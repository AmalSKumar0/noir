import React from 'react';
import { Navigate } from 'react-router-dom';
import { useAuthState, getUserRole, getRoleHomePath } from '../utils/auth';

interface PublicOnlyRouteProps {
  children: React.ReactNode;
}

export default function PublicOnlyRoute({ children }: PublicOnlyRouteProps) {
  const authed = useAuthState();

  // If user is returning from OAuth callback code exchange, allow them to view the page to complete exchange
  const hasOAuthCode = typeof window !== 'undefined' && new URLSearchParams(window.location.search).has('code');

  if (authed && !hasOAuthCode) {
    const role = getUserRole();
    return <Navigate to={getRoleHomePath(role)} replace />;
  }

  return <>{children}</>;
}

