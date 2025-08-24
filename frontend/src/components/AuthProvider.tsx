import React, { useEffect } from 'react';
import { useCurrentUser } from '../hooks/useAuth';
import { useAuthStore } from '../stores/useAuthStore';
import Cookies from 'js-cookie';

interface AuthProviderProps {
  children: React.ReactNode;
}

export const AuthProvider: React.FC<AuthProviderProps> = ({ children }) => {
  const { data: user, isLoading, error } = useCurrentUser();
  const { setUser, logout, isAuthenticated } = useAuthStore();

  useEffect(() => {
    // Check if we have a token but no user data
    const token = Cookies.get('access_token');
    const storedUser = localStorage.getItem('user');

    if (token && !user && !isLoading) {
      // Token exists but no valid user - clear everything
      logout();
      localStorage.removeItem('user');
      localStorage.removeItem('token');
    } else if (!token && (storedUser || isAuthenticated)) {
      // No token but user data exists - clear everything
      logout();
      localStorage.removeItem('user');
      localStorage.removeItem('token');
    } else if (user) {
      // Valid user data - update store
      setUser(user);
    }
  }, [user, isLoading, error, setUser, logout, isAuthenticated]);

  // Show loading state while checking authentication
  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-gray-900"></div>
      </div>
    );
  }

  return <>{children}</>;
};

