import React from 'react';
import AdminNavbar from './AdminNavBar';

interface AdminLayoutProps {
  children: React.ReactNode;
}

export default function AdminLayout({ children }: AdminLayoutProps) {
  return (
    <div 
      className="min-h-screen p-3 sm:p-5 md:p-7 font-sans text-white selection:bg-[#c4b5fd]/30 selection:text-[#f3e8ff]"
      style={{
        background: 'radial-gradient(circle at 50% -12%, rgba(196, 181, 253, 0.18) 0%, rgba(147, 112, 219, 0.06) 42%, rgba(5, 5, 8, 1) 90%)',
        backgroundColor: '#050508',
      }}
    >
      <div className="min-h-[calc(100vh-1.25rem)] md:min-h-[calc(100vh-2.5rem)] bg-[#0a0812]/95 border border-[#c4b5fd]/20 rounded-[1.75rem] md:rounded-[2rem] shadow-[0_24px_80px_rgba(0,0,0,0.92),0_0_60px_rgba(196,181,253,0.12)] overflow-hidden flex flex-col backdrop-blur-2xl">
        <AdminNavbar />
        <div className="flex-1 px-4 sm:px-6 md:px-8 pb-6 md:pb-8 overflow-x-hidden">
          {children}
        </div>
      </div>
    </div>
  );
}
