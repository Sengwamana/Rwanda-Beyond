import React, { useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate, useNavigate, useLocation } from 'react-router-dom';
import { ClerkProvider, RedirectToSignIn, SignedIn, SignedOut, SignUp as ClerkSignUp, useAuth, useUser } from '@clerk/clerk-react';
import { QueryClientProvider } from '@tanstack/react-query';
import { Toaster, toast } from 'react-hot-toast';

// Components
import { LandingPage } from './components/LandingPage';
import { Dashboard } from './components/Dashboard';
import { About } from './components/About';
import { Features } from './components/Features';
import { Pricing } from './components/Pricing';
import { Login } from './components/Login';
import { SignUp } from './components/SignUp';
import { VoiceAssistant } from './components/VoiceAssistant';
import { Consultation } from './components/Consultation';
import { Resources } from './components/Resources';
import { Legal } from './components/Legal';
import { Careers } from './components/Careers';
import { FAQ } from './components/FAQ';
import { Footer } from './components/Footer';
import { Navbar } from './components/Navbar';
import { FullPageLoading } from './components/ui/Spinner';

// Store & Hooks
import { useAppStore, useAuthStore, useNotificationStore } from './store';
import { setAuthToken, configureApiAuth } from './services/api';
import { authService } from './services/auth';
import { configureAuth } from './services/apiClient';
import { queryClient } from './config/queryClient';
import { wsManager as webSocketManager } from './services/websocket';
import { Language, UserRole } from './types';

// Get Clerk publishable key from environment
const clerkPubKey = import.meta.env.VITE_CLERK_PUBLISHABLE_KEY;

function resolvePreferredRole(clerkUser: any, fallbackRole?: UserRole | null): UserRole {
  const metadataRole = clerkUser?.publicMetadata?.role ?? clerkUser?.unsafeMetadata?.role;
  const sessionRole = authService.getPreferredRole();
  const candidate = fallbackRole ?? metadataRole ?? sessionRole ?? 'farmer';
  return candidate === 'admin' || candidate === 'expert' || candidate === 'farmer'
    ? candidate
    : 'farmer';
}

// Protected Route Component
function ProtectedRoute({ children, allowedRoles }: { children: React.ReactNode; allowedRoles?: UserRole[] }) {
  const { isSignedIn, isLoaded } = useAuth();
  const { user, isLoading } = useAuthStore();

  if (!isLoaded || isLoading) {
    return <FullPageLoading text="Loading dashboard..." />;
  }

  if (!isSignedIn || !user) {
    if (!isSignedIn) {
      return <Navigate to="/login" replace />;
    }

    return (
      <FullPageLoading text="Preparing your account..." />
    );
  }

  if (allowedRoles && user && !allowedRoles.includes(user.role)) {
    return <Navigate to="/dashboard" replace />;
  }

  return <>{children}</>;
}

// Auth Sync Component - Syncs Clerk user with backend
function AuthSync() {
  const { isSignedIn, getToken } = useAuth();
  const { user: clerkUser, isLoaded } = useUser();
  const { setUser, setLoading, setError, setToken } = useAuthStore();

  const buildFallbackUser = (clerk: any, role: UserRole) => ({
    id: clerk.id,
    clerkId: clerk.id,
    email: clerk.primaryEmailAddress?.emailAddress || undefined,
    phoneNumber: clerk.primaryPhoneNumber?.phoneNumber || undefined,
    firstName: clerk.firstName || undefined,
    lastName: clerk.lastName || undefined,
    role,
    preferredLanguage: 'en' as const,
    profileImageUrl: clerk.imageUrl || undefined,
    isActive: true,
    isVerified: clerk.primaryEmailAddress?.verification?.status === 'verified',
    createdAt: clerk.createdAt?.toISOString() || new Date().toISOString(),
    updatedAt: clerk.updatedAt?.toISOString() || new Date().toISOString(),
  });

  useEffect(() => {
    // Configure the API client with Clerk's getToken function
    configureAuth(getToken, getToken);
    configureApiAuth(
      async () => await getToken(),
      async () => await getToken({ skipCache: true })
    );
  }, [getToken]);

  useEffect(() => {
    const syncUser = async () => {
      if (!isLoaded) return;

      if (isSignedIn && clerkUser) {
        let token: string | null = null;

        try {
          setLoading(true);
          
          // Get Clerk session token
          for (let attempt = 0; attempt < 3 && !token; attempt += 1) {
            token = await getToken();
            if (!token) {
              await new Promise((resolve) => setTimeout(resolve, 200));
            }
          }
          if (!token) {
            throw new Error('No Clerk token available');
          }
          setAuthToken(token);
          setToken(token);

          // Sync user with backend
          const response = await authService.syncUser();
          const syncedUser = response.data;
          const preferredRole = resolvePreferredRole(clerkUser, syncedUser?.role);
          const mergedUser = { ...syncedUser, role: preferredRole };
          setUser(mergedUser);
          setError(null);
          authService.clearPreferredRole();

          webSocketManager.connect(token, clerkUser.id, mergedUser?.role || 'farmer');
        } catch (error) {
          console.error('Failed to sync user:', error);
          const status = (error as any)?.response?.status;
          const isTokenError = (error as Error)?.message?.includes('No Clerk token available');

          const fallbackRole = resolvePreferredRole(clerkUser);
          setUser(buildFallbackUser(clerkUser, fallbackRole));

          if (isTokenError) {
            setError('Signed in, but auth token is not ready. Dashboard is available in limited mode.');
          } else if (status === 401 || status === 403) {
            setError('Backend auth rejected the session token. Dashboard is available in limited mode.');
          } else if (status === 503) {
            setError('Backend database is unavailable. Start Convex or connect the backend to a live Convex deployment.');
          } else {
            setError('Connected with limited backend data. Some dashboard features may be unavailable.');
          }

          if (token) {
            webSocketManager.connect(token, clerkUser.id, fallbackRole);
          }
        }
      } else {
        setUser(null);
        setAuthToken(null);
        setToken(null);
        webSocketManager.disconnect();
      }
    };

    syncUser();
  }, [isSignedIn, clerkUser, isLoaded, getToken, setUser, setLoading, setError, setToken]);

  return null;
}

