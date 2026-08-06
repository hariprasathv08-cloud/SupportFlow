import React, { useEffect, useState } from "react";
import { Outlet, useNavigate, useOutletContext, useLocation } from "react-router-dom";
import Sidebar from "./Sidebar";
import Header from "./Header";
import { useWebSocket } from "../hooks/useWebSocket";
import { useBackendStatus } from "../hooks/useBackendStatus";
import { motion, AnimatePresence } from "framer-motion";
import { AlertCircle, CheckCircle, Info, X } from "lucide-react";

interface ToastAlert {
  id: string;
  category: string;
  severity: string;
  message: string;
}

export default function Layout() {
  const navigate = useNavigate();
  const location = useLocation();
  const token = localStorage.getItem("token");
  const userName = localStorage.getItem("user_name") || "General User";
  const role = localStorage.getItem("role") || "Viewer";

  const { metrics, connected, status } = useWebSocket();
  const [toasts, setToasts] = useState<ToastAlert[]>([]);
  const { isOffline, setIsOffline, isStarting } = useBackendStatus();
  const [showConnectedSuccess, setShowConnectedSuccess] = useState(false);

  useEffect(() => {
    if (status === "connected") {
      setShowConnectedSuccess(true);
      const timer = setTimeout(() => setShowConnectedSuccess(false), 5000);
      return () => clearTimeout(timer);
    }
  }, [status]);

  useEffect(() => {
    // Auth guard check
    if (!token) {
      navigate("/login");
      return;
    }

    // Role-based redirection from root path `/`
    if (location.pathname === "/") {
      if (role === "Viewer") {
        navigate("/MySupport", { replace: true });
      } else if (role === "Admin" || role === "Super Administrator" || role === "Administrator") {
        navigate("/Admin", { replace: true });
      }
    }
  }, [token, role, location.pathname, navigate]);

  useEffect(() => {
    // Listen to real-time threshold alert broadcasts
    const handleNewAlert = (event: Event) => {
      const alert = (event as CustomEvent).detail;
      
      const newToast: ToastAlert = {
        id: alert.id.toString(),
        category: alert.category,
        severity: alert.severity,
        message: alert.message
      };

      setToasts((prev) => [...prev, newToast]);

      // Remove after 6 seconds
      setTimeout(() => {
        removeToast(newToast.id);
      }, 6000);
    };

    window.addEventListener("sys_alert", handleNewAlert);
    return () => {
      window.removeEventListener("sys_alert", handleNewAlert);
    };
  }, []);

  const removeToast = (id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  };

  const handleLogout = () => {
    localStorage.removeItem("token");
    localStorage.removeItem("role");
    localStorage.removeItem("user_name");
    navigate("/login");
  };

  if (!token) return null;



  return (
    <div className="flex h-screen w-screen overflow-hidden bg-bgLight dark:bg-slate-950 font-sans">
      <Sidebar role={role} userName={userName} />

      <div className="flex-1 flex flex-col h-full overflow-hidden">
        <Header
          userName={userName}
          role={role}
          onLogout={handleLogout}
          alertCount={metrics?.critical_alerts_count || 0}
        />

        <main className="flex-1 overflow-y-auto px-8 py-6 select-text relative scrollbar-thin">
          {/* WebSocket disconnection notification bar */}
          {isOffline ? (
            <div className="mb-4 bg-amber-500/10 border border-amber-500/30 rounded-xl p-3 text-amber-500 text-xs font-semibold flex items-center justify-between animate-pulse">
              <span className="flex items-center gap-2">
                <Info className="h-4 w-4 shrink-0" />
                {isStarting ? "Backend is starting..." : "Working Offline. Some live features are temporarily unavailable."}
              </span>
            </div>
          ) : status === "connected" && showConnectedSuccess ? (
            <div className="mb-4 bg-emerald-500/10 border border-emerald-500/30 rounded-xl p-3 text-emerald-500 text-xs font-semibold flex items-center justify-between">
              <span className="flex items-center gap-2">
                <CheckCircle className="h-4 w-4 shrink-0 text-emerald-500" />
                Real-time service connected
              </span>
            </div>
          ) : status === "connecting" ? (
            <div className="mb-4 bg-blue-500/10 border border-blue-500/30 rounded-xl p-3 text-blue-500 text-xs font-semibold flex items-center justify-between animate-pulse">
              <span className="flex items-center gap-2">
                <Info className="h-4 w-4 shrink-0" />
                Connecting to real-time service...
              </span>
            </div>
          ) : status === "unavailable" ? (
            <div className="mb-4 bg-red-500/10 border border-red-500/30 rounded-xl p-3 text-red-500 text-xs font-semibold flex items-center justify-between animate-pulse">
              <span className="flex items-center gap-2">
                <AlertCircle className="h-4 w-4 text-red-500 shrink-0" />
                Realtime service unavailable
              </span>
            </div>
          ) : null}

          <Outlet context={{ metrics, connected }} />
        </main>
      </div>

      {/* Floating Notifications Tray */}
      <div className="fixed bottom-6 right-6 z-50 flex flex-col gap-3 w-80 max-w-full">
        <AnimatePresence>
          {toasts.map((toast) => (
            <motion.div
              key={toast.id}
              initial={{ opacity: 0, y: 30, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, x: 50 }}
              className="bg-white dark:bg-slate-900 border-l-4 border-danger rounded-lg p-4 shadow-xl flex items-start gap-3 border border-slate-200 dark:border-slate-800"
            >
              <AlertCircle className="h-5 w-5 text-danger shrink-0 mt-0.5" />
              <div className="flex-1">
                <p className="text-xs font-bold text-slate-800 dark:text-slate-200 uppercase tracking-wide">
                  {toast.category} CRITICAL ALERT
                </p>
                <p className="text-xs text-slate-600 dark:text-slate-400 mt-0.5">
                  {toast.message}
                </p>
              </div>
              <button
                onClick={() => removeToast(toast.id)}
                className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-300"
              >
                <X className="h-4 w-4" />
              </button>
            </motion.div>
          ))}
        </AnimatePresence>
      </div>
    </div>
  );
}
export function useOutletMetrics() {
  return useOutletContext<{ metrics: any; connected: boolean }>();
}
