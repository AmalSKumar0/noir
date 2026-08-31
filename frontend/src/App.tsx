import { useState, useEffect } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import Lenis from 'lenis';
import { BrowserRouter, Routes, Route, useLocation, Navigate } from 'react-router-dom';
import Home from './pages/Home';
import Login from './pages/Login';
import Register from './pages/Register';
import CompanyRegister from './pages/CompanyRegister';
import CompanyDashboard from './pages/CompanyDashboard';
import CompanyStatus from './pages/CompanyStatus';
import CompanyProjects from './pages/CompanyProjects';
import CompanyProjectDetail from './pages/CompanyProjectDetail';
import CompanyDevelopers from './pages/CompanyDevelopers';
import Logout from './pages/Logout';
import Contact from './pages/Contact';
import Dashboard from './pages/Dashboard';
import UserProjects from './pages/UserProjects';
import ProjectDetail from './pages/ProjectDetail';
import ProjectAnalyticsPage from './pages/ProjectAnalyticsPage';
import OrganizationProfile from './pages/OrganizationProfile';
import UserProfile from './pages/UserProfile';
import QuickstartPage from './pages/QuickstartPage';
import AdminDashboard from './pages/AdminDashboard';
import AdminManageProjects from './pages/AdminManageProjects';
import AdminManageUsers from './pages/AdminManageUsers';
import AdminManageCompanies from './pages/AdminManageCompanies';

import AuthCallback from './pages/AuthCallback';
import Loader from './components/Loader';
import ProtectedRoute from './components/ProtectedRoute';
import PublicOnlyRoute from './components/PublicOnlyRoute';
import { checkAndRefreshToken } from './utils/auth';

const pageTransition = { 
  duration: 0.16,
  ease: [0.25, 0.1, 0.25, 1.0]
};

