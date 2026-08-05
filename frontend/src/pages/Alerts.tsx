import React, { useState, useEffect } from "react";
import { AlertTriangle, ShieldCheck, CheckCircle2, RefreshCw, Loader } from "lucide-react";
import api from "../services/api";

export default function Alerts() {
  const [alerts, setAlerts] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const currentUserRole = localStorage.getItem("role") || "Viewer";

  const loadAlerts = async () => {
    setLoading(true);
    try {
      const data: any = await api.get("/alerts");
      setAlerts(data);
    } catch (err) {
      console.error("Failed to load alerts list:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadAlerts();
    
    // Listen to custom alert events to auto-refresh alerts list
    const handleRefreshAlerts = () => {
      loadAlerts();
    };

    window.addEventListener("sys_alert", handleRefreshAlerts);
    window.addEventListener("sys_alert_resolved", handleRefreshAlerts);

    return () => {
      window.removeEventListener("sys_alert", handleRefreshAlerts);
      window.removeEventListener("sys_alert_resolved", handleRefreshAlerts);
    };
  }, []);

  const handleResolveAlert = async (id: number) => {
    try {
      await api.post(`/alerts/${id}/resolve`, { resolved: true });
      await loadAlerts();
    } catch (err) {
      alert("Failed to resolve alert.");
    }
  };

  const getAlertSeverityStyles = (severity: string) => {
    if (severity.toLowerCase() === "critical") {
      return "text-danger bg-danger/10 border-danger/20";
    }
    return "text-warning bg-warning/10 border-warning/20";
  };

  return (
    <div className="flex flex-col gap-6">
      {/* Title */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-slate-800 dark:text-white">Active & Resolved Anomalies</h1>
          <p className="text-xs text-slate-500 mt-0.5">Alert log warnings triggered when hardware limits are breached</p>
        </div>
        
        <button
          onClick={loadAlerts}
          disabled={loading}
          className="p-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-350 disabled:opacity-50 transition-all shadow-sm"
        >
          <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
        </button>
      </div>

      {/* Main Table logs */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-card p-5 shadow-soft flex-1 flex flex-col h-[520px]">
        <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3 mb-4 shrink-0">
          <h2 className="text-sm font-bold text-slate-800 dark:text-white flex items-center gap-2">
            <AlertTriangle className="h-4.5 w-4.5 text-danger" />
            Anomalies History Ledger
          </h2>
        </div>

        <div className="flex-1 overflow-y-auto pr-1 text-xs scrollbar-thin">
          {loading ? (
            <div className="h-full w-full flex items-center justify-center text-center text-slate-400">
              <Loader className="h-6 w-6 text-primary animate-spin" />
            </div>
          ) : alerts.length === 0 ? (
            <div className="h-full w-full flex flex-col items-center justify-center text-center text-slate-400 py-12">
              <ShieldCheck className="h-10 w-10 text-success mx-auto mb-2" />
              <p className="font-semibold">All systems functioning within safe threshold levels.</p>
            </div>
          ) : (
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-slate-100 dark:border-slate-800 text-slate-400 font-bold sticky top-0 bg-white dark:bg-slate-900 z-10">
                  <th className="pb-2">Incident ID</th>
                  <th className="pb-2">Category</th>
                  <th className="pb-2">Details</th>
                  <th className="pb-2">Severity</th>
                  <th className="pb-2">Timestamp</th>
                  <th className="pb-2 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50 dark:divide-slate-800/40 text-slate-700 dark:text-slate-350">
                {alerts.map((al) => (
                  <tr key={al.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/30">
                    <td className="py-3 text-slate-400 font-medium">#INC-{1000 + al.id}</td>
                    <td className="py-3 font-bold text-slate-800 dark:text-white">{al.category}</td>
                    <td className="py-3 font-medium truncate max-w-[200px]" title={al.message}>
                      {al.message}
                    </td>
                    <td className="py-3">
                      <span className={`px-1.5 py-0.5 rounded font-bold uppercase tracking-wider text-[8px] border ${getAlertSeverityStyles(al.severity)}`}>
                        {al.severity}
                      </span>
                    </td>
                    <td className="py-3 text-slate-400">
                      {new Date(al.created_at).toLocaleString([], { dateStyle: 'short', timeStyle: 'short' })}
                    </td>
                    <td className="py-3 text-right">
                      {al.resolved ? (
                        <span className="text-[10px] text-success font-semibold flex items-center gap-1 justify-end">
                          <CheckCircle2 className="h-3.5 w-3.5" />
                          Resolved
                        </span>
                      ) : (currentUserRole === "Admin" || currentUserRole === "Super Administrator" || currentUserRole === "Administrator") ? (
                        <button
                          onClick={() => handleResolveAlert(al.id)}
                          className="px-2.5 py-1 bg-slate-50 hover:bg-success/15 border border-slate-200 dark:border-slate-700 hover:border-success/20 text-slate-500 hover:text-success rounded-lg font-bold transition-all"
                        >
                          Resolve
                        </button>
                      ) : (
                        <span className="text-[10px] text-danger font-semibold">Active</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  );
}
