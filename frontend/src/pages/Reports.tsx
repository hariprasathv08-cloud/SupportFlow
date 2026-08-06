import React, { useState, useEffect, useRef } from "react";
import { 
  FileText, 
  Download, 
  Database, 
  FileSpreadsheet, 
  Info, 
  LayoutDashboard, 
  Ticket, 
  Layers, 
  Activity, 
  Network as NetworkIcon, 
  Users, 
  AlertTriangle,
  Loader2,
  CheckCircle,
  XCircle,
  X,
  Mail,
  Calendar,
  Eye,
  RefreshCw,
  Plus
} from "lucide-react";
import api from "../services/api";

const API_URL = import.meta.env.VITE_API_URL || "http://127.0.0.1:8000/api/v1";

interface ReportTask {
  id: number;
  task_id: string;
  user_id: number;
  report_type: string;
  formats: string;
  delivery: string;
  emails: string | null;
  date_range: string;
  status: string;
  progress: number;
  error_message: string | null;
  file_path: string | null;
  created_at: string;
  completed_at: string | null;
}

export default function Reports() {
  const [counts, setCounts] = useState<Record<string, number | boolean>>({});
  const [loadingCounts, setLoadingCounts] = useState(true);
  const [history, setHistory] = useState<ReportTask[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(true);
  
  // Modal states
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [reportType, setReportType] = useState("Dashboard Summary");
  const [formats, setFormats] = useState<string[]>(["pdf"]);
  const [delivery, setDelivery] = useState("download");
  const [emailsStr, setEmailsStr] = useState("");
  const [dateRange, setDateRange] = useState("today");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [includeCharts, setIncludeCharts] = useState(true);
  const [includeRawData, setIncludeRawData] = useState(true);
  
  // Active job states
  const [activeTaskId, setActiveTaskId] = useState<string | null>(null);
  const [activeTask, setActiveTask] = useState<ReportTask | null>(null);
  const [pollingActive, setPollingActive] = useState(false);

  // Sub-tabs for logs
  const [activeTab, setActiveTab] = useState<"recent" | "downloads" | "emails">("recent");
  
  const [toast, setToast] = useState<{ type: "success" | "error"; message: string } | null>(null);

  // Ref to poll active tasks
  const pollIntervalRef = useRef<any>(null);

  const fetchStatus = async () => {
    try {
      setLoadingCounts(true);
      const data: any = await api.get("/reports/status");
      setCounts(data || {});
    } catch (err: any) {
      console.error("Failed to load reports status:", err);
      showToast("error", "Failed to connect to backend reports status check.");
    } finally {
      setLoadingCounts(false);
    }
  };

  const fetchHistory = async () => {
    try {
      setLoadingHistory(true);
      const data: any = await api.get("/reports/history");
      setHistory(data || []);
    } catch (err: any) {
      console.error("Failed to load report history:", err);
    } finally {
      setLoadingHistory(false);
    }
  };

  useEffect(() => {
    fetchStatus();
    fetchHistory();
  }, []);

  // Poll for active task progress
  useEffect(() => {
    if (activeTaskId) {
      setPollingActive(true);
      pollIntervalRef.current = setInterval(async () => {
        try {
          const task: any = await api.get(`/reports/tasks/${activeTaskId}`);
          setActiveTask(task);
          if (task.status === "Completed" || task.status === "Failed") {
            // Stop polling
            if (pollIntervalRef.current) clearInterval(pollIntervalRef.current);
            setActiveTaskId(null);
            setPollingActive(false);
            fetchHistory();
            fetchStatus();
            if (task.status === "Completed") {
              showToast("success", `Report generation completed successfully!`);
            } else {
              showToast("error", `Report generation failed: ${task.error_message || "Unknown error"}`);
            }
          }
        } catch (err) {
          console.error("Polling error:", err);
          if (pollIntervalRef.current) clearInterval(pollIntervalRef.current);
          setActiveTaskId(null);
          setPollingActive(false);
        }
      }, 1000);
    }

    return () => {
      if (pollIntervalRef.current) clearInterval(pollIntervalRef.current);
    };
  }, [activeTaskId]);

  const showToast = (type: "success" | "error", message: string) => {
    setToast({ type, message });
    setTimeout(() => setToast(null), 5000);
  };

  // Convert key mapping to match status counts check
  const getRecordCountKey = (type: string) => {
    switch (type) {
      case "Dashboard Summary": return "dashboard";
      case "Assets": return "assets";
      case "Tickets": return "tickets";
      case "Software Inventory": return "software";
      case "Network": return "network";
      case "System Health": return "system_health";
      case "Users": return "users";
      case "Alerts": return "alerts";
      default: return "dashboard";
    }
  };

  const checkDataAvailability = () => {
    if (reportType === "Complete Enterprise Report") {
      // Must have at least some data
      return Object.values(counts).some(v => v === true || (typeof v === "number" && v > 0));
    }
    const key = getRecordCountKey(reportType);
    const countVal = counts[key];
    return countVal === true || (typeof countVal === "number" && countVal > 0);
  };

  const handleGenerateSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (formats.length === 0) {
      showToast("error", "Please select at least one export format.");
      return;
    }

    if ((delivery === "email" || delivery === "both") && !emailsStr.trim()) {
      showToast("error", "Please enter at least one recipient email address.");
      return;
    }

    if (!checkDataAvailability()) {
      showToast("error", "No records available for the selected report.");
      return;
    }

    try {
      const payload = {
        report_type: reportType,
        formats,
        delivery,
        emails: (delivery === "email" || delivery === "both") ? emailsStr.split(",").map(e => e.trim()) : [],
        date_range: dateRange,
        start_date: dateRange === "custom" ? startDate : null,
        end_date: dateRange === "custom" ? endDate : null,
        include_charts: includeCharts,
        include_raw_data: includeRawData
      };

      const task: any = await api.post("/reports/generate", payload);
      setActiveTaskId(task.task_id);
      setActiveTask(task);
      setIsModalOpen(false);
      showToast("success", "Report compilation request queued successfully.");
    } catch (err: any) {
      showToast("error", err.message || "Failed to enqueue report task.");
    }
  };

  const downloadReportFile = async (filename: string) => {
    try {
      const token = localStorage.getItem("token") || "";
      const headers: Record<string, string> = {};
      if (token) {
        headers["Authorization"] = `Bearer ${token}`;
      }
      const response = await fetch(`${API_URL}/reports/download/${filename}`, { headers });
      
      if (response.status === 401) {
        // Try refresh
        const refreshToken = localStorage.getItem("refresh_token");
        if (refreshToken) {
          const refreshRes = await fetch(`${API_URL}/auth/refresh`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ refresh_token: refreshToken })
          });
          if (refreshRes.ok) {
            const refreshData = await refreshRes.json();
            localStorage.setItem("token", refreshData.access_token);
            localStorage.setItem("refresh_token", refreshData.refresh_token);
            
            headers["Authorization"] = `Bearer ${refreshData.access_token}`;
            const retryRes = await fetch(`${API_URL}/reports/download/${filename}`, { headers });
            if (retryRes.ok) {
              const blob = await retryRes.blob();
              triggerBlobDownload(blob, filename);
              return;
            }
          }
        }
        localStorage.removeItem("token");
        localStorage.removeItem("refresh_token");
        window.location.href = "/login";
        throw new Error("Session expired. Please log in again.");
      }
      
      if (!response.ok) {
        throw new Error("Failed to download file");
      }
      
      const blob = await response.blob();
      triggerBlobDownload(blob, filename);
      showToast("success", `${filename} downloaded successfully.`);
    } catch (err: any) {
      showToast("error", err.message || "Failed to download report");
    }
  };

  const triggerBlobDownload = (blob: Blob, filename: string) => {
    const downloadUrl = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = downloadUrl;
    link.setAttribute("download", filename);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(downloadUrl);
  };

  const getFormatBadge = (fmt: string) => {
    switch (fmt.toLowerCase()) {
      case "pdf": return "bg-red-500/10 text-red-500 border border-red-500/20";
      case "excel": return "bg-emerald-500/10 text-emerald-500 border border-emerald-500/20";
      case "csv": return "bg-blue-500/10 text-blue-500 border border-blue-500/20";
      default: return "bg-slate-500/10 text-slate-500 border border-slate-500/20";
    }
  };

  const hasData = checkDataAvailability();

  return (
    <div className="flex flex-col gap-6 relative min-h-screen text-slate-700 dark:text-slate-200">
      {/* Toast Tray */}
      {toast && (
        <div className="fixed top-6 right-6 z-50 flex items-center gap-3 px-4 py-3 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl shadow-xl animate-fade-in max-w-sm">
          {toast.type === "success" ? (
            <CheckCircle className="h-5 w-5 text-emerald-500 shrink-0" />
          ) : (
            <XCircle className="h-5 w-5 text-red-500 shrink-0" />
          )}
          <span className="text-xs font-semibold flex-1">{toast.message}</span>
          <button onClick={() => setToast(null)} className="text-slate-400 hover:text-slate-600">
            <X className="h-4 w-4" />
          </button>
        </div>
      )}

      {/* Header Area */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-slate-800 dark:text-white">Reports Center</h1>
          <p className="text-xs text-slate-500 mt-0.5">Enterprise diagnostic logging, automated report generation and direct SMTP mail dispatch</p>
        </div>
        <button 
          onClick={() => {
            fetchStatus();
            setIsModalOpen(true);
          }}
          className="flex items-center justify-center gap-2 px-4 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-semibold shadow-md transition-all self-start"
        >
          <Plus className="h-4 w-4" />
          Generate Report
        </button>
      </div>

      {/* Info Warning Bar */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-4 shadow-soft text-xs flex gap-3 text-slate-500 dark:text-slate-400">
        <Info className="h-5 w-5 text-blue-500 shrink-0" />
        <div className="leading-normal flex-1">
          <span className="font-semibold text-slate-800 dark:text-white">Security & Audit Compliance Mode active:</span> all diagnostic requests automatically verify JWT claims and refresh expired tokens transparently. Download history metrics and SMTP emails logs are recorded globally.
        </div>
        <button onClick={fetchHistory} className="text-blue-500 hover:underline flex items-center gap-1 shrink-0 font-medium">
          <RefreshCw className="h-3.5 w-3.5" />
          Sync Log History
        </button>
      </div>

      {/* Active Job Tracker */}
      {activeTask && (
        <div className="bg-white dark:bg-slate-900 border-2 border-blue-500/20 dark:border-blue-500/30 rounded-xl p-5 shadow-lg relative overflow-hidden transition-all">
          <div className="absolute top-0 left-0 h-1 bg-blue-500 transition-all duration-300" style={{ width: `${activeTask.progress}%` }}></div>
          
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 text-xs">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 bg-blue-500/10 rounded-xl flex items-center justify-center border border-blue-500/20">
                <Loader2 className="h-5 w-5 text-blue-500 animate-spin" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="font-bold text-slate-800 dark:text-white">Active Compilation Task</h3>
                  <span className="bg-blue-500/15 text-blue-500 text-[10px] font-bold px-2 py-0.5 rounded-full uppercase">
                    {activeTask.status}
                  </span>
                </div>
                <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-1">
                  Type: {activeTask.report_type} • Formats: {activeTask.formats.toUpperCase()} • Range: {activeTask.date_range}
                </p>
              </div>
            </div>

            <div className="flex flex-col items-end gap-1.5 min-w-[200px]">
              <div className="flex justify-between w-full font-bold text-slate-800 dark:text-white text-[11px]">
                <span>Status: {activeTask.status}...</span>
                <span>{activeTask.progress}%</span>
              </div>
              <div className="w-full bg-slate-100 dark:bg-slate-800 h-2 rounded-full overflow-hidden">
                <div className="bg-blue-600 h-full rounded-full transition-all duration-300" style={{ width: `${activeTask.progress}%` }}></div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Grid: Status checklist & tabs logs */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* Left Side: Status Check Counts */}
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5 shadow-soft flex flex-col gap-4 self-start">
          <h2 className="text-xs font-bold uppercase tracking-wider text-slate-400">Database Record Inventory</h2>
          
          {loadingCounts ? (
            <div className="flex flex-col items-center py-10 gap-2">
              <Loader2 className="h-6 w-6 text-blue-500 animate-spin" />
              <span className="text-[10px] text-slate-400">Auditing active records...</span>
            </div>
          ) : (
            <div className="flex flex-col gap-3">
              {[
                { label: "Managed Workstations", key: "assets", icon: Database },
                { label: "SupportFlow Tickets", key: "tickets", icon: Ticket },
                { label: "Audited Software Packages", key: "software", icon: Layers },
                { label: "Security System Alerts", key: "alerts", icon: AlertTriangle },
                { label: "Administrator Profiles", key: "users", icon: Users },
              ].map(item => {
                const count = counts[item.key];
                const countNum = typeof count === "number" ? count : 0;
                const Icon = item.icon;
                return (
                  <div key={item.key} className="flex items-center justify-between p-2.5 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-850 transition-colors border border-transparent hover:border-slate-100 dark:hover:border-slate-800">
                    <div className="flex items-center gap-2.5">
                      <Icon className="h-4 w-4 text-slate-400" />
                      <span className="text-xs font-medium text-slate-700 dark:text-slate-300">{item.label}</span>
                    </div>
                    <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                      countNum > 0 ? "bg-blue-500/10 text-blue-500" : "bg-red-500/10 text-red-500"
                    }`}>
                      {countNum} rows
                    </span>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Right Side: Log tables */}
        <div className="lg:col-span-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5 shadow-soft flex flex-col gap-4">
          
          {/* Sub tabs list */}
          <div className="flex border-b border-slate-250 dark:border-slate-800 gap-4 text-xs font-bold">
            <button 
              onClick={() => setActiveTab("recent")}
              className={`pb-2 border-b-2 transition-all ${
                activeTab === "recent" ? "border-blue-500 text-blue-500" : "border-transparent text-slate-400 hover:text-slate-600"
              }`}
            >
              Recent Reports
            </button>
            <button 
              onClick={() => setActiveTab("downloads")}
              className={`pb-2 border-b-2 transition-all ${
                activeTab === "downloads" ? "border-blue-500 text-blue-500" : "border-transparent text-slate-400 hover:text-slate-600"
              }`}
            >
              Download History
            </button>
            <button 
              onClick={() => setActiveTab("emails")}
              className={`pb-2 border-b-2 transition-all ${
                activeTab === "emails" ? "border-blue-500 text-blue-500" : "border-transparent text-slate-400 hover:text-slate-600"
              }`}
            >
              Email History
            </button>
          </div>

          {loadingHistory ? (
            <div className="flex flex-col items-center justify-center py-20 gap-2">
              <Loader2 className="h-6 w-6 text-blue-500 animate-spin" />
              <span className="text-[10px] text-slate-400">Loading compilation logs...</span>
            </div>
          ) : history.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-20 text-slate-400 gap-2 text-xs">
              <Info className="h-8 w-8 text-slate-350" />
              <span>No report records in this ledger.</span>
            </div>
          ) : (
            <div className="overflow-x-auto">
              {activeTab === "recent" && (
                <table className="w-full text-left text-xs border-collapse">
                  <thead>
                    <tr className="border-b border-slate-200 dark:border-slate-800 text-slate-400 font-semibold">
                      <th className="pb-3 pr-2">Report Type</th>
                      <th className="pb-3 px-2">Delivery</th>
                      <th className="pb-3 px-2 font-medium">Formats</th>
                      <th className="pb-3 px-2">Status</th>
                      <th className="pb-3 px-2 text-right">Date</th>
                      <th className="pb-3 pl-2 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {history.map((task) => (
                      <tr key={task.task_id} className="border-b border-slate-100 dark:border-slate-800/80 hover:bg-slate-50 dark:hover:bg-slate-850/30 transition-colors">
                        <td className="py-3.5 pr-2 font-bold text-slate-800 dark:text-slate-200">
                          {task.report_type}
                        </td>
                        <td className="py-3.5 px-2 capitalize text-slate-500 dark:text-slate-400">
                          {task.delivery}
                        </td>
                        <td className="py-3.5 px-2">
                          <div className="flex gap-1.5 flex-wrap">
                            {task.formats.split(",").map(fmt => (
                              <span key={fmt} className={`text-[9px] font-bold px-1.5 py-0.5 rounded uppercase ${getFormatBadge(fmt)}`}>
                                {fmt}
                              </span>
                            ))}
                          </div>
                        </td>
                        <td className="py-3.5 px-2">
                          <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                            task.status === "Completed" ? "bg-emerald-500/10 text-emerald-500" :
                            task.status === "Failed" ? "bg-red-500/10 text-red-500" : "bg-blue-500/10 text-blue-500 animate-pulse"
                          }`}>
                            {task.status}
                          </span>
                        </td>
                        <td className="py-3.5 px-2 text-right text-slate-500 dark:text-slate-400">
                          {new Date(task.created_at).toLocaleDateString()}
                        </td>
                        <td className="py-3.5 pl-2 text-right">
                          <div className="flex gap-2 justify-end">
                            {task.status === "Completed" && task.file_path && task.file_path.split(",").map((file) => (
                              <button 
                                key={file}
                                onClick={() => downloadReportFile(file)}
                                className="flex items-center gap-1 hover:text-blue-500 transition-colors text-slate-400"
                                title={`Download ${file}`}
                              >
                                <Download className="h-4 w-4" />
                              </button>
                            ))}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}

              {activeTab === "downloads" && (
                <table className="w-full text-left text-xs border-collapse">
                  <thead>
                    <tr className="border-b border-slate-200 dark:border-slate-800 text-slate-400 font-semibold">
                      <th className="pb-3 pr-2">Report Type</th>
                      <th className="pb-3 px-2">Download File</th>
                      <th className="pb-3 px-2 text-right">Timestamp</th>
                      <th className="pb-3 pl-2 text-right">Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {history
                      .filter(t => t.status === "Completed" && (t.delivery === "download" || t.delivery === "both") && t.file_path)
                      .map((task) => (
                        <React.Fragment key={task.task_id}>
                          {task.file_path && task.file_path.split(",").map((file) => (
                            <tr key={file} className="border-b border-slate-100 dark:border-slate-800/80 hover:bg-slate-50 dark:hover:bg-slate-850/30 transition-colors">
                              <td className="py-3.5 pr-2 font-bold text-slate-800 dark:text-slate-200">
                                {task.report_type}
                              </td>
                              <td className="py-3.5 px-2 text-slate-500 dark:text-slate-400 font-mono text-[11px] truncate max-w-[200px]" title={file}>
                                {file}
                              </td>
                              <td className="py-3.5 px-2 text-right text-slate-500 dark:text-slate-400">
                                {new Date(task.completed_at || task.created_at).toLocaleString()}
                              </td>
                              <td className="py-3.5 pl-2 text-right">
                                <button 
                                  onClick={() => downloadReportFile(file)}
                                  className="flex items-center gap-1.5 hover:text-blue-500 text-slate-400 justify-end w-full"
                                >
                                  <Download className="h-4 w-4" />
                                  <span>Download</span>
                                </button>
                              </td>
                            </tr>
                          ))}
                        </React.Fragment>
                      ))}
                  </tbody>
                </table>
              )}

              {activeTab === "emails" && (
                <table className="w-full text-left text-xs border-collapse">
                  <thead>
                    <tr className="border-b border-slate-200 dark:border-slate-800 text-slate-400 font-semibold">
                      <th className="pb-3 pr-2">Report Type</th>
                      <th className="pb-3 px-2">Recipient Mailbox(es)</th>
                      <th className="pb-3 px-2 text-right">Status</th>
                      <th className="pb-3 pl-2 text-right">Dispatched At</th>
                    </tr>
                  </thead>
                  <tbody>
                    {history
                      .filter(t => t.delivery === "email" || t.delivery === "both")
                      .map((task) => (
                        <tr key={task.task_id} className="border-b border-slate-100 dark:border-slate-800/80 hover:bg-slate-50 dark:hover:bg-slate-850/30 transition-colors">
                          <td className="py-3.5 pr-2 font-bold text-slate-800 dark:text-slate-200">
                            {task.report_type}
                          </td>
                          <td className="py-3.5 px-2 text-slate-500 dark:text-slate-400 truncate max-w-[200px]" title={task.emails || ""}>
                            {task.emails || "N/A"}
                          </td>
                          <td className="py-3.5 px-2 text-right font-bold">
                            <span className={
                              task.status === "Completed" ? "text-emerald-500" :
                              task.status === "Failed" ? "text-red-500" : "text-blue-500 animate-pulse"
                            }>
                              {task.status === "Completed" ? "Dispatched" : task.status}
                            </span>
                          </td>
                          <td className="py-3.5 pl-2 text-right text-slate-500 dark:text-slate-400">
                            {new Date(task.completed_at || task.created_at).toLocaleString()}
                          </td>
                        </tr>
                      ))}
                  </tbody>
                </table>
              )}
            </div>
          )}
        </div>

      </div>

      {/* Redesigned Glassmorphism Wizard Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-sm px-4">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-850 w-full max-w-lg rounded-2xl shadow-2xl p-6 relative overflow-hidden transition-all animate-scale-up">
            
            {/* Modal Header */}
            <div className="flex justify-between items-start pb-4 border-b border-slate-200 dark:border-slate-800">
              <div>
                <h3 className="text-md font-bold text-slate-800 dark:text-white">Report Generator Wizard</h3>
                <p className="text-[11px] text-slate-500 mt-0.5">Enqueues diagnostic compilation tasks run in background</p>
              </div>
              <button 
                onClick={() => setIsModalOpen(false)}
                className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* Modal Body / Form */}
            <form onSubmit={handleGenerateSubmit} className="mt-4 flex flex-col gap-4 text-xs">
              
              {/* Report Type */}
              <div className="flex flex-col gap-1.5">
                <label className="font-bold text-slate-600 dark:text-slate-400">Report Category</label>
                <select 
                  value={reportType}
                  onChange={(e) => setReportType(e.target.value)}
                  className="bg-slate-50 dark:bg-slate-850 border border-slate-250 dark:border-slate-800 rounded-xl px-3 py-2 text-slate-800 dark:text-white outline-none focus:border-blue-500"
                >
                  <option value="Dashboard Summary">Dashboard Summary</option>
                  <option value="Assets">Assets Inventory</option>
                  <option value="Tickets">Tickets Lifecycle</option>
                  <option value="Software Inventory">Software Inventory</option>
                  <option value="Network">Network Topology</option>
                  <option value="System Health">System Health Audit</option>
                  <option value="Users">Users Directory</option>
                  <option value="Alerts">Vulnerabilities & Alerts</option>
                  <option value="Complete Enterprise Report">Complete Enterprise Report (All Tabs)</option>
                </select>
              </div>

              {/* Data Availability Warning */}
              {!hasData && (
                <div className="p-3 bg-red-500/10 border border-red-500/20 rounded-xl text-red-500 font-semibold">
                  No records available for the selected report. Generation is disabled.
                </div>
              )}

              {/* Export formats (PDF, Excel, CSV checkboxes) */}
              <div className="flex flex-col gap-1.5">
                <label className="font-bold text-slate-600 dark:text-slate-400">Export File Formats</label>
                <div className="flex gap-4 items-center">
                  {["pdf", "excel", "csv"].map(fmt => (
                    <label key={fmt} className="flex items-center gap-2 cursor-pointer font-medium uppercase">
                      <input 
                        type="checkbox"
                        checked={formats.includes(fmt)}
                        onChange={(e) => {
                          if (e.target.checked) {
                            setFormats(prev => [...prev, fmt]);
                          } else {
                            setFormats(prev => prev.filter(f => f !== fmt));
                          }
                        }}
                        className="rounded border-slate-300 dark:border-slate-800 text-blue-600 focus:ring-blue-500 h-4 w-4"
                      />
                      <span>{fmt}</span>
                    </label>
                  ))}
                </div>
              </div>

              {/* Delivery method dropdown */}
              <div className="flex flex-col gap-1.5">
                <label className="font-bold text-slate-600 dark:text-slate-400">Delivery Channel</label>
                <select 
                  value={delivery}
                  onChange={(e) => setDelivery(e.target.value)}
                  className="bg-slate-50 dark:bg-slate-850 border border-slate-250 dark:border-slate-800 rounded-xl px-3 py-2 text-slate-800 dark:text-white outline-none focus:border-blue-500"
                >
                  <option value="download">Direct Download Only</option>
                  <option value="email">SMTP Email Attachment Only</option>
                  <option value="both">Both Download & Email</option>
                </select>
              </div>

              {/* Emails Input if Email or Both is selected */}
              {(delivery === "email" || delivery === "both") && (
                <div className="flex flex-col gap-1.5">
                  <label className="font-bold text-slate-600 dark:text-slate-400 flex items-center gap-1.5">
                    <Mail className="h-3.5 w-3.5" />
                    Recipient Email Addresses (comma-separated)
                  </label>
                  <input 
                    type="text"
                    placeholder="e.g. admin@supportflow.com, audit@supportflow.com"
                    value={emailsStr}
                    onChange={(e) => setEmailsStr(e.target.value)}
                    className="bg-slate-50 dark:bg-slate-850 border border-slate-250 dark:border-slate-800 rounded-xl px-3 py-2 text-slate-800 dark:text-white outline-none focus:border-blue-500 placeholder-slate-400"
                  />
                </div>
              )}

              {/* Date range dropdown */}
              <div className="grid grid-cols-2 gap-4">
                <div className="flex flex-col gap-1.5">
                  <label className="font-bold text-slate-600 dark:text-slate-400 flex items-center gap-1.5">
                    <Calendar className="h-3.5 w-3.5" />
                    Date Range
                  </label>
                  <select 
                    value={dateRange}
                    onChange={(e) => setDateRange(e.target.value)}
                    className="bg-slate-50 dark:bg-slate-850 border border-slate-250 dark:border-slate-800 rounded-xl px-3 py-2 text-slate-800 dark:text-white outline-none focus:border-blue-500"
                  >
                    <option value="today">Today</option>
                    <option value="7days">Last 7 Days</option>
                    <option value="30days">Last 30 Days</option>
                    <option value="custom">Custom Range</option>
                  </select>
                </div>
              </div>

              {/* Custom Date Inputs if Range is Custom */}
              {dateRange === "custom" && (
                <div className="grid grid-cols-2 gap-4">
                  <div className="flex flex-col gap-1.5">
                    <label className="font-semibold text-slate-500">Start Date</label>
                    <input 
                      type="date"
                      value={startDate}
                      onChange={(e) => setStartDate(e.target.value)}
                      className="bg-slate-50 dark:bg-slate-850 border border-slate-250 dark:border-slate-800 rounded-xl px-3 py-2 text-slate-800 dark:text-white outline-none focus:border-blue-500"
                    />
                  </div>
                  <div className="flex flex-col gap-1.5">
                    <label className="font-semibold text-slate-500">End Date</label>
                    <input 
                      type="date"
                      value={endDate}
                      onChange={(e) => setEndDate(e.target.value)}
                      className="bg-slate-50 dark:bg-slate-850 border border-slate-250 dark:border-slate-800 rounded-xl px-3 py-2 text-slate-800 dark:text-white outline-none focus:border-blue-500"
                    />
                  </div>
                </div>
              )}

              {/* Advanced Parameters toggles */}
              <div className="border-t border-slate-100 dark:border-slate-800 pt-3 mt-1 grid grid-cols-2 gap-4">
                <div className="flex items-center justify-between">
                  <span className="font-semibold text-slate-600 dark:text-slate-400">Include Analytics Charts</span>
                  <input 
                    type="checkbox"
                    checked={includeCharts}
                    onChange={(e) => setIncludeCharts(e.target.checked)}
                    className="h-4 w-4 text-blue-600 focus:ring-blue-550 border-slate-300 dark:border-slate-800 rounded"
                  />
                </div>
                <div className="flex items-center justify-between">
                  <span className="font-semibold text-slate-600 dark:text-slate-400">Include Raw Table Data</span>
                  <input 
                    type="checkbox"
                    checked={includeRawData}
                    onChange={(e) => setIncludeRawData(e.target.checked)}
                    className="h-4 w-4 text-blue-600 focus:ring-blue-550 border-slate-300 dark:border-slate-800 rounded"
                  />
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex justify-end gap-2 border-t border-slate-200 dark:border-slate-800 pt-4 mt-2">
                <button 
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2 border border-slate-250 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-850 text-slate-700 dark:text-slate-300 rounded-xl font-semibold transition-colors"
                >
                  Cancel
                </button>
                <button 
                  type="submit"
                  disabled={!hasData || formats.length === 0}
                  className="px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed text-white rounded-xl font-semibold shadow-md transition-all"
                >
                  Generate Report
                </button>
              </div>

            </form>

          </div>
        </div>
      )}

    </div>
  );
}