function AnimatedRoutes() {
  const location = useLocation();
  
  return (
    <AnimatePresence mode="wait">
      {/* @ts-expect-error react-router-dom types issue with React 19 */}
      <Routes location={location} key={location.pathname}>
        <Route 
          path="/" 
          element={
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={pageTransition}
            >
              <Home />
            </motion.div>
          } 
        />
        <Route 
          path="/login" 
          element={
            <PublicOnlyRoute>
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={pageTransition}
              >
                <Login />
              </motion.div>
            </PublicOnlyRoute>
          } 
        />
        <Route 
          path="/register" 
          element={
            <PublicOnlyRoute>
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={pageTransition}
              >
                <Register />
              </motion.div>
            </PublicOnlyRoute>
          } 
        />
        <Route 
          path="/register/company" 
          element={
            <PublicOnlyRoute>
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={pageTransition}
              >
                <CompanyRegister />
              </motion.div>
            </PublicOnlyRoute>
          } 
        />
        <Route 
          path="/join-company" 
          element={
            <PublicOnlyRoute>
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={pageTransition}
              >
                <CompanyRegister />
              </motion.div>
            </PublicOnlyRoute>
          } 
        />
        <Route 
          path="/company/dashboard" 
          element={
            <ProtectedRoute companyOnly>
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={pageTransition}
              >
                <CompanyDashboard />
              </motion.div>
            </ProtectedRoute>
          } 
        />
        <Route 
          path="/company/projects" 
          element={
            <ProtectedRoute companyOnly>
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={pageTransition}
              >
                <CompanyProjects />
              </motion.div>
            </ProtectedRoute>
          } 
        />
        <Route 
          path="/company/projects/:projectId" 
          element={
            <ProtectedRoute companyOnly>
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={pageTransition}
              >
                <CompanyProjectDetail />
              </motion.div>
            </ProtectedRoute>
          } 
        />
        <Route 
          path="/company/projects/:projectId/analytics" 
          element={
            <ProtectedRoute companyOnly>
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={pageTransition}
              >
                <ProjectAnalyticsPage isCompanyView />
              </motion.div>
            </ProtectedRoute>
          } 
        />
        <Route 
          path="/company/developers" 
          element={
            <ProtectedRoute companyOnly>
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={pageTransition}
              >
                <CompanyDevelopers />
              </motion.div>
            </ProtectedRoute>
          } 
        />
        <Route 
          path="/company/status" 
          element={
            <ProtectedRoute allowPendingCompany>
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={pageTransition}
              >
                <CompanyStatus />
              </motion.div>
            </ProtectedRoute>
          } 
        />
        <Route 
          path="/logout" 
          element={
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={pageTransition}
            >
              <Logout />
            </motion.div>
          } 
        />
        <Route 
          path="/contact" 
          element={
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={pageTransition}
            >
              <Contact />
            </motion.div>
          } 
        />
        <Route 
          path="/contact/" 
          element={
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={pageTransition}
            >
              <Contact />
            </motion.div>
          } 
        />


    
        <Route 
          path="/auth/callback" 
          element={
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={pageTransition}
            >
              <AuthCallback />
            </motion.div>
          } 
        />
        
        <Route 
          path="/dashboard" 
          element={
            <ProtectedRoute>
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={pageTransition}
              >
                <Dashboard />
              </motion.div>
            </ProtectedRoute>
          } 
        />
        <Route 
          path="/dashboard/projects" 
          element={
            <ProtectedRoute>
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={pageTransition}
              >
                <UserProjects />
              </motion.div>
            </ProtectedRoute>
          } 
        />
        <Route 
          path="/organization" 
          element={
            <ProtectedRoute>
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={pageTransition}
              >
                <OrganizationProfile />
              </motion.div>
            </ProtectedRoute>
          } 
        />
        <Route 
          path="/profile" 
          element={
            <ProtectedRoute>
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={pageTransition}
              >
                <UserProfile />
              </motion.div>
            </ProtectedRoute>
          } 
        />
        <Route path="/company/profile" element={<Navigate to="/profile" replace />} />
        <Route path="/dashboard/profile" element={<Navigate to="/profile" replace />} />
        <Route 
          path="/quickstart" 
          element={
            <ProtectedRoute>
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={pageTransition}
              >
                <QuickstartPage />
              </motion.div>
            </ProtectedRoute>
          } 
        />
        <Route 
          path="/dashboard/quickstart" 
          element={
            <ProtectedRoute>
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={pageTransition}
              >
                <QuickstartPage />
              </motion.div>
            </ProtectedRoute>
          } 
        />
        <Route 
          path="/company/quickstart" 
          element={
            <ProtectedRoute companyOnly>
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={pageTransition}
              >
                <QuickstartPage isCompanyView />
              </motion.div>
            </ProtectedRoute>
          } 
        />
        <Route 
          path="/dashboard/projects/:projectId" 
          element={
            <ProtectedRoute>
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={pageTransition}
              >
                <ProjectDetail />
              </motion.div>
            </ProtectedRoute>
          } 
        />
        <Route 
          path="/dashboard/projects/:projectId/analytics" 
          element={
            <ProtectedRoute>
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={pageTransition}
              >
                <ProjectAnalyticsPage />
              </motion.div>
            </ProtectedRoute>
          } 
        />
        <Route 
          path="/admin/dashboard" 
          element={
            <ProtectedRoute adminOnly>
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={pageTransition}
              >
                <AdminDashboard />
              </motion.div>
            </ProtectedRoute>
          } 
        />
        <Route 
          path="/admin/users" 
          element={
            <ProtectedRoute adminOnly>
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={pageTransition}
              >
                <AdminManageUsers />
              </motion.div>
            </ProtectedRoute>
          } 
        />
        <Route 
          path="/admin/companies" 
          element={
            <ProtectedRoute adminOnly>
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={pageTransition}
              >
                <AdminManageCompanies />
              </motion.div>
            </ProtectedRoute>
          } 
        />

        <Route 
          path="/admin/projects" 
          element={
            <ProtectedRoute adminOnly>
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={pageTransition}
              >
                <AdminManageProjects />
              </motion.div>
            </ProtectedRoute>
          } 
        />
        {/* Wildcard catch-all fallback route */}
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </AnimatePresence>
  );
}

export default function App() {
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    checkAndRefreshToken();
  }, []);

  useEffect(() => {
    const lenis = new Lenis({
      duration: 1.2,
      easing: (t) => Math.min(1, 1.001 - Math.pow(2, -10 * t)), // smooth easeOutQuint
      orientation: 'vertical',
      gestureOrientation: 'vertical',
      smoothWheel: true,
      wheelMultiplier: 1,
      touchMultiplier: 2,
    });

    function raf(time: number) {
      lenis.raf(time);
      requestAnimationFrame(raf);
    }

    requestAnimationFrame(raf);

    return () => {
      lenis.destroy();
    };
  }, []);

  return (
    <div className="min-h-screen bg-[#000000] text-white font-sans selection:bg-violet-600 selection:text-white overflow-x-hidden">
      <BrowserRouter>
        <AnimatePresence mode="wait">
          {isLoading ? (
            <Loader key="loader" onComplete={() => setIsLoading(false)} />
          ) : (
            <AnimatedRoutes />
          )}
        </AnimatePresence>
      </BrowserRouter>
    </div>
  );
}
