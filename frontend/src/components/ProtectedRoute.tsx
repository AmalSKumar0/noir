import React from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuthState, getUserRole, getRoleHomePath } from '../utils/auth';

interface ProtectedRouteProps {
  children: React.ReactNode;
  adminOnly?: boolean;
  companyOnly?: boolean;
  developerOnly?: boolean;
  allowPendingCompany?: boolean;
}

export default function ProtectedRoute({
  children,
  adminOnly = false,
  companyOnly = false,
  developerOnly = false,
  allowPendingCompany = false,
}: ProtectedRouteProps) {
  const authed = useAuthState();
  const location = useLocation();
  const role = getUserRole();

  if (!authed) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  const roleHome = getRoleHomePath(role);

  // 1. Strict status check for company accounts (pending/rejected must stay on status page)
  if (role === 'company') {
    if (!allowPendingCompany && roleHome === '/company/status' && location.pathname !== '/company/status') {
      return <Navigate to="/company/status" replace />;
    }
  }

  // 2. Explicit role restriction props
  if (adminOnly && role !== 'admin') {
    return <Navigate to={roleHome} replace />;
  }

  if (companyOnly && role !== 'company') {
    return <Navigate to={roleHome} replace />;
  }

  if (developerOnly && role !== 'developer' && role !== null && role !== '') {
    if (role === 'company' || role === 'admin') {
      return <Navigate to={roleHome} replace />;
    }
  }

  // 3. Strict URL path isolation per role
  const path = location.pathname;

  // Company users accessing developer routes
  if (role === 'company' && (path.startsWith('/dashboard') || path.startsWith('/organization') || (path.startsWith('/quickstart') && path !== '/company/quickstart'))) {
    return <Navigate to={roleHome} replace />;
  }

  // Admin users accessing developer or company routes
  if (role === 'admin' && (path.startsWith('/dashboard') || path.startsWith('/company') || path.startsWith('/organization') || path.startsWith('/quickstart'))) {
    return <Navigate to={roleHome} replace />;
  }

  // Non-company users accessing company routes (excluding profile redirect)
  if (role !== 'company' && path.startsWith('/company') && path !== '/company/profile') {
    return <Navigate to={roleHome} replace />;
  }

  // Non-admin users accessing admin routes
  if (role !== 'admin' && path.startsWith('/admin')) {
    return <Navigate to={roleHome} replace />;
  }

  return <>{children}</>;
}

