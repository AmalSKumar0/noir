import React from 'react';
import UserNavBar from './UserNavBar';

interface UserLayoutProps {
  children: React.ReactNode;
}

export default function UserLayout({ children }: UserLayoutProps) {
  return (
    <div 
      className="min-h-screen font-sans text-white selection:bg-violet-500/30 overflow-x-hidden pb-12"
      style={{
        background: 'radial-gradient(circle at 85% 75%, rgba(124, 58, 237, 0.22) 0%, rgba(99, 102, 241, 0.08) 35%, rgba(3, 2, 14, 1) 100%)'
      }}
    >
      <UserNavBar />
      <div className="pl-24 md:pl-28 max-w-[1400px] mx-auto px-4 py-4 md:px-8 md:py-6 overflow-hidden">
        {children}
      </div>
    </div>
  );
}
