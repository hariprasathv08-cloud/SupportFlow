import React, { useState, useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useWebSocket } from "../hooks/useWebSocket";
import { motion } from "framer-motion";
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip
} from "recharts";
import {
  Laptop,
  Ticket,
  CheckCircle,
  AlertTriangle,
  Plus,
  RefreshCw,
  TrendingUp,
  Server,
  Activity,
  User as UserIcon,
  Cpu,
  HardDrive,
  Globe,
  FileText,
  FileSpreadsheet,
  ListFilter,
  UserPlus,
  Settings,
  ShieldCheck
} from "lucide-react";
import api from "../services/api";
import { useTheme } from "../hooks/useTheme";
import { useQuery, useQueryClient } from "@tanstack/react-query";

export default function AdminDashboard() {
  const navigate = useNavigate();
  const { resolvedTheme } = useTheme();
  const isDark = resolvedTheme === "dark";
  const axisColor = isDark ? "#64748B" : "#94A3B8";
  const tooltipBg = isDark ? "#0F172A" : "#FFFFFF";
  const tooltipBorder = isDark ? "#334155" : "#E2E8F0";
  const tooltipText = isDark ? "#F8FAFC" : "#0F172A";

  const queryClient = useQueryClient();
  const [selectedDeviceId, setSelectedDeviceId] = useState<number | null>(null);

  // Parallel asynchronous widget fetching using React Query
  const { data: devices = [], isLoading: isLoadingDevices } = useQuery({
    queryKey: ["devices"],
    queryFn: () => api.getDevices(),
    staleTime: 5000,
  });

  const { data: tickets = [], isLoading: isLoadingTickets } = useQuery({
    queryKey: ["tickets"],
    queryFn: () => api.get("/tickets") as Promise<any[]>,
    staleTime: 10000,
  });

  const { data: administrators = [], isLoading: isLoadingAdmins } = useQuery({
    queryKey: ["administrators"],
    queryFn: async () => {
      const allUsers: any = await api.listUsers();
      return allUsers.filter((u: any) => u.role === "Administrator" || u.role === "Super Administrator" || u.role === "Admin");
    },
    staleTime: 30000,
  });

  const { data: audits = [], isLoading: isLoadingAudits } = useQuery({
    queryKey: ["audits"],
    queryFn: async () => {
      const data: any = await api.get("/users/audits");
      return data.slice(0, 5);
    },
    staleTime: 10000,
  });

  // Auto-select first device
  useEffect(() => {
    if (devices.length > 0 && selectedDeviceId === null) {
      setSelectedDeviceId(devices[0].id);
    }
  }, [devices, selectedDeviceId]);

  // Real-time telemetry connection for selected node
  const { metrics, connected } = useWebSocket(selectedDeviceId);

  const [historyData, setHistoryData] = useState<any[]>([]);

  // Fetch telemetry history on selected node change
  const { data: initialHistory } = useQuery({
    queryKey: ["deviceHistory", selectedDeviceId],
    queryFn: () => api.getDeviceTelemetryHistory(selectedDeviceId!),
    enabled: selectedDeviceId !== null,
    staleTime: 15000,
  });

  useEffect(() => {
    if (initialHistory) {
      setHistoryData(
        initialHistory.map((h: any) => ({
          time: new Date(h.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
          cpu: h.cpu_usage,
          ram: h.ram_usage,
          disk: h.disk_usage
        }))
      );
    }
  }, [initialHistory]);

  const handleQuickReassign = async (ticketId: number, techIdStr: string) => {
    if (!techIdStr) return;
    try {
      await api.put(`/tickets/${ticketId}`, { assigned_to_id: parseInt(techIdStr) });
      queryClient.invalidateQueries({ queryKey: ["tickets"] });
    } catch (err) {
      alert("Failed to reassign ticket.");
    }
  };

  const handleRestartAgent = async () => {
    if (!selectedDeviceId) return;
    const target = devices.find((d: any) => d.id === selectedDeviceId);
    if (!target) return;
    try {
      await api.post(`/system/restart-agent?hostname=${target.hostname}`, {});
      alert("Restart command successfully sent to agent.");
    } catch (err) {
      alert("Failed to send restart command.");
    }
  };

  useEffect(() => {
    if (metrics) {
      setHistoryData((prev) => {
        const timeStr = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
        return [
          ...prev,
          {
            time: timeStr,
            cpu: metrics.cpu.usage_percent,
            ram: metrics.ram.percent,
            disk: metrics.disks[0]?.percent || 0
          }
        ].slice(-15);
      });
    }
  }, [metrics]);

  // Logging authentication redirect and rendering duration trace
  useEffect(() => {
    const clickTimeStr = localStorage.getItem("login_click_time");
    if (clickTimeStr) {
      const clickTime = parseFloat(clickTimeStr);
      const redirectDuration = performance.now() - clickTime;
      console.log(`[AUTH PERF] End-to-end Redirect & Admin Dashboard render time: ${redirectDuration.toFixed(2)}ms`);
      localStorage.removeItem("login_click_time");
    }
  }, []);



  const getCircleStrokeProps = (percent: number, radius: number = 32) => {
    const circumference = 2 * Math.PI * radius;
    const strokeDashoffset = circumference - (percent / 100) * circumference;
    return {
      strokeDasharray: circumference,
      strokeDashoffset,
      r: radius,
      cx: radius + 4,
      cy: radius + 4
    };
  };

  const totalDevices = devices.length;
  const onlineDevices = devices.filter(d => d.status === "Online").length;
  const offlineDevices = devices.filter(d => d.status === "Offline").length;
  const openTicketsCount = tickets.filter(t => t.status !== "Resolved" && t.status !== "Closed").length;

  const activeDevice = devices.find(d => d.id === selectedDeviceId);
  const healthScore = activeDevice?.health_score ?? (metrics?.health_score ?? 100);
  const cpuVal = activeDevice?.cpu_usage ?? (metrics?.cpu.usage_percent ?? 0);
  const ramVal = activeDevice?.ram_usage ?? (metrics?.ram.percent ?? 0);
  const diskVal = activeDevice?.disk_usage ?? (metrics?.disks[0]?.percent ?? 0);

  return (
    <div className="flex flex-col gap-6 text-slate-200">
      
      {/* Top Controls */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-white">
            IT Operations Dashboard
          </h1>
          <p className="text-xs text-slate-500 mt-0.5">
            Complete visibility and control over the IT enterprise environment.
          </p>
        </div>

        {totalDevices > 0 && (
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2 bg-slate-900 border border-slate-800 rounded-xl px-3 py-1.5 shadow-sm">
              <span className="text-xs font-semibold text-slate-500">Node:</span>
              <select
                value={selectedDeviceId ?? ""}
                onChange={(e) => setSelectedDeviceId(Number(e.target.value))}
                className="text-xs font-bold text-slate-350 bg-transparent border-none focus:outline-none cursor-pointer"
              >
                {devices.map((d) => (
                  <option key={d.id} value={d.id} className="bg-slate-950">
                    {d.hostname} ({d.os}) {d.status === "Offline" ? "[OFFLINE]" : ""}
                  </option>
                ))}
              </select>
              <span className={`h-2.5 w-2.5 rounded-full ${connected ? "bg-success animate-pulse" : "bg-danger"}`} />
            </div>

            <button
              onClick={() => navigate("/tickets")}
              className="flex items-center gap-2 px-4 py-2 bg-primary hover:bg-primary-dark text-white rounded-xl text-xs font-semibold shadow-md active:scale-95 transition-all"
            >
              <Plus className="h-4 w-4" />
              Create Ticket
            </button>
          </div>
        )}
      </div>

      {isLoadingDevices ? (
        <div className="py-24 px-4 text-center bg-slate-900/60 border border-slate-800 rounded-xl animate-pulse">
          <Server className="h-12 w-12 text-slate-700 mx-auto mb-4" />
          <h2 className="text-base font-bold text-white">Loading diagnostics network...</h2>
        </div>
      ) : totalDevices === 0 ? (
        <div className="py-24 px-4 text-center bg-slate-900/60 border border-slate-800 rounded-xl">
          <Server className="h-12 w-12 text-slate-700 mx-auto mb-4 animate-pulse" />
          <h2 className="text-base font-bold text-white">No monitoring agents connected.</h2>
          <p className="text-xs text-slate-500 mt-2 max-w-md mx-auto leading-relaxed">
            There are currently no machines connected to SupportFlow. Install or start the lightweight client-side daemon on your hosts to collect telemetry.
          </p>
        </div>
      ) : (
        <>
          {/* Row 1: Summary Cards */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-5">
            <div className="bg-slate-900/60 border border-slate-800/80 rounded-card p-5 shadow-soft flex items-center justify-between group hover:border-primary/20 transition-all">
              <div className="flex items-center gap-4">
                <div className="h-12 w-12 rounded-xl bg-success/10 flex items-center justify-center text-success shrink-0">
                  <Activity className="h-6 w-6" />
                </div>
                <div>
                  <p className="text-xs font-medium text-slate-500">Online Endpoints</p>
                  <p className="text-2xl font-bold text-success mt-0.5">{onlineDevices}</p>
                </div>
              </div>
            </div>

            <div className="bg-slate-900/60 border border-slate-800/80 rounded-card p-5 shadow-soft flex items-center justify-between group hover:border-danger/20 transition-all">
              <div className="flex items-center gap-4">
                <div className="h-12 w-12 rounded-xl bg-danger/10 flex items-center justify-center text-danger shrink-0">
                  <Server className="h-6 w-6" />
                </div>
                <div>
                  <p className="text-xs font-medium text-slate-500">Offline Endpoints</p>
                  <p className="text-2xl font-bold text-danger mt-0.5">{offlineDevices}</p>
                </div>
              </div>
            </div>

            <div className="bg-slate-900/60 border border-slate-800/80 rounded-card p-5 shadow-soft flex items-center justify-between group hover:border-warning/20 transition-all">
              <div className="flex items-center gap-4">
                <div className="h-12 w-12 rounded-xl bg-warning/10 flex items-center justify-center text-warning shrink-0">
                  <Ticket className="h-6 w-6" />
                </div>
                <div>
                  <p className="text-xs font-medium text-slate-500">Open Tickets</p>
                  <p className="text-2xl font-bold text-white mt-0.5">{openTicketsCount}</p>
                </div>
              </div>
            </div>

            <div className="bg-slate-900/60 border border-slate-800/80 rounded-card p-5 shadow-soft flex items-center justify-between group hover:border-primary/20 transition-all">
              <div className="flex items-center gap-4">
                <div className="h-12 w-12 rounded-xl bg-primary/10 flex items-center justify-center text-primary shrink-0">
                  <Laptop className="h-6 w-6" />
                </div>
                <div>
                  <p className="text-xs font-medium text-slate-500">Asset Summary</p>
                  <p className="text-2xl font-bold text-white mt-0.5">{totalDevices} Nodes</p>
                </div>
              </div>
            </div>
          </div>

          {/* Row 2: Selected Node Dial Overview & Live Charts */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
            <div className="bg-slate-900/60 border border-slate-800/80 rounded-card p-5 col-span-1 lg:col-span-4 flex flex-col justify-between">
              {isLoadingDevices ? (
                <div className="h-64 flex items-center justify-center animate-pulse py-12">
                  <div className="flex flex-col items-center gap-2">
                    <div className="h-16 w-16 rounded-full bg-slate-800/60" />
                    <div className="h-4 bg-slate-800/60 w-32 rounded animate-pulse" />
                    <div className="h-3 bg-slate-800/60 w-24 rounded animate-pulse" />
                  </div>
                </div>
              ) : (
                <>
                  <div className="flex items-center justify-between border-b border-slate-800 pb-3">
                    <div>
                      <h2 className="text-sm font-bold text-white">Node Health Index</h2>
                      <span className="text-[10px] text-slate-550">{activeDevice?.hostname || "Local Node"}</span>
                    </div>
                    <span className="text-xs font-bold text-white">{healthScore}%</span>
                  </div>

              <div className="grid grid-cols-3 gap-2 my-5 text-center">
                <div className="flex flex-col items-center">
                  <div className="relative h-[72px] w-[72px] mb-2 flex items-center justify-center">
                    <svg className="absolute transform -rotate-90 h-[72px] w-[72px]">
                      <circle className="text-slate-800" strokeWidth="4" stroke="currentColor" fill="transparent" r="32" cx="36" cy="36" />
                      <circle className="text-primary" strokeWidth="4" {...getCircleStrokeProps(cpuVal)} strokeLinecap="round" stroke="currentColor" fill="transparent" />
                    </svg>
                    <span className="text-[10px] font-bold text-slate-300">{Math.round(cpuVal)}%</span>
                  </div>
                  <span className="text-[10px] font-medium text-slate-500 flex items-center gap-1"><Cpu className="h-3.5 w-3.5" /> CPU</span>
                </div>

                <div className="flex flex-col items-center">
                  <div className="relative h-[72px] w-[72px] mb-2 flex items-center justify-center">
                    <svg className="absolute transform -rotate-90 h-[72px] w-[72px]">
                      <circle className="text-slate-800" strokeWidth="4" stroke="currentColor" fill="transparent" r="32" cx="36" cy="36" />
                      <circle className="text-purple-500" strokeWidth="4" {...getCircleStrokeProps(ramVal)} strokeLinecap="round" stroke="currentColor" fill="transparent" />
                    </svg>
                    <span className="text-[10px] font-bold text-slate-300">{Math.round(ramVal)}%</span>
                  </div>
                  <span className="text-[10px] font-medium text-slate-500 flex items-center gap-1"><Activity className="h-3.5 w-3.5" /> RAM</span>
                </div>

                <div className="flex flex-col items-center">
                  <div className="relative h-[72px] w-[72px] mb-2 flex items-center justify-center">
                    <svg className="absolute transform -rotate-90 h-[72px] w-[72px]">
                      <circle className="text-slate-800" strokeWidth="4" stroke="currentColor" fill="transparent" r="32" cx="36" cy="36" />
                      <circle className="text-orange-500" strokeWidth="4" {...getCircleStrokeProps(diskVal)} strokeLinecap="round" stroke="currentColor" fill="transparent" />
                    </svg>
                    <span className="text-[10px] font-bold text-slate-300">{Math.round(diskVal)}%</span>
                  </div>
                  <span className="text-[10px] font-medium text-slate-500 flex items-center gap-1"><HardDrive className="h-3.5 w-3.5" /> Disk</span>
                </div>
              </div>

              <div className="bg-slate-955 p-3 rounded-xl text-xs flex flex-col gap-2 border border-slate-800/80">
                <div className="flex justify-between">
                  <span className="text-slate-500">OS Platform:</span>
                  <span className="font-bold text-slate-300">{activeDevice?.os || "N/A"}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Local Address:</span>
                  <span className="font-bold text-slate-300">{activeDevice?.ip_address || "N/A"}</span>
                </div>
              </div>
                </>
              )}
            </div>

            {/* Recharts resource history */}
            <div className="bg-slate-900/60 border border-slate-800/80 rounded-card p-5 col-span-1 lg:col-span-8 flex flex-col justify-between">
              {isLoadingDevices ? (
                <div className="h-64 bg-slate-850/40 animate-pulse rounded-xl flex items-center justify-center">
                  <div className="text-slate-500 text-xs font-semibold">Loading telemetry historical logs...</div>
                </div>
              ) : (
                <>
                  <div className="flex items-center justify-between border-b border-slate-800 pb-3 mb-4">
                <div>
                  <h2 className="text-sm font-bold text-white">Live Resource Monitoring</h2>
                  <p className="text-[10px] text-slate-550">Telemetry tracking history logged dynamically</p>
                </div>
                <div className="flex items-center gap-4 text-[10px] font-semibold">
                  <span className="flex items-center gap-1.5 text-primary"><span className="h-2 w-2 rounded-full bg-primary" /> CPU</span>
                  <span className="flex items-center gap-1.5 text-purple-500"><span className="h-2 w-2 rounded-full bg-purple-500" /> RAM</span>
                </div>
              </div>

              <div className="h-56 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={historyData}>
                    <defs>
                      <linearGradient id="colorCpu" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#2563EB" stopOpacity={0.2}/>
                        <stop offset="95%" stopColor="#2563EB" stopOpacity={0}/>
                      </linearGradient>
                      <linearGradient id="colorRam" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#A855F7" stopOpacity={0.2}/>
                        <stop offset="95%" stopColor="#A855F7" stopOpacity={0}/>
                      </linearGradient>
                    </defs>
                    <XAxis dataKey="time" tick={{ fontSize: 8 }} stroke={axisColor} />
                    <YAxis domain={[0, 100]} tick={{ fontSize: 8 }} stroke={axisColor} />
                    <Tooltip contentStyle={{ background: tooltipBg, border: `1px solid ${tooltipBorder}`, borderRadius: '12px', color: tooltipText, fontSize: '10px' }} />
                    <Area type="monotone" dataKey="cpu" stroke="#2563EB" strokeWidth={2} fillOpacity={1} fill="url(#colorCpu)" />
                    <Area type="monotone" dataKey="ram" stroke="#A855F7" strokeWidth={2} fillOpacity={1} fill="url(#colorRam)" />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
              </>
              )}
            </div>
          </div>

          {/* Row 3: Support Incidents Quick Reassignment */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
            
            {/* Ticket Reassign Desk */}
            <div className="bg-slate-900/60 border border-slate-800/80 rounded-card p-5 shadow-soft flex flex-col">
              <div className="flex justify-between items-center border-b border-slate-800 pb-3 mb-4">
                <h2 className="text-sm font-bold text-white flex items-center gap-2">
                  <Ticket className="h-4.5 w-4.5 text-primary" /> Incident Routing Desk
                </h2>
                <Link to="/tickets" className="text-xs text-primary hover:underline font-semibold">Incident Queue</Link>
              </div>

              <div className="space-y-3 max-h-64 overflow-y-auto scrollbar-thin">
                {isLoadingTickets || isLoadingAdmins ? (
                  <>
                    <div className="h-12 bg-slate-850/50 rounded-xl animate-pulse" />
                    <div className="h-12 bg-slate-850/50 rounded-xl animate-pulse" />
                  </>
                ) : (
                  <>
                    {tickets.filter((t: any) => t.status !== "Resolved" && t.status !== "Closed").slice(0, 4).map((ticket: any) => (
                      <div key={ticket.id} className="p-3 bg-slate-955 border border-slate-850 rounded-xl flex justify-between items-center gap-4">
                        <div className="min-w-0">
                          <p className="text-xs font-bold text-slate-200 truncate">{ticket.title}</p>
                          <p className="text-[9px] text-slate-500 mt-1 font-mono">#TIC-{1000 + ticket.id} • Priority: <span className="text-slate-400 font-bold">{ticket.priority}</span></p>
                        </div>
                        <div className="flex items-center gap-2 shrink-0">
                           <select
                            value={ticket.assigned_to_id || ""}
                            onChange={(e) => handleQuickReassign(ticket.id, e.target.value)}
                            className="bg-slate-900 border border-slate-800 rounded px-2.5 py-1 text-[10px] text-slate-300 focus:outline-none"
                          >
                            <option value="">Unassigned</option>
                            {administrators.map((t: any) => (
                              <option key={t.id} value={t.id}>{t.full_name}</option>
                            ))}
                          </select>
                        </div>
                      </div>
                    ))}
                    {tickets.filter((t: any) => t.status !== "Resolved" && t.status !== "Closed").length === 0 && (
                      <div className="p-8 text-center text-slate-500 text-xs">
                        No active incidents require routing.
                      </div>
                    )}
                  </>
                )}
              </div>
            </div>

            {/* Audit Log Stream (Recent Activities) */}
            <div className="bg-slate-900/60 border border-slate-800/80 rounded-card p-5 shadow-soft flex flex-col">
              <div className="flex justify-between items-center border-b border-slate-800 pb-3 mb-4">
                <h2 className="text-sm font-bold text-white flex items-center gap-2">
                  <UserIcon className="h-4.5 w-4.5 text-primary" /> Recent Activities
                </h2>
                <Link to="/users" className="text-xs text-primary hover:underline font-semibold">User Directory</Link>
              </div>

              <div className="space-y-3 max-h-64 overflow-y-auto scrollbar-thin">
                {isLoadingAudits ? (
                  <>
                    <div className="h-12 bg-slate-850/50 rounded-xl animate-pulse" />
                    <div className="h-12 bg-slate-850/50 rounded-xl animate-pulse" />
                  </>
                ) : (
                  <>
                    {audits.map((log: any) => (
                      <div key={log.id} className="p-3 bg-slate-955 border border-slate-850 rounded-xl text-xs space-y-1">
                        <div className="flex justify-between">
                          <span className="font-bold text-primary text-[10px] uppercase">{log.action}</span>
                          <span className="font-mono text-slate-550 text-[9px]">{new Date(log.created_at).toLocaleTimeString()}</span>
                        </div>
                        <p className="text-slate-350 text-[10px] leading-relaxed">{log.details}</p>
                      </div>
                    ))}
                    {audits.length === 0 && (
                      <div className="p-8 text-center text-slate-500 text-xs">
                        No system audits logged in directory.
                      </div>
                    )}
                  </>
                )}
              </div>
            </div>

          </div>

          {/* Quick Actions Panel */}
          <div className="bg-slate-900/60 border border-slate-800/80 rounded-card p-5 shadow-soft">
            <h2 className="text-sm font-bold text-white border-b border-slate-800 pb-3 mb-4">
              Quick Actions
            </h2>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <button
                onClick={() => navigate("/users")}
                className="p-4 bg-slate-955 hover:bg-slate-850 border border-slate-800/85 hover:border-slate-850 rounded-xl flex items-center gap-3 transition-all text-left"
              >
                <div className="h-10 w-10 bg-primary/10 rounded-lg flex items-center justify-center text-primary shrink-0">
                  <UserPlus className="h-5 w-5" />
                </div>
                <div>
                  <h4 className="text-xs font-bold text-white">Create User</h4>
                  <p className="text-[10px] text-slate-550 mt-0.5">Add staff credentials</p>
                </div>
              </button>

              <button
                onClick={handleRestartAgent}
                className="p-4 bg-slate-955 hover:bg-slate-850 border border-slate-800/85 hover:border-slate-850 rounded-xl flex items-center gap-3 transition-all text-left"
              >
                <div className="h-10 w-10 bg-primary/10 rounded-lg flex items-center justify-center text-primary shrink-0">
                  <RefreshCw className="h-5 w-5" />
                </div>
                <div>
                  <h4 className="text-xs font-bold text-white">Restart Agent</h4>
                  <p className="text-[10px] text-slate-550 mt-0.5">Reboot telemetry services</p>
                </div>
              </button>

              <button
                onClick={() => navigate("/reports")}
                className="p-4 bg-slate-955 hover:bg-slate-850 border border-slate-800/85 hover:border-slate-850 rounded-xl flex items-center gap-3 transition-all text-left"
              >
                <div className="h-10 w-10 bg-primary/10 rounded-lg flex items-center justify-center text-primary shrink-0">
                  <FileSpreadsheet className="h-5 w-5" />
                </div>
                <div>
                  <h4 className="text-xs font-bold text-white">Export Reports</h4>
                  <p className="text-[10px] text-slate-550 mt-0.5">Generate Excel/CSV files</p>
                </div>
              </button>
            </div>
          </div>
        </>
      )}

    </div>
  );
}
