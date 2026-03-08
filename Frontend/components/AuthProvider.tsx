// =====================================================
// Auth Provider - Smart Maize Farming System
// Integrated Clerk authentication with API and WebSocket
// =====================================================

import React, { useEffect, useCallback, createContext, useContext } from 'react';
import { useAuth, useUser } from '@clerk/clerk-react';
import { configureAuth } from '../services/apiClient';
import { setAuthToken } from '../services/api';
import wsManager from '../services/websocket';
import { useAuthStore } from '../store';

// =====================================================
// Types
// =====================================================

interface AuthContextValue {
  isAuthenticated: boolean;
  isLoading: boolean;
  userId: string | null;
  userRole: 'farmer' | 'expert' | 'admin' | null;
  user: {
    id: string;
    email: string | null;
    firstName: string | null;
    lastName: string | null;
    imageUrl: string | null;
    phone: string | null;
  } | null;
  getToken: () => Promise<string | null>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

// =====================================================
// Auth Provider Component
// =====================================================

interface AuthProviderProps {
  children: React.ReactNode;
}

export function AuthProvider({ children }: AuthProviderProps) {
  const { isSignedIn, isLoaded, getToken, signOut, userId } = useAuth();
  const { user: clerkUser } = useUser();
  const { setUser, setToken, clearAuth, user: storedUser } = useAuthStore();

  // Configure API client with token getter
  useEffect(() => {
    configureAuth(
      async () => {
        if (!isSignedIn) return null;
        try {
          const token = await getToken();
          return token;
        } catch (error) {
          console.error('Failed to get token:', error);
          return null;
        }
      },
      async () => {
        // Token refresh - Clerk handles this automatically
        if (!isSignedIn) return null;
        try {
          const token = await getToken({ skipCache: true });
          return token;
        } catch (error) {
          console.error('Failed to refresh token:', error);
          return null;
        }
      }
    );
  }, [isSignedIn, getToken]);

  // Sync Clerk auth state with app store
  useEffect(() => {
    const syncAuthState = async () => {
      if (isSignedIn && clerkUser) {
        try {
          // Get fresh token
          const token = await getToken();
          
          if (token) {
            // Store token
            setToken(token);
            setAuthToken(token);

            // Extract user role from metadata (set in Clerk Dashboard or via API)
            const roleFromMetadata = (clerkUser.publicMetadata?.role as string) || 'farmer';
            const role: 'farmer' | 'expert' | 'admin' =
              roleFromMetadata === 'admin' || roleFromMetadata === 'expert' || roleFromMetadata === 'farmer'
                ? roleFromMetadata
                : 'farmer';

            // Update user in store
            setUser({
              id: clerkUser.id,
              clerkId: clerkUser.id,
              email: clerkUser.primaryEmailAddress?.emailAddress || '',
              firstName: clerkUser.firstName || '',
              lastName: clerkUser.lastName || '',
              phoneNumber: clerkUser.primaryPhoneNumber?.phoneNumber || '',
              profileImageUrl: clerkUser.imageUrl || '',
              role,
              preferredLanguage: 'en',
              isActive: true,
              isVerified: clerkUser.primaryEmailAddress?.verification?.status === 'verified',
              createdAt: new Date().toISOString(),
              updatedAt: new Date().toISOString(),
            });

            // Connect WebSocket
            wsManager.connect(token, clerkUser.id, role);
          }
        } catch (error) {
          console.error('Error syncing auth state:', error);
        }
      } else if (!isSignedIn && isLoaded) {
        // User signed out
        clearAuth();
        setAuthToken(null);
        wsManager.disconnect();
      }
    };

    syncAuthState();
  }, [isSignedIn, isLoaded, clerkUser, getToken, setUser, setToken, clearAuth]);

  // Listen for auth:logout events (triggered by API client on 401)
  useEffect(() => {
    const handleLogout = async (event: Event) => {
      const customEvent = event as CustomEvent<{ reason?: string }>;
      console.log('Auth logout triggered:', customEvent.detail);
      await signOut();
    };

    window.addEventListener('auth:logout', handleLogout);
    return () => {
      window.removeEventListener('auth:logout', handleLogout);
    };
  }, [signOut]);

  // Build context value
  const getTokenWrapper = useCallback(async () => {
    if (!isSignedIn) return null;
    return getToken();
  }, [isSignedIn, getToken]);

  const signOutWrapper = useCallback(async () => {
    clearAuth();
    setAuthToken(null);
    wsManager.disconnect();
    await signOut();
  }, [signOut, clearAuth]);

  const value: AuthContextValue = {
    isAuthenticated: isSignedIn ?? false,
    isLoading: !isLoaded,
    userId: userId || null,
    userRole: (storedUser?.role as 'farmer' | 'expert' | 'admin') || null,
    user: clerkUser
      ? {
          id: clerkUser.id,
          email: clerkUser.primaryEmailAddress?.emailAddress || null,
          firstName: clerkUser.firstName,
          lastName: clerkUser.lastName,
          imageUrl: clerkUser.imageUrl,
          phone: clerkUser.primaryPhoneNumber?.phoneNumber || null,
        }
      : null,
    getToken: getTokenWrapper,
    signOut: signOutWrapper,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

// =====================================================
// Auth Hook
// =====================================================

export function useAuthContext() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuthContext must be used within an AuthProvider');
  }
  return context;
}

// =====================================================
// Protected Route Component
// =====================================================

interface ProtectedRouteProps {
  children: React.ReactNode;
  allowedRoles?: ('farmer' | 'expert' | 'admin')[];
  fallback?: React.ReactNode;
  redirectTo?: string;
}

export function ProtectedRoute({
  children,
  allowedRoles,
  fallback,
  redirectTo = '/login',
}: ProtectedRouteProps) {
  const { isAuthenticated, isLoading, userRole } = useAuthContext();

  // Show loading state
  if (isLoading) {
    return fallback || <DefaultLoadingFallback />;
  }

  // Not authenticated - redirect to login
  if (!isAuthenticated) {
    window.location.href = redirectTo;
    return null;
  }

  // Check role if specified
  if (allowedRoles && userRole && !allowedRoles.includes(userRole)) {
    return <UnauthorizedFallback />;
  }

  return <>{children}</>;
}

// =====================================================
// Role-Based Access Control Hook
// =====================================================

export function useRoleAccess() {
  const { userRole, isAuthenticated } = useAuthContext();

  const hasRole = useCallback(
    (roles: ('farmer' | 'expert' | 'admin')[]): boolean => {
      if (!isAuthenticated || !userRole) return false;
      return roles.includes(userRole);
    },
    [isAuthenticated, userRole]
  );

  const isFarmer = userRole === 'farmer';
  const isExpert = userRole === 'expert';
  const isAdmin = userRole === 'admin';
  const isExpertOrAdmin = isExpert || isAdmin;

  return {
    userRole,
    hasRole,
    isFarmer,
    isExpert,
    isAdmin,
    isExpertOrAdmin,
  };
}

// =====================================================
// Fallback Components
// =====================================================

function DefaultLoadingFallback() {
  return (
    <div className="flex items-center justify-center min-h-screen bg-slate-50 dark:bg-slate-900">
      <div className="flex flex-col items-center gap-4">
        <div className="w-12 h-12 border-4 border-green-500 border-t-transparent rounded-full animate-spin" />
        <p className="text-slate-600 dark:text-slate-400">Loading...</p>
      </div>
    </div>
  );
}

function UnauthorizedFallback() {
  return (
    <div className="flex items-center justify-center min-h-screen bg-slate-50 dark:bg-slate-900">
      <div className="text-center">
        <h1 className="text-4xl font-bold text-slate-900 dark:text-white mb-4">
          Access Denied
        </h1>
        <p className="text-slate-600 dark:text-slate-400 mb-6">
          You don't have permission to access this page.
        </p>
        <a
          href="/"
          className="inline-flex items-center px-6 py-3 bg-green-600 text-white font-semibold rounded-xl hover:bg-green-700 transition-colors"
        >
          Go to Dashboard
        </a>
      </div>
    </div>
  );
}

export default AuthProvider;
