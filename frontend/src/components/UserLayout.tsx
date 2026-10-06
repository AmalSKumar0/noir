import React from 'react';
import UserNavBar from './UserNavBar';

interface UserLayoutProps {
  children: React.ReactNode;
}

export default function UserLayout({ children }: UserLayoutProps) {
  return (
    <div 
      className="min-h-screen font-sans text-zinc-100 selection:bg-violet-500/30 bg-[#090A0F] overflow-x-hidden pb-10"
      style={{
        backgroundImage: 'radial-gradient(ellipse 80% 50% at 50% -20%, rgba(120, 119, 198, 0.12), rgba(255, 255, 255, 0))'
      }}
    >
      <UserNavBar />
      <div className="pt-20 md:pt-4 px-3.5 sm:px-6 md:pl-24 md:pr-8 max-w-[1680px] mx-auto overflow-hidden">
        {children}
      </div>
    </div>
  );
}
