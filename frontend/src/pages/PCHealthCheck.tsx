import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  ShieldCheck,
  RefreshCw,
  Download,
  AlertCircle,
  CheckCircle,
  FileText,
  Clock,
  Trash2,
  Sliders,
  Shield,
  Activity,
  Cpu,
  Database,
  Monitor,
  ListRestart,
  ShieldAlert
} from "lucide-react";
import api from "../services/api";

const API_URL = import.meta.env.VITE_API_URL || "http://127.0.0.1:8000/api/v1";

interface ScanStep {
  name: string;
  status: "Pending" | "Running" | "Passed" | "Warning" | "Failed";
  message: string;
}

export default function PCHealthCheck() {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [scanSteps, setScanSteps] = useState<ScanStep[]>([]);
  const [currentStepIndex, setCurrentStepIndex] = useState(0);

  const [devices, setDevices] = useState<any[]>([]);
  const [selectedDeviceId, setSelectedDeviceId] = useState<number | null>(null);
  const currentUserRole = localStorage.getItem("role") || "Viewer";

  const loadDevices = async () => {
    try {
      const devList = await api.getDevices();
      setDevices(devList);
      
      const params = new URLSearchParams(window.location.search);
      const queryDevId = params.get("device");
      if (queryDevId) {
        setSelectedDeviceId(Number(queryDevId));
        return Number(queryDevId);
      } else if (devList.length > 0) {
        setSelectedDeviceId(devList[0].id);
        return devList[0].id;
      }
    } catch (err) {
      console.error("Failed to load devices list:", err);
    }
    return null;
  };

  const loadDiagnostics = async (triggerScan: boolean = false, deviceIdOverride?: number) => {
    const targetId = deviceIdOverride !== undefined ? deviceIdOverride : selectedDeviceId;
    if (targetId === null) {
      setError("No monitored endpoints connected. Please install the monitoring agent on a machine by running the agent.py script.");
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);
    setData(null);
    setCurrentStepIndex(0);
    
    // 11 distinct real-time diagnostic stages
    const initialSteps: ScanStep[] = [
      { name: "Collecting CPU Information", status: "Pending", message: "Awaiting thread dispatch..." },
      { name: "Checking Physical Memory", status: "Pending", message: "Awaiting thread dispatch..." },
      { name: "Verifying Disk Storage & SMART Health", status: "Pending", message: "Awaiting thread dispatch..." },
      { name: "Testing Network Latency & Internet Routing", status: "Pending", message: "Awaiting thread dispatch..." },
      { name: "Querying Firewall & Security Shields", status: "Pending", message: "Awaiting thread dispatch..." },
      { name: "Auditing Active Operating Services", status: "Pending", message: "Awaiting thread dispatch..." },
      { name: "Checking Active Running Processes", status: "Pending", message: "Awaiting thread dispatch..." },
      { name: "Indexing Installed Software Catalog", status: "Pending", message: "Awaiting thread dispatch..." },
      { name: "Reading System Startup Configurations", status: "Pending", message: "Awaiting thread dispatch..." },
      { name: "Checking Pending System Updates", status: "Pending", message: "Awaiting thread dispatch..." },
      { name: "Querying System Power Health", status: "Pending", message: "Awaiting thread dispatch..." }
    ];
    setScanSteps(initialSteps);

    let wsUrl = "";
    const api_url = import.meta.env.VITE_API_URL || "";
    if (api_url) {
      try {
        const urlObj = new URL(api_url);
        const wsProtocol = urlObj.protocol === "https:" ? "wss:" : "ws:";
        wsUrl = `${wsProtocol}//${urlObj.host}/api/ws`;
      } catch {
        const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
        const host = import.meta.env.VITE_WS_URL || "127.0.0.1:8000";
        wsUrl = `${protocol}//${host}/api/ws`;
      }
    } else {
      const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
      const host = import.meta.env.VITE_WS_URL || "127.0.0.1:8000";
      wsUrl = `${protocol}//${host}/api/ws`;
    }

    const socket = new WebSocket(wsUrl);

    socket.onmessage = (event) => {
      try {
        const packet = JSON.parse(event.data);
        if (packet.type === "scan_progress") {
          setScanSteps((prev) =>
            prev.map((step) =>
              step.name === packet.task
                ? { ...step, status: packet.status, message: packet.message || "" }
                : step
            )
          );
          if (packet.step) {
            setCurrentStepIndex(packet.step - 1);
          }
        } else if (packet.type === "scan_complete") {
          setData(packet.result);
          setLoading(false);
          socket.close();
        }
      } catch (err) {
        console.error("ITSM WebSocket diagnostics parse error:", err);
      }
    };

    socket.onerror = (err) => {
      console.error("WebSocket diagnostic sync failed:", err);
    };

    try {
      const res = await api.post(`/diagnostics/run?bypass_cache=${triggerScan}&device_id=${targetId}`);
      setData(res);
    } catch (err: any) {
      setError(err.message || "Endpoint diagnostics scan failed.");
      setData(null);
    } finally {
      setLoading(false);
      if (socket.readyState === WebSocket.OPEN) {
        socket.close();
      }
    }
  };

  useEffect(() => {
    const init = async () => {
      const activeId = await loadDevices();
      if (activeId !== null) {
        loadDiagnostics(false, activeId);
      }
    };
    init();
  }, []);

  const getStatusBadge = (status: string) => {
    switch (status.toLowerCase()) {
      case "passed":
      case "success":
      case "ok":
        return <span className="text-success text-[10px] font-bold tracking-wide">✓ PASSED</span>;
      case "warning":
        return <span className="text-warning text-[10px] font-bold tracking-wide">⚠ WARNING</span>;
      case "running":
        return <span className="text-primary text-[10px] font-bold tracking-wide animate-pulse">● RUNNING</span>;
      case "pending":
        return <span className="text-slate-650 text-[10px] font-bold tracking-wide">● PENDING</span>;
      default:
        return <span className="text-danger text-[10px] font-bold tracking-wide">✗ FAILED</span>;
    }
  };

  const getStepColorClass = (status: string) => {
    switch (status.toLowerCase()) {
      case "passed":
        return "border-success/20 bg-success/5";
      case "warning":
        return "border-warning/20 bg-warning/5";
      case "failed":
        return "border-danger/25 bg-danger/5";
      case "running":
        return "border-primary/30 bg-primary/5";
      default:
        return "border-slate-800 bg-slate-900/20";
    }
  };

  // Export diagnostic logs to CSV file directly in React client
  const handleExportCSV = () => {
    if (!data) return;
    const headers = "Check Criterion,Health Status,Reported Diagnostics\r\n";
    const rows = [
      ["Diagnostic Health Score", `${data.health_score}/100`, "Overall performance calculation"],
      ["CPU Configuration Check", data.cpu_health, data.cpu_metrics ? `${data.cpu_metrics.usage}% usage load` : "N/A"],
      ["Physical RAM Health", data.ram_health, data.ram_metrics ? `${data.ram_metrics.usage}% memory utilization` : "N/A"],
      ["Storage Partitions Space", data.disk_health, data.disk_metrics ? `${data.disk_metrics.free_gb} GB free of ${data.disk_metrics.total_gb} GB` : "N/A"],
      ["Internet Routing Gateways", data.internet_health, "DNS query path ping verified"],
      ["Windows Defender Shields", data.defender_health, data.security_metrics ? `Defender: ${data.security_metrics.antivirus}` : "N/A"],
      ["Windows Firewall Profiles", data.firewall_health, data.security_metrics ? `Firewall: ${data.security_metrics.firewall}` : "N/A"],
      ["System Patches updates", data.updates_health, "OS Updates Registry audited"],
      ["Startup Registry Entries", "Passed", `${data.startup_programs?.length || 0} active HKCU/HKLM registry items`],
      ["Uptime Duration", "Passed", `${data.uptime_hours} active hours`]
    ];

    const csvContent = "data:text/csv;charset=utf-8," 
      + headers 
      + rows.map(r => r.map(cell => `"${cell}"`).join(",")).join("\r\n");
    
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `Endpoint_Health_Report_${Date.now()}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const token = localStorage.getItem("token");

  return (
    <div className="flex flex-col h-full gap-4 text-slate-250 select-none">
      
      {/* Header controls */}
      <div className="flex flex-col md:flex-row items-start md:items-center justify-between bg-slate-900/60 border border-slate-800/85 p-5 rounded-xl backdrop-blur-md gap-4">
        <div>
          <h1 className="text-lg font-bold text-white tracking-wide">PC Health Diagnostics</h1>
          <p className="text-xs text-slate-500 mt-0.5">Automated diagnostic scanner for security configurations, memory usage, and driver checks</p>
        </div>
        <div className="flex items-center gap-3">
          {data && (
            <>
              <button
                onClick={handleExportCSV}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-750 hover:border-slate-650 rounded-lg text-xs font-bold transition-all shadow-md active:scale-95"
              >
                <FileText className="h-4 w-4 text-slate-400" />
                Export CSV
              </button>
              <a
                href={`${API_URL}/reports/health/pdf?token=${token}`}
                target="_blank"
                rel="noreferrer"
                className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-750 hover:border-slate-650 rounded-lg text-xs font-bold transition-all shadow-md active:scale-95"
              >
                <Download className="h-4 w-4 text-slate-400" />
                Download PDF
              </a>
            </>
          )}

          {/* Node Selector for Admins */}
          {currentUserRole !== "Viewer" && devices.length > 0 && (
            <div className="flex items-center gap-2 bg-slate-800 border border-slate-705 rounded-lg px-3 py-1.5 shadow-sm text-xs font-sans">
              <span className="font-semibold text-slate-400">Target Node:</span>
              <select
                value={selectedDeviceId ?? ""}
                onChange={(e) => {
                  const val = Number(e.target.value);
                  setSelectedDeviceId(val);
                  loadDiagnostics(false, val);
                }}
                className="font-bold text-slate-200 bg-transparent border-none focus:outline-none cursor-pointer"
              >
                {devices.map((d) => (
                  <option key={d.id} value={d.id} className="bg-slate-900 text-white">
                    {d.hostname} ({d.os})
                  </option>
                ))}
              </select>
            </div>
          )}

          <button
            onClick={() => loadDiagnostics(true)}
            disabled={loading}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-primary hover:bg-primary-dark text-white rounded-lg text-xs font-bold transition-all shadow-md active:scale-95 disabled:opacity-55"
          >
            <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
            Run Full Scan
          </button>
        </div>
      </div>

      {/* Exception Error Box */}
      {error && (
        <div className="bg-danger/10 border border-danger/30 text-danger text-xs font-medium p-4 rounded-xl flex items-center gap-3">
          <ShieldAlert className="h-5 w-5 shrink-0" />
          <div>
            <p className="font-bold">Diagnostics Execution Failure</p>
            <p className="mt-0.5 text-slate-400">{error}</p>
          </div>
        </div>
      )}

      {/* Scan details pane */}
      <AnimatePresence mode="wait">
        {loading ? (
          /* Live WebSocket Scanning checklist */
          <motion.div
            key="loading"
            initial={{ opacity: 0, scale: 0.98 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.98 }}
            className="bg-slate-900/60 border border-slate-800/80 rounded-xl p-8 backdrop-blur-md shadow-2xl flex flex-col xl:flex-row gap-8 items-stretch min-h-[420px]"
          >
            {/* Checklist items list */}
            <div className="flex-1 space-y-2.5">
              <h3 className="text-xs font-bold text-slate-450 uppercase tracking-wider mb-4">
                Executing Real Asynchronous Diagnostics ({currentStepIndex + 1}/{scanSteps.length})
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5 max-h-[320px] overflow-y-auto pr-2 scrollbar-thin">
                {scanSteps.map((step, idx) => (
                  <div
                    key={idx}
                    className={`p-3 border rounded-lg flex flex-col justify-between transition-colors ${getStepColorClass(step.status)}`}
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-xs text-white line-clamp-1">{step.name}</span>
                      {getStatusBadge(step.status)}
                    </div>
                    <span className="text-[10px] text-slate-500 font-mono mt-1.5 truncate" title={step.message}>
                      {step.message}
                    </span>
                  </div>
                ))}
              </div>
            </div>

            {/* Circular progress card */}
            <div className="w-full xl:w-80 bg-slate-950/40 border border-slate-850 p-6 rounded-xl flex flex-col items-center justify-center text-center">
              <div className="relative h-28 w-28 flex items-center justify-center">
                <span className="absolute inset-0 rounded-full border-4 border-primary/10 border-t-primary animate-spin" />
                <ShieldCheck className="h-9 w-9 text-primary animate-pulse" />
              </div>
              <h4 className="text-xs font-bold text-slate-300 mt-5">Scanning Host System Registry</h4>
              <p className="text-[10px] text-slate-500 mt-1 max-w-[200px]">
                Checking security shields, memory space pools, and updating WUA registry updates...
              </p>
            </div>
          </motion.div>
        ) : data ? (
          /* Diagnostics Dashboard Results */
          <motion.div
            key="results"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="grid grid-cols-1 lg:grid-cols-12 gap-5"
          >
            {/* Left Score visuals */}
            <div className="lg:col-span-4 flex flex-col gap-5">
              
              {/* Score visualizer */}
              <div className="bg-slate-900/60 border border-slate-800/80 rounded-xl p-6 backdrop-blur shadow-soft flex flex-col items-center text-center">
                <h3 className="text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-6">Overall Diagnostic Score</h3>
                
                <div className="relative h-32 w-32 flex items-center justify-center">
                  <svg className="absolute transform -rotate-90 h-32 w-32">
                    <circle className="text-slate-800" strokeWidth="6" stroke="currentColor" fill="transparent" r="54" cx="64" cy="64" />
                    <circle
                      className="text-success"
                      strokeWidth="6"
                      strokeDasharray={2 * Math.PI * 54}
                      strokeDashoffset={(2 * Math.PI * 54) - (data.health_score / 100) * (2 * Math.PI * 54)}
                      r="54"
                      cx="64"
                      cy="64"
                      strokeLinecap="round"
                      stroke="currentColor"
                      fill="transparent"
                    />
                  </svg>
                  <div className="text-center z-10">
                    <p className="text-3xl font-extrabold text-white font-mono">{data.health_score}</p>
                    <p className="text-[9px] text-slate-400 font-bold uppercase tracking-wider mt-0.5">
                      {data.health_score > 85 ? "Excellent" : data.health_score > 60 ? "Warning" : "Critical"}
                    </p>
                  </div>
                </div>

                <div className="mt-8 flex gap-3 text-xs bg-slate-950/40 border border-slate-800/50 p-3 rounded-xl w-full text-left items-center">
                  <Clock className="h-5 w-5 text-primary shrink-0" />
                  <div>
                    <p className="font-bold text-slate-300">Audited Specifications</p>
                    <p className="text-[9px] text-slate-550 mt-0.5">Uptime Duration: {data.uptime_hours} active hours</p>
                  </div>
                </div>
              </div>

              {/* Recommendations list */}
              <div className="bg-slate-900/60 border border-slate-800/80 rounded-xl p-5 backdrop-blur shadow-soft flex-grow flex flex-col">
                <h3 className="text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-4">Recommended Actions</h3>
                <div className="space-y-3.5 text-xs flex-grow overflow-y-auto max-h-[220px] scrollbar-thin">
                  {data.recommendations?.length === 0 && data.cleanup_recommendation_gb === 0 ? (
                    <div className="py-8 text-center text-slate-500">
                      <CheckCircle className="h-8 w-8 text-success mx-auto mb-2" />
                      <p className="font-semibold text-slate-350">All systems optimal.</p>
                    </div>
                  ) : (
                    <>
                      {data.cleanup_recommendation_gb > 0 && (
                        <div className="flex gap-3 items-start bg-warning/5 border border-warning/15 p-3 rounded-lg">
                          <Trash2 className="h-4.5 w-4.5 text-warning shrink-0 mt-0.5" />
                          <div>
                            <p className="font-bold text-warning">Disk Cleanup Recommendation</p>
                            <p className="text-[9px] text-slate-400 mt-0.5">
                              Free up roughly <b>{data.cleanup_recommendation_gb} GB</b> of temp files.
                            </p>
                          </div>
                        </div>
                      )}
                      
                      {data.recommendations?.map((rec: string, idx: number) => (
                        <div key={idx} className="flex gap-3 items-start bg-slate-955 border border-slate-850 p-3 rounded-lg">
                          <AlertCircle className="h-4.5 w-4.5 text-primary shrink-0 mt-0.5 animate-pulse" />
                          <p className="text-slate-400 text-[11px] leading-relaxed">
                            {rec}
                          </p>
                        </div>
                      ))}
                    </>
                  )}
                </div>
              </div>
            </div>

            {/* Right Audit Panels */}
            <div className="lg:col-span-8 flex flex-col gap-5">
              
              {/* Checks status */}
              <div className="bg-slate-900/60 border border-slate-800/80 rounded-xl p-5 backdrop-blur shadow-soft">
                <h3 className="text-xs font-bold text-slate-450 uppercase tracking-wider border-b border-slate-850 pb-3.5 mb-4">
                  Diagnostics Results Breakdown
                </h3>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-xs">
                  {/* CPU */}
                  <div className={`p-3.5 rounded-lg border flex items-center justify-between ${getStepColorClass(data.cpu_health)}`}>
                    <div>
                      <p className="font-bold text-white text-[11px]">CPU Health</p>
                      <p className="text-[9px] text-slate-500 mt-0.5">Usage & Temp</p>
                    </div>
                    {getStatusBadge(data.cpu_health)}
                  </div>

                  {/* RAM */}
                  <div className={`p-3.5 rounded-lg border flex items-center justify-between ${getStepColorClass(data.ram_health)}`}>
                    <div>
                      <p className="font-bold text-white text-[11px]">RAM Health</p>
                      <p className="text-[9px] text-slate-500 mt-0.5">Memory load</p>
                    </div>
                    {getStatusBadge(data.ram_health)}
                  </div>

                  {/* Storage */}
                  <div className={`p-3.5 rounded-lg border flex items-center justify-between ${getStepColorClass(data.disk_health)}`}>
                    <div>
                      <p className="font-bold text-white text-[11px]">Disk Space</p>
                      <p className="text-[9px] text-slate-500 mt-0.5">SMART storage</p>
                    </div>
                    {getStatusBadge(data.disk_health)}
                  </div>

                  {/* Internet */}
                  <div className={`p-3.5 rounded-lg border flex items-center justify-between ${getStepColorClass(data.internet_health)}`}>
                    <div>
                      <p className="font-bold text-white text-[11px]">Internet Link</p>
                      <p className="text-[9px] text-slate-500 mt-0.5">DNS routing</p>
                    </div>
                    {getStatusBadge(data.internet_health)}
                  </div>

                  {/* Defender */}
                  <div className={`p-3.5 rounded-lg border flex items-center justify-between ${getStepColorClass(data.defender_health)}`}>
                    <div>
                      <p className="font-bold text-white text-[11px]">Antivirus Shield</p>
                      <p className="text-[9px] text-slate-500 mt-0.5">Defender service</p>
                    </div>
                    {getStatusBadge(data.defender_health)}
                  </div>

                  {/* Firewall */}
                  <div className={`p-3.5 rounded-lg border flex items-center justify-between ${getStepColorClass(data.firewall_health)}`}>
                    <div>
                      <p className="font-bold text-white text-[11px]">Firewall Profiles</p>
                      <p className="text-[9px] text-slate-500 mt-0.5">netsh status</p>
                    </div>
                    {getStatusBadge(data.firewall_health)}
                  </div>
                </div>
              </div>

              {/* Startup Programs */}
              <div className="bg-slate-900/60 border border-slate-800/80 rounded-xl p-5 backdrop-blur shadow-soft">
                <h3 className="text-xs font-bold text-slate-455 uppercase tracking-wider border-b border-slate-850 pb-3 mb-4 flex items-center gap-2">
                  <ListRestart className="h-4 w-4 text-primary" />
                  Active Startup Tasks (Registry Hive)
                </h3>

                <div className="flex flex-wrap gap-2 text-[10px]">
                  {data.startup_programs?.length === 0 ? (
                    <p className="text-slate-500 italic">No custom startup items found in HKCU/HKLM registry paths.</p>
                  ) : (
                    data.startup_programs?.map((prog: string, idx: number) => (
                      <span
                        key={idx}
                        className="px-2.5 py-1.5 rounded-lg bg-slate-955/40 border border-slate-850 font-bold text-slate-350"
                      >
                        {prog}
                      </span>
                    ))
                  )}
                </div>
              </div>

            </div>
          </motion.div>
        ) : null}
      </AnimatePresence>
      
    </div>
  );
}
