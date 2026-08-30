import React from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuthState, getUserRole } from '../utils/auth';

interface ProtectedRouteProps {
  children: React.ReactNode;
  adminOnly?: boolean;
  companyOnly?: boolean;
  allowPendingCompany?: boolean;
}

export default function ProtectedRoute({
  children,
  adminOnly = false,
  companyOnly = false,
  allowPendingCompany = false,
}: ProtectedRouteProps) {
  const authed = useAuthState();
  const location = useLocation();
  const role = getUserRole();

  if (!authed) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  if (adminOnly && role !== 'admin') {
    return <Navigate to="/dashboard" replace />;
  }

  if (companyOnly && role !== 'company') {
    return <Navigate to="/dashboard" replace />;
  }

  // If user is a company user attempting to access dashboard, check status
  if (role === 'company' && !allowPendingCompany) {
    const storedUser = localStorage.getItem('user');
    if (storedUser) {
      try {
        const parsed = JSON.parse(storedUser);
        const status = parsed.company_profile?.status;
        if (status === 'pending' || status === 'rejected') {
          return <Navigate to="/company/status" replace />;
        }
      } catch (e) {
        console.error(e);
      }
    }
  }

  return <>{children}</>;
}
