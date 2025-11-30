import React, { ReactNode } from 'react';
import SnowEffect from './SnowEffect';

interface GlassLayoutProps {
  children: ReactNode;
}

const GlassLayout: React.FC<GlassLayoutProps> = ({ children }) => {
  return (
    <div className="min-h-screen w-full relative bg-gray-900 text-white overflow-hidden selection:bg-teal-500/30 flex flex-col">
      <style>{`
        @keyframes pulse-slow {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.5; }
        }
        .animate-pulse-slow {
          animation: pulse-slow 8s cubic-bezier(0.4, 0, 0.6, 1) infinite;
        }
      `}</style>

      {/* Dynamic Background Gradient Blobs */}
      <div className="fixed top-[-10%] left-[-10%] w-[50%] h-[50%] bg-emerald-600/40 rounded-full blur-[120px] animate-pulse-slow" />
      <div className="fixed bottom-[-10%] right-[-10%] w-[50%] h-[50%] bg-teal-600/40 rounded-full blur-[120px] animate-pulse-slow" style={{ animationDelay: '2s' }} />
      <div className="fixed top-[20%] right-[20%] w-[40%] h-[40%] bg-cyan-600/30 rounded-full blur-[100px] animate-pulse-slow" style={{ animationDelay: '4s' }} />

      {/* 
         WINTER SPECIAL: Schneefall-Effekt 
         Um ihn nach dem Winter zu entfernen, lösche einfach die Zeile: <SnowEffect />
      */}
      <SnowEffect />

      {/* Main Content Container 
          REMOVED: transition-all duration-300 to fix fixed positioning context bugs on mobile
      */}
      <div className="relative z-10 w-full h-full min-h-screen flex flex-col md:pl-24">
         <div className="w-full md:max-w-7xl mx-auto h-full flex flex-col relative">
            {children}
         </div>
      </div>
    </div>
  );
};

export default GlassLayout;