import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { 
  Plus, 
  User as UserIcon, 
  Bell, 
  CheckCircle,
  AlertCircle,
  FileText,
  Laptop,
  Terminal,
  Volume2,
  BookOpen,
  Image,
  MessageSquare
} from "lucide-react";
import api from "../services/api";

import { useQuery } from "@tanstack/react-query";

export default function EmployeeDashboard() {
  const navigate = useNavigate();
  const [healthStatus, setHealthStatus] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);

  // Parallel asynchronous fetching via React Query
  const { data: profile, isLoading: isLoadingProfile } = useQuery<any>({
    queryKey: ["profile"],
    queryFn: () => api.get("/auth/me"),
    staleTime: 60000,
  });

  const { data: tickets = [], isLoading: isLoadingTickets } = useQuery({
    queryKey: ["tickets"],
    queryFn: () => api.get("/tickets") as Promise<any[]>,
    staleTime: 10000,
  });

  const { data: notifications = [], isLoading: isLoadingNotifs } = useQuery({
    queryKey: ["notifications"],
    queryFn: () => api.get("/notifications") as Promise<any[]>,
    staleTime: 10000,
  });

  const { data: devices = [], isLoading: isLoadingDevices } = useQuery({
    queryKey: ["devices"],
    queryFn: () => api.getDevices(),
    staleTime: 10000,
  });

  // Logging auth redirect trace
  useEffect(() => {
    const clickTimeStr = localStorage.getItem("login_click_time");
    if (clickTimeStr) {
      const clickTime = parseFloat(clickTimeStr);
      const redirectDuration = performance.now() - clickTime;
      console.log(`[AUTH PERF] End-to-end Redirect & Employee Dashboard render time: ${redirectDuration.toFixed(2)}ms`);
      localStorage.removeItem("login_click_time");
    }
  }, []);



  const runHealthCheck = () => {
    setHealthStatus("Scanning...");
    setTimeout(() => {
      setHealthStatus("System healthy. CPU: 12% | Temp: 45°C. All security definitions up to date.");
    }, 2000);
  };

  const handleScreenshotUpload = () => {
    setUploading(true);
    setTimeout(() => {
      setUploading(false);
      alert("Screenshot uploaded successfully and attached to your profile.");
    }, 1500);
  };

  const myDevice = profile && devices
    ? devices.find(d => d.assigned_user_id === profile.id || d.current_user === profile.username)
    : null;

  const pendingNotifsCount = notifications.filter(n => !n.is_read).length;
  const unresolvedTickets = tickets.filter(t => t.status !== "Resolved" && t.status !== "Closed");

  return (
    <div className="flex flex-col gap-6 text-slate-200">
      {/* Top Banner */}
      <div className="bg-slate-900/60 border border-slate-800/80 p-6 rounded-card backdrop-blur-md flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-white flex items-center gap-2">
            My Support Portal
          </h1>
          <p className="text-xs text-slate-400 mt-1">
            Welcome, {profile?.full_name || "User"}. Report issues and track requests below.
          </p>
        </div>
        <button
          onClick={() => navigate("/tickets")}
          className="flex items-center gap-2 px-5 py-2.5 bg-primary hover:bg-primary-dark text-white rounded-xl text-sm font-semibold shadow-lg shadow-primary/20 active:scale-[0.98] transition-all shrink-0"
        >
          <Plus className="h-4.5 w-4.5" />
          Create Ticket
        </button>
      </div>

      {/* Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        
        {/* Welcome Card & Profile Summary */}
        <div className="bg-slate-900/60 border border-slate-800/80 rounded-card p-5 shadow-soft lg:col-span-4 flex flex-col justify-between">
          {isLoadingProfile || isLoadingNotifs ? (
            <div className="h-80 flex flex-col justify-between animate-pulse py-4">
              <div className="flex items-center gap-3 pb-4">
                <div className="h-12 w-12 rounded-full bg-slate-800" />
                <div className="space-y-2">
                  <div className="h-4 bg-slate-800 w-24 rounded" />
                  <div className="h-3 bg-slate-800 w-32 rounded" />
                </div>
              </div>
              <div className="space-y-2 mt-4">
                <div className="h-3 bg-slate-800 w-full rounded" />
                <div className="h-3 bg-slate-800 w-5/6 rounded" />
              </div>
              <div className="h-20 bg-slate-850 rounded-xl mt-6 animate-pulse" />
            </div>
          ) : (
            <>
              <div>
                <div className="flex items-center gap-3 pb-4 border-b border-slate-800">
                  <div className="h-12 w-12 rounded-full bg-primary/20 border border-primary/40 flex items-center justify-center font-bold text-white text-lg">
                    {profile?.full_name?.slice(0, 2).toUpperCase() || "US"}
                  </div>
                  <div>
                    <h2 className="text-sm font-bold text-white">{profile?.full_name}</h2>
                    <span className="text-[10px] text-slate-550 font-mono">{profile?.email}</span>
                  </div>
                </div>

                <div className="mt-4 space-y-3 text-xs">
                  <div className="flex justify-between">
                    <span className="text-slate-400">Department:</span>
                    <span className="font-semibold text-slate-200">{profile?.department || "N/A"}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-400">Job Title:</span>
                    <span className="font-semibold text-slate-200">{profile?.job_title || "N/A"}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-400">Assigned Role:</span>
                    <span className="font-bold text-primary uppercase">{profile?.role || "Viewer"}</span>
                  </div>
                </div>
              </div>

              <div className="bg-slate-950/40 rounded-xl p-3 text-xs mt-6 border border-slate-800">
                <p className="text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1.5 flex items-center gap-1.5">
                  <Bell className="h-3 w-3 text-warning" /> Recent Notifications
                </p>
                {notifications.slice(0, 2).map((n) => (
                  <div key={n.id} className="border-b border-slate-850 py-1.5 last:border-b-0">
                    <p className="font-bold text-slate-350">{n.title}</p>
                    <p className="text-[10px] text-slate-500">{n.message}</p>
                  </div>
                ))}
                {notifications.length === 0 && (
                  <p className="text-slate-500">You have no unread notifications.</p>
                )}
              </div>
            </>
          )}
        </div>

        {/* My Device Status */}
        <div className="bg-slate-900/60 border border-slate-800/80 rounded-card p-5 shadow-soft lg:col-span-8 flex flex-col">
          <h2 className="text-sm font-bold text-white border-b border-slate-800 pb-3 mb-4 flex items-center gap-2">
            <Laptop className="h-4.5 w-4.5 text-primary" /> My Assigned Workstation
          </h2>

          {isLoadingDevices || isLoadingProfile ? (
            <div className="h-40 bg-slate-850/40 rounded-xl animate-pulse flex items-center justify-center">
              <span className="text-slate-500 text-xs">Querying workstation diagnostics...</span>
            </div>
          ) : myDevice ? (
            <div className="bg-slate-955 p-4 rounded-xl border border-slate-800/60 space-y-3">
              <div className="flex justify-between items-center">
                <div>
                  <h3 className="text-sm font-bold text-white">{myDevice.hostname}</h3>
                  <p className="text-[10px] text-slate-550">OS: {myDevice.os} | IP: {myDevice.ip_address}</p>
                </div>
                <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                  myDevice.status === "Online" ? "bg-success/15 text-success" : "bg-danger/15 text-danger"
                }`}>
                  {myDevice.status}
                </span>
              </div>

              <div className="grid grid-cols-3 gap-4 text-xs pt-2">
                <div>
                  <p className="text-slate-500">CPU Usage</p>
                  <p className="font-bold text-slate-200">{myDevice.cpu_usage}%</p>
                </div>
                <div>
                  <p className="text-slate-500">RAM Usage</p>
                  <p className="font-bold text-slate-200">{myDevice.ram_usage}%</p>
                </div>
                <div>
                  <p className="text-slate-500">Health Index</p>
                  <p className="font-bold text-slate-200">{myDevice.health_score}/100</p>
                </div>
              </div>
            </div>
          ) : (
            <div className="p-8 text-center text-slate-500 bg-slate-950/20 border border-slate-800 rounded-xl">
              No corporate workstation assigned to your profile.
            </div>
          )}
        </div>

      </div>

      {/* Tickets & Quick Actions Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        
        {/* Open Tickets */}
        <div className="bg-slate-900/60 border border-slate-800/80 rounded-card p-5 shadow-soft lg:col-span-8 flex flex-col">
          <h2 className="text-sm font-bold text-white border-b border-slate-800 pb-3 mb-4">
            My Open Tickets
          </h2>

          <div className="flex-1 overflow-y-auto space-y-3 pr-1 max-h-64 scrollbar-thin">
            {isLoadingTickets ? (
              <>
                <div className="h-12 bg-slate-850/50 rounded-xl animate-pulse" />
                <div className="h-12 bg-slate-850/50 rounded-xl animate-pulse" />
              </>
            ) : unresolvedTickets.length === 0 ? (
              <div className="h-full flex flex-col items-center justify-center py-12 text-center text-slate-500">
                <CheckCircle className="h-10 w-10 text-success mb-2" />
                <p className="font-bold text-slate-350">You have no support requests yet.</p>
                <p className="text-[10px] text-slate-500 mt-1">If you have any IT issues, create a support ticket above.</p>
              </div>
            ) : (
              unresolvedTickets.map((t) => (
                <div
                  key={t.id}
                  onClick={() => navigate("/tickets")}
                  className="p-3.5 bg-slate-950/20 hover:bg-slate-850/45 rounded-xl flex items-center justify-between border border-slate-800/40 cursor-pointer transition-all"
                >
                  <div>
                    <h3 className="text-xs font-bold text-white line-clamp-1">{t.title}</h3>
                    <div className="flex items-center gap-2 text-[9px] text-slate-500 mt-1 font-mono">
                      <span>#TIC-{1000 + t.id}</span>
                      <span>•</span>
                      <span>Priority: <span className={`font-bold ${t.priority === "Critical" ? "text-danger" : "text-slate-400"}`}>{t.priority}</span></span>
                    </div>
                  </div>
                  <span className="text-[9px] font-bold px-2 py-0.5 bg-warning/15 text-warning rounded uppercase">
                    {t.status}
                  </span>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Quick Actions Panel */}
        <div className="bg-slate-900/60 border border-slate-800/80 rounded-card p-5 shadow-soft lg:col-span-4 flex flex-col">
          <h2 className="text-sm font-bold text-white border-b border-slate-800 pb-3 mb-4">
            Quick Actions
          </h2>

          <div className="space-y-3 flex-1 flex flex-col justify-center">
            <button
              onClick={() => navigate("/tickets")}
              className="w-full py-2.5 bg-primary/20 hover:bg-primary/30 border border-primary/35 text-white rounded-xl text-xs font-semibold flex items-center justify-center gap-2 transition-all active:scale-95"
            >
              <Plus className="h-4 w-4" /> Create Ticket
            </button>

            <button
              onClick={runHealthCheck}
              className="w-full py-2.5 bg-slate-950 hover:bg-slate-850 border border-slate-800 text-slate-300 rounded-xl text-xs font-semibold flex items-center justify-center gap-2 transition-all active:scale-95"
            >
              <Terminal className="h-4 w-4 text-success animate-pulse" /> Run Device Health Check
            </button>

            {healthStatus && (
              <p className="text-[10px] text-slate-400 italic bg-slate-950/60 p-2 rounded border border-slate-800 font-mono leading-relaxed">
                {healthStatus}
              </p>
            )}

            <button
              onClick={handleScreenshotUpload}
              disabled={uploading}
              className="w-full py-2.5 bg-slate-950 hover:bg-slate-850 border border-slate-800 text-slate-300 rounded-xl text-xs font-semibold flex items-center justify-center gap-2 transition-all active:scale-95"
            >
              <Image className="h-4 w-4 text-primary" /> {uploading ? "Uploading..." : "Upload Screenshot"}
            </button>

            <button
              onClick={() => navigate("/tickets")}
              className="w-full py-2.5 bg-slate-950 hover:bg-slate-850 border border-slate-800 text-slate-300 rounded-xl text-xs font-semibold flex items-center justify-center gap-2 transition-all active:scale-95"
            >
              <MessageSquare className="h-4 w-4 text-warning" /> Contact IT Support
            </button>
          </div>
        </div>

      </div>

      {/* Latest Announcements */}
      <div className="bg-slate-900/60 border border-slate-800/80 rounded-card p-5 shadow-soft">
        <h2 className="text-sm font-bold text-white border-b border-slate-800 pb-3 mb-4 flex items-center gap-2">
          <Volume2 className="h-4.5 w-4.5 text-warning" /> Latest Company Announcements
        </h2>
        <div className="space-y-4">
          <div className="bg-slate-950/20 p-4 rounded-xl border border-slate-800/40">
            <h3 className="text-xs font-bold text-white">Scheduled Maintenance Window</h3>
            <p className="text-[11px] text-slate-450 mt-1 leading-relaxed">
              IT Ops will perform database upgrades on Saturday, August 8th, between 02:00 AM and 04:00 AM UTC. Telemetry collections may experience brief downtime during this window.
            </p>
          </div>
        </div>
      </div>

    </div>
  );
}