// Notification Handler Component
function NotificationHandler() {
  const { notifications, removeNotification } = useNotificationStore();

  useEffect(() => {
    notifications.forEach((notification) => {
      const toastFn = notification.type === 'success' ? toast.success
        : notification.type === 'error' ? toast.error
        : toast;

      toastFn(notification.message || notification.title, {
        id: notification.id,
        duration: notification.duration || 4000,
      });

      // Auto remove after showing
      setTimeout(() => {
        removeNotification(notification.id);
      }, notification.duration || 4000);
    });
  }, [notifications, removeNotification]);

  return null;
}

// Theme Provider Component
function ThemeProvider({ children }: { children: React.ReactNode }) {
  const { theme } = useAppStore();

  useEffect(() => {
    const root = window.document.documentElement;
    if (theme === 'dark') {
      root.classList.add('dark');
    } else {
      root.classList.remove('dark');
    }
  }, [theme]);

  return <>{children}</>;
}

function AuthenticatedDashboard({
  userRole,
  language,
  setLanguage,
  theme,
  toggleTheme,
}: {
  userRole: UserRole;
  language: Language;
  setLanguage: (language: Language) => void;
  theme: 'light' | 'dark';
  toggleTheme: () => void;
}) {
  const navigate = useNavigate();
  const { signOut } = useAuth();
  const { setUser, setToken } = useAuthStore();

  const handleLogout = async () => {
    authService.clearPreferredRole();

    try {
      await signOut();
    } catch (error) {
      console.error('Failed to sign out from Clerk:', error);
    } finally {
      setUser(null);
      setToken(null);
      setAuthToken(null);
      webSocketManager.disconnect();
      navigate('/', { replace: true });
    }
  };

  return (
    <Dashboard
      userRole={userRole}
      onLogout={handleLogout}
      language={language}
      setLanguage={setLanguage}
      theme={theme}
      toggleTheme={toggleTheme}
    />
  );
}

