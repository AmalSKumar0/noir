import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'motion/react';
import { logout } from '../utils/auth';

export default function Logout() {
  const navigate = useNavigate();

  useEffect(() => {
    const handleUserLogout = async () => {
      await logout(navigate);
    };
    handleUserLogout();
  }, [navigate]);

  return (
    <div className="min-h-screen bg-[#000000] text-white flex flex-col items-center justify-center p-6 font-sans">
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.05 }}
        className="flex flex-col items-center gap-6 max-w-md text-center"
      >
        <div className="relative flex items-center justify-center w-16 h-16">
          <div className="absolute inset-0 rounded-full border-2 border-violet-500/20 animate-ping"></div>
          <div className="w-12 h-12 rounded-full border-2 border-violet-500 border-t-transparent animate-spin"></div>
        </div>
        <div>
          <h2 className="text-2xl font-medium tracking-tight text-white mb-2">
            Signing out...
          </h2>
          <p className="text-stone-400 text-sm font-mono tracking-wide">
            Invalidating session and clearing security tokens.
          </p>
        </div>
      </motion.div>
    </div>
  );
}
