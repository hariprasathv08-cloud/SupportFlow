import React, { useState, useEffect } from "react";
import { api } from "../services/api";
import { History, Search, RefreshCw, Smartphone, Laptop } from "lucide-react";

export default function SessionLogs() {
  const [sessions, setSessions] = useState<any[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const fetchSessions = async () => {
    try {
      setLoading(true);
      const data: any = await api.get("/users/session-logs/list");
      setSessions(data || []);
      setError("");
    } catch (err: any) {
      setError(err.message || "Failed to load session logs");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSessions();
  }, []);

  const filteredSessions = sessions.filter((s) => {
    const term = searchQuery.toLowerCase();
    return (
      s.username?.toLowerCase().includes(term) ||
      s.email?.toLowerCase().includes(term) ||
      s.ip_address?.toLowerCase().includes(term) ||
      s.user_agent?.toLowerCase().includes(term) ||
      s.status?.toLowerCase().includes(term)
    );
  });

  return (
    <div className="p-8 max-w-7xl mx-auto font-sans text-slate-800 dark:text-slate-200">
      <div className="flex justify-between items-center mb-8">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Active User Sessions</h1>
          <p className="text-slate-500 dark:text-slate-400 mt-1">
            Monitor active security logins, connected IP addresses, and browsers across the ITSM platform.
          </p>
        </div>
        <History className="h-10 w-10 text-primary opacity-75" />
      </div>

      {error && (
        <div className="mb-6 p-4 bg-red-50 dark:bg-red-950/30 text-red-600 dark:text-red-400 border border-red-200 dark:border-red-800 rounded-xl text-sm">
          {error}
        </div>
      )}

      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl overflow-hidden shadow-sm">
        <div className="px-6 py-4 border-b border-slate-200 dark:border-slate-800 flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div className="relative flex-1 max-w-md">
            <input
              type="text"
              placeholder="Search user, email, IP, or agent..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-2.5 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 focus:outline-none focus:border-primary transition-colors text-sm"
            />
            <Search className="absolute left-3.5 top-3.5 h-4 w-4 text-slate-400" />
          </div>
          <button
            onClick={fetchSessions}
            disabled={loading}
            className="flex items-center gap-2 px-4 py-2.5 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 font-semibold rounded-xl text-sm transition-all"
          >
            <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
            Refresh
          </button>
        </div>

        {loading ? (
          <div className="p-12 text-center text-slate-500 dark:text-slate-400 text-sm">
            Loading session history...
          </div>
        ) : filteredSessions.length === 0 ? (
          <div className="p-12 text-center text-slate-500 dark:text-slate-400 text-sm">
            No active session records found matching search.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full border-collapse text-left">
              <thead>
                <tr className="bg-slate-50/75 dark:bg-slate-950/50 text-slate-500 dark:text-slate-400 text-xs uppercase font-bold border-b border-slate-200 dark:border-slate-800">
                  <th className="px-6 py-4">User</th>
                  <th className="px-6 py-4">IP Address</th>
                  <th className="px-6 py-4">User Agent</th>
                  <th className="px-6 py-4">Login Time</th>
                  <th className="px-6 py-4">Logout Time</th>
                  <th className="px-6 py-4">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-150 dark:divide-slate-850 text-sm">
                {filteredSessions.map((s) => (
                  <tr key={s.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-950/20 transition-colors">
                    <td className="px-6 py-4">
                      <div>
                        <p className="font-bold">{s.username}</p>
                        <p className="text-xs text-slate-500 dark:text-slate-400">{s.email}</p>
                      </div>
                    </td>
                    <td className="px-6 py-4 font-mono text-xs font-semibold">
                      {s.ip_address}
                    </td>
                    <td className="px-6 py-4 text-xs text-slate-600 dark:text-slate-450 break-all max-w-xs">
                      <div className="flex items-center gap-1.5">
                        {s.user_agent.toLowerCase().includes("mobi") ? <Smartphone className="h-3.5 w-3.5 shrink-0" /> : <Laptop className="h-3.5 w-3.5 shrink-0" />}
                        <span>{s.user_agent}</span>
                      </div>
                    </td>
                    <td className="px-6 py-4 text-xs text-slate-500 dark:text-slate-400 font-mono">
                      {s.login_time ? new Date(s.login_time).toLocaleString() : "N/A"}
                    </td>
                    <td className="px-6 py-4 text-xs text-slate-500 dark:text-slate-400 font-mono">
                      {s.logout_time ? new Date(s.logout_time).toLocaleString() : "—"}
                    </td>
                    <td className="px-6 py-4">
                      <span className={`px-2.5 py-1 rounded-full text-xs font-semibold ${
                        s.status === "Active" ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-400" : "bg-slate-100 text-slate-650 dark:bg-slate-800 dark:text-slate-400"
                      }`}>
                        {s.status}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
