import React from 'react';
import AdminNavbar from './AdminNavBar';

interface AdminLayoutProps {
  children: React.ReactNode;
}

export default function AdminLayout({ children }: AdminLayoutProps) {
  return (
    <div 
      className="min-h-screen p-2 sm:p-5 md:p-7 font-sans text-slate-900 dark:text-white selection:bg-purple-500/20 dark:selection:bg-[#c4b5fd]/30 selection:text-purple-900 dark:selection:text-[#f3e8ff] transition-colors duration-200 bg-[#f8f7ff] dark:bg-[#050508]"
      style={{
        background: 'var(--admin-outer-bg)',
      }}
    >
      <div className="min-h-[calc(100vh-1rem)] md:min-h-[calc(100vh-2.5rem)] bg-white/95 dark:bg-[#0a0812]/95 border border-purple-200/80 dark:border-[#c4b5fd]/20 rounded-2xl md:rounded-[2rem] shadow-[0_16px_50px_rgba(109,40,217,0.06),0_0_25px_rgba(196,181,253,0.1)] dark:shadow-[0_24px_80px_rgba(0,0,0,0.92),0_0_60px_rgba(196,181,253,0.12)] overflow-hidden flex flex-col backdrop-blur-2xl transition-colors duration-200">
        <AdminNavbar />
        <div className="flex-1 px-3 sm:px-6 md:px-8 pb-6 md:pb-8 overflow-x-hidden">
          {children}
        </div>
      </div>
    </div>
  );
}
