import { useState, useEffect, useRef } from "react";
import { useWebSocket } from "../hooks/useWebSocket";
import {
  Laptop,
  Network,
  Search,
  Plus,
  Trash2,
  Edit,
  Download,
  X,
  Server,
  Cpu,
  Activity,
  HardDrive,
  User,
  ShieldCheck,
  RefreshCw,
  FolderOpen,
  MapPin,
  Calendar,
  Terminal,
  Grid,
  ChevronLeft,
  ChevronRight,
  Filter,
  Check
} from "lucide-react";
import api from "../services/api";

const API_URL = import.meta.env.VITE_API_URL || "http://127.0.0.1:8000/api/v1";

export default function AssetManagement() {
  const [assets, setAssets] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState("");
  
  // Real-time socket metrics
  const { devicesMetrics } = useWebSocket();

  // Onboarding states
  const [isAddingAsset, setIsAddingAsset] = useState(false);

  // Pagination states
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

  // Column Chooser State
  const [visibleColumns, setVisibleColumns] = useState<Record<string, boolean>>({
    asset_tag: true,
    hostname: true,
    operating_system: true,
    serial_number: true,
    cpu: true,
    ram: true,
    ip_address: true,
    current_user: true,
    status: true,
    health_score: true,
    location: true
  });
  const [showColumnChooser, setShowColumnChooser] = useState(false);

  // Column Width Resizing State
  const [columnWidths, setColumnWidths] = useState<Record<string, number>>({
    asset_tag: 120,
    hostname: 140,
    operating_system: 110,
    serial_number: 140,
    cpu: 160,
    ram: 90,
    ip_address: 120,
    current_user: 110,
    status: 90,
    health_score: 90,
    location: 110
  });

  // Advanced Filters State
  const [showFilters, setShowFilters] = useState(false);
  const [filterOS, setFilterOS] = useState("");
  const [filterType, setFilterType] = useState("");
  const [filterStatus, setFilterStatus] = useState("");
  const [filterHealth, setFilterHealth] = useState("");

  // Drawer Inspect State
  const [selectedAsset, setSelectedAsset] = useState<any>(null);
  const [activeTab, setActiveTab] = useState("overview");

  // Inspect detail lists loaded from telemetry database
  const [latestTelemetry, setLatestTelemetry] = useState<any>(null);
  const [telemetryHistory, setTelemetryHistory] = useState<any[]>([]);
  const [telemetryLoading, setTelemetryLoading] = useState(false);

  // ping result modal state
  const [pingOutput, setPingOutput] = useState<any>(null);
  const [pinging, setPinging] = useState(false);

  // manual asset creator form inputs
  const [formName, setFormName] = useState("");
  const [formHostname, setFormHostname] = useState("");
  const [formType, setFormType] = useState("Laptop");
  const [formSerial, setFormSerial] = useState("");
  const [formManufacturer, setFormManufacturer] = useState("");
  const [formModel, setFormModel] = useState("");
  const [formIP, setFormIP] = useState("");
  const [formMAC, setFormMAC] = useState("");
  const [formDepartment, setFormDepartment] = useState("IT Support");
  const [formLocation, setFormLocation] = useState("HQ Floor 1");
  const [formWarranty, setFormWarranty] = useState("Active - 3 Years");

  // Edit Assignment Form
  const [editDept, setEditDept] = useState("");
  const [editLoc, setEditLoc] = useState("");
  const [editWarranty, setEditWarranty] = useState("");

  const currentUserRole = localStorage.getItem("role") || "Viewer";
  const token = localStorage.getItem("token");

  const loadAssets = async () => {
    setLoading(true);
    try {
      const data: any = await api.get("/assets");
      setAssets(data);
    } catch (err) {
      printError("Failed to load assets registry", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadAssets();
  }, []);

  // Fetch telemetry details when drawer opens
  useEffect(() => {
    if (selectedAsset) {
      setTelemetryLoading(true);
      setLatestTelemetry(null);
      
      // Load current assignments to inputs
      setEditDept(selectedAsset.department || "");
      setEditLoc(selectedAsset.location || "");
      setEditWarranty(selectedAsset.warranty || "");

      // Load software, processes, Docker etc.
      api.getDeviceLatestTelemetry(selectedAsset.id)
        .then((data) => setLatestTelemetry(data))
        .catch(() => setLatestTelemetry({ processes: [], services: [], software: [], network_interfaces: [], docker_containers: [] }))
        .finally(() => setTelemetryLoading(false));

      api.getDeviceTelemetryHistory(selectedAsset.id)
        .then((history) => setTelemetryHistory(history))
        .catch(() => setTelemetryHistory([]));
    }
  }, [selectedAsset]);

  const printError = (msg: string, err: any) => {
    console.error(msg, err);
  };

  // Actions
  const handleAssignSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedAsset) return;
    try {
      const updated = await api.put(`/assets/${selectedAsset.id}`, {
        department: editDept,
        location: editLoc,
        warranty: editWarranty
      });
      setSelectedAsset(updated);
      loadAssets();
      alert("Assignments updated successfully.");
    } catch (err: any) {
      alert(`Save Assignment Error: ${err.message}`);
    }
  };

  const handleCreateAsset = async (e: React.FormEvent) => {
    e.preventDefault();
    const payload = {
      asset_name: formName || formHostname,
      hostname: formHostname,
      operating_system: "Manual Node",
      type: formType,
      serial_number: formSerial,
      manufacturer: formManufacturer,
      model: formModel,
      ip_address: formIP,
      mac_address: formMAC,
      department: formDepartment,
      location: formLocation,
      warranty: formWarranty
    };

    try {
      await api.post("/assets", payload);
      setIsAddingAsset(false);
      loadAssets();
    } catch (err: any) {
      alert(`Asset Registry Error: ${err.message}`);
    }
  };

  const handleDeleteAsset = async (id: number) => {
    if (!confirm("Are you sure you want to decommission and remove this asset?")) return;
    try {
      await api.delete(`/assets/${id}`);
      setSelectedAsset(null);
      loadAssets();
    } catch (err: any) {
      alert(`Asset Decommission Error: ${err.message}`);
    }
  };

  const handlePing = async (host: string) => {
    if (!host) return;
    setPinging(true);
    setPingOutput(null);
    try {
      const data = await api.get(`/network/ping?host=${host}&count=4`);
      setPingOutput(data);
    } catch (err: any) {
      setPingOutput({ output: `Ping failed: ${err.message}` });
    } finally {
      setPinging(false);
    }
  };

  // Diagnostics Scan
  const handleRunDiagnostics = async () => {
    alert("Triggering diagnostics suite on active node...");
    try {
      await api.post("/diagnostics/run");
      alert("Diagnostics sweep dispatched successfully.");
    } catch (err: any) {
      alert(`Diagnostics trigger failed: ${err.message}`);
    }
  };

  // RMM actions simulation
  const handleRMMCommand = (cmd: string) => {
    alert(`RMM Command '${cmd}' dispatched to remote agent queue. Awaiting execution acknowledgment.`);
  };

  // Column Resizing logic
  const dragStartInfo = useRef<{ col: string; startWidth: number; startX: number } | null>(null);
  
  const handleResizeStart = (e: React.MouseEvent, col: string) => {
    e.preventDefault();
    dragStartInfo.current = {
      col,
      startWidth: columnWidths[col],
      startX: e.clientX
    };
    document.addEventListener("mousemove", handleResizeMove);
    document.addEventListener("mouseup", handleResizeEnd);
  };

  const handleResizeMove = (e: MouseEvent) => {
    if (!dragStartInfo.current) return;
    const deltaX = e.clientX - dragStartInfo.current.startX;
    const newWidth = Math.max(50, dragStartInfo.current.startWidth + deltaX);
    setColumnWidths((prev) => ({
      ...prev,
      [dragStartInfo.current!.col]: newWidth
    }));
  };

  const handleResizeEnd = () => {
    dragStartInfo.current = null;
    document.removeEventListener("mousemove", handleResizeMove);
    document.removeEventListener("mouseup", handleResizeEnd);
  };

  // Filters application
  const filteredAssets = assets.filter((a) => {
    // live binding status override from websockets
    const live = devicesMetrics[a.id];
    const actualStatus = live ? "Online" : a.status;
    const actualHealth = live ? live.health_score : a.health_score;

    const matchesSearch =
      (a.hostname || "").toLowerCase().includes(search.toLowerCase()) ||
      (a.serial_number || "").toLowerCase().includes(search.toLowerCase()) ||
      (a.asset_tag || "").toLowerCase().includes(search.toLowerCase()) ||
      (a.mac_address || "").toLowerCase().includes(search.toLowerCase()) ||
      (a.ip_address || "").toLowerCase().includes(search.toLowerCase()) ||
      (a.current_user || "").toLowerCase().includes(search.toLowerCase()) ||
      (a.department || "").toLowerCase().includes(search.toLowerCase());

    const matchesOS = filterOS ? (a.operating_system || "").toLowerCase().includes(filterOS.toLowerCase()) : true;
    const matchesType = filterType ? (a.type || "").toLowerCase() === filterType.toLowerCase() : true;
    const matchesStatus = filterStatus ? actualStatus.toLowerCase() === filterStatus.toLowerCase() : true;
    
    let matchesHealth = true;
    if (filterHealth === "healthy") matchesHealth = actualHealth >= 85;
    else if (filterHealth === "warning") matchesHealth = actualHealth >= 65 && actualHealth < 85;
    else if (filterHealth === "critical") matchesHealth = actualHealth < 65;

    return matchesSearch && matchesOS && matchesType && matchesStatus && matchesHealth;
  });

  // Pagination logic
  const totalItems = filteredAssets.length;
  const totalPages = Math.ceil(totalItems / pageSize) || 1;
  const startIndex = (currentPage - 1) * pageSize;
  const paginatedAssets = filteredAssets.slice(startIndex, startIndex + pageSize);

  const getHealthColor = (score: number) => {
    if (score >= 85) return "text-success bg-success/10 border-success/20";
    if (score >= 65) return "text-warning bg-warning/10 border-warning/20";
    return "text-danger bg-danger/10 border-danger/20";
  };

  return (
    <div className="flex flex-col gap-6">
      {/* Top Banner Control */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold tracking-tight text-slate-800 dark:text-white">
            Enterprise Asset Management
          </h1>
          <p className="text-xs text-slate-500 mt-0.5">
            Discover endpoints, monitor hardware inventories, and issue diagnostic controls
          </p>
        </div>

        <div className="flex gap-2">
          {currentUserRole !== "Viewer" && (
            <button
              onClick={() => setIsAddingAsset(true)}
              className="flex items-center gap-1.5 px-4 py-2 bg-primary hover:bg-primary-dark text-white rounded-xl text-xs font-semibold shadow-md transition-all active:scale-[0.98]"
            >
              <Plus className="h-4 w-4" />
              Register Asset Manually
            </button>
          )}

          {assets.length > 0 && (
            <>
              <a
                href={`${API_URL}/reports/assets/excel?token=${token}`}
                className="flex items-center gap-1.5 px-3.5 py-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 hover:bg-slate-50 rounded-xl text-xs font-semibold text-slate-700 dark:text-slate-200 transition-colors shadow-sm"
              >
                <Download className="h-4 w-4 text-slate-400" />
                Export Excel
              </a>
              <a
                href={`${API_URL}/reports/assets/pdf?token=${token}`}
                target="_blank"
                rel="noreferrer"
                className="flex items-center gap-1.5 px-3.5 py-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 hover:bg-slate-50 rounded-xl text-xs font-semibold text-slate-700 dark:text-slate-200 transition-colors shadow-sm"
              >
                <Download className="h-4 w-4 text-slate-400" />
                PDF Registry
              </a>
            </>
          )}
        </div>
      </div>

      {/* Onboarding Wizard - Shown when there are no assets registered */}
      {assets.length === 0 && !loading && (
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-card p-6 shadow-soft flex flex-col items-center justify-center text-center max-w-2xl mx-auto my-10">
          <Laptop className="h-16 w-16 text-primary mb-4 animate-pulse" />
          <h2 className="text-lg font-bold text-slate-800 dark:text-white">
            No endpoints have reported telemetry yet
          </h2>
          <p className="text-xs text-slate-500 max-w-md mt-1.5">
            Auto-discover your servers and computer assets inside the organization by installing our lightweight background telemetry agent.
          </p>

          {/* Setup Guide */}
          <div className="w-full text-left bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl p-4 mt-6 text-xs flex flex-col gap-3">
            <div className="font-bold text-slate-700 dark:text-slate-200">Onboarding Quick Setup:</div>
            
            <div className="flex gap-3">
              <span className="h-5 w-5 bg-primary text-white font-bold rounded-full flex items-center justify-center text-[10px] shrink-0">1</span>
              <div>
                <span className="font-bold">Download monitoring utility:</span>
                <p className="text-[10px] text-slate-400 mt-0.5">Copy <code className="bg-white dark:bg-slate-900 px-1 border rounded">agent.py</code> located in the root workspace onto the target computer.</p>
              </div>
            </div>

            <div className="flex gap-3">
              <span className="h-5 w-5 bg-primary text-white font-bold rounded-full flex items-center justify-center text-[10px] shrink-0">2</span>
              <div>
                <span className="font-bold">Install requirements:</span>
                <pre className="bg-white dark:bg-slate-900 p-2 border rounded text-[10px] font-mono mt-1 text-slate-600 dark:text-slate-350">
                  pip install psutil
                </pre>
              </div>
            </div>

            <div className="flex gap-3">
              <span className="h-5 w-5 bg-primary text-white font-bold rounded-full flex items-center justify-center text-[10px] shrink-0">3</span>
              <div>
                <span className="font-bold">Launch background monitor:</span>
                <pre className="bg-white dark:bg-slate-900 p-2 border rounded text-[10px] font-mono mt-1 text-slate-600 dark:text-slate-350">
                  python agent.py
                </pre>
                <p className="text-[10px] text-slate-400 mt-1">Once launched, the workstation registers automatically with complete motherboard, CPU, and serial details.</p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Main Assets Workspace */}
      {assets.length > 0 && (
        <div className="flex flex-col gap-4">
          {/* Controls Bar */}
          <div className="flex flex-col sm:flex-row items-center justify-between gap-3 text-xs">
            <div className="relative w-full sm:w-80">
              <span className="absolute inset-y-0 left-3 flex items-center text-slate-400">
                <Search className="h-4 w-4" />
              </span>
              <input
                type="text"
                value={search}
                onChange={(e) => { setSearch(e.target.value); setCurrentPage(1); }}
                placeholder="Search by Hostname, Serial, Tag, IP, MAC..."
                className="w-full bg-white dark:bg-slate-900 pl-10 pr-4 py-2 rounded-xl border border-slate-200 dark:border-slate-800 text-xs focus:outline-none focus:ring-1 focus:ring-primary focus:border-primary text-slate-800 dark:text-white"
              />
            </div>

            {/* Config controls */}
            <div className="flex items-center gap-2 self-end sm:self-auto">
              {/* Filter Panel Trigger */}
              <button
                onClick={() => setShowFilters(!showFilters)}
                className={`flex items-center gap-1.5 px-3 py-2 border rounded-xl font-semibold shadow-sm transition-colors ${
                  showFilters ? "bg-primary/10 border-primary/20 text-primary" : "bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-200"
                }`}
              >
                <Filter className="h-3.5 w-3.5" />
                Filters
              </button>

              {/* Column Chooser Trigger */}
              <div className="relative">
                <button
                  onClick={() => setShowColumnChooser(!showColumnChooser)}
                  className="flex items-center gap-1.5 px-3 py-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-200 rounded-xl font-semibold shadow-sm"
                >
                  <Grid className="h-3.5 w-3.5" />
                  Columns
                </button>
                {showColumnChooser && (
                  <div className="absolute right-0 mt-2 w-48 bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl p-3 shadow-lg z-30 flex flex-col gap-2">
                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Choose Columns</span>
                    {Object.keys(visibleColumns).map((col) => (
                      <label key={col} className="flex items-center gap-2 cursor-pointer text-slate-700 dark:text-slate-300">
                        <input
                          type="checkbox"
                          checked={visibleColumns[col]}
                          onChange={() => setVisibleColumns(prev => ({ ...prev, [col]: !prev[col] }))}
                          className="rounded text-primary focus:ring-primary"
                        />
                        <span className="capitalize">{col.replace("_", " ")}</span>
                      </label>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Advanced Filters Panel */}
          {showFilters && (
            <div className="bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl p-4 grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4 text-xs">
              <div className="flex flex-col gap-1.5">
                <span className="font-semibold text-slate-400">Operating System</span>
                <select
                  value={filterOS}
                  onChange={(e) => { setFilterOS(e.target.value); setCurrentPage(1); }}
                  className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg p-2 focus:outline-none"
                >
                  <option value="">All OS</option>
                  <option value="windows">Windows</option>
                  <option value="linux">Linux</option>
                  <option value="darwin">macOS</option>
                  <option value="manual">Manual Registry</option>
                </select>
              </div>

              <div className="flex flex-col gap-1.5">
                <span className="font-semibold text-slate-400">Device Type</span>
                <select
                  value={filterType}
                  onChange={(e) => { setFilterType(e.target.value); setCurrentPage(1); }}
                  className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg p-2 focus:outline-none"
                >
                  <option value="">All Types</option>
                  <option value="laptop">Laptop</option>
                  <option value="desktop">Desktop</option>
                  <option value="server">Server</option>
                  <option value="virtual machine">Virtual Machine</option>
                  <option value="router">Router</option>
                  <option value="firewall">Firewall</option>
                  <option value="printer">Printer</option>
                </select>
              </div>

              <div className="flex flex-col gap-1.5">
                <span className="font-semibold text-slate-400">Connection status</span>
                <select
                  value={filterStatus}
                  onChange={(e) => { setFilterStatus(e.target.value); setCurrentPage(1); }}
                  className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg p-2 focus:outline-none"
                >
                  <option value="">All Statuses</option>
                  <option value="online">Online</option>
                  <option value="offline">Offline</option>
                </select>
              </div>

              <div className="flex flex-col gap-1.5">
                <span className="font-semibold text-slate-400">Node Health Index</span>
                <select
                  value={filterHealth}
                  onChange={(e) => { setFilterHealth(e.target.value); setCurrentPage(1); }}
                  className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg p-2 focus:outline-none"
                >
                  <option value="">All health</option>
                  <option value="healthy">Healthy (85+)</option>
                  <option value="warning">Warning (65-84)</option>
                  <option value="critical">Critical (&lt;65)</option>
                </select>
              </div>
            </div>
          )}

          {/* Sticky Resizable Table */}
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-card shadow-soft overflow-hidden">
            <div className="overflow-x-auto min-w-full relative">
              <table className="min-w-full divide-y divide-slate-100 dark:divide-slate-800 text-left text-xs table-fixed">
                <thead>
                  <tr className="bg-slate-50 dark:bg-slate-950 text-slate-400 font-bold sticky top-0 z-10">
                    {visibleColumns.asset_tag && (
                      <th style={{ width: columnWidths.asset_tag }} className="py-3 px-4 relative truncate">
                        Asset Tag
                        <span onMouseDown={(e) => handleResizeStart(e, "asset_tag")} className="absolute right-0 top-0 bottom-0 w-1.5 cursor-col-resize hover:bg-primary/40" />
                      </th>
                    )}
                    {visibleColumns.hostname && (
                      <th style={{ width: columnWidths.hostname }} className="py-3 px-4 relative truncate">
                        Hostname
                        <span onMouseDown={(e) => handleResizeStart(e, "hostname")} className="absolute right-0 top-0 bottom-0 w-1.5 cursor-col-resize hover:bg-primary/40" />
                      </th>
                    )}
                    {visibleColumns.operating_system && (
                      <th style={{ width: columnWidths.operating_system }} className="py-3 px-4 relative truncate">
                        OS Type
                        <span onMouseDown={(e) => handleResizeStart(e, "operating_system")} className="absolute right-0 top-0 bottom-0 w-1.5 cursor-col-resize hover:bg-primary/40" />
                      </th>
                    )}
                    {visibleColumns.serial_number && (
                      <th style={{ width: columnWidths.serial_number }} className="py-3 px-4 relative truncate">
                        Serial Number
                        <span onMouseDown={(e) => handleResizeStart(e, "serial_number")} className="absolute right-0 top-0 bottom-0 w-1.5 cursor-col-resize hover:bg-primary/40" />
                      </th>
                    )}
                    {visibleColumns.cpu && (
                      <th style={{ width: columnWidths.cpu }} className="py-3 px-4 relative truncate">
                        CPU Info
                        <span onMouseDown={(e) => handleResizeStart(e, "cpu")} className="absolute right-0 top-0 bottom-0 w-1.5 cursor-col-resize hover:bg-primary/40" />
                      </th>
                    )}
                    {visibleColumns.ram && (
                      <th style={{ width: columnWidths.ram }} className="py-3 px-4 relative truncate">
                        RAM Size
                        <span onMouseDown={(e) => handleResizeStart(e, "ram")} className="absolute right-0 top-0 bottom-0 w-1.5 cursor-col-resize hover:bg-primary/40" />
                      </th>
                    )}
                    {visibleColumns.ip_address && (
                      <th style={{ width: columnWidths.ip_address }} className="py-3 px-4 relative truncate">
                        IP Address
                        <span onMouseDown={(e) => handleResizeStart(e, "ip_address")} className="absolute right-0 top-0 bottom-0 w-1.5 cursor-col-resize hover:bg-primary/40" />
                      </th>
                    )}
                    {visibleColumns.current_user && (
                      <th style={{ width: columnWidths.current_user }} className="py-3 px-4 relative truncate">
                        Active User
                        <span onMouseDown={(e) => handleResizeStart(e, "current_user")} className="absolute right-0 top-0 bottom-0 w-1.5 cursor-col-resize hover:bg-primary/40" />
                      </th>
                    )}
                    {visibleColumns.status && (
                      <th style={{ width: columnWidths.status }} className="py-3 px-4 relative truncate">
                        Status
                        <span onMouseDown={(e) => handleResizeStart(e, "status")} className="absolute right-0 top-0 bottom-0 w-1.5 cursor-col-resize hover:bg-primary/40" />
                      </th>
                    )}
                    {visibleColumns.health_score && (
                      <th style={{ width: columnWidths.health_score }} className="py-3 px-4 relative truncate">
                        Health Score
                        <span onMouseDown={(e) => handleResizeStart(e, "health_score")} className="absolute right-0 top-0 bottom-0 w-1.5 cursor-col-resize hover:bg-primary/40" />
                      </th>
                    )}
                    {visibleColumns.location && (
                      <th style={{ width: columnWidths.location }} className="py-3 px-4 relative truncate">
                        Location
                        <span onMouseDown={(e) => handleResizeStart(e, "location")} className="absolute right-0 top-0 bottom-0 w-1.5 cursor-col-resize hover:bg-primary/40" />
                      </th>
                    )}
                    <th className="py-3 px-4 text-right w-20">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                  {paginatedAssets.map((a) => {
                    const live = devicesMetrics[a.id];
                    const displayStatus = live ? "Online" : a.status;
                    const displayHealth = live ? live.health_score : a.health_score;

                    return (
                      <tr
                        key={a.id}
                        className={`hover:bg-slate-50/50 dark:hover:bg-slate-950 transition-colors cursor-pointer ${
                          selectedAsset?.id === a.id ? "bg-primary/5" : ""
                        }`}
                        onClick={() => { setSelectedAsset(a); setActiveTab("overview"); }}
                      >
                        {visibleColumns.asset_tag && (
                          <td className="py-3 px-4 font-bold text-slate-700 dark:text-slate-200 truncate">{a.asset_tag}</td>
                        )}
                        {visibleColumns.hostname && (
                          <td className="py-3 px-4 font-semibold text-slate-800 dark:text-slate-100 truncate">{a.hostname || "Manual Node"}</td>
                        )}
                        {visibleColumns.operating_system && (
                          <td className="py-3 px-4 text-slate-500 truncate">{a.operating_system}</td>
                        )}
                        {visibleColumns.serial_number && (
                          <td className="py-3 px-4 text-slate-500 font-mono truncate">{a.serial_number || "N/A"}</td>
                        )}
                        {visibleColumns.cpu && (
                          <td className="py-3 px-4 text-slate-500 truncate" title={a.cpu}>{a.cpu || "N/A"}</td>
                        )}
                        {visibleColumns.ram && (
                          <td className="py-3 px-4 text-slate-500 truncate">{a.ram || "N/A"}</td>
                        )}
                        {visibleColumns.ip_address && (
                          <td className="py-3 px-4 text-slate-500 font-mono truncate">{a.ip_address || "N/A"}</td>
                        )}
                        {visibleColumns.current_user && (
                          <td className="py-3 px-4 text-slate-500 truncate">{a.current_user || "N/A"}</td>
                        )}
                        {visibleColumns.status && (
                          <td className="py-3 px-4">
                            <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold ${
                              displayStatus === "Online" ? "bg-success/10 text-success" : "bg-slate-100 dark:bg-slate-800 text-slate-400"
                            }`}>
                              <span className={`h-1.5 w-1.5 rounded-full ${displayStatus === "Online" ? "bg-success animate-pulse" : "bg-slate-400"}`} />
                              {displayStatus}
                            </span>
                          </td>
                        )}
                        {visibleColumns.health_score && (
                          <td className="py-3 px-4">
                            <span className={`px-1.5 py-0.5 rounded text-[9px] font-bold ${getHealthColor(displayHealth)}`}>
                              {displayHealth}/100
                            </span>
                          </td>
                        )}
                        {visibleColumns.location && (
                          <td className="py-3 px-4 text-slate-500 truncate">{a.location || "N/A"}</td>
                        )}
                        <td className="py-3 px-4 text-right" onClick={(e) => e.stopPropagation()}>
                          <button
                            onClick={() => handleDeleteAsset(a.id)}
                            className="p-1 rounded text-slate-400 hover:text-danger hover:bg-danger/5 transition-colors"
                            title="Decommission Node"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* Pagination Controls */}
            <div className="bg-slate-50 dark:bg-slate-950 border-t border-slate-100 dark:border-slate-800 p-3.5 flex items-center justify-between text-xs shrink-0">
              <span className="text-slate-400 font-semibold">
                Showing {startIndex + 1} - {Math.min(startIndex + pageSize, totalItems)} of {totalItems} assets
              </span>
              
              <div className="flex items-center gap-4">
                <div className="flex items-center gap-1.5">
                  <span className="text-slate-400">Rows per page:</span>
                  <select
                    value={pageSize}
                    onChange={(e) => { setPageSize(Number(e.target.value)); setCurrentPage(1); }}
                    className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded px-2 py-0.5 focus:outline-none"
                  >
                    <option value={10}>10</option>
                    <option value={25}>25</option>
                    <option value={50}>50</option>
                  </select>
                </div>

                <div className="flex items-center gap-1.5">
                  <button
                    disabled={currentPage === 1}
                    onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                    className="p-1 border rounded bg-white dark:bg-slate-900 disabled:opacity-50"
                  >
                    <ChevronLeft className="h-4 w-4" />
                  </button>
                  <span className="font-bold text-slate-700 dark:text-slate-300">
                    {currentPage} / {totalPages}
                  </span>
                  <button
                    disabled={currentPage === totalPages}
                    onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
                    className="p-1 border rounded bg-white dark:bg-slate-900 disabled:opacity-50"
                  >
                    <ChevronRight className="h-4 w-4" />
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Manual Asset Creation Modal */}
      {isAddingAsset && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-card p-6 w-full max-w-lg shadow-xl relative animate-in fade-in zoom-in-95 duration-200 text-xs">
            <button
              onClick={() => setIsAddingAsset(false)}
              className="absolute right-4 top-4 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
            >
              <X className="h-4 w-4" />
            </button>

            <h3 className="text-sm font-bold text-slate-800 dark:text-white mb-4">Register Administrative IT Asset</h3>
            <form onSubmit={handleCreateAsset} className="flex flex-col gap-3.5">
              <div className="grid grid-cols-2 gap-3">
                <div className="flex flex-col gap-1">
                  <label className="font-semibold text-slate-400">Asset Name</label>
                  <input
                    type="text"
                    required
                    value={formName}
                    onChange={(e) => setFormName(e.target.value)}
                    placeholder="e.g. Finance Printer"
                    className="bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg p-2 focus:outline-none"
                  />
                </div>
                <div className="flex flex-col gap-1">
                  <label className="font-semibold text-slate-400">Hostname</label>
                  <input
                    type="text"
                    required
                    value={formHostname}
                    onChange={(e) => setFormHostname(e.target.value)}
                    placeholder="e.g. printer-fn-01"
                    className="bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg p-2 focus:outline-none"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="flex flex-col gap-1">
                  <label className="font-semibold text-slate-400">Device Type</label>
                  <select
                    value={formType}
                    onChange={(e) => setFormType(e.target.value)}
                    className="bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg p-2 focus:outline-none"
                  >
                    <option value="Laptop">Laptop</option>
                    <option value="Desktop">Desktop</option>
                    <option value="Server">Server</option>
                    <option value="Virtual Machine">Virtual Machine</option>
                    <option value="Router">Router</option>
                    <option value="Firewall">Firewall</option>
                    <option value="Printer">Printer</option>
                  </select>
                </div>
                <div className="flex flex-col gap-1">
                  <label className="font-semibold text-slate-400">Serial Number</label>
                  <input
                    type="text"
                    required
                    value={formSerial}
                    onChange={(e) => setFormSerial(e.target.value)}
                    placeholder="e.g. SN-PRNT-9981"
                    className="bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg p-2 focus:outline-none"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="flex flex-col gap-1">
                  <label className="font-semibold text-slate-400">IP Address</label>
                  <input
                    type="text"
                    value={formIP}
                    onChange={(e) => setFormIP(e.target.value)}
                    placeholder="e.g. 192.168.1.150"
                    className="bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg p-2 focus:outline-none"
                  />
                </div>
                <div className="flex flex-col gap-1">
                  <label className="font-semibold text-slate-400">MAC Address</label>
                  <input
                    type="text"
                    value={formMAC}
                    onChange={(e) => setFormMAC(e.target.value)}
                    placeholder="e.g. 00:1A:2B:3C:4D:5E"
                    className="bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg p-2 focus:outline-none"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="flex flex-col gap-1">
                  <label className="font-semibold text-slate-400">Department</label>
                  <input
                    type="text"
                    value={formDepartment}
                    onChange={(e) => setFormDepartment(e.target.value)}
                    className="bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg p-2"
                  />
                </div>
                <div className="flex flex-col gap-1">
                  <label className="font-semibold text-slate-400">Location</label>
                  <input
                    type="text"
                    value={formLocation}
                    onChange={(e) => setFormLocation(e.target.value)}
                    className="bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg p-2"
                  />
                </div>
              </div>

              <div className="flex flex-col gap-1">
                <label className="font-semibold text-slate-400">Warranty Contract</label>
                <input
                  type="text"
                  value={formWarranty}
                  onChange={(e) => setFormWarranty(e.target.value)}
                  className="bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg p-2"
                />
              </div>

              <button
                type="submit"
                className="w-full mt-2 py-2 px-4 bg-primary hover:bg-primary-dark text-white rounded-lg font-bold"
              >
                Register Asset
              </button>
            </form>
          </div>
        </div>
      )}

      {/* Slide-out Inspect Drawer Panel */}
      {selectedAsset && (
        <div className="fixed inset-y-0 right-0 w-full sm:w-[600px] bg-white dark:bg-slate-950 border-l border-slate-200 dark:border-slate-800 shadow-2xl z-40 flex flex-col animate-in slide-in-from-right duration-250 text-xs">
          {/* Drawer Header */}
          <div className="p-4 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between shrink-0">
            <div>
              <h3 className="text-sm font-bold text-slate-800 dark:text-white flex items-center gap-2">
                <Server className="h-4.5 w-4.5 text-slate-400" />
                {selectedAsset.hostname || "Manual Node"}
              </h3>
              <p className="text-[10px] text-slate-400 mt-0.5">Asset Tag: {selectedAsset.asset_tag}</p>
            </div>
            <button
              onClick={() => setSelectedAsset(null)}
              className="p-1.5 hover:bg-slate-100 rounded-lg transition-colors text-slate-400 hover:text-slate-650"
            >
              <X className="h-5 w-5" />
            </button>
          </div>

          {/* Tabs header */}
          <div className="px-4 border-b border-slate-100 dark:border-slate-800 flex gap-4 shrink-0 text-slate-400 font-semibold overflow-x-auto whitespace-nowrap scrollbar-none">
            {["overview", "hardware", "network", "processes", "services", "software", "docker"].map((tab) => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={`py-2.5 border-b-2 capitalize transition-colors ${
                  activeTab === tab ? "border-primary text-primary font-bold" : "border-transparent hover:text-slate-700"
                }`}
              >
                {tab}
              </button>
            ))}
          </div>

          {/* Drawer Content */}
          <div className="flex-1 overflow-y-auto p-4 scrollbar-thin">
            {activeTab === "overview" && (
              <div className="flex flex-col gap-5">
                {/* RMM Operations Dashboard Panel */}
                <div className="bg-slate-50 dark:bg-slate-900/50 border border-slate-200 dark:border-slate-800 rounded-xl p-4 flex flex-col gap-3">
                  <span className="font-bold text-slate-400 uppercase tracking-wider text-[10px]">Remote Terminal Operations</span>
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                    <button onClick={() => handlePing(selectedAsset.ip_address)} className="flex items-center justify-center gap-1.5 p-2 bg-white dark:bg-slate-950 border dark:border-slate-800 rounded-lg font-semibold hover:border-primary transition-all">
                      <Terminal className="h-3.5 w-3.5" /> Ping Node
                    </button>
                    <button onClick={() => handleRMMCommand("Wake on LAN")} className="flex items-center justify-center gap-1.5 p-2 bg-white dark:bg-slate-950 border dark:border-slate-800 rounded-lg font-semibold hover:border-primary transition-all">
                      WoL Command
                    </button>
                    <button onClick={() => handleRMMCommand("Restart")} className="flex items-center justify-center gap-1.5 p-2 bg-white dark:bg-slate-950 border dark:border-slate-800 rounded-lg font-semibold text-warning hover:border-warning transition-all">
                      Restart
                    </button>
                    <button onClick={() => handleRMMCommand("Shutdown")} className="flex items-center justify-center gap-1.5 p-2 bg-white dark:bg-slate-950 border dark:border-slate-800 rounded-lg font-semibold text-danger hover:border-danger transition-all">
                      Shutdown
                    </button>
                    <button onClick={handleRunDiagnostics} className="flex items-center justify-center gap-1.5 p-2 bg-white dark:bg-slate-950 border dark:border-slate-800 rounded-lg font-semibold hover:border-primary transition-all col-span-2">
                      Run Diagnostic Scan
                    </button>
                  </div>
                </div>

                {/* Live Ping Dialog Overlay */}
                {pinging && (
                  <div className="bg-slate-950 text-success p-3 rounded-lg font-mono text-[10px] flex items-center gap-2">
                    <RefreshCw className="h-3 w-3 animate-spin" /> Pinging host {selectedAsset.ip_address}...
                  </div>
                )}
                {pingOutput && (
                  <div className="bg-slate-950 text-slate-300 p-3 rounded-lg font-mono text-[10px] relative">
                    <button onClick={() => setPingOutput(null)} className="absolute right-2 top-2 text-slate-500 hover:text-white">✕</button>
                    <div className="font-bold text-success border-b border-slate-800 pb-1 mb-1">PING CMD RESPONSE</div>
                    <pre className="whitespace-pre-wrap">Host: {pingOutput.host}{"\n"}IP: {pingOutput.ip_resolved}{"\n"}Avg latency: {pingOutput.avg_latency_ms} ms{"\n"}Packets: Sent={pingOutput.packets_sent}, Recv={pingOutput.packets_received}</pre>
                  </div>
                )}

                {/* Edit Administrative Settings Form */}
                <form onSubmit={handleAssignSubmit} className="flex flex-col gap-4">
                  <span className="font-bold text-slate-400 uppercase tracking-wider text-[10px] border-b pb-1">Administrative Details</span>
                  
                  <div className="flex flex-col gap-1">
                    <label className="font-semibold text-slate-400">Department</label>
                    <input
                      type="text"
                      value={editDept}
                      onChange={(e) => setEditDept(e.target.value)}
                      className="bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-850 rounded-lg p-2 focus:outline-none"
                    />
                  </div>

                  <div className="flex flex-col gap-1">
                    <label className="font-semibold text-slate-400">Office Location</label>
                    <input
                      type="text"
                      value={editLoc}
                      onChange={(e) => setEditLoc(e.target.value)}
                      className="bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-850 rounded-lg p-2 focus:outline-none"
                    />
                  </div>

                  <div className="flex flex-col gap-1">
                    <label className="font-semibold text-slate-400">Warranty Contract</label>
                    <input
                      type="text"
                      value={editWarranty}
                      onChange={(e) => setEditWarranty(e.target.value)}
                      className="bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-850 rounded-lg p-2 focus:outline-none"
                    />
                  </div>

                  <button type="submit" className="py-2 bg-primary hover:bg-primary-dark text-white rounded-lg font-bold">
                    Save Assignments
                  </button>
                </form>
              </div>
            )}

            {activeTab === "hardware" && (
              <div className="flex flex-col gap-4">
                <span className="font-bold text-slate-400 uppercase tracking-wider text-[10px] border-b pb-1">Discovered Hardware Profile</span>
                <div className="grid grid-cols-2 gap-4">
                  <div className="bg-slate-50 dark:bg-slate-900/40 p-3 rounded-lg">
                    <span className="text-slate-400">Manufacturer</span>
                    <p className="font-bold text-slate-700 dark:text-slate-200 mt-1">{selectedAsset.manufacturer || "N/A"}</p>
                  </div>
                  <div className="bg-slate-50 dark:bg-slate-900/40 p-3 rounded-lg">
                    <span className="text-slate-400">Model</span>
                    <p className="font-bold text-slate-700 dark:text-slate-200 mt-1">{selectedAsset.model || "N/A"}</p>
                  </div>
                  <div className="bg-slate-50 dark:bg-slate-900/40 p-3 rounded-lg">
                    <span className="text-slate-400">Serial Number</span>
                    <p className="font-bold text-slate-700 dark:text-slate-200 font-mono mt-1">{selectedAsset.serial_number || "N/A"}</p>
                  </div>
                  <div className="bg-slate-50 dark:bg-slate-900/40 p-3 rounded-lg">
                    <span className="text-slate-400">Motherboard Serial</span>
                    <p className="font-bold text-slate-700 dark:text-slate-200 font-mono mt-1">{selectedAsset.motherboard_serial || "N/A"}</p>
                  </div>
                  <div className="bg-slate-50 dark:bg-slate-900/40 p-3 rounded-lg">
                    <span className="text-slate-400">BIOS version</span>
                    <p className="font-bold text-slate-700 dark:text-slate-200 mt-1">{selectedAsset.bios_version || "N/A"}</p>
                  </div>
                  <div className="bg-slate-50 dark:bg-slate-900/40 p-3 rounded-lg">
                    <span className="text-slate-400">CPU Chip</span>
                    <p className="font-bold text-slate-700 dark:text-slate-200 mt-1 truncate" title={selectedAsset.cpu}>{selectedAsset.cpu || "N/A"}</p>
                  </div>
                  <div className="bg-slate-50 dark:bg-slate-900/40 p-3 rounded-lg">
                    <span className="text-slate-400">RAM Capacity</span>
                    <p className="font-bold text-slate-700 dark:text-slate-200 mt-1">{selectedAsset.ram || "N/A"}</p>
                  </div>
                  <div className="bg-slate-50 dark:bg-slate-900/40 p-3 rounded-lg">
                    <span className="text-slate-400">Primary storage</span>
                    <p className="font-bold text-slate-700 dark:text-slate-200 mt-1">{selectedAsset.storage || "N/A"}</p>
                  </div>
                </div>
              </div>
            )}

            {activeTab === "network" && (
              <div className="flex flex-col gap-4">
                <span className="font-bold text-slate-400 uppercase tracking-wider text-[10px] border-b pb-1">Network Config</span>
                <div className="grid grid-cols-2 gap-4 text-xs">
                  <div>
                    <span className="text-slate-400">Local IP Address</span>
                    <p className="font-bold font-mono text-slate-700 dark:text-slate-200 mt-0.5">{selectedAsset.ip_address || "N/A"}</p>
                  </div>
                  <div>
                    <span className="text-slate-400">MAC Address</span>
                    <p className="font-bold font-mono text-slate-700 dark:text-slate-200 mt-0.5">{selectedAsset.mac_address || "N/A"}</p>
                  </div>
                </div>

                <div className="mt-2">
                  <span className="font-bold text-slate-400">Active LAN Interfaces</span>
                  <table className="w-full text-left mt-2">
                    <thead>
                      <tr className="border-b border-slate-100 dark:border-slate-800 text-slate-400 font-semibold">
                        <th className="pb-1">Interface</th>
                        <th className="pb-1">Sent Bytes</th>
                        <th className="pb-1 text-right">Recv Bytes</th>
                      </tr>
                    </thead>
                    <tbody>
                      {(latestTelemetry?.network_interfaces || []).map((net: any, idx: number) => (
                        <tr key={idx} className="border-b border-slate-100 dark:border-slate-800/40">
                          <td className="py-2 font-mono">{net.interface}</td>
                          <td className="py-2 text-slate-500 font-mono">{(net.bytes_sent / 1024 / 1024).toFixed(1)} MB</td>
                          <td className="py-2 text-slate-500 font-mono text-right">{(net.bytes_recv / 1024 / 1024).toFixed(1)} MB</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {activeTab === "processes" && (
              <div className="flex flex-col gap-3">
                <span className="font-bold text-slate-400 uppercase tracking-wider text-[10px] border-b pb-1">Telemetry Active Processes</span>
                {telemetryLoading ? (
                  <div className="py-10 text-center">Loading processes...</div>
                ) : (
                  <table className="w-full text-left">
                    <thead>
                      <tr className="border-b text-slate-400">
                        <th>Process</th>
                        <th>PID</th>
                        <th>CPU</th>
                        <th className="text-right">RAM</th>
                      </tr>
                    </thead>
                    <tbody>
                      {(latestTelemetry?.processes || []).map((p: any, idx: number) => (
                        <tr key={idx} className="border-b border-slate-50/50 dark:border-slate-800/30">
                          <td className="py-1.5 font-semibold truncate max-w-[150px]">{p.name}</td>
                          <td className="py-1.5 text-slate-450 font-mono">{p.pid}</td>
                          <td className="py-1.5 text-slate-800 dark:text-slate-200">{p.cpu_percent}%</td>
                          <td className="py-1.5 text-right font-medium">{p.memory_percent}%</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>
            )}

            {activeTab === "services" && (
              <div className="flex flex-col gap-3">
                <span className="font-bold text-slate-400 uppercase tracking-wider text-[10px] border-b pb-1">Endpoint System Services</span>
                {telemetryLoading ? (
                  <div className="py-10 text-center">Loading services...</div>
                ) : (
                  <table className="w-full text-left">
                    <thead>
                      <tr className="border-b text-slate-400">
                        <th>Service Name</th>
                        <th className="text-right">status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {(latestTelemetry?.services || []).map((s: any, idx: number) => (
                        <tr key={idx} className="border-b border-slate-50/50 dark:border-slate-800/30">
                          <td className="py-2 max-w-[300px] truncate" title={s.display_name}>{s.display_name}</td>
                          <td className="py-2 text-right">
                            <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                              s.status === "running" ? "bg-success/10 text-success" : "bg-slate-100 dark:bg-slate-800 text-slate-400"
                            }`}>{s.status}</span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>
            )}

            {activeTab === "software" && (
              <div className="flex flex-col gap-3">
                <span className="font-bold text-slate-400 uppercase tracking-wider text-[10px] border-b pb-1">Installed Software Inventory</span>
                {telemetryLoading ? (
                  <div className="py-10 text-center">Loading software...</div>
                ) : (
                  <table className="w-full text-left">
                    <thead>
                      <tr className="border-b text-slate-400">
                        <th>Software</th>
                        <th>Version</th>
                        <th className="text-right">Publisher</th>
                      </tr>
                    </thead>
                    <tbody>
                      {(latestTelemetry?.software || []).map((sw: any, idx: number) => (
                        <tr key={idx} className="border-b border-slate-50/50 dark:border-slate-800/30">
                          <td className="py-2 font-semibold max-w-[200px] truncate" title={sw.name}>{sw.name}</td>
                          <td className="py-2 font-mono text-slate-450">{sw.version}</td>
                          <td className="py-2 text-right text-slate-450 truncate max-w-[120px]" title={sw.publisher}>{sw.publisher}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>
            )}

            {activeTab === "docker" && (
              <div className="flex flex-col gap-3">
                <span className="font-bold text-slate-400 uppercase tracking-wider text-[10px] border-b pb-1">Docker Containers</span>
                {telemetryLoading ? (
                  <div className="py-10 text-center">Loading docker logs...</div>
                ) : (latestTelemetry?.docker_containers || []).length === 0 ? (
                  <div className="py-8 text-center text-slate-400">No active docker containers found on this node.</div>
                ) : (
                  <table className="w-full text-left">
                    <thead>
                      <tr className="border-b text-slate-400">
                        <th>Container ID</th>
                        <th>Name</th>
                        <th>Image</th>
                        <th className="text-right font-semibold">Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {(latestTelemetry?.docker_containers || []).map((c: any, idx: number) => (
                        <tr key={idx} className="border-b border-slate-50/50 dark:border-slate-800/30">
                          <td className="py-2 font-mono text-slate-500">{c.id}</td>
                          <td className="py-2 font-bold text-slate-700 dark:text-slate-200">{c.name}</td>
                          <td className="py-2 text-slate-500 font-mono">{c.image}</td>
                          <td className="py-2 text-right text-success font-semibold">{c.status}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