// Main App Routes
function AppRoutes({ authEnabled }: { authEnabled: boolean }) {
  const navigate = useNavigate();
  const location = useLocation();
  const { language, theme, toggleTheme, setLanguage } = useAppStore();
  const { user } = useAuthStore();

  // Helper to convert old view-based navigation
  const handleNavigate = (page: string) => {
    const routes: Record<string, string> = {
      'landing': '/',
      'login': '/login',
      'signup': '/signup',
      'dashboard': '/dashboard',
      'about': '/about',
      'features': '/features',
      'pricing': '/pricing',
      'resources': '/resources',
      'consultation': '/consultation',
      'privacy': '/privacy',
      'terms': '/terms',
      'careers': '/careers',
      'faq': '/faq',
    };
    navigate(routes[page] || '/');
  };

  const handleLogin = (_role: UserRole) => {
    navigate(authEnabled ? '/login' : '/');
  };

  // Determine if navbar/footer should show
  const hideNavbarPaths = ['/dashboard', '/login', '/signup', '/sign-in', '/sign-up'];
  const hideFooterPaths = ['/dashboard'];
  const showNavbar = !hideNavbarPaths.some(path => location.pathname.startsWith(path));
  const showFooter = !hideFooterPaths.some(path => location.pathname.startsWith(path));

  return (
    <div className="min-h-screen bg-background font-sans text-foreground selection:bg-primary selection:text-primary-foreground flex flex-col transition-colors duration-300">
      {/* Navbar */}
      {showNavbar && (
        <Navbar 
          onNavigate={handleNavigate} 
          language={language} 
          setLanguage={setLanguage}
          theme={theme}
          toggleTheme={toggleTheme}
          currentPath={location.pathname}
        />
      )}

      {/* Main Content */}
      <main className={`flex-1 ${showNavbar ? 'pt-0' : ''}`}>
        <Routes>
          {/* Public Routes */}
          <Route path="/" element={<LandingPage onLogin={handleLogin} onNavigate={handleNavigate} language={language} />} />
          <Route path="/about" element={<About />} />
          <Route path="/features" element={<Features />} />
          <Route path="/pricing" element={<Pricing />} />
          <Route path="/resources" element={<Resources language={language} />} />
          <Route path="/consultation" element={<Consultation language={language} />} />
          <Route path="/privacy" element={<Legal type="privacy" language={language} />} />
          <Route path="/terms" element={<Legal type="terms" language={language} />} />
          <Route path="/careers" element={<Careers language={language} />} />
          <Route path="/faq" element={<FAQ language={language} />} />

          {authEnabled ? (
            <>
              {/* Auth Routes - Use custom components that wrap Clerk */}
              <Route
                path="/login"
                element={
                  <>
                    <SignedIn>
                      {user ? (
                        <Navigate to="/dashboard" replace />
                      ) : (
                        <FullPageLoading text="Preparing your account..." />
                      )}
                    </SignedIn>
                    <SignedOut>
                      <Login onNavigate={handleNavigate} language={language} />
                    </SignedOut>
                  </>
                }
              />
              <Route
                path="/signup"
                element={
                  <>
                    <SignedIn>
                      {user ? (
                        <Navigate to="/dashboard" replace />
                      ) : (
                        <FullPageLoading text="Preparing your account..." />
                      )}
                    </SignedIn>
                    <SignedOut>
                      <SignUp onNavigate={handleNavigate} language={language} />
                    </SignedOut>
                  </>
                }
              />

              <Route
                path="/sign-in/*"
                element={
                  <>
                    <SignedIn>
                      <Navigate to="/dashboard" replace />
                    </SignedIn>
                    <SignedOut>
                      <RedirectToSignIn />
                    </SignedOut>
                  </>
                }
              />
              <Route
                path="/sign-up/*"
                element={
                  <>
                    <SignedIn>
                      <Navigate to="/dashboard" replace />
                    </SignedIn>
                    <SignedOut>
                      <ClerkSignUp
                        routing="path"
                        path="/sign-up"
                        fallbackRedirectUrl="/dashboard"
                        signInUrl="/sign-in"
                      />
                    </SignedOut>
                  </>
                }
              />

              {/* Protected Routes */}
              <Route path="/dashboard/*" element={
                <ProtectedRoute>
                  <AuthenticatedDashboard
                    userRole={user?.role || 'farmer'}
                    language={language}
                    setLanguage={setLanguage}
                    theme={theme}
                    toggleTheme={toggleTheme}
                  />
                </ProtectedRoute>
              } />
            </>
          ) : (
            <>
              <Route path="/login" element={<Navigate to="/" replace />} />
              <Route path="/signup" element={<Navigate to="/" replace />} />
              <Route path="/sign-in/*" element={<Navigate to="/" replace />} />
              <Route path="/sign-up/*" element={<Navigate to="/" replace />} />
              <Route path="/dashboard/*" element={<Navigate to="/" replace />} />
            </>
          )}

          {/* Catch all - redirect to home */}
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </main>

      {/* Footer */}
      {showFooter && <Footer onNavigate={handleNavigate} />}

      {/* Voice Assistant FAB */}
      <VoiceAssistant />
    </div>
  );
}

// Main App Component
function App() {
  // If no Clerk key is provided, render app without Clerk (for development)
  if (!clerkPubKey) {
    console.warn('No Clerk publishable key found. Running in development mode without authentication.');
    return (
      <QueryClientProvider client={queryClient}>
        <ThemeProvider>
          <Router future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
            <NotificationHandler />
            <AppRoutes authEnabled={false} />
          </Router>
          <Toaster position="top-right" />
        </ThemeProvider>
      </QueryClientProvider>
    );
  }

  return (
    <ClerkProvider publishableKey={clerkPubKey}>
      <QueryClientProvider client={queryClient}>
        <ThemeProvider>
          <Router future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
            <AuthSync />
            <NotificationHandler />
            <AppRoutes authEnabled={true} />
          </Router>
          <Toaster position="top-right" />
        </ThemeProvider>
      </QueryClientProvider>
    </ClerkProvider>
  );
}

export default App;
