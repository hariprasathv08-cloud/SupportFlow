import { useState, useEffect } from "react";
import { Search, Download, Server } from "lucide-react";
import api from "../services/api";

export default function SoftwareInventory() {
  const [devices, setDevices] = useState<any[]>([]);
  const [selectedDeviceId, setSelectedDeviceId] = useState<number | null>(null);

  const [software, setSoftware] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState("");
  const [selectedPublisher, setSelectedPublisher] = useState("");

  const loadDevices = async () => {
    try {
      const devList = await api.getDevices();
      setDevices(devList);
      if (devList.length > 0 && selectedDeviceId === null) {
        setSelectedDeviceId(devList[0].id);
      }
    } catch (err) {
      console.error("Failed to load devices:", err);
    }
  };

  const loadSoftware = async () => {
    if (selectedDeviceId === null) return;
    setLoading(true);
    try {
      const targetDevice = devices.find(d => d.id === selectedDeviceId);
      if (targetDevice && targetDevice.uuid === "local-host") {
        // Query host registry directly
        const data: any = await api.get("/software");
        setSoftware(data);
      } else {
        // Query remote agent software array
        const telemetry = await api.getDeviceLatestTelemetry(selectedDeviceId);
        setSoftware(telemetry.software || []);
      }
    } catch (err) {
      console.error("Failed to load software list:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadDevices();
  }, []);

  useEffect(() => {
    loadSoftware();
  }, [selectedDeviceId, devices]);

  const handleExport = () => {
    if (software.length === 0) return;
    const headers = ["Name", "Version", "Publisher", "Install Date"];
    const csvContent = [
      headers.join(","),
      ...software.map((s) =>
        [
          `"${(s.name || "").replace(/"/g, '""')}"`,
          `"${(s.version || "").replace(/"/g, '""')}"`,
          `"${(s.publisher || "").replace(/"/g, '""')}"`,
          `"${(s.install_date || "").replace(/"/g, '""')}"`
        ].join(",")
      )
    ].join("\n");

    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", `Software_Inventory_${selectedDeviceId}.csv`);
    link.click();
  };

  const publishers = Array.from(
    new Set(software.map((s) => s.publisher).filter(Boolean))
  ).sort() as string[];

  const filteredSoftware = software.filter((s) => {
    const matchesSearch = s.name.toLowerCase().includes(search.toLowerCase());
    const matchesPublisher = selectedPublisher
      ? s.publisher === selectedPublisher
      : true;
    return matchesSearch && matchesPublisher;
  });

  return (
    <div className="flex flex-col gap-6">
      {/* Title Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-slate-800 dark:text-white">Software Inventory</h1>
          <p className="text-xs text-slate-500 mt-0.5">Scans active system registries for installed programs</p>
        </div>
        
        <div className="flex items-center gap-3">
          {/* Node Selector */}
          <div className="flex items-center gap-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl px-3 py-1.5 shadow-sm">
            <Server className="h-4 w-4 text-slate-400" />
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
            onClick={handleExport}
            disabled={software.length === 0}
            className="flex items-center gap-1.5 px-3.5 py-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-850 rounded-xl text-xs font-semibold text-slate-700 dark:text-slate-200 transition-colors shadow-sm disabled:opacity-50"
          >
            <Download className="h-4 w-4 text-slate-400" />
            Export Inventory
          </button>
        </div>
      </div>

      {/* Filter controls */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-card p-4 shadow-soft flex flex-col md:flex-row gap-4 text-xs">
        <div className="relative flex-1">
          <span className="absolute inset-y-0 left-3 flex items-center text-slate-400">
            <Search className="h-4 w-4" />
          </span>
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search software by program name..."
            className="w-full bg-slate-50 dark:bg-slate-800 pl-10 pr-4 py-2 rounded-lg border border-slate-200 dark:border-slate-700 focus:outline-none focus:ring-1 focus:ring-primary focus:border-primary text-slate-800 dark:text-white"
          />
        </div>

        <select
          value={selectedPublisher}
          onChange={(e) => setSelectedPublisher(e.target.value)}
          className="bg-slate-50 dark:bg-slate-850 border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-2 text-xs focus:outline-none focus:ring-1 focus:ring-primary font-medium text-slate-700 dark:text-slate-200"
        >
          <option value="">All Publishers</option>
          {publishers.map((pub) => (
            <option key={pub} value={pub}>
              {pub}
            </option>
          ))}
        </select>
      </div>

      {/* Software Inventory Grid */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-card shadow-soft overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-slate-100 dark:divide-slate-800 text-left text-xs">
            <thead>
              <tr className="bg-slate-50 dark:bg-slate-950 text-slate-400">
                <th className="py-3 px-5 font-semibold">Program Name</th>
                <th className="py-3 px-5 font-semibold">Version</th>
                <th className="py-3 px-5 font-semibold">Publisher</th>
                <th className="py-3 px-5 font-semibold">Install Date</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {devices.length === 0 ? (
                <tr>
                  <td colSpan={4} className="py-12 px-5 text-center text-slate-500 bg-slate-50/50 dark:bg-slate-900/50">
                    <div className="flex flex-col items-center justify-center max-w-md mx-auto py-2">
                      <Server className="h-8 w-8 text-slate-400 dark:text-slate-600 mb-3 animate-pulse" />
                      <p className="font-bold text-sm text-slate-800 dark:text-slate-200">No software discovered.</p>
                      <p className="text-[11px] text-slate-450 mt-1 leading-relaxed">
                        No monitored endpoint connected. Please install the monitoring agent on a machine by running the lightweight <code className="bg-slate-100 dark:bg-slate-800 px-1 py-0.5 rounded text-primary">agent.py</code> script to sync its installed programs index.
                      </p>
                    </div>
                  </td>
                </tr>
              ) : filteredSoftware.length === 0 && !loading ? (
                <tr>
                  <td colSpan={4} className="py-8 text-center text-slate-450">
                    No software discovered. Ensure the agent has posted telemetry or check search filter.
                  </td>
                </tr>
              ) : (
                filteredSoftware.map((s, idx) => (
                  <tr key={`${s.name}-${idx}`} className="hover:bg-slate-50/50 dark:hover:bg-slate-950 transition-colors">
                    <td className="py-3 px-5 font-bold text-slate-800 dark:text-slate-150">{s.name}</td>
                    <td className="py-3 px-5 text-slate-500 font-mono">{s.version}</td>
                    <td className="py-3 px-5 text-slate-500">{s.publisher}</td>
                    <td className="py-3 px-5 text-slate-400">{s.install_date}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
