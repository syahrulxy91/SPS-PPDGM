import React, { useState } from 'react';
import { Outlet, NavLink, useNavigate, useLocation } from 'react-router-dom';
import { 
  Building2, 
  Menu,
  Home,
  Bell,
  Search,
  BookOpen,
  LogOut,
  ChevronDown,
  Megaphone,
  FolderOpen,
  ShieldCheck,
  ChevronRight,
  Sparkles,
  HelpCircle,
  FileText
} from 'lucide-react';
import { logout, getCurrentAppUser } from '../lib/auth';
import { motion } from 'motion/react';

const UNITS = [
  { name: 'Unit Swasta', path: 'unit-swasta', code: 'US' },
  { name: 'Unit Rendah', path: 'unit-rendah', code: 'UR' },
  { name: 'Unit Menengah & Tingkatan 6', path: 'unit-menengah', code: 'UM' },
  { name: 'Unit Prasekolah', path: 'unit-prasekolah', code: 'UP' },
  { name: 'Unit Pendidikan Khas', path: 'unit-pendidikan-khas', code: 'UK' },
  { name: 'Unit HEM', path: 'unit-hem', code: 'UH' },
  { name: 'Unit Peperiksaan', path: 'unit-kokurikulum', code: 'UPe' },
  { name: 'SIP+', path: 'unit-sukan', code: 'SIP' }
];

export default function DashboardLayout() {
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const user = getCurrentAppUser();
  const isSuperAdmin = user?.role === 'SUPER ADMIN' || 
                       user?.email?.toLowerCase() === 'syahrulxy91@gmail.com';
  const navigate = useNavigate();
  const location = useLocation();

  const handleLogout = async () => {
    await logout();
    navigate('/');
  };

  return (
    <div id="dashboard-layout-root" className="min-h-screen bg-slate-50/50 font-sans flex text-slate-800 antialiased selection:bg-indigo-500 selection:text-white">
      {/* Sidebar overlay for mobile */}
      {!sidebarOpen && (
        <div 
          onClick={() => setSidebarOpen(true)}
          className="lg:hidden fixed inset-0 z-30 bg-slate-900/40 backdrop-blur-xs transition-opacity duration-300 pointer-events-auto"
        />
      )}

      {/* Modern Sidebar */}
      <aside 
        id="sidebar"
        className={`fixed lg:sticky top-0 left-0 bottom-0 z-40 bg-[#0A192F] text-slate-100 flex-shrink-0 transition-all duration-300 ${
          sidebarOpen ? 'w-72' : 'w-20'
        } flex flex-col border-r border-[#1B2C4E] h-screen shadow-xl`}
      >
        {/* Header / Logo */}
        <div id="sidebar-logo-container" className="px-5 flex items-center justify-between border-b border-[#1B2C4E]/60 h-16 shrink-0 bg-[#071324]/50">
          <div className="flex items-center space-x-3 overflow-hidden">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-tr from-indigo-500 to-sky-400 flex items-center justify-center shadow-lg shadow-indigo-500/20">
              <Building2 className="w-4 h-4 text-white shrink-0" />
            </div>
            {sidebarOpen && (
              <motion.div 
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                className="flex flex-col"
              >
                <span className="font-bold text-sm tracking-tight text-white leading-tight">e-Laporan SPS</span>
                <span className="text-[10px] text-slate-400/90 font-medium">Sektor Pengurusan Sekolah</span>
              </motion.div>
            )}
          </div>
          <button 
            id="sidebar-toggle-btn"
            onClick={() => setSidebarOpen(!sidebarOpen)} 
            className="p-1.5 hover:bg-slate-800/60 rounded-lg text-slate-400 hover:text-white transition-colors cursor-pointer"
            aria-label="Toggle Navigation Sidebar"
          >
            <Menu className="w-5 h-5 mx-auto" />
          </button>
        </div>

        {/* Navigation Items */}
        <div id="sidebar-nav-scroll" className="flex-1 overflow-y-auto px-4 py-6 space-y-7 custom-scrollbar">
          {/* General Navigation */}
          <div className="space-y-1.5">
            <NavItem to="/dashboard" icon={<Home />} label="Utama" open={sidebarOpen} end />
            <NavItem to="/dashboard/carian" icon={<Search />} label="Carian Pintar" open={sidebarOpen} />
          </div>

          {/* Super Admin Control Station */}
          {isSuperAdmin && (
            <div className="space-y-2">
              <div className={`px-2 text-[10px] font-extrabold text-indigo-400/90 uppercase tracking-widest ${!sidebarOpen && 'hidden'}`}>
                Audit &amp; Kawalan
              </div>
              <NavItem 
                to="/dashboard" 
                icon={<ShieldCheck className="text-emerald-400" />} 
                label="Kawalan Super Admin" 
                open={sidebarOpen} 
              />
            </div>
          )}

          {/* Sektor Directory */}
          <div className="space-y-2">
            <div className={`px-2.5 flex items-center justify-between text-[10px] font-extrabold text-slate-400/95 uppercase tracking-widest ${!sidebarOpen && 'hidden'}`}>
              <span>Direktori Unit SPS</span>
              <Sparkles className="w-3 h-3 text-indigo-400 shrink-0" />
            </div>
            
            <div className="space-y-1">
              {UNITS.map(u => (
                <NavItem 
                  key={u.path} 
                  to={`/views-redirect-handling-${u.path}`}
                  toActual={`/dashboard/unit/${u.path}`} 
                  icon={<FolderOpen />} 
                  badge={sidebarOpen ? u.code : undefined}
                  label={u.name} 
                  open={sidebarOpen} 
                />
              ))}
            </div>
          </div>
        </div>

        {/* Sidebar Footer */}
        <div id="sidebar-footer" className="p-4 border-t border-[#1B2C4E]/60 bg-[#071324]/30 shrink-0">
          <button 
            id="sidebar-logout-btn"
            onClick={handleLogout}
            className={`flex items-center justify-center w-full px-4 py-2.5 space-x-3 transition-all rounded-xl bg-red-500/10 hover:bg-red-500/20 text-red-400 hover:text-red-300 font-semibold text-xs cursor-pointer ${!sidebarOpen && 'px-2'}`}
          >
            <LogOut className="w-4 h-4 shrink-0" />
            {sidebarOpen && <span className="truncate">Log Keluar Sistem</span>}
          </button>
        </div>
      </aside>

      {/* Main Container */}
      <div id="main-frame-holder" className="flex-1 flex flex-col min-w-0 min-h-screen">
        {/* Header App Bar */}
        <header id="main-app-header" className="sticky top-0 z-30 bg-white/85 backdrop-blur-md border-b border-slate-100 h-16 flex items-center justify-between px-6 sm:px-8 shadow-xs">
          <div className="flex items-center space-x-3">
            <button 
              id="sidebar-mobile-menu-btn"
              onClick={() => setSidebarOpen(!sidebarOpen)} 
              className="lg:hidden p-1.5 hover:bg-slate-100 rounded-lg text-slate-500 transition-colors cursor-pointer"
            >
              <Menu className="w-5 h-5" />
            </button>
            <div className="hidden sm:flex flex-col">
              <h2 className="text-xs font-semibold tracking-wider uppercase text-slate-400">PPD GUA MUSANG</h2>
              <h1 className="text-sm font-extrabold text-slate-700 tracking-tight leading-tight -mt-0.5">Sistem Portal dwi-Storan e-Laporan</h1>
            </div>
          </div>

          <div id="header-user-badge-container" className="flex items-center space-x-5">
            {/* Quick search and notification indicators */}
            <div className="flex items-center space-x-1.5 border-r border-slate-100 pr-5">
              <button 
                id="header-shortcut-carian"
                onClick={() => navigate('/dashboard/carian')} 
                className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-50 rounded-full transition-colors relative cursor-pointer"
                title="Cari Dokumen"
              >
                <Search className="w-4 h-4" />
              </button>
              <div className="relative">
                <button className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-50 rounded-full transition-colors relative cursor-pointer">
                  <Bell className="w-4 h-4" />
                  <span className="absolute top-1.5 right-1.5 w-1.5 h-1.5 bg-rose-500 rounded-full"></span>
                </button>
              </div>
            </div>

            {/* Profile widget */}
            <div id="profile-widget" className="flex items-center space-x-3">
              <div id="profile-names-column" className="text-right hidden md:block">
                <div className="text-xs font-extrabold text-slate-700 leading-tight">{user?.name}</div>
                <div className="text-[10px] text-slate-400 font-semibold tracking-wider mt-0.5 flex items-center justify-end gap-1 uppercase">
                  <span className={`w-1.5 h-1.5 rounded-full ${isSuperAdmin ? 'bg-red-500' : 'bg-indigo-500'}`}></span>
                  {user?.role}
                </div>
              </div>
              <div className="relative">
                {user?.photoURL ? (
                  <img src={user.photoURL} alt="p" className="w-9 h-9 rounded-xl border border-slate-200 object-cover shadow-sm hover:scale-105 transition-transform" />
                ) : (
                  <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-indigo-600 to-sky-500 flex items-center justify-center text-white font-extrabold text-sm shadow-sm select-none">
                    {user?.name?.charAt(0)}
                  </div>
                )}
              </div>
            </div>
          </div>
        </header>

        {/* Scrollable Workspace */}
        <main id="workspace-viewport" className="flex-1 overflow-y-auto bg-[#F8FAFC]">
          <div className="px-4 py-8 sm:px-8 max-w-7xl mx-auto space-y-8 animate-in fade-in duration-500">
            <Outlet />
          </div>
        </main>
      </div>
    </div>
  );
}

