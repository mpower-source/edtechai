import React from 'react';
import { useAuth } from './AuthProvider';

export const ProtectedRoute: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user, loading } = useAuth();

  if (loading) return <div className="p-4">Checking session…</div>;
  if (!user) {
    return (
      <div className="p-6 space-y-4">
        <h1 className="text-xl font-semibold">Sign in required</h1>
        <p>Please sign in to access this page.</p>
        <a className="text-primary underline" href="/auth">Go to Sign In</a>
      </div>
    );
  }

  return <>{children}</>;
};
