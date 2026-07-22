import React, { useEffect, useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'motion/react';
import BackgroundBoids from '../components/BackgroundBoids';
import Loader from '../components/Loader';
import { setAuthTokens, isAuthenticated } from '../utils/auth';

// Global single-flight set to prevent duplicate code exchange in React StrictMode
const processedAuthCodes = new Set<string>();

export default function AuthCallback() {
  const [error, setError] = useState('');
  const navigate = useNavigate();
  const mouseRef = useRef({ x: -1000, y: -1000 });

  useEffect(() => {
    if (isAuthenticated()) {
      navigate('/dashboard', { replace: true });
      return;
    }

    const params = new URLSearchParams(window.location.search);
    const accessParam = params.get('access') || params.get('access_token');
    const refreshParam = params.get('refresh') || params.get('refresh_token');
    const authcode = params.get('authcode');

    // Case 1: Tokens provided directly in URL
    if (accessParam) {
      setAuthTokens(accessParam, refreshParam || undefined);
      navigate('/dashboard', { replace: true });
      return;
    }

    if (authcode) {
      if (processedAuthCodes.has(authcode)) {
        return;
      }
      processedAuthCodes.add(authcode);

      const processCallback = async () => {
        try {
          console.time("Auth callback");
          const baseUrl = import.meta.env.VITE_API_BASE_URL || '';
          const response = await fetch(`${baseUrl}/api/accounts/common-auth/callback/`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({ code: authcode }),
          });
          console.timeEnd("Auth callback");

          if (!response.ok) {
            // Check if another parallel call set tokens in the meantime
            if (isAuthenticated()) {
              navigate('/dashboard', { replace: true });
              return;
            }
            const errData = await response.json().catch(() => ({}));
            throw new Error(errData.detail || errData.error || 'Authentication failed');
          }

          console.time("JSON");
          const data = await response.json();
          console.timeEnd("JSON");
          if (data.access) {
            setAuthTokens(data.access, data.refresh);
            navigate('/dashboard', { replace: true });
          } else {
            throw new Error('No access token returned from server');
          }
        } catch (err: any) {
          if (isAuthenticated()) {
            console.time("Navigate");
            navigate("/dashboard", { replace: true });
            console.timeEnd("Navigate");
          } else {
            setError(err.message || 'Authentication failed');
          }
        }
      };

      processCallback();
      return;
    }

    // Fallback if no authcode or tokens were provided
    if (!isAuthenticated()) {
      navigate('/login', { replace: true });
    }
  }, [navigate]);

  return (
    <div className="relative min-h-screen bg-black overflow-hidden flex items-center justify-center font-sans">
      <BackgroundBoids mouseRef={mouseRef} />
      
      {error ? (
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          className="relative z-[110] max-w-md w-full p-8 mx-6 rounded-[2rem] bg-white/5 backdrop-blur-3xl border border-white/10 text-center flex flex-col items-center gap-4"
        >
          <div className="p-4 rounded-2xl bg-red-500/10 border border-red-500/20 text-red-400 text-xs font-mono w-full">
            {error}
          </div>
          <motion.button
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            onClick={() => navigate('/login')}
            className="w-full py-3 rounded-full bg-white text-black font-semibold text-xs uppercase tracking-widest hover:bg-stone-200 transition-colors shadow-[0_5px_20px_rgba(139,92,246,0.15)]"
          >
            Back to Sign In
          </motion.button>
        </motion.div>
      ) : (
        <Loader />
      )}
    </div>
  );
}
