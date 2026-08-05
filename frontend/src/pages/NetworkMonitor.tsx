import { useState } from "react";
import { motion } from "framer-motion";
import {
  Wifi,
  Search,
  Download,
  Play,
  Server,
  HelpCircle,
  Network,
  Globe,
  Loader
} from "lucide-react";
import api from "../services/api";

export default function NetworkMonitor() {
  const [pingHost, setPingHost] = useState("8.8.8.8");
  const [pingCount, setPingCount] = useState(4);
  const [pingResult, setPingResult] = useState<any>(null);
  const [pingLoading, setPingLoading] = useState(false);

  const [traceHost, setTraceHost] = useState("google.com");
  const [traceResult, setTraceResult] = useState<any>(null);
  const [traceLoading, setTraceLoading] = useState(false);

  const [dnsHost, setDnsHost] = useState("yahoo.com");
  const [dnsResult, setDnsResult] = useState<any>(null);
  const [dnsLoading, setDnsLoading] = useState(false);

  const [scanLimit, setScanLimit] = useState(50);
  const [scanResults, setScanResults] = useState<any[]>([]);
  const [scanLoading, setScanLoading] = useState(false);

  const handlePing = async (e: React.FormEvent) => {
    e.preventDefault();
    setPingLoading(true);
    setPingResult(null);
    try {
      const data = await api.get(`/network/ping?host=${pingHost}&count=${pingCount}`, { timeout: 15000 });
      setPingResult(data);
    } catch (err: any) {
      alert(`Ping Error: ${err.message}`);
    } finally {
      setPingLoading(false);
    }
  };

  const handleTrace = async (e: React.FormEvent) => {
    e.preventDefault();
    setTraceLoading(true);
    setTraceResult(null);
    try {
      const data = await api.get(`/network/traceroute?host=${traceHost}`, { timeout: 35000 });
      setTraceResult(data);
    } catch (err: any) {
      alert(`Traceroute Error: ${err.message}`);
    } finally {
      setTraceLoading(false);
    }
  };

  const handleDns = async (e: React.FormEvent) => {
    e.preventDefault();
    setDnsLoading(true);
    setDnsResult(null);
    try {
      const data = await api.get(`/network/dns?host=${dnsHost}`);
      setDnsResult(data);
    } catch (err: any) {
      alert(`DNS Error: ${err.message}`);
    } finally {
      setDnsLoading(false);
    }
  };

  const handleLanScan = async () => {
    setScanLoading(true);
    setScanResults([]);
    try {
      const data: any = await api.post(`/network/scan?limit=${scanLimit}`, null, { timeout: 30000 });
      setScanResults(data);
    } catch (err: any) {
      alert(`LAN Scan Error: ${err.message}`);
    } finally {
      setScanLoading(false);
    }
  };

  const exportScanResults = () => {
    if (scanResults.length === 0) return;
    const headers = ["IP Address", "MAC Address", "Hostname", "Latency (ms)", "Status"];
    const csvContent = [
      headers.join(","),
      ...scanResults.map((r) =>
        [r.ip, r.mac, r.hostname, r.latency_ms ?? "", r.status].join(",")
      )
    ].join("\n");

    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", `Network_Subnet_Scan_${new Date().toISOString().slice(0,10)}.csv`);
    link.click();
  };

  return (
    <div className="flex flex-col gap-6">
      {/* Title */}
      <div>
        <h1 className="text-xl font-bold text-slate-800 dark:text-white">Network Diagnostics</h1>
        <p className="text-xs text-slate-500 mt-0.5">Test latency, traceroutes, DNS speeds, and perform local LAN scanning sweeps</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Network forms */}
        <div className="lg:col-span-5 flex flex-col gap-5">
          {/* Ping Form */}
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-card p-5 shadow-soft">
            <h2 className="text-xs font-bold text-slate-400 uppercase tracking-wide mb-4 flex items-center gap-2">
              <Wifi className="h-4 w-4 text-primary" />
              ICMP Ping Diagnostic
            </h2>
            <form onSubmit={handlePing} className="flex gap-2 text-xs">
              <input
                type="text"
                required
                value={pingHost}
                onChange={(e) => setPingHost(e.target.value)}
                placeholder="IP or Hostname"
                className="flex-1 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 px-3 py-2 rounded-lg focus:outline-none focus:ring-1 focus:ring-primary focus:border-primary text-slate-800 dark:text-white"
              />
              <select
                value={pingCount}
                onChange={(e) => setPingCount(parseInt(e.target.value))}
                className="bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 px-2 py-2 rounded-lg text-slate-700 dark:text-slate-200"
              >
                <option value={2}>2 packs</option>
                <option value={4}>4 packs</option>
                <option value={8}>8 packs</option>
              </select>
              <button
                type="submit"
                disabled={pingLoading}
                className="bg-primary hover:bg-primary-dark text-white px-3 py-2 rounded-lg font-bold flex items-center gap-1.5 disabled:opacity-50"
              >
                {pingLoading ? <Loader className="h-3 w-3 animate-spin" /> : <Play className="h-3 w-3 fill-white" />}
                Run
              </button>
            </form>

            {pingResult && (
              <div className="mt-4 bg-slate-950 p-3 rounded-lg border border-slate-800 font-mono text-[9px] text-green-400 overflow-x-auto max-h-36">
                <p className="font-bold text-white uppercase text-[8px] mb-1.5">PING OUTPUT: {pingResult.status}</p>
                <pre>{pingResult.output}</pre>
              </div>
            )}
          </div>

          {/* DNS Lookup Form */}
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-card p-5 shadow-soft">
            <h2 className="text-xs font-bold text-slate-400 uppercase tracking-wide mb-4 flex items-center gap-2">
              <Globe className="h-4 w-4 text-info" />
              DNS Lookup Resolution
            </h2>
            <form onSubmit={handleDns} className="flex gap-2 text-xs">
              <input
                type="text"
                required
                value={dnsHost}
                onChange={(e) => setDnsHost(e.target.value)}
                placeholder="domain.com"
                className="flex-1 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 px-3 py-2 rounded-lg focus:outline-none focus:ring-1 focus:ring-primary focus:border-primary text-slate-800 dark:text-white"
              />
              <button
                type="submit"
                disabled={dnsLoading}
                className="bg-primary hover:bg-primary-dark text-white px-3 py-2 rounded-lg font-bold flex items-center gap-1.5 disabled:opacity-50"
              >
                {dnsLoading ? <Loader className="h-3 w-3 animate-spin" /> : <Play className="h-3 w-3 fill-white" />}
                Lookup
              </button>
            </form>

            {dnsResult && (
              <div className="mt-4 bg-slate-950 p-3 rounded-lg border border-slate-800 font-mono text-[9px] text-green-400">
                <p className="font-bold text-white uppercase text-[8px] mb-1.5">DNS STATUS: {dnsResult.status}</p>
                {dnsResult.ip_addresses.length > 0 ? (
                  <div className="space-y-1">
                    <p>Query Time: {dnsResult.query_time_ms} ms</p>
                    <p>Addresses Discovered:</p>
                    {dnsResult.ip_addresses.map((ip: string) => (
                      <p key={ip} className="pl-4 text-white font-semibold">- {ip}</p>
                    ))}
                  </div>
                ) : (
                  <p className="text-danger">Failed to resolve domain addresses.</p>
                )}
              </div>
            )}
          </div>

          {/* Traceroute Form */}
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-card p-5 shadow-soft">
            <h2 className="text-xs font-bold text-slate-400 uppercase tracking-wide mb-4 flex items-center gap-2">
              <Network className="h-4 w-4 text-purple-500" />
              Trace Route Pathway
            </h2>
            <form onSubmit={handleTrace} className="flex gap-2 text-xs">
              <input
                type="text"
                required
                value={traceHost}
                onChange={(e) => setTraceHost(e.target.value)}
                placeholder="Domain or IP"
                className="flex-1 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 px-3 py-2 rounded-lg focus:outline-none focus:ring-1 focus:ring-primary focus:border-primary text-slate-800 dark:text-white"
              />
              <button
                type="submit"
                disabled={traceLoading}
                className="bg-primary hover:bg-primary-dark text-white px-3 py-2 rounded-lg font-bold flex items-center gap-1.5 disabled:opacity-50"
              >
                {traceLoading ? <Loader className="h-3 w-3 animate-spin" /> : <Play className="h-3 w-3 fill-white" />}
                Trace
              </button>
            </form>

            {traceResult && (
              <div className="mt-4 bg-slate-950 p-3 rounded-lg border border-slate-800 font-mono text-[9px] text-green-400 overflow-x-auto max-h-48">
                <p className="font-bold text-white uppercase text-[8px] mb-2">Hops Diagram:</p>
                <div className="space-y-1.5">
                  {traceResult.hops.length === 0 ? (
                    <p className="text-slate-500">Destination unreachable or ICMP blocked.</p>
                  ) : (
                    traceResult.hops.map((h: any) => (
                      <div key={h.hop_number} className="flex gap-4">
                        <span className="text-slate-400 font-bold">#{h.hop_number}</span>
                        <span className="text-info">{h.rtt_ms}</span>
                        <span className="text-white font-semibold">{h.ip_address}</span>
                        <span className="text-slate-400 truncate">({h.hostname})</span>
                      </div>
                    ))
                  )}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Subnet LAN Discovery Scan */}
        <div className="lg:col-span-7 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-card p-5 shadow-soft flex flex-col h-[520px]">
          <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3 mb-4 shrink-0">
            <div>
              <h2 className="text-sm font-bold text-slate-800 dark:text-white">LAN Device Discovery</h2>
              <p className="text-[10px] text-slate-400 mt-0.5">Pings subnet threads to resolve responsive active terminals</p>
            </div>
            <div className="flex items-center gap-2 text-xs">
              <select
                value={scanLimit}
                onChange={(e) => setScanLimit(parseInt(e.target.value))}
                className="bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 px-2 py-1.5 rounded-lg text-slate-700 dark:text-slate-300"
              >
                <option value={20}>First 20 IPs</option>
                <option value={50}>First 50 IPs</option>
                <option value={100}>First 100 IPs</option>
              </select>
              <button
                onClick={handleLanScan}
                disabled={scanLoading}
                className="bg-primary hover:bg-primary-dark text-white px-3 py-1.5 rounded-lg font-bold flex items-center gap-1.5 disabled:opacity-50"
              >
                {scanLoading ? <Loader className="h-3.5 w-3.5 animate-spin" /> : <Wifi className="h-3.5 w-3.5" />}
                Scan Subnet
              </button>
              {scanResults.length > 0 && (
                <button
                  onClick={exportScanResults}
                  className="p-1.5 border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800 rounded-lg text-slate-500 hover:text-slate-800 dark:hover:text-white"
                  title="Export results"
                >
                  <Download className="h-4 w-4" />
                </button>
              )}
            </div>
          </div>

          <div className="flex-1 overflow-y-auto pr-1 text-xs scrollbar-thin">
            {scanLoading ? (
              <div className="h-full w-full flex flex-col items-center justify-center text-center text-slate-400">
                <Loader className="h-10 w-10 text-primary animate-spin" />
                <p className="mt-3 font-semibold text-xs">Sweeping local subnet gateway range...</p>
                <p className="text-[10px] text-slate-500 mt-1">This will scan multithreaded network targets.</p>
              </div>
            ) : scanResults.length === 0 ? (
              <div className="h-full w-full flex flex-col items-center justify-center text-center text-slate-400 py-12">
                <Wifi className="h-12 w-12 text-slate-300 dark:text-slate-800" />
                <p className="mt-3 font-semibold text-xs text-slate-500">Subnet scanner idle.</p>
                <p className="text-[10px] text-slate-400 mt-1">Click the button above to discover local nodes.</p>
              </div>
            ) : (
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-slate-100 dark:border-slate-800 text-slate-400 font-bold sticky top-0 bg-white dark:bg-slate-900 z-10">
                    <th className="pb-2">Local IP</th>
                    <th className="pb-2">Physical MAC</th>
                    <th className="pb-2">Hostname</th>
                    <th className="pb-2 text-right">Ping Time</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-50 dark:divide-slate-800/40 text-slate-700 dark:text-slate-300">
                  {scanResults.map((r, idx) => (
                    <tr key={idx} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/30">
                      <td className="py-2.5 font-bold text-slate-800 dark:text-white">{r.ip}</td>
                      <td className="py-2.5 font-mono text-slate-500">{r.mac}</td>
                      <td className="py-2.5 font-medium truncate max-w-[150px]" title={r.hostname}>
                        {r.hostname}
                      </td>
                      <td className="py-2.5 text-right font-semibold text-success">{r.latency_ms} ms</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
