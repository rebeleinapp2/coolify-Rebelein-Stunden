import React, { ReactNode } from 'react';

interface GlassCardProps {
  children: ReactNode;
  className?: string;
  onClick?: () => void;
}

export const GlassCard: React.FC<GlassCardProps> = ({ children, className = "", onClick }) => {
  return (
    <div 
      onClick={onClick}
      className={`bg-white/10 backdrop-blur-lg border border-white/20 shadow-[0_8px_32px_0_rgba(31,38,135,0.37)] rounded-2xl p-4 ${className}`}
    >
      {children}
    </div>
  );
};

export const GlassInput: React.FC<React.InputHTMLAttributes<HTMLInputElement>> = (props) => (
  <input
    {...props}
    className={`w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white placeholder-white/40 focus:outline-none focus:ring-2 focus:ring-teal-500/50 focus:border-transparent transition-all backdrop-blur-sm ${props.className || ''}`}
  />
);

export const GlassButton: React.FC<React.ButtonHTMLAttributes<HTMLButtonElement> & { variant?: 'primary' | 'danger' }> = ({ children, variant = 'primary', className, ...props }) => {
  const baseStyle = "w-full font-semibold py-3 rounded-xl transition-all transform active:scale-95 backdrop-blur-md shadow-lg";
  const variantStyles = {
    primary: "bg-gradient-to-r from-emerald-500/80 to-teal-600/80 hover:from-emerald-500 hover:to-teal-600 text-white border border-white/20",
    danger: "bg-red-500/20 hover:bg-red-500/40 text-red-200 border border-red-500/30"
  };

  return (
    <button 
      className={`${baseStyle} ${variantStyles[variant]} ${className || ''}`}
      {...props}
    >
      {children}
    </button>
  );
};