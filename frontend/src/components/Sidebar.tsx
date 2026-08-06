import React from "react";
import { Link, useLocation } from "react-router-dom";
import { motion } from "framer-motion";
import {
  LayoutDashboard,
  Activity,
  Network,
  HeartPulse,
  Database,
  Layers,
  Ticket,
  FileText,
  AlertTriangle,
  Users,
  Settings,
  ChevronLeft,
  ChevronRight,
  ShieldCheck
} from "lucide-react";
import { useTheme } from "../hooks/useTheme";
import { useBackendStatus } from "../hooks/useBackendStatus";

interface SidebarProps {
  role: string;
  userName: string;
}

export default function Sidebar({ role, userName }: SidebarProps) {
  const location = useLocation();
  const { preferences, updatePreference } = useTheme();
  const { isOffline } = useBackendStatus();

  const collapsed = preferences.sidebar_state === "collapsed";
  const setCollapsed = (val: boolean) => {
    updatePreference("sidebar_state", val ? "collapsed" : "expanded");
  };

  const isViewer = role === "Viewer";
  const isAdmin = role === "Admin" || role === "Super Administrator" || role === "Administrator";

  const menuItems = [
    { name: "Dashboard", path: "/", icon: LayoutDashboard },
    ...(!isViewer ? [
      { name: "System Health", path: "/system-health", icon: Activity },
      { name: "Network Monitor", path: "/network-monitor", icon: Network },
      { name: "PC Health Check", path: "/pc-health", icon: HeartPulse },
      { name: "Assets", path: "/assets", icon: Database },
      { name: "Software Inventory", path: "/software", icon: Layers },
    ] : []),
    { name: "SupportFlow Tickets", path: "/tickets", icon: Ticket },
    ...(!isViewer ? [
      { name: "Reports", path: "/reports", icon: FileText },
      { name: "Real-time Alerts", path: "/alerts", icon: AlertTriangle },
    ] : []),
    ...(isAdmin ? [{ name: "Users & Roles", path: "/users", icon: Users }] : []),
    { name: "Settings", path: "/settings", icon: Settings },
  ];

  return (
    <motion.div
      animate={{ width: collapsed ? 80 : 260 }}
      transition={{ duration: 0.3, ease: "easeInOut" }}
      className="flex flex-col h-screen bg-slate-50 dark:bg-slate-900 text-slate-600 dark:text-slate-300 border-r border-slate-200 dark:border-slate-800 shrink-0 select-none overflow-hidden relative"
    >
      {/* Brand Header */}
      <div className="flex items-center px-6 py-5 border-b border-slate-200 dark:border-slate-800 h-16 shrink-0">
        <ShieldCheck className="h-8 w-8 text-primary shrink-0" />
        {!collapsed && (
          <motion.span
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="ml-3 font-bold text-lg text-slate-800 dark:text-white tracking-wider font-sans whitespace-nowrap"
          >
            SUPPORT<span className="text-primary">FLOW</span>
          </motion.span>
        )}
      </div>

      {/* Nav Menu */}
      <div className="flex-1 py-6 overflow-y-auto px-4 space-y-1.5 scrollbar-thin">
        {menuItems.map((item) => {
          const isActive = location.pathname === item.path;
          const Icon = item.icon;

          return (
            <Link key={item.path} to={item.path}>
              <div
                className={`flex items-center px-4 py-3 rounded-xl transition-all duration-200 group relative ${
                  isActive
                    ? "bg-primary text-white shadow-md shadow-primary/20"
                    : "hover:bg-slate-200/50 dark:hover:bg-slate-800/60 hover:text-slate-900 dark:hover:text-white text-slate-500 dark:text-slate-400"
                }`}
              >
                <Icon className={`h-5 w-5 shrink-0 transition-transform group-hover:scale-105 ${isActive ? "text-white" : "text-slate-400 dark:text-slate-500"}`} />
                {!collapsed && (
                  <motion.span
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    className="ml-4 font-medium text-sm whitespace-nowrap"
                  >
                    {item.name}
                  </motion.span>
                )}
                {collapsed && (
                  <div className="absolute left-20 bg-slate-800 dark:bg-slate-950 text-white text-xs px-2.5 py-1.5 rounded-md opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none whitespace-nowrap z-50 shadow-lg border border-slate-700 dark:border-slate-800">
                    {item.name}
                  </div>
                )}
              </div>
            </Link>
          );
        })}
      </div>

      {/* User profile footer */}
      <div className="p-4 border-t border-slate-200 dark:border-slate-800 bg-slate-100/50 dark:bg-slate-900/50 flex flex-col gap-3 shrink-0">
        <div className="flex items-center gap-3 overflow-hidden">
          <div className="h-10 w-10 rounded-full bg-primary/25 border border-primary/40 flex items-center justify-center font-bold text-primary dark:text-white shrink-0">
            {userName.slice(0, 2).toUpperCase()}
          </div>
          {!collapsed && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="overflow-hidden">
              <p className="text-sm font-semibold text-slate-800 dark:text-white truncate">{userName}</p>
              <p className="text-xs text-slate-400 dark:text-slate-500 truncate">{role}</p>
              <div className="flex items-center gap-1.5 mt-0.5">
                <span className={`h-2 w-2 rounded-full ${isOffline ? "bg-amber-500 animate-pulse" : "bg-success animate-pulse"}`} />
                <span className="text-[10px] text-slate-500 dark:text-slate-400 font-medium truncate">
                  {isOffline ? "Offline" : "Online"}
                </span>
              </div>
            </motion.div>
          )}
        </div>

        {/* Collapse Button */}
        <button
          onClick={() => setCollapsed(!collapsed)}
          className="w-full flex items-center justify-center py-2 bg-slate-200/40 hover:bg-slate-250 dark:bg-slate-800/40 dark:hover:bg-slate-800 rounded-lg text-slate-500 hover:text-slate-800 dark:hover:text-slate-350 transition-colors"
        >
          {collapsed ? <ChevronRight className="h-4 w-4" /> : <ChevronLeft className="h-4 w-4" />}
        </button>
      </div>
    </motion.div>
  );
}
