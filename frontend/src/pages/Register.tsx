import React, { useState, useEffect } from 'react';
import { motion } from 'motion/react';
import { Mail, Lock, Eye, EyeOff, User, AlertCircle } from 'lucide-react';
import { Link, useNavigate } from 'react-router-dom';
import { apiFetch } from '../utils/api';
import { setAuthTokens } from '../utils/auth';
import { initiateGithubOAuth, initiateGoogleOAuth } from '../utils/oauth';
import AuthLayout from '../components/AuthLayout';

const processedCodes = new Set<string>();

export default function Register() {
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  // Initialize isGithubLoading to true if code or tokens are present in the URL on mount
  const [isGithubLoading, setIsGithubLoading] = useState(() => {
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search);
      return !!(params.get('code') || params.get('access') || params.get('access_token'));
    }
    return false;
  });

  const [error, setError] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const accessParam = params.get('access') || params.get('access_token');
    const refreshParam = params.get('refresh') || params.get('refresh_token');
    const code = params.get('code');

    if (accessParam) {
      setAuthTokens(accessParam, refreshParam || undefined);
      navigate('/dashboard', { replace: true });
      return;
    }

    if (code) {
      if (processedCodes.has(code)) return;
      processedCodes.add(code);

      const exchangeCode = async () => {
        setIsGithubLoading(true);
        setError('');
        try {
          const baseUrl = import.meta.env.VITE_API_BASE_URL || '';
          const response = await apiFetch(`${baseUrl}/api/accounts/github/callback/`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({ code }),
          });

          if (!response.ok) {
            const errData = await response.json().catch(() => ({}));
            throw new Error(errData.detail || errData.error || 'Failed to exchange GitHub authorization code.');
          }

          const data = await response.json();
          if (data.access) {
            setAuthTokens(data.access, data.refresh);
          }

          navigate('/dashboard', { replace: true });
        } catch (err: any) {
          setError(`Error in authentication using GitHub: ${err.message || 'Verification failed.'}`);
          setIsGithubLoading(false);
        }
      };

      exchangeCode();
    }
  }, [navigate]);

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    if (password !== confirmPassword) {
      setError('Passwords do not match');
      return;
    }

    setIsLoading(true);
    setError('');

    try {
      const baseUrl = import.meta.env.VITE_API_BASE_URL || '';
      const response = await apiFetch(`${baseUrl}/api/accounts/register/`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ username, email, password }),
      });

      if (!response.ok) {
        const errData = await response.json().catch(() => ({}));
        throw new Error(errData.detail || errData.error || 'Registration failed');
      }

      const data = await response.json();
      
      if (data.access) {
        setAuthTokens(data.access, data.refresh);
      }

      navigate('/dashboard');
    } catch (err: any) {
      setError(err.message || 'An error occurred during registration');
    } finally {
      setIsLoading(false);
    }
  };

  const handleGithubLogin = () => {
    setIsGithubLoading(true);
    setError('');
    initiateGithubOAuth();
  };

  const handleGoogleLogin = () => {
    initiateGoogleOAuth();
  };

  return (
    <AuthLayout
      title={
        <>
          Join the <br />
          <span className="font-medium text-white drop-shadow-[0_0_30px_rgba(139,92,246,0.15)]">workspace.</span>
        </>
      }
      description="The autonomous reliability engineer for modern applications. Register to monitor cascades and access telemetry."
      isGithubLoading={isGithubLoading}
      onGithubLogin={handleGithubLogin}
      onGoogleLogin={handleGoogleLogin}
    >
      <motion.div 
        initial={{ opacity: 0, y: 30 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.7, ease: [0.16, 1, 0.3, 1], delay: 0.15 }}
        className="relative w-full max-w-[440px] p-8 md:p-12 rounded-[2rem] bg-white/5 backdrop-blur-3xl border border-white/10 shadow-[0_8px_32px_rgba(0,0,0,0.5)] flex flex-col"
      >
        <div className="flex flex-col mb-10">
           <h2 className="text-2xl font-medium tracking-tight text-white mb-2">
             Create an account
           </h2>
           <p className="text-stone-400 text-sm font-mono tracking-wide">
             Enter your details to create an account
           </p>
        </div>

        {/* Error Banner */}
        {error && (
          <motion.div 
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            className="mb-6 p-4 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-xs font-mono flex items-center gap-3"
          >
            <AlertCircle className="w-4 h-4 shrink-0 text-red-400" />
            <span>{error}</span>
          </motion.div>
        )}

        <form onSubmit={handleRegister} className="flex flex-col gap-4 w-full">
          <div className="relative">
            <User className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-stone-500" />
            <input
              type="text"
              placeholder="Username"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              required
              className="w-full bg-stone-900/50 border border-white/5 rounded-full py-3.5 pl-12 pr-6 text-sm text-white placeholder-stone-500 focus:outline-none focus:border-violet-500/50 focus:bg-stone-900/80 transition-all font-mono"
            />
          </div>

          <div className="relative">
            <Mail className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-stone-500" />
            <input
              type="email"
              placeholder="Email address"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              className="w-full bg-stone-900/50 border border-white/5 rounded-full py-3.5 pl-12 pr-6 text-sm text-white placeholder-stone-500 focus:outline-none focus:border-violet-500/50 focus:bg-stone-900/80 transition-all font-mono"
            />
          </div>
          
          <div className="relative">
            <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-stone-500" />
            <input
              type={showPassword ? "text" : "password"}
              placeholder="Password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              className="w-full bg-stone-900/50 border border-white/5 rounded-full py-3.5 pl-12 pr-12 text-sm text-white placeholder-stone-500 focus:outline-none focus:border-violet-500/50 focus:bg-stone-900/80 transition-all font-mono"
            />
            <button
              type="button"
              onClick={() => setShowPassword(!showPassword)}
              className="absolute right-4 top-1/2 -translate-y-1/2 text-stone-500 hover:text-white transition-colors"
            >
              {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
            </button>
          </div>

          <div className="relative">
            <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-stone-500" />
            <input
              type={showConfirmPassword ? "text" : "password"}
              placeholder="Confirm Password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              required
              className="w-full bg-stone-900/50 border border-white/5 rounded-full py-3.5 pl-12 pr-12 text-sm text-white placeholder-stone-500 focus:outline-none focus:border-violet-500/50 focus:bg-stone-900/80 transition-all font-mono"
            />
            <button
              type="button"
              onClick={() => setShowConfirmPassword(!showConfirmPassword)}
              className="absolute right-4 top-1/2 -translate-y-1/2 text-stone-500 hover:text-white transition-colors"
            >
              {showConfirmPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
            </button>
          </div>

          <motion.button
            whileHover={{ scale: 1.02, boxShadow: "0 0 20px rgba(124,58,237,0.2)" }}
            whileTap={{ scale: 0.98 }}
            type="submit"
            disabled={isLoading || isGithubLoading}
            className="w-full mt-4 py-3.5 rounded-full bg-white text-black font-semibold text-xs uppercase tracking-widest hover:bg-stone-200 transition-colors shadow-[0_5px_20px_rgba(139,92,246,0.15)] disabled:opacity-70 disabled:cursor-not-allowed flex items-center justify-center gap-2"
          >
            {isLoading ? (
              <>
                <div className="w-4 h-4 border-2 border-black border-t-transparent rounded-full animate-spin"></div>
                <span>Creating Account...</span>
              </>
            ) : (
              'Create Account'
            )}
          </motion.button>
          
          <div className="mt-4 text-center">
            <Link to="/login" className="text-stone-400 hover:text-white text-sm font-mono tracking-wide transition-colors">
              Already have an account? Sign in
            </Link>
          </div>
        </form>
      </motion.div>
    </AuthLayout>
  );
}
