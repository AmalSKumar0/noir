import React from 'react';
import UserNavBar from './UserNavBar';

interface UserLayoutProps {
  children: React.ReactNode;
}

export default function UserLayout({ children }: UserLayoutProps) {
  return (
    <div 
      className="min-h-screen font-sans text-slate-900 dark:text-zinc-100 selection:bg-violet-500/20 dark:selection:bg-violet-500/30 bg-[#f8fafc] dark:bg-[#090A0F] overflow-x-hidden pb-10 transition-colors duration-200"
      style={{
        backgroundImage: 'var(--user-layout-bg)'
      }}
    >
      <UserNavBar />
      <div className="pt-20 md:pt-4 px-3.5 sm:px-6 md:pl-24 md:pr-8 max-w-[1680px] mx-auto overflow-hidden">
        {children}
      </div>
    </div>
  );
}
