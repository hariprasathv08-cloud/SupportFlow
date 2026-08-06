import { useState, useEffect } from "react";
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
  User,
  Cpu,
  HardDrive,
  Globe
} from "lucide-react";
import api from "../services/api";
import { useTheme } from "../hooks/useTheme";

import { useQuery } from "@tanstack/react-query";

export default function Dashboard() {
  const navigate = useNavigate();
  const { resolvedTheme } = useTheme();
  const isDark = resolvedTheme === "dark";
  const axisColor = isDark ? "#64748B" : "#94A3B8";
  const tooltipBg = isDark ? "#0F172A" : "#FFFFFF";
  const tooltipBorder = isDark ? "#334155" : "#E2E8F0";
  const tooltipText = isDark ? "#F8FAFC" : "#0F172A";

  const [selectedDeviceId, setSelectedDeviceId] = useState<number | null>(null);

  // Parallel asynchronous widget fetching using React Query (staleTime caches requests)
  const { data: devices = [], isLoading: isLoadingDevices, refetch: refetchDevices } = useQuery({
    queryKey: ["devices"],
    queryFn: () => api.getDevices(),
    staleTime: 5000,
    gcTime: 30000,
    refetchInterval: 10000, // Background status sweep
  });

  const { data: alerts = [], isLoading: isLoadingAlerts } = useQuery({
    queryKey: ["alerts"],
    queryFn: async () => {
      const data: any = await api.get("/alerts");
      return data.slice(0, 4);
    },
    staleTime: 10000,
  });

  const { data: tickets = [], isLoading: isLoadingTickets } = useQuery({
    queryKey: ["tickets"],
    queryFn: async () => {
      const data: any = await api.get("/tickets");
      return data.slice(0, 4);
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

  // Update live graph when real-time ticks arrive over WebSocket
  useEffect(() => {
    if (metrics) {
      setHistoryData((prev) => {
        const timeStr = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
        const updated = [
          ...prev,
          {
            time: timeStr,
            cpu: metrics.cpu.usage_percent,
            ram: metrics.ram.percent,
            disk: metrics.disks[0]?.percent || 0
          }
        ];
        return updated.slice(-15); // limit to last 15 points
      });
    }
  }, [metrics]);

  // Logging authentication redirect and rendering duration trace
  useEffect(() => {
    const clickTimeStr = localStorage.getItem("login_click_time");
    if (clickTimeStr) {
      const clickTime = parseFloat(clickTimeStr);
      const redirectDuration = performance.now() - clickTime;
      console.log(`[AUTH PERF] End-to-end Redirect & Dashboard render time: ${redirectDuration.toFixed(2)}ms`);
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

  // Aggregate stats
  const totalDevices = devices.length;
  const onlineDevices = devices.filter((d: any) => d.status === "Online").length;
  const offlineDevices = devices.filter((d: any) => d.status === "Offline").length;
  const openTicketsCount = tickets.filter((t: any) => t.status !== "Resolved").length;

  const activeDevice = devices.find((d: any) => d.id === selectedDeviceId);
  const healthScore = activeDevice?.health_score ?? (metrics?.health_score ?? 100);
  const cpuVal = activeDevice?.cpu_usage ?? (metrics?.cpu.usage_percent ?? 0);
  const ramVal = activeDevice?.ram_usage ?? (metrics?.ram.percent ?? 0);
  const diskVal = activeDevice?.disk_usage ?? (metrics?.disks[0]?.percent ?? 0);

  return (
    <div className="flex flex-col gap-6">
      {/* Top Controls */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-800 dark:text-white">
            Endpoint Command Console
          </h1>
          <p className="text-xs text-slate-500 mt-0.5">
            Real-time multi-agent telemetry stream. Subnet sweep active.
          </p>
        </div>

        {/* Node Selector Selector */}
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl px-3 py-1.5 shadow-sm">
            <span className="text-xs font-semibold text-slate-400">Node:</span>
            <select
              value={selectedDeviceId ?? ""}
              onChange={(e) => setSelectedDeviceId(Number(e.target.value))}
              className="text-xs font-bold text-slate-700 dark:text-slate-200 bg-transparent border-none focus:outline-none cursor-pointer"
            >
              {devices.map((d) => (
                <option key={d.id} value={d.id} className="bg-white dark:bg-slate-950">
                  {d.hostname} ({d.os}) {d.status === "Offline" ? "[OFFLINE]" : ""}
                </option>
              ))}
            </select>
            <span className={`h-2.5 w-2.5 rounded-full ${connected ? "bg-success animate-pulse" : "bg-danger"}`} />
          </div>

          <button
            onClick={() => navigate("/tickets")}
            className="flex items-center gap-2 px-4 py-2 bg-primary hover:bg-primary-dark text-white rounded-xl text-xs font-semibold shadow-md shadow-primary/20 active:scale-[0.98] transition-all"
          >
            <Plus className="h-4 w-4" />
            Create Ticket
          </button>
        </div>
      </div>

      {/* Row 1: Summary Cards with Sparklines */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-5">
        {/* Card 1: Total Devices */}
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-card p-5 shadow-soft flex items-center justify-between group hover:border-primary/20 transition-all">
          <div className="flex items-center gap-4">
            <div className="h-12 w-12 rounded-xl bg-primary/10 flex items-center justify-center text-primary shrink-0">
              <Laptop className="h-6 w-6" />
            </div>
            <div>
              <p className="text-xs font-medium text-slate-400">Total Enrolled Nodes</p>
              <p className="text-2xl font-bold text-slate-800 dark:text-white mt-0.5">{totalDevices}</p>
              <p className="text-[10px] text-slate-400 font-medium mt-0.5">
                Active monitoring agents
              </p>
            </div>
          </div>
        </div>

        {/* Card 2: Online Devices */}
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-card p-5 shadow-soft flex items-center justify-between group hover:border-success/20 transition-all">
          <div className="flex items-center gap-4">
            <div className="h-12 w-12 rounded-xl bg-success/10 flex items-center justify-center text-success shrink-0">
              <Activity className="h-6 w-6" />
            </div>
            <div>
              <p className="text-xs font-medium text-slate-400">Online Endpoints</p>
              <p className="text-2xl font-bold text-slate-800 dark:text-white mt-0.5 text-success">
                {onlineDevices}
              </p>
              <p className="text-[10px] text-success font-medium mt-0.5 flex items-center gap-1">
                Healthy connections
              </p>
            </div>
          </div>
        </div>

        {/* Card 3: Offline Devices */}
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-card p-5 shadow-soft flex items-center justify-between group hover:border-danger/20 transition-all">
          <div className="flex items-center gap-4">
            <div className="h-12 w-12 rounded-xl bg-danger/10 flex items-center justify-center text-danger shrink-0">
              <Server className="h-6 w-6" />
            </div>
            <div>
              <p className="text-xs font-medium text-slate-400">Offline Endpoints</p>
              <p className="text-2xl font-bold text-slate-800 dark:text-white mt-0.5 text-danger">
                {offlineDevices}
              </p>
              <p className="text-[10px] text-slate-400 font-medium mt-0.5">
                Missing heartbeats &gt; 45s
              </p>
            </div>
          </div>
        </div>

        {/* Card 4: Open Tickets */}
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-card p-5 shadow-soft flex items-center justify-between group hover:border-warning/20 transition-all">
          <div className="flex items-center gap-4">
            <div className="h-12 w-12 rounded-xl bg-warning/10 flex items-center justify-center text-warning shrink-0">
              <Ticket className="h-6 w-6" />
            </div>
            <div>
              <p className="text-xs font-medium text-slate-400">Unresolved Tickets</p>
              <p className="text-2xl font-bold text-slate-800 dark:text-white mt-0.5">
                {openTicketsCount}
              </p>
              <p className="text-[10px] text-slate-400 font-medium mt-0.5">
                Active SupportFlow queue
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Row 2: Selected Node Health Dial Overview & Live Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
        {/* Dials for Selected Device */}
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-card p-5 shadow-soft lg:col-span-4 flex flex-col justify-between">
          {isLoadingDevices ? (
            <div className="h-64 flex items-center justify-center animate-pulse py-12">
              <div className="flex flex-col items-center gap-2">
                <div className="h-16 w-16 rounded-full bg-slate-100 dark:bg-slate-800" />
                <div className="h-4 bg-slate-100 dark:bg-slate-800 w-32 rounded" />
                <div className="h-3 bg-slate-100 dark:bg-slate-800 w-24 rounded" />
              </div>
            </div>
          ) : devices.length === 0 ? (
            <div className="h-64 flex flex-col items-center justify-center text-center text-slate-400 py-12">
              <Laptop className="h-10 w-10 text-slate-500 mb-2" />
              <p className="font-semibold text-slate-800 dark:text-slate-200">No Data Available</p>
              <p className="text-[10px] text-slate-500 mt-1 max-w-[200px]">No active devices are streaming system metrics.</p>
            </div>
          ) : (
            <>
              <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
                <div>
                  <h2 className="text-sm font-bold text-slate-800 dark:text-white">Node Health Index</h2>
                  <span className="text-[10px] text-slate-400 font-medium">{activeDevice?.hostname || "Local Node"}</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="text-xs font-bold text-slate-800 dark:text-white">{healthScore}%</span>
                  <div className="h-4 w-12 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden relative">
                    <div 
                      className={`h-full ${healthScore > 85 ? "bg-success" : healthScore > 65 ? "bg-warning" : "bg-danger"}`}
                      style={{ width: `${healthScore}%` }}
                    />
                  </div>
                </div>
              </div>

              {/* 3 circular dials */}
              <div className="grid grid-cols-3 gap-2 my-5 text-center">
                {/* CPU */}
                <div className="flex flex-col items-center">
                  <div className="relative h-[72px] w-[72px] mb-2 flex items-center justify-center">
                    <svg className="absolute transform -rotate-90 h-[72px] w-[72px]">
                      <circle className="text-slate-100 dark:text-slate-800" strokeWidth="4" stroke="currentColor" fill="transparent" r="32" cx="36" cy="36" />
                      <circle className="text-primary" strokeWidth="4" {...getCircleStrokeProps(cpuVal)} strokeLinecap="round" stroke="currentColor" fill="transparent" />
                    </svg>
                    <span className="text-[10px] font-bold text-slate-700 dark:text-slate-200">{Math.round(cpuVal)}%</span>
                  </div>
                  <span className="text-[10px] font-medium text-slate-400 flex items-center gap-1"><Cpu className="h-3.5 w-3.5" /> CPU</span>
                </div>

                {/* RAM */}
                <div className="flex flex-col items-center">
                  <div className="relative h-[72px] w-[72px] mb-2 flex items-center justify-center">
                    <svg className="absolute transform -rotate-90 h-[72px] w-[72px]">
                      <circle className="text-slate-100 dark:text-slate-800" strokeWidth="4" stroke="currentColor" fill="transparent" r="32" cx="36" cy="36" />
                      <circle className="text-purple-500" strokeWidth="4" {...getCircleStrokeProps(ramVal)} strokeLinecap="round" stroke="currentColor" fill="transparent" />
                    </svg>
                    <span className="text-[10px] font-bold text-slate-700 dark:text-slate-200">{Math.round(ramVal)}%</span>
                  </div>
                  <span className="text-[10px] font-medium text-slate-400 flex items-center gap-1"><Activity className="h-3.5 w-3.5" /> RAM</span>
                </div>

                {/* Disk */}
                <div className="flex flex-col items-center">
                  <div className="relative h-[72px] w-[72px] mb-2 flex items-center justify-center">
                    <svg className="absolute transform -rotate-90 h-[72px] w-[72px]">
                      <circle className="text-slate-100 dark:text-slate-800" strokeWidth="4" stroke="currentColor" fill="transparent" r="32" cx="36" cy="36" />
                      <circle className="text-orange-500" strokeWidth="4" {...getCircleStrokeProps(diskVal)} strokeLinecap="round" stroke="currentColor" fill="transparent" />
                    </svg>
                    <span className="text-[10px] font-bold text-slate-700 dark:text-slate-200">{Math.round(diskVal)}%</span>
                  </div>
                  <span className="text-[10px] font-medium text-slate-400 flex items-center gap-1"><HardDrive className="h-3.5 w-3.5" /> Disk</span>
                </div>
              </div>

              {/* Quick Properties */}
              <div className="bg-slate-50 dark:bg-slate-950 rounded-xl p-3 text-xs flex flex-col gap-2">
                <div className="flex justify-between">
                  <span className="text-slate-400">OS Platform:</span>
                  <span className="font-bold text-slate-700 dark:text-slate-200">{activeDevice?.os || "N/A"}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">Local Address:</span>
                  <span className="font-bold text-slate-700 dark:text-slate-200">{activeDevice?.ip_address || "N/A"}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">Connection State:</span>
                  <span className={`font-bold ${activeDevice?.status === 'Online' ? 'text-success' : 'text-danger'}`}>
                    {activeDevice?.status || "Offline"}
                  </span>
                </div>
              </div>
            </>
          )}
        </div>

        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-card p-5 shadow-soft lg:col-span-8 flex flex-col justify-between">
          {isLoadingDevices ? (
            <div className="h-64 bg-slate-50 dark:bg-slate-800/40 animate-pulse rounded-xl flex items-center justify-center">
              <div className="text-slate-400 text-xs font-semibold">Loading telemetry historical logs...</div>
            </div>
          ) : devices.length === 0 ? (
            <div className="h-64 flex flex-col items-center justify-center text-center text-slate-400 py-12">
              <TrendingUp className="h-10 w-10 text-slate-500 mb-2" />
              <p className="font-semibold text-slate-800 dark:text-slate-200">No Data Available</p>
              <p className="text-[10px] text-slate-500 mt-1 max-w-[200px]">History telemetry tracking is empty.</p>
            </div>
          ) : (
            <>
              <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3 mb-4">
                <div>
                  <h2 className="text-sm font-bold text-slate-800 dark:text-white">Endpoint Resource History</h2>
                  <p className="text-[10px] text-slate-400 mt-0.5">Telemetry tracking logged every 15s</p>
                </div>
                <div className="flex items-center gap-4 text-xs">
                  <span className="flex items-center gap-1.5 text-primary"><span className="h-2 w-2 rounded-full bg-primary" /> CPU</span>
                  <span className="flex items-center gap-1.5 text-purple-500"><span className="h-2 w-2 rounded-full bg-purple-500" /> RAM</span>
                  <span className="flex items-center gap-1.5 text-orange-500"><span className="h-2 w-2 rounded-full bg-orange-500" /> Disk</span>
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
                    <XAxis dataKey="time" tick={{ fontSize: 9 }} stroke={axisColor} />
                    <YAxis domain={[0, 100]} tick={{ fontSize: 9 }} stroke={axisColor} />
                    <Tooltip contentStyle={{ background: tooltipBg, border: `1px solid ${tooltipBorder}`, borderRadius: '12px', color: tooltipText, fontSize: '11px' }} />
                    <Area type="monotone" dataKey="cpu" stroke="#2563EB" strokeWidth={2} fillOpacity={1} fill="url(#colorCpu)" />
                    <Area type="monotone" dataKey="ram" stroke="#A855F7" strokeWidth={2} fillOpacity={1} fill="url(#colorRam)" />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </>
          )}
        </div>
      </div>

      {/* Row 3: Enrolled Endpoint Inventory List (RMM View) */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-card p-5 shadow-soft">
        <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-4 mb-4">
          <div>
            <h2 className="text-sm font-bold text-slate-800 dark:text-white">Active Node Inventory</h2>
            <p className="text-[10px] text-slate-400 mt-0.5">Manage and check diagnostics on physical and virtual nodes</p>
          </div>
          <button 
            onClick={() => refetchDevices()}
            className="flex items-center gap-1.5 text-xs text-slate-400 hover:text-slate-600 transition-colors"
          >
            <RefreshCw className="h-3.5 w-3.5" /> Refresh List
          </button>
        </div>

        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-slate-100 dark:divide-slate-800 text-left text-xs">
            <thead>
              <tr className="text-slate-400">
                <th className="py-3 px-4 font-semibold">Node Name</th>
                <th className="py-3 px-4 font-semibold">Status</th>
                <th className="py-3 px-4 font-semibold">OS Platform</th>
                <th className="py-3 px-4 font-semibold">IP Address</th>
                <th className="py-3 px-4 font-semibold">CPU</th>
                <th className="py-3 px-4 font-semibold">RAM</th>
                <th className="py-3 px-4 font-semibold">Health Score</th>
                <th className="py-3 px-4 font-semibold">Last Seen</th>
                <th className="py-3 px-4 font-semibold text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {isLoadingDevices ? (
                <tr>
                  <td colSpan={9} className="py-6 px-4 text-center">
                    <div className="flex flex-col gap-2 py-4">
                      <div className="h-8 bg-slate-150 dark:bg-slate-800/40 rounded animate-pulse w-full" />
                      <div className="h-8 bg-slate-150 dark:bg-slate-800/40 rounded animate-pulse w-full" />
                      <div className="h-8 bg-slate-150 dark:bg-slate-800/40 rounded animate-pulse w-full" />
                    </div>
                  </td>
                </tr>
              ) : devices.length === 0 ? (
                <tr>
                  <td colSpan={9} className="py-12 px-4 text-center text-slate-500 bg-slate-50/50 dark:bg-slate-900/50">
                    <div className="flex flex-col items-center justify-center max-w-lg mx-auto py-2">
                      <Server className="h-8 w-8 text-slate-400 dark:text-slate-600 mb-3 animate-pulse" />
                      <p className="font-bold text-sm text-slate-800 dark:text-slate-200">No monitored endpoints connected.</p>
                      <p className="text-[11px] text-slate-450 mt-1 leading-relaxed">
                        There are currently no machines connected to SupportFlow. Install or start the lightweight client-side daemon on your hosts to collect telemetry.
                      </p>
                      <div className="mt-4 bg-slate-950 rounded-lg p-3 text-left font-mono text-[10px] text-success border border-slate-850 w-full">
                        <p className="text-slate-500 select-none"># Install dependencies & run telemetry agent</p>
                        <p className="mt-1"><span className="text-slate-500">$</span> python agent.py</p>
                      </div>
                    </div>
                  </td>
                </tr>
              ) : (
                devices.map((d) => (
                  <tr 
                    key={d.id} 
                    className={`hover:bg-slate-50 dark:hover:bg-slate-950 transition-colors cursor-pointer ${d.id === selectedDeviceId ? 'bg-primary/5' : ''}`}
                    onClick={() => setSelectedDeviceId(d.id)}
                  >
                    <td className="py-3.5 px-4 font-bold text-slate-700 dark:text-slate-200 flex items-center gap-2">
                      <Server className="h-4 w-4 text-slate-400" />
                      {d.hostname}
                    </td>
                    <td className="py-3.5 px-4">
                      <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold ${
                        d.status === "Online" ? "bg-success/10 text-success" : "bg-danger/10 text-danger"
                      }`}>
                        <span className={`h-1.5 w-1.5 rounded-full ${d.status === "Online" ? "bg-success" : "bg-danger"}`} />
                        {d.status}
                      </span>
                    </td>
                    <td className="py-3.5 px-4 text-slate-500">{d.os}</td>
                    <td className="py-3.5 px-4 text-slate-500 font-mono">{d.ip_address || "N/A"}</td>
                    <td className="py-3.5 px-4 text-slate-700 dark:text-slate-300 font-bold">{Math.round(d.cpu_usage)}%</td>
                    <td className="py-3.5 px-4 text-slate-700 dark:text-slate-300 font-bold">{Math.round(d.ram_usage)}%</td>
                    <td className="py-3.5 px-4">
                      <span className={`font-bold ${d.health_score > 85 ? 'text-success' : d.health_score > 65 ? 'text-warning' : 'text-danger'}`}>
                        {d.health_score}/100
                      </span>
                    </td>
                    <td className="py-3.5 px-4 text-slate-400">
                      {new Date(d.last_seen).toLocaleTimeString()}
                    </td>
                    <td className="py-3.5 px-4 text-right" onClick={(e) => e.stopPropagation()}>
                      <button
                        onClick={() => navigate(`/diagnostics?device=${d.id}`)}
                        className="px-3 py-1 bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 rounded-lg font-semibold hover:bg-slate-200 transition-colors"
                      >
                        Diagnose
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Row 4: Supporting Support Tickets & Alerts Timeline lists */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        {/* Support Tickets list */}
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-card p-5 shadow-soft">
          <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3 mb-4">
            <h2 className="text-sm font-bold text-slate-800 dark:text-white">Urgent Incident Tickets</h2>
            <Link to="/tickets" className="text-xs text-primary hover:underline">View Queue</Link>
          </div>

          <div className="flex flex-col gap-3">
            {isLoadingTickets ? (
              <>
                <div className="h-12 bg-slate-100 dark:bg-slate-800/40 rounded-xl animate-pulse" />
                <div className="h-12 bg-slate-100 dark:bg-slate-800/40 rounded-xl animate-pulse" />
                <div className="h-12 bg-slate-100 dark:bg-slate-800/40 rounded-xl animate-pulse" />
              </>
            ) : (
              tickets.map((t: any) => (
                <div 
                  key={t.id} 
                  className="p-3 bg-slate-50 dark:bg-slate-950 rounded-xl flex items-center justify-between hover:border-slate-300 transition-all border border-transparent cursor-pointer"
                  onClick={() => navigate("/tickets")}
                >
                  <div>
                    <h3 className="text-xs font-bold text-slate-700 dark:text-slate-200">{t.title}</h3>
                    <p className="text-[10px] text-slate-400 mt-1 flex items-center gap-2">
                      <span>Priority: <span className={`font-bold ${
                        t.priority === "Critical" ? "text-danger" : t.priority === "High" ? "text-orange-500" : "text-slate-400"
                      }`}>{t.priority}</span></span>
                      <span>•</span>
                      <span>Status: <span className="font-bold text-slate-500">{t.status}</span></span>
                    </p>
                  </div>
                  <span className="text-[10px] text-slate-400">{new Date(t.created_at).toLocaleDateString()}</span>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Live Alerts list */}
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-card p-5 shadow-soft">
          <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3 mb-4">
            <h2 className="text-sm font-bold text-slate-800 dark:text-white">Active System Alerts</h2>
            <Link to="/alerts" className="text-xs text-primary hover:underline">View Logs</Link>
          </div>

          <div className="flex flex-col gap-3">
            {isLoadingAlerts ? (
              <>
                <div className="h-12 bg-slate-100 dark:bg-slate-800/40 rounded-xl animate-pulse" />
                <div className="h-12 bg-slate-100 dark:bg-slate-800/40 rounded-xl animate-pulse" />
                <div className="h-12 bg-slate-100 dark:bg-slate-800/40 rounded-xl animate-pulse" />
              </>
            ) : (
              <>
                {alerts.filter((a: any) => !a.resolved).map((a: any) => (
                  <div key={a.id} className="p-3 bg-danger/5 border border-danger/10 rounded-xl flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="h-8 w-8 rounded-lg bg-danger/10 text-danger flex items-center justify-center shrink-0">
                        <AlertTriangle className="h-4.5 w-4.5" />
                      </div>
                      <div>
                        <h3 className="text-xs font-bold text-slate-700 dark:text-slate-200">{a.message}</h3>
                        <p className="text-[10px] text-slate-400 mt-0.5">Category: {a.category} • Severity: {a.severity}</p>
                      </div>
                    </div>
                    <span className="text-[10px] text-slate-400">{new Date(a.created_at).toLocaleTimeString()}</span>
                  </div>
                ))}
                {alerts.filter((a: any) => !a.resolved).length === 0 && (
                  <div className="h-32 flex flex-col items-center justify-center text-slate-400 text-xs">
                    <CheckCircle className="h-8 w-8 text-success mb-2" />
                    No active threshold alerts triggered.
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
