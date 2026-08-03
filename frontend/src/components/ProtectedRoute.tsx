import React from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuthState, getUserRole } from '../utils/auth';

interface ProtectedRouteProps {
  children: React.ReactNode;
  adminOnly?: boolean;
}

export default function ProtectedRoute({ children, adminOnly = false }: ProtectedRouteProps) {
  const authed = useAuthState();
  const location = useLocation();
  const role = getUserRole();

  if (!authed) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  if (adminOnly && role !== 'admin') {
    return <Navigate to="/dashboard" replace />;
  }

  return <>{children}</>;
}
