
import React from 'react';
import { PlusCircle, Calendar, PieChart, Settings, LogOut, LayoutDashboard, Users, Presentation } from 'lucide-react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useSettings } from '../services/dataService'; 

const BottomNav: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { settings, logout } = useSettings();

  // Check Role
  const isOfficeOrAdmin = settings.role === 'admin' || settings.role === 'office';

  const NavItem = ({ path, icon: Icon, label, onClick, colorClass }: { path?: string; icon: any; label: string; onClick?: () => void, colorClass?: string }) => {
    const isActive = path ? location.pathname === path : false;
    
    const handleClick = () => {
        if (onClick) onClick();
        else if (path) navigate(path);
    };

    return (
      <button 
        type="button"
        onClick={handleClick}
        className={`group flex items-center justify-center transition-all duration-300 relative cursor-pointer
            ${/* Mobile Styles */ ''}
            flex-col w-full h-full
            ${/* Desktop Styles */ ''}
            md:flex-row md:w-12 md:h-12 md:rounded-xl md:hover:bg-white/10
            ${isActive ? 'text-teal-400' : 'text-white/50 hover:text-white/80'}
            ${colorClass && !isActive ? colorClass : ''}
        `}
      >
        <Icon size={24} strokeWidth={isActive ? 2.5 : 1.5} className="transition-transform group-hover:scale-110" />
        
        {/* Mobile Label */}
        <span className="text-[10px] mt-1 font-medium md:hidden">{label}</span>
        
        {/* Desktop Tooltip / Indicator */}
        {isActive && <div className="hidden md:block absolute left-0 top-1/2 -translate-y-1/2 w-1 h-6 bg-teal-400 rounded-r-full" />}
      </button>
    );
  };

  return (
    <>
        {/* MOBILE: Bottom Navigation */}
        <div className="fixed bottom-0 left-0 w-full z-[100] flex justify-center pb-4 pointer-events-none md:hidden">
            <div className="w-full pointer-events-auto">
                <div className="mx-4 mb-2 bg-gray-900/80 backdrop-blur-xl border border-white/10 rounded-2xl h-16 shadow-2xl flex justify-between items-center px-2">
                    <NavItem path="/" icon={PlusCircle} label="Erfassen" />
                    <NavItem path="/history" icon={Calendar} label="Verlauf" />
                    
                    {/* Office Modules Mobile */}
                    {isOfficeOrAdmin && (
                        <>
                         <NavItem path="/office" icon={LayoutDashboard} label="Büro" colorClass="text-orange-400/70" />
                         <NavItem path="/office/users" icon={Users} label="Benutzer" colorClass="text-orange-400/70" />
                        </>
                    )}

                    <NavItem path="/analysis" icon={PieChart} label="Analyse" />
                    <NavItem path="/settings" icon={Settings} label="Optionen" />
                </div>
            </div>
        </div>

        {/* DESKTOP: Sidebar Navigation */}
        <div className="hidden md:flex fixed top-0 left-0 h-full w-24 flex-col items-center py-8 z-50 pointer-events-auto">
            {/* Glass Container for Sidebar */}
            <div className="absolute inset-y-4 left-4 w-16 bg-gray-900/40 backdrop-blur-xl border border-white/10 rounded-2xl shadow-2xl flex flex-col items-center py-6 gap-8">
                
                {/* Logo / Brand Icon */}
                <div className="w-8 h-8 rounded-full bg-gradient-to-tr from-emerald-500 to-teal-500 shadow-[0_0_15px_rgba(20,184,166,0.5)] mb-4" />

                {/* Nav Items */}
                <div className="flex flex-col gap-4 w-full px-2">
                    <NavItem path="/" icon={PlusCircle} label="Erfassen" />
                    <NavItem path="/history" icon={Calendar} label="Verlauf" />
                    <NavItem path="/analysis" icon={PieChart} label="Analyse" />
                    <NavItem path="/settings" icon={Settings} label="Optionen" />
                    
                    {/* Office Modules Desktop Separator */}
                    {isOfficeOrAdmin && (
                        <div className="w-full h-px bg-white/10 my-2" />
                    )}

                    {isOfficeOrAdmin && (
                        <>
                            <NavItem path="/office" icon={LayoutDashboard} label="Dashboard" colorClass="text-orange-400/70" />
                            <NavItem path="/office/users" icon={Users} label="Benutzer" colorClass="text-orange-400/70" />
                            <NavItem path="/office/analysis" icon={Presentation} label="Profi-Auswertung" colorClass="text-purple-400/70" />
                        </>
                    )}
                </div>

                <div className="mt-auto">
                    <button 
                        onClick={logout}
                        className="w-10 h-10 flex items-center justify-center text-white/30 hover:text-red-400 hover:bg-red-500/10 rounded-xl transition-all"
                        title="Abmelden"
                    >
                        <LogOut size={20} />
                    </button>
                </div>
            </div>
        </div>
    </>
  );
};

export default BottomNav;
