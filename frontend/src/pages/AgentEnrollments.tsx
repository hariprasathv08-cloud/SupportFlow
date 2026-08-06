import React, { useState, useEffect } from "react";
import { api } from "../services/api";
import { CheckCircle, XCircle, ShieldAlert, Monitor, Terminal } from "lucide-react";

export default function AgentEnrollments() {
  const [pendingAgents, setPendingAgents] = useState<any[]>([]);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [loading, setLoading] = useState(false);

  const fetchPending = async () => {
    try {
      setLoading(true);
      const data: any = await api.get("/agents/pending");
      setPendingAgents(data || []);
      setError("");
    } catch (err: any) {
      setError(err.message || "Failed to load pending agent enrollment requests");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchPending();
  }, []);

  const handleApprove = async (id: number) => {
    try {
      const res: any = await api.post(`/agents/${id}/approve`);
      setSuccess(res.message || "Device approved successfully!");
      fetchPending();
      setTimeout(() => setSuccess(""), 5000);
    } catch (err: any) {
      setError(err.message || "Failed to approve agent");
    }
  };

  const handleReject = async (id: number) => {
    if (!window.confirm("Are you sure you want to reject this device monitoring request?")) return;
    try {
      const res: any = await api.post(`/agents/${id}/reject`);
      setSuccess(res.message || "Device monitoring request rejected.");
      fetchPending();
      setTimeout(() => setSuccess(""), 5000);
    } catch (err: any) {
      setError(err.message || "Failed to reject agent");
    }
  };

  return (
    <div className="p-8 max-w-7xl mx-auto font-sans text-slate-800 dark:text-slate-200">
      <div className="flex justify-between items-center mb-8">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Agent Enrollment Requests</h1>
          <p className="text-slate-500 dark:text-slate-400 mt-1">
            Review and authorize endpoint monitoring agents before telemetry is ingested.
          </p>
        </div>
        <ShieldAlert className="h-10 w-10 text-primary opacity-75 animate-pulse" />
      </div>

      {error && (
        <div className="mb-6 p-4 bg-red-50 dark:bg-red-950/30 text-red-600 dark:text-red-400 border border-red-200 dark:border-red-800 rounded-xl text-sm">
          {error}
        </div>
      )}

      {success && (
        <div className="mb-6 p-4 bg-emerald-50 dark:bg-emerald-950/30 text-emerald-600 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800 rounded-xl text-sm">
          {success}
        </div>
      )}

      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl overflow-hidden shadow-sm">
        <div className="px-6 py-4 border-b border-slate-200 dark:border-slate-800 flex justify-between items-center">
          <h2 className="text-lg font-bold">Pending Approval Queue</h2>
          <span className="bg-amber-100 dark:bg-amber-950/50 text-amber-700 dark:text-amber-400 text-xs px-2.5 py-1 rounded-full font-semibold">
            {pendingAgents.length} pending
          </span>
        </div>

        {loading ? (
          <div className="p-12 text-center text-slate-500 dark:text-slate-400 text-sm">
            Loading enrollment requests...
          </div>
        ) : pendingAgents.length === 0 ? (
          <div className="p-12 text-center text-slate-500 dark:text-slate-400 text-sm">
            No pending agent registration requests.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full border-collapse text-left">
              <thead>
                <tr className="bg-slate-50/75 dark:bg-slate-950/50 text-slate-500 dark:text-slate-400 text-xs uppercase font-bold border-b border-slate-200 dark:border-slate-800">
                  <th className="px-6 py-4">Machine Spec</th>
                  <th className="px-6 py-4">UUID</th>
                  <th className="px-6 py-4">Tenant Scope</th>
                  <th className="px-6 py-4">API Token Status</th>
                  <th className="px-6 py-4 text-right">Verification Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-150 dark:divide-slate-850 text-sm">
                {pendingAgents.map((agent) => (
                  <tr key={agent.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-950/20 transition-colors">
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-3">
                        <Monitor className="h-8 w-8 text-slate-400" />
                        <div>
                          <p className="font-bold">{agent.hostname}</p>
                          <p className="text-xs text-slate-500 dark:text-slate-400">{agent.operating_system}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4 font-mono text-xs text-slate-600 dark:text-slate-400">
                      {agent.uuid}
                    </td>
                    <td className="px-6 py-4">
                      <span className="bg-primary/10 text-primary dark:text-white text-xs px-2.5 py-1 rounded-full font-medium">
                        {agent.organization?.name || "Acme Enterprise"}
                      </span>
                    </td>
                    <td className="px-6 py-4 font-mono text-xs">
                      {agent.api_token ? (
                        <div className="flex items-center gap-1.5 text-slate-600 dark:text-slate-350">
                          <Terminal className="h-3.5 w-3.5" />
                          <span>Generated</span>
                        </div>
                      ) : (
                        <span className="text-slate-400">Awaiting Assign</span>
                      )}
                    </td>
                    <td className="px-6 py-4 text-right">
                      <div className="flex items-center justify-end gap-2">
                        <button
                          onClick={() => handleApprove(agent.id)}
                          className="flex items-center gap-1.5 py-2 px-3 bg-emerald-500 hover:bg-emerald-600 text-white rounded-xl font-semibold text-xs transition-colors shadow-sm"
                        >
                          <CheckCircle className="h-3.5 w-3.5" />
                          Approve
                        </button>
                        <button
                          onClick={() => handleReject(agent.id)}
                          className="flex items-center gap-1.5 py-2 px-3 bg-red-500 hover:bg-red-600 text-white rounded-xl font-semibold text-xs transition-colors shadow-sm"
                        >
                          <XCircle className="h-3.5 w-3.5" />
                          Reject
                        </button>
                      </div>
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
