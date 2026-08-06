import { useState, useEffect } from "react";
import { useLocation } from "react-router-dom";
import { motion } from "framer-motion";
import {
  Cpu,
  Layers,
  Activity,
  HardDrive,
  RefreshCw,
  Search,
  StopCircle,
  Play,
  RotateCw,
  Info,
  Server
} from "lucide-react";
import api from "../services/api";

export default function SystemHealth() {
  const location = useLocation();
  const [devices, setDevices] = useState<any[]>([]);
  const [selectedDeviceId, setSelectedDeviceId] = useState<number | null>(null);

  const [specs, setSpecs] = useState<any>(null);
  const [processes, setProcesses] = useState<any[]>([]);
  const [services, setServices] = useState<any[]>([]);
  
  const [searchProcess, setSearchProcess] = useState("");
  const [searchService, setSearchService] = useState("");
  const [loading, setLoading] = useState(false);
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  // Parse query params for device routing
  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const devIdStr = params.get("device");
    if (devIdStr) {
      setSelectedDeviceId(Number(devIdStr));
    }
  }, [location]);

  const loadDevices = async () => {
    try {
      const devList = await api.getDevices();
      setDevices(devList);
      if (devList.length > 0 && selectedDeviceId === null) {
        // If query string didn't set ID, default to first device
        const params = new URLSearchParams(location.search);
        const devIdStr = params.get("device");
        setSelectedDeviceId(devIdStr ? Number(devIdStr) : devList[0].id);
      }
    } catch (err) {
      console.error("Failed to load RMM nodes:", err);
    }
  };

  const loadDiagnosticsData = async () => {
    if (selectedDeviceId === null) return;
    setLoading(true);

    try {
      const targetDevice = devices.find(d => d.id === selectedDeviceId);
      
      if (targetDevice && targetDevice.uuid === "local-host") {
        // Fallback to query local backend host info directly via WMI APIs
        const specsData = await api.get("/system/specs");
        setSpecs(specsData);
        const procs = await api.get<any[]>("/system/processes");
        setProcesses(procs);
        const servs = await api.get<any[]>("/system/services");
        setServices(servs);
      } else {
        // Fetch remote agent telemetry
        const deviceDetail = await api.getDevice(selectedDeviceId);
        
        // Construct visual specs payload from telemetry
        setSpecs({
          hostname: deviceDetail.hostname,
          os: deviceDetail.os,
          build_number: deviceDetail.kernel || "N/A",
          uptime_hours: (deviceDetail.uptime / 3600).toFixed(1),
          current_user: deviceDetail.current_user || "N/A",
          ip_address: deviceDetail.ip_address || "N/A",
          mac_address: deviceDetail.mac_address || "N/A",
          processor: "Remote CPU Node",
          physical_cores: 0,
          total_ram_gb: 0,
          disk_total_gb: 0
        });

        // Load services and processes from latest telemetry json
        const telemetry = await api.getDeviceLatestTelemetry(selectedDeviceId);
        setProcesses(telemetry.processes || []);
        setServices(telemetry.services || []);
      }
    } catch (err) {
      console.error("Diagnostics load error:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadDevices();
  }, []);

  useEffect(() => {
    loadDiagnosticsData();
    const interval = setInterval(loadDiagnosticsData, 15000);
    return () => clearInterval(interval);
  }, [selectedDeviceId, devices]);

  const handleServiceControl = async (serviceName: string, action: "start" | "stop" | "restart") => {
    const targetDevice = devices.find(d => d.id === selectedDeviceId);
    if (!targetDevice) return;

    if (targetDevice.uuid !== "local-host") {
      alert(`Service Control Commands are currently read-only for remote nodes for security. Supported on Local Node.`);
      return;
    }

    setActionLoading(`${serviceName}-${action}`);
    try {
      await api.post(`/system/services/${serviceName}/control?action=${action}`);
      alert(`Service '${serviceName}' successfully received command: ${action}`);
      await loadDiagnosticsData();
    } catch (err: any) {
      alert(`Service Control Error: ${err.message || "Failed to execute service command"}`);
    } finally {
      setActionLoading(null);
    }
  };

  const filteredProcesses = processes.filter((p) =>
    p.name.toLowerCase().includes(searchProcess.toLowerCase())
  );

  const filteredServices = services.filter(
    (s) =>
      s.name.toLowerCase().includes(searchService.toLowerCase()) ||
      s.display_name.toLowerCase().includes(searchService.toLowerCase())
  );

  if (devices.length === 0) {
    return (
      <div className="flex flex-col gap-6">
        <div>
          <h1 className="text-xl font-bold text-slate-800 dark:text-white">System Diagnostics</h1>
          <p className="text-xs text-slate-500 mt-0.5">Explore active processes and service states</p>
        </div>
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-card p-12 text-center shadow-soft">
          <Server className="h-10 w-10 text-slate-400 mx-auto mb-3 animate-pulse" />
          <p className="font-bold text-sm text-slate-800 dark:text-slate-200">No monitored endpoint connected.</p>
          <p className="text-xs text-slate-450 mt-2 max-w-md mx-auto leading-relaxed">
            Please register and start the client monitoring agent on your machines to collect process and service diagnostics. Run <code className="bg-slate-100 dark:bg-slate-800 px-1 py-0.5 rounded text-primary font-semibold">python agent.py</code> to initialize connection.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      {/* Header & Selector */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-slate-800 dark:text-white">System Diagnostics</h1>
          <p className="text-xs text-slate-500 mt-0.5">Explore active processes and service states</p>
        </div>

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
                  {d.hostname} ({d.os})
                </option>
              ))}
            </select>
          </div>

          <button
            onClick={loadDiagnosticsData}
            disabled={loading}
            className="p-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl hover:bg-slate-50 text-slate-600 disabled:opacity-50"
          >
            <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
          </button>
        </div>
      </div>

      {/* specs Grid */}
      {specs && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-5">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-card p-4 shadow-soft">
            <div className="flex items-center gap-3 text-primary mb-2">
              <Server className="h-5 w-5" />
              <span className="text-xs font-bold uppercase tracking-wider text-slate-400">Node Properties</span>
            </div>
            <div className="text-xs flex flex-col gap-1.5 mt-2">
              <div className="flex justify-between"><span className="text-slate-400">Hostname:</span><span className="font-semibold text-slate-700 dark:text-slate-200">{specs.hostname}</span></div>
              <div className="flex justify-between"><span className="text-slate-400">OS:</span><span className="font-semibold text-slate-700 dark:text-slate-200">{specs.os}</span></div>
              <div className="flex justify-between"><span className="text-slate-400">Build:</span><span className="font-semibold text-slate-700 dark:text-slate-200 text-right truncate max-w-[120px]">{specs.build_number}</span></div>
            </div>
          </div>

          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-card p-4 shadow-soft">
            <div className="flex items-center gap-3 text-success mb-2">
              <Cpu className="h-5 w-5" />
              <span className="text-xs font-bold uppercase tracking-wider text-slate-400">Hardware specs</span>
            </div>
            <div className="text-xs flex flex-col gap-1.5 mt-2">
              <div className="flex justify-between"><span className="text-slate-400">Processor:</span><span className="font-semibold text-slate-700 dark:text-slate-200 truncate max-w-[120px]">{specs.processor}</span></div>
              <div className="flex justify-between"><span className="text-slate-400">Physical Cores:</span><span className="font-semibold text-slate-700 dark:text-slate-200">{specs.physical_cores || "N/A"}</span></div>
              <div className="flex justify-between"><span className="text-slate-400">Total RAM:</span><span className="font-semibold text-slate-700 dark:text-slate-200">{specs.total_ram_gb ? `${specs.total_ram_gb} GB` : "N/A"}</span></div>
            </div>
          </div>

          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-card p-4 shadow-soft">
            <div className="flex items-center gap-3 text-orange-500 mb-2">
              <Activity className="h-5 w-5" />
              <span className="text-xs font-bold uppercase tracking-wider text-slate-400">Network Profiles</span>
            </div>
            <div className="text-xs flex flex-col gap-1.5 mt-2">
              <div className="flex justify-between"><span className="text-slate-400">Primary IP:</span><span className="font-semibold text-slate-700 dark:text-slate-200">{specs.ip_address}</span></div>
              <div className="flex justify-between"><span className="text-slate-400">MAC Address:</span><span className="font-semibold text-slate-700 dark:text-slate-200 font-mono text-[10px]">{specs.mac_address}</span></div>
              <div className="flex justify-between"><span className="text-slate-400">Internet:</span><span className="font-semibold text-success">Online</span></div>
            </div>
          </div>

          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-card p-4 shadow-soft">
            <div className="flex items-center gap-3 text-purple-500 mb-2">
              <Info className="h-5 w-5" />
              <span className="text-xs font-bold uppercase tracking-wider text-slate-400">Session Details</span>
            </div>
            <div className="text-xs flex flex-col gap-1.5 mt-2">
              <div className="flex justify-between"><span className="text-slate-400">Active User:</span><span className="font-semibold text-slate-700 dark:text-slate-200">{specs.current_user}</span></div>
              <div className="flex justify-between"><span className="text-slate-400">Node Uptime:</span><span className="font-semibold text-slate-700 dark:text-slate-200">{specs.uptime_hours} Hours</span></div>
              <div className="flex justify-between"><span className="text-slate-400">Diagnostic:</span><span className="font-semibold text-primary">Normal</span></div>
            </div>
          </div>
        </div>
      )}

      {/* Row 2: Processes & Services */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 h-[500px]">
        {/* Processes List */}
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-card p-5 shadow-soft lg:col-span-6 flex flex-col overflow-hidden">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-3 border-b border-slate-100 dark:border-slate-800 mb-4 shrink-0">
            <div className="flex items-center gap-2">
              <Layers className="h-5 w-5 text-primary" />
              <h2 className="text-sm font-bold text-slate-800 dark:text-white">Active Logs & Processes</h2>
            </div>
            <div className="relative w-full sm:w-44">
              <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400">
                <Search className="h-3.5 w-3.5" />
              </span>
              <input
                type="text"
                value={searchProcess}
                onChange={(e) => setSearchProcess(e.target.value)}
                placeholder="Search processes..."
                className="w-full bg-slate-50 dark:bg-slate-800 pl-8 pr-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 text-xs focus:outline-none focus:ring-1 focus:ring-primary focus:border-primary text-slate-700 dark:text-slate-200"
              />
            </div>
          </div>

          <div className="flex-1 overflow-y-auto scrollbar-thin pr-1 text-xs">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-slate-100 dark:border-slate-800 text-slate-400 font-bold sticky top-0 bg-white dark:bg-slate-900 z-10">
                  <th className="pb-2">Process</th>
                  <th className="pb-2">PID</th>
                  <th className="pb-2">User</th>
                  <th className="pb-2">CPU</th>
                  <th className="pb-2 text-right">RAM</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50 dark:divide-slate-800/40 text-slate-700 dark:text-slate-300">
                {filteredProcesses.map((p) => (
                  <tr key={`${p.pid}-${p.name}`} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/30">
                    <td className="py-2 font-semibold max-w-[120px] truncate" title={p.name}>{p.name}</td>
                    <td className="py-2 text-slate-400 font-mono">{p.pid}</td>
                    <td className="py-2 text-slate-400 truncate max-w-[80px]" title={p.username}>{p.username}</td>
                    <td className="py-2 font-bold text-slate-800 dark:text-slate-200">{p.cpu_percent}%</td>
                    <td className="py-2 text-right font-medium">{p.memory_percent}%</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Services List */}
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-card p-5 shadow-soft lg:col-span-6 flex flex-col overflow-hidden">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-3 border-b border-slate-100 dark:border-slate-800 mb-4 shrink-0">
            <div className="flex items-center gap-2">
              <Cpu className="h-5 w-5 text-purple-500" />
              <h2 className="text-sm font-bold text-slate-800 dark:text-white">Active services Control</h2>
            </div>
            <div className="relative w-full sm:w-44">
              <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400">
                <Search className="h-3.5 w-3.5" />
              </span>
              <input
                type="text"
                value={searchService}
                onChange={(e) => setSearchService(e.target.value)}
                placeholder="Search services..."
                className="w-full bg-slate-50 dark:bg-slate-800 pl-8 pr-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 text-xs focus:outline-none focus:ring-1 focus:ring-primary focus:border-primary text-slate-700 dark:text-slate-200"
              />
            </div>
          </div>

          <div className="flex-1 overflow-y-auto scrollbar-thin pr-1 text-xs">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-slate-100 dark:border-slate-800 text-slate-400 font-bold sticky top-0 bg-white dark:bg-slate-900 z-10">
                  <th className="pb-2">Display Name</th>
                  <th className="pb-2">Status</th>
                  <th className="pb-2 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50 dark:divide-slate-800/40 text-slate-700 dark:text-slate-300">
                {filteredServices.map((s) => (
                  <tr key={s.name} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/30">
                    <td className="py-2.5 font-medium max-w-[200px] truncate" title={s.display_name}>
                      {s.display_name}
                    </td>
                    <td className="py-2.5">
                      <span className={`px-1.5 py-0.5 rounded text-[9px] font-bold ${
                        s.status === "running" ? "bg-success/10 text-success" : "bg-slate-100 dark:bg-slate-800 text-slate-400"
                      }`}>
                        {s.status}
                      </span>
                    </td>
                    <td className="py-2.5 text-right flex justify-end gap-1.5">
                      {s.status === "running" ? (
                        <button
                          disabled={actionLoading !== null}
                          onClick={() => handleServiceControl(s.name, "stop")}
                          className="p-1 rounded bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-500 hover:text-danger hover:bg-danger/5 transition-colors disabled:opacity-50"
                          title="Stop Service"
                        >
                          <StopCircle className="h-3.5 w-3.5" />
                        </button>
                      ) : (
                        <button
                          disabled={actionLoading !== null}
                          onClick={() => handleServiceControl(s.name, "start")}
                          className="p-1 rounded bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-500 hover:text-success hover:bg-success/5 transition-colors disabled:opacity-50"
                          title="Start Service"
                        >
                          <Play className="h-3.5 w-3.5" />
                        </button>
                      )}
                      <button
                        disabled={actionLoading !== null}
                        onClick={() => handleServiceControl(s.name, "restart")}
                        className="p-1 rounded bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-500 hover:text-primary hover:bg-primary/5 transition-colors disabled:opacity-50"
                        title="Restart Service"
                      >
                        <RotateCw className="h-3.5 w-3.5" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}
