import React from 'react';
import { Navigate } from 'react-router-dom';
import { useAuthState, getUserRole } from '../utils/auth';

interface PublicOnlyRouteProps {
  children: React.ReactNode;
}

export default function PublicOnlyRoute({ children }: PublicOnlyRouteProps) {
  const authed = useAuthState();

  // If user is returning from OAuth callback code exchange, allow them to view the page to complete exchange
  const hasOAuthCode = typeof window !== 'undefined' && new URLSearchParams(window.location.search).has('code');

  if (authed && !hasOAuthCode) {
    const role = getUserRole();
    if (role === 'admin') {
      return <Navigate to="/admin/dashboard" replace />;
    }
    return <Navigate to="/dashboard" replace />;
  }

  return <>{children}</>;
}
