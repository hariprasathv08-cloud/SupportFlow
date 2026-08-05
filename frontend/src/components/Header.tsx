import React, { useState } from "react";
import { Bell, HelpCircle, LogOut, Search, Sun, Moon, Laptop } from "lucide-react";
import { Link } from "react-router-dom";
import { useTheme } from "../hooks/useTheme";
import { useBackendStatus } from "../hooks/useBackendStatus";

interface HeaderProps {
  userName: string;
  role: string;
  onLogout: () => void;
  alertCount: number;
}

export default function Header({ userName, role, onLogout, alertCount }: HeaderProps) {
  const { theme, setTheme } = useTheme();
  const [showThemeDropdown, setShowThemeDropdown] = useState(false);
  const { isOffline } = useBackendStatus();

  return (
    <header className="h-16 bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between px-8 select-none shrink-0 z-40 shadow-sm">
      {/* Search Container */}
      <div className="relative w-72">
        <span className="absolute inset-y-0 left-3 flex items-center pointer-events-none text-slate-400">
          <Search className="h-4 w-4" />
        </span>
        <input
          type="text"
          placeholder="Search anything..."
          className="w-full bg-slate-50 dark:bg-slate-800 pl-10 pr-4 py-2 text-sm rounded-lg border border-slate-200 dark:border-slate-700 focus:outline-none focus:ring-1 focus:ring-primary focus:border-primary text-slate-700 dark:text-slate-200 transition-colors"
        />
      </div>

      {/* Right Controls */}
      <div className="flex items-center gap-5">
        {/* Theme Toggle Dropdown */}
        <div className="relative">
          <button
            onClick={() => setShowThemeDropdown(!showThemeDropdown)}
            className="p-2 rounded-lg bg-slate-50 dark:bg-slate-800 text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-white transition-colors flex items-center justify-center"
            title="Toggle Theme"
          >
            {theme === "light" && <Sun className="h-4 w-4" />}
            {theme === "dark" && <Moon className="h-4 w-4" />}
            {theme === "system" && <Laptop className="h-4 w-4" />}
          </button>
          
          {showThemeDropdown && (
            <>
              <div 
                className="fixed inset-0 z-40" 
                onClick={() => setShowThemeDropdown(false)} 
              />
              <div className="absolute right-0 mt-2 w-36 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl shadow-lg py-1 z-50">
                <button
                  onClick={() => { setTheme("light"); setShowThemeDropdown(false); }}
                  className={`w-full text-left px-4 py-2 text-xs flex items-center gap-2 hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-200 ${theme === 'light' ? 'font-bold text-primary' : ''}`}
                >
                  <Sun className="h-3.5 w-3.5" />
                  Light Mode
                </button>
                <button
                  onClick={() => { setTheme("dark"); setShowThemeDropdown(false); }}
                  className={`w-full text-left px-4 py-2 text-xs flex items-center gap-2 hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-200 ${theme === 'dark' ? 'font-bold text-primary' : ''}`}
                >
                  <Moon className="h-3.5 w-3.5" />
                  Dark Mode
                </button>
                <button
                  onClick={() => { setTheme("system"); setShowThemeDropdown(false); }}
                  className={`w-full text-left px-4 py-2 text-xs flex items-center gap-2 hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-200 ${theme === 'system' ? 'font-bold text-primary' : ''}`}
                >
                  <Laptop className="h-3.5 w-3.5" />
                  System Auto
                </button>
              </div>
            </>
          )}
        </div>

        {/* Alert Bell */}
        <Link to="/alerts" className="relative p-2 rounded-lg bg-slate-50 dark:bg-slate-800 text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-white transition-colors">
          <Bell className="h-4 w-4" />
          {alertCount > 0 && (
            <span className="absolute -top-1 -right-1 bg-danger text-white text-[10px] font-bold h-4 min-w-4 px-1 rounded-full flex items-center justify-center animate-bounce">
              {alertCount}
            </span>
          )}
        </Link>

        {/* Help Center */}
        <button className="p-2 rounded-lg bg-slate-50 dark:bg-slate-800 text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-white transition-colors">
          <HelpCircle className="h-4 w-4" />
        </button>

        {isOffline && (
          <span className="flex items-center gap-1.5 px-2.5 py-1 bg-amber-500/10 border border-amber-500/20 text-amber-500 rounded-full text-[9px] font-bold tracking-wide uppercase">
            <span className="h-1.5 w-1.5 rounded-full bg-amber-500 animate-pulse" />
            Offline
          </span>
        )}

        <span className="h-6 w-px bg-slate-200 dark:bg-slate-700" />

        {/* Profile Card */}
        <div className="flex items-center gap-3">
          <div className="text-right">
            <p className="text-xs font-semibold text-slate-700 dark:text-slate-200">{userName}</p>
            <p className="text-[10px] text-slate-400 dark:text-slate-500 font-medium capitalize">{role}</p>
          </div>
          <div className="h-8 w-8 rounded-full bg-primary/10 border border-primary/20 flex items-center justify-center font-bold text-primary select-none text-xs">
            {userName.slice(0, 2).toUpperCase()}
          </div>
          
          {/* Logout Action */}
          <button
            onClick={onLogout}
            className="p-2 rounded-lg bg-slate-50 hover:bg-danger/10 text-slate-500 hover:text-danger dark:bg-slate-800 dark:hover:bg-danger/20 dark:text-slate-400 dark:hover:text-danger transition-all duration-200"
            title="Log Out"
          >
            <LogOut className="h-4 w-4" />
          </button>
        </div>
      </div>
    </header>
  );
}
