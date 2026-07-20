import React from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuthState } from '../utils/auth';

interface ProtectedRouteProps {
  children: React.ReactNode;
}

export default function ProtectedRoute({ children }: ProtectedRouteProps) {
  const authed = useAuthState();
  const location = useLocation();

  if (!authed) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  return <>{children}</>;
}
