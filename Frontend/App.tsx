import React, { useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate, useNavigate, useLocation } from 'react-router-dom';
import { ClerkProvider, SignIn, SignUp as ClerkSignUp, SignedIn, SignedOut, useAuth, useUser } from '@clerk/clerk-react';
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

// Store & Hooks
import { useAppStore, useAuthStore, useNotificationStore } from './store';
import { setAuthToken } from './services/api';
import { authService } from './services/auth';
import { configureAuth } from './services/apiClient';
import { queryClient } from './config/queryClient';
import { wsManager as webSocketManager } from './services/websocket';
import { UserRole } from './types';

// Get Clerk publishable key from environment
const clerkPubKey = import.meta.env.VITE_CLERK_PUBLISHABLE_KEY;

// Protected Route Component
function ProtectedRoute({ children, allowedRoles }: { children: React.ReactNode; allowedRoles?: UserRole[] }) {
  const { isSignedIn, isLoaded } = useAuth();
  const { user } = useAuthStore();

  if (!isLoaded) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="animate-spin rounded-full h-12 w-12 border-4 border-primary border-t-transparent"></div>
      </div>
    );
  }

  if (!isSignedIn) {
    return <Navigate to="/login" replace />;
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

  useEffect(() => {
    // Configure the API client with Clerk's getToken function
    configureAuth(getToken, getToken);
  }, [getToken]);

  useEffect(() => {
    const syncUser = async () => {
      if (!isLoaded) return;

      if (isSignedIn && clerkUser) {
        try {
          setLoading(true);
          
          // Get Clerk session token
          const token = await getToken();
          if (token) {
            setAuthToken(token);
            setToken(token);
            
            // Connect WebSocket with auth token
            webSocketManager.connect(token);
          }

          // Sync user with backend
          const response = await authService.syncUser();
          setUser(response.data);
        } catch (error) {
          console.error('Failed to sync user:', error);
          // If sync fails, create a basic user object from Clerk data
          setUser({
            id: clerkUser.id,
            clerkId: clerkUser.id,
            email: clerkUser.primaryEmailAddress?.emailAddress,
            phoneNumber: clerkUser.primaryPhoneNumber?.phoneNumber,
            firstName: clerkUser.firstName || undefined,
            lastName: clerkUser.lastName || undefined,
            role: 'farmer', // Default role
            preferredLanguage: 'en',
            profileImageUrl: clerkUser.imageUrl,
            isActive: true,
            isVerified: clerkUser.primaryEmailAddress?.verification?.status === 'verified',
            createdAt: clerkUser.createdAt?.toISOString() || new Date().toISOString(),
            updatedAt: clerkUser.updatedAt?.toISOString() || new Date().toISOString(),
          });
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

// Main App Routes
function AppRoutes() {
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

  const handleLogin = (role: UserRole) => {
    navigate('/dashboard');
  };

  const handleLogout = () => {
    navigate('/');
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

          {/* Auth Routes - Use custom components that wrap Clerk */}
          <Route path="/login" element={
            <SignedOut>
              <Login onLogin={handleLogin} onNavigate={handleNavigate} language={language} />
            </SignedOut>
          } />
          <Route path="/signup" element={
            <SignedOut>
              <SignUp onLogin={handleLogin} onNavigate={handleNavigate} language={language} />
            </SignedOut>
          } />

          {/* Clerk's built-in sign-in/up pages (fallback) */}
          <Route path="/sign-in/*" element={
            <SignedOut>
              <div className="min-h-screen flex items-center justify-center bg-background">
                <SignIn routing="path" path="/sign-in" afterSignInUrl="/dashboard" />
              </div>
            </SignedOut>
          } />
          <Route path="/sign-up/*" element={
            <SignedOut>
              <div className="min-h-screen flex items-center justify-center bg-background">
                <ClerkSignUp routing="path" path="/sign-up" afterSignUpUrl="/dashboard" />
              </div>
            </SignedOut>
          } />

          {/* Protected Routes */}
          <Route path="/dashboard/*" element={
            <ProtectedRoute>
              <Dashboard 
                userRole={user?.role || 'farmer'} 
                onLogout={handleLogout} 
                language={language} 
                setLanguage={setLanguage}
                theme={theme}
                toggleTheme={toggleTheme}
              />
            </ProtectedRoute>
          } />

          {/* Redirect for signed in users trying to access auth pages */}
          <Route path="/login" element={
            <SignedIn>
              <Navigate to="/dashboard" replace />
            </SignedIn>
          } />
          <Route path="/signup" element={
            <SignedIn>
              <Navigate to="/dashboard" replace />
            </SignedIn>
          } />

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
            <AppRoutes />
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
            <AppRoutes />
          </Router>
          <Toaster position="top-right" />
        </ThemeProvider>
      </QueryClientProvider>
    </ClerkProvider>
  );
}

export default App;