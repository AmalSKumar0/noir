import { useState, useEffect } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import Lenis from 'lenis';
import { BrowserRouter, Routes, Route, useLocation } from 'react-router-dom';
import Home from './pages/Home';
import Login from './pages/Login';
import Register from './pages/Register';
import Logout from './pages/Logout';
import Dashboard from './pages/Dashboard';
import GithubCallback from './pages/GithubCallback';
import Loader from './components/Loader';
import ProtectedRoute from './components/ProtectedRoute';
import PublicOnlyRoute from './components/PublicOnlyRoute';
import { getRefreshToken, setAuthTokens, clearAuthTokens } from './utils/auth';

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
              transition={{ duration: 0.8 }}
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
                transition={{ duration: 0.8 }}
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
                transition={{ duration: 0.8 }}
              >
                <Register />
              </motion.div>
            </PublicOnlyRoute>
          } 
        />
        <Route 
          path="/logout" 
          element={
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.8 }}
            >
              <Logout />
            </motion.div>
          } 
        />
        <Route 
          path="/github/callback" 
          element={
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.8 }}
            >
              <GithubCallback />
            </motion.div>
          } 
        />
        <Route 
          path="/github/callback/" 
          element={
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.8 }}
            >
              <GithubCallback />
            </motion.div>
          } 
        />
        <Route 
          path="/oauth/callback" 
          element={
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.8 }}
            >
              <GithubCallback />
            </motion.div>
          } 
        />
        <Route 
          path="/oauth/callback/" 
          element={
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.8 }}
            >
              <GithubCallback />
            </motion.div>
          } 
        />
        <Route 
          path="/api/accounts/github/callback/" 
          element={
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.8 }}
            >
              <GithubCallback />
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
                transition={{ duration: 0.8 }}
              >
                <Dashboard />
              </motion.div>
            </ProtectedRoute>
          } 
        />
      </Routes>
    </AnimatePresence>
  );
}

export default function App() {
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const refreshAuthToken = async () => {
      const refreshToken = getRefreshToken();
      if (refreshToken) {
        try {
          const baseUrl = import.meta.env.VITE_API_BASE_URL || '';
          const response = await fetch(`${baseUrl}/api/accounts/token/refresh/`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({ refresh: refreshToken }),
          });
          
          if (response.ok) {
            const data = await response.json();
            if (data.access) {
              setAuthTokens(data.access, data.refresh);
            }
          } else {
            // If the refresh token is invalid or expired, clear the auth state
            clearAuthTokens();
          }
        } catch (error) {
          console.error('Error refreshing token:', error);
        }
      }
    };
    
    refreshAuthToken();
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
