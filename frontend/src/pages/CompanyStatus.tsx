import React, { useEffect, useState } from 'react';
import { motion } from 'motion/react';
import { Mail, LogOut, RefreshCw, CheckCircle2 } from 'lucide-react';
import { Link, useNavigate } from 'react-router-dom';
import AuthLayout from '../components/AuthLayout';
import { apiFetch } from '../utils/api';
import { logout, checkAndRefreshToken } from '../utils/auth';

export default function CompanyStatus() {
  const navigate = useNavigate();
  const [companyUser, setCompanyUser] = useState<any>(null);
  const [companyProfile, setCompanyProfile] = useState<any>(null);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isLoggingOut, setIsLoggingOut] = useState(false);

  const fetchStatus = async () => {
    setIsRefreshing(true);
    try {
      const baseUrl = import.meta.env.VITE_API_BASE_URL || '';
      const token = await checkAndRefreshToken();
      const res = await apiFetch(`${baseUrl}/api/accounts/company/me/`, {
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
      });
      if (res.ok) {
        const data = await res.json();
        setCompanyUser(data);
        if (data.company_profile) {
          setCompanyProfile(data.company_profile);
          const currentUserStr = localStorage.getItem('user');
          if (currentUserStr) {
            try {
              const parsed = JSON.parse(currentUserStr);
              parsed.company_profile = data.company_profile;
              localStorage.setItem('user', JSON.stringify(parsed));
            } catch (e) {
              console.error(e);
            }
          }
          if (data.company_profile.status === 'approved') {
            navigate('/company/dashboard', { replace: true });
          }
        }
      }
    } catch (err) {
      console.error('Failed to fetch company status:', err);
    } finally {
      setIsRefreshing(false);
    }
  };

  useEffect(() => {
    const storedUser = localStorage.getItem('user');
    if (storedUser) {
      try {
        const parsed = JSON.parse(storedUser);
        setCompanyUser(parsed);
        if (parsed.company_profile) {
          setCompanyProfile(parsed.company_profile);
          if (parsed.company_profile.status === 'approved') {
            navigate('/company/dashboard', { replace: true });
            return;
          }
        }
      } catch (e) {
        console.error(e);
      }
    }
    fetchStatus();
  }, []);

  const handleLogoutClick = async () => {
    setIsLoggingOut(true);
    await logout(navigate);
  };

  const status = companyProfile?.status || 'pending';
  const companyName =
    companyProfile?.company_name ||
    companyUser?.company_profile?.company_name ||
    'Your Organization';

  return (
    <AuthLayout
      title={
        status === 'pending' ? (
          <>
            Verification in progress for <br />
            <span className="font-medium text-white drop-shadow-[0_0_30px_rgba(245,158,11,0.2)]">
              {companyName}.
            </span>
          </>
        ) : (
          <>
            Registration declined for <br />
            <span className="font-medium text-white drop-shadow-[0_0_30px_rgba(239,68,68,0.2)]">
              {companyName}.
            </span>
          </>
        )
      }
      description={
        status === 'pending'
          ? 'Your enterprise onboarding application is currently under manual review by our administration team. Full telemetry workspace access will unlock automatically upon verification.'
          : 'Your organization onboarding request could not be verified at this time. If you believe this is an error or need assistance, please contact support.'
      }
    >
      <motion.div
        initial={{ opacity: 0, y: 30 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.7, ease: [0.16, 1, 0.3, 1], delay: 0.15 }}
        className="relative w-full max-w-[440px] flex flex-col gap-6"
      >
        {/* Status Pill Badge */}
        {status === 'pending' ? (
          <div className="inline-flex items-center gap-2.5 px-4 py-2 rounded-full border border-amber-500/30 bg-amber-500/10 text-amber-300 text-xs font-mono tracking-widest uppercase w-fit shadow-[0_0_20px_rgba(245,158,11,0.15)]">
            <span className="w-2 h-2 rounded-full bg-amber-400 animate-pulse"></span>
            <span>Application Pending Review</span>
          </div>
        ) : (
          <div className="inline-flex items-center gap-2.5 px-4 py-2 rounded-full border border-red-500/30 bg-red-500/10 text-red-400 text-xs font-mono tracking-widest uppercase w-fit shadow-[0_0_20px_rgba(239,68,68,0.15)]">
            <span className="w-2 h-2 rounded-full bg-red-400"></span>
            <span>Application Declined</span>
          </div>
        )}

        {/* Company & Status Info */}
        <div className="flex flex-col gap-2">
          <h2 className="text-2xl font-medium tracking-tight text-white font-sans">
            {companyName}
          </h2>
          <p className="text-stone-400 text-xs font-mono tracking-wide leading-relaxed">
            {status === 'pending'
              ? 'Our administrative team usually reviews company accounts within 24 to 48 hours.'
              : 'Your registration was declined. You may contact support for further guidance.'}
          </p>
        </div>

        {/* Status Indicators List */}
        <div className="flex flex-col gap-3 font-mono text-xs text-stone-300 py-3 border-y border-white/10">
          <div className="flex items-center justify-between">
            <span className="text-stone-500 uppercase tracking-widest text-[10px]">Review Status</span>
            <span className={status === 'pending' ? 'text-amber-400 font-semibold' : 'text-red-400 font-semibold'}>
              {status === 'pending' ? 'In Queue' : 'Declined'}
            </span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-stone-500 uppercase tracking-widest text-[10px]">Admin Notification</span>
            <span className="text-emerald-400 font-semibold flex items-center gap-1">
              <CheckCircle2 className="w-3.5 h-3.5" /> Dispatched
            </span>
          </div>
        </div>

        {/* Action Buttons: Contact Us & Logout (Uniform, Same Length) */}
        <div className="flex flex-col sm:flex-row items-center gap-3 w-full mt-2">
          <Link to="/contact" className="w-full sm:w-1/2">
            <motion.button
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              type="button"
              className="w-full h-11 px-4 rounded-full bg-white text-black font-semibold text-xs font-mono uppercase tracking-widest hover:bg-stone-200 transition-all flex items-center justify-center gap-2 cursor-pointer shadow-[0_4px_15px_rgba(255,255,255,0.15)]"
            >
              <Mail className="w-4 h-4" />
              <span>Contact Us</span>
            </motion.button>
          </Link>

          <motion.button
            onClick={handleLogoutClick}
            disabled={isLoggingOut}
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            type="button"
            className="w-full sm:w-1/2 h-11 px-4 rounded-full bg-stone-900/80 border border-white/20 text-white font-semibold text-xs font-mono uppercase tracking-widest hover:bg-stone-800 hover:border-white/40 transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
          >
            <LogOut className="w-4 h-4" />
            <span>{isLoggingOut ? 'Logging Out...' : 'Logout'}</span>
          </motion.button>
        </div>

        {/* Refresh Status Link */}
        <div className="pt-1 flex justify-start">
          <button
            onClick={fetchStatus}
            disabled={isRefreshing}
            className="inline-flex items-center gap-2 text-xs font-mono text-stone-500 hover:text-stone-300 transition-colors disabled:opacity-50 cursor-pointer"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isRefreshing ? 'animate-spin' : ''}`} />
            <span>{isRefreshing ? 'Checking status...' : 'Refresh Status'}</span>
          </button>
        </div>
      </motion.div>
    </AuthLayout>
  );
}

