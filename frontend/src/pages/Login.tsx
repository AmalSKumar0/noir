import React, { useState } from 'react';
import { motion } from 'motion/react';
import { Mail, Lock, Eye, EyeOff, AlertCircle } from 'lucide-react';
import { Link, useNavigate } from 'react-router-dom';
import { apiFetch } from '../utils/api';
import { setAuthTokens } from '../utils/auth';
import { initiateGithubOAuth, initiateGoogleOAuth } from '../utils/oauth';
import AuthLayout from '../components/AuthLayout';

export default function Login() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [isGithubLoading, setIsGithubLoading] = useState(false);
  const [isGoogleLoading, setIsGoogleLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const navigate = useNavigate();

  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError('');

    try {
      const baseUrl = import.meta.env.VITE_API_BASE_URL || '';
      const endpoint = `${baseUrl}/api/accounts/login/`;

      const response = await apiFetch(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ email, password }),
      });

      if (!response.ok) {
        const errData = await response.json().catch(() => ({}));
        throw new Error(errData.detail || errData.error || 'Invalid credentials');
      }

      const data = await response.json();
      
      // Store tokens and user/role info
      if (data.access) {
        setAuthTokens(data.access, data.refresh);
        if (data.user && data.user.role) {
          localStorage.setItem('user_role', data.user.role);
          localStorage.setItem('user', JSON.stringify(data.user));
        }
      }

      // Navigate to dashboard based on role
      if (data.user && data.user.role === 'admin') {
        navigate('/admin/dashboard');
      } else {
        navigate('/dashboard');
      }
    } catch (err: any) {
      setError(err.message || 'An error occurred during authentication');
    } finally {
      setIsLoading(false);
    }
  };

  const handleGithubLogin = () => {
    setIsGithubLoading(true);
    initiateGithubOAuth();
  };

  const handleGoogleLogin = () => {
    setIsGoogleLoading(true);
    initiateGoogleOAuth();
  };

  return (
    <AuthLayout
      title={
        <>
          Welcome back to <br />
          <span className="font-medium text-white drop-shadow-[0_0_30px_rgba(139,92,246,0.15)]">your workspace.</span>
        </>
      }
      description="The autonomous reliability engineer for modern applications. Sign in to monitor cascades and access telemetry."
      isGithubLoading={isGithubLoading}
      isGoogleLoading={isGoogleLoading}
      onGithubLogin={handleGithubLogin}
      onGoogleLogin={handleGoogleLogin}
    >
      <motion.div 
        initial={{ opacity: 0, y: 30 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.7, ease: "easeOut", delay: 0.2 }}
        className="relative w-full max-w-[440px] p-8 md:p-12 rounded-[2rem] bg-white/5 backdrop-blur-3xl border border-white/10 shadow-[0_8px_32px_rgba(0,0,0,0.5)] flex flex-col"
      >
        <div className="flex flex-col mb-10">
           <h2 className="text-2xl font-medium tracking-tight text-white mb-2">
             Sign in with email
           </h2>
           <p className="text-stone-400 text-sm font-mono tracking-wide">
             Enter your credentials to continue
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

        <form onSubmit={handleAuth} className="flex flex-col gap-4 w-full">
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

          <motion.button
            whileHover={{ scale: 1.02, boxShadow: "0 0 20px rgba(124,58,237,0.2)" }}
            whileTap={{ scale: 0.98 }}
            type="submit"
            disabled={isLoading || isGithubLoading || isGoogleLoading}
            className="w-full mt-4 py-3.5 rounded-full bg-white text-black font-semibold text-xs uppercase tracking-widest hover:bg-stone-200 transition-colors shadow-[0_5px_20px_rgba(139,92,246,0.15)] disabled:opacity-70 disabled:cursor-not-allowed flex items-center justify-center gap-2"
          >
            {isLoading ? (
              <>
                <div className="w-4 h-4 border-2 border-black border-t-transparent rounded-full animate-spin"></div>
                <span>Signing In...</span>
              </>
            ) : (
              'Sign In'
            )}
          </motion.button>
          
          <div className="mt-4 text-center">
            <Link to="/register" className="text-stone-400 hover:text-white text-sm font-mono tracking-wide transition-colors">
              Don't have an account? Register
            </Link>
          </div>
        </form>
      </motion.div>
    </AuthLayout>
  );
}