interface NavItemProps {
  key?: React.Key;
  to: string;
  toActual?: string;
  icon: React.ReactNode;
  badge?: string;
  label: string;
  open: boolean;
  end?: boolean;
}

function NavItem({ to, toActual, icon, badge, label, open, end = false }: NavItemProps) {
  const iconCopy = React.cloneElement(icon as React.ReactElement, { 
    className: 'w-4 h-4 flex-shrink-0 group-hover:scale-110 transition-transform' 
  });
  
  return (
    <NavLink
      to={toActual || to}
      end={end}
      className={({ isActive }) =>
        `flex items-center justify-between px-3.5 py-3 rounded-xl transition-all duration-200 select-none group border ${
          isActive 
            ? 'bg-gradient-to-r from-indigo-600/90 to-indigo-500/80 text-white border-indigo-500/40 font-semibold shadow-md shadow-indigo-600/10' 
            : 'text-slate-400 hover:text-white border-transparent hover:bg-slate-800/35'
        }`
      }
      title={!open ? label : undefined}
    >
      <div className="flex items-center min-w-0">
        <div className={`flex items-center justify-center ${open ? 'mr-3' : 'mx-auto'}`}>
          {iconCopy}
        </div>
        {open && (
          <span className="text-xs truncate transition-opacity duration-200">
            {label}
          </span>
        )}
      </div>
      {open && badge && (
        <span className="text-[9px] font-extrabold tracking-wide uppercase px-1.5 py-0.5 rounded-md bg-white/10 text-slate-300 font-mono group-hover:bg-white/20 transition-all transition-colors">
          {badge}
        </span>
      )}
    </NavLink>
  );
}
