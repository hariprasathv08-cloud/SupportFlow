import React, { useState, useEffect, useRef } from "react";
import {
  Ticket as TicketIcon,
  Plus,
  Search,
  MessageSquare,
  Paperclip,
  Clock,
  User as UserIcon,
  CheckCircle,
  AlertCircle,
  X,
  Send,
  Loader,
  Activity,
  Cpu,
  Database,
  Monitor,
  RefreshCw,
  Server,
  Terminal,
  Network,
  ShieldAlert,
  Sliders,
  Check,
  Building
} from "lucide-react";
import api from "../services/api";
import { motion, AnimatePresence } from "framer-motion";

export default function TicketManagement() {
  const [tickets, setTickets] = useState<any[]>([]);
  const [administrators, setAdministrators] = useState<any[]>([]);
  const [selectedTicket, setSelectedTicket] = useState<any>(null);
  const [devices, setDevices] = useState<any[]>([]);
  const [myProfile, setMyProfile] = useState<any>(null);
  
  // RMM remote states for selected ticket/employee computer
  const [selectedDevice, setSelectedDevice] = useState<any>(null);
  const [deviceDiagnostics, setDeviceDiagnostics] = useState<any>({
    processes: [],
    services: [],
    software: [],
    network_interfaces: [],
    docker_containers: []
  });
  const [loadingDiagnostics, setLoadingDiagnostics] = useState(false);
  const [diagSearch, setDiagSearch] = useState("");
  const [diagTab, setDiagTab] = useState<"services" | "processes" | "software">("services");

  // Chat window state
  const [messages, setMessages] = useState<any[]>([]);
  const [chatMessage, setChatMessage] = useState("");
  const [selectedChatFile, setSelectedChatFile] = useState<File | null>(null);
  const [sendingMsg, setSendingMsg] = useState(false);
  const chatScrollRef = useRef<HTMLDivElement>(null);
  const socketRef = useRef<WebSocket | null>(null);
  const [onlineUsers, setOnlineUsers] = useState<Set<number>>(new Set());
  const [typingStatus, setTypingStatus] = useState<string | null>(null);
  const typingTimeoutRef = useRef<any>(null);

  // UI state
  const [loadingQueue, setLoadingQueue] = useState(false);
  const [loadingDetails, setLoadingDetails] = useState(false);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  
  // Creation Form states
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [newTitle, setNewTitle] = useState("");
  const [newDesc, setNewDesc] = useState("");
  const [newCategory, setNewCategory] = useState("Software");
  const [newPriority, setNewPriority] = useState("Medium");
  const [newAssignedId, setNewAssignedId] = useState<string>("");

  const currentUserRole = localStorage.getItem("role") || "Viewer";

  // WebSocket real-time subscription
  useEffect(() => {
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
    
    const token = localStorage.getItem("token");
    const wsUrlWithToken = token ? `${wsUrl}?token=${token}` : wsUrl;
    console.log(`Connecting to ITSM WS gateway: ${wsUrlWithToken}`);
    const socket = new WebSocket(wsUrlWithToken);
    socketRef.current = socket;

    socket.onmessage = (event) => {
      try {
        const packet = JSON.parse(event.data);
        if (packet.type === "new_ticket") {
          loadQueue();
        } else if (packet.type === "ticket_update") {
          loadQueue();
          if (selectedTicket && selectedTicket.id === packet.ticket_id) {
            handleSelectTicket(selectedTicket);
          }
        } else if (packet.type === "ticket_message") {
          if (selectedTicket && selectedTicket.id === packet.ticket_id) {
            setMessages((prev) => {
              if (prev.some((m) => m.id === packet.message.id)) return prev;
              return [...prev, packet.message];
            });
            api.post(`/tickets/${selectedTicket.id}/chat/read`).catch(() => {});
            setTimeout(() => {
              if (chatScrollRef.current) {
                chatScrollRef.current.scrollTop = chatScrollRef.current.scrollHeight;
              }
            }, 80);
          }
        } else if (packet.type === "typing") {
          if (selectedTicket && selectedTicket.id === packet.ticket_id) {
            if (packet.typing) {
              setTypingStatus(`${packet.user_name} is typing...`);
            } else {
              setTypingStatus(null);
            }
          }
        } else if (packet.type === "messages_read") {
          if (selectedTicket && selectedTicket.id === packet.ticket_id) {
            setMessages((prev) =>
              prev.map((m) =>
                m.sender_id !== packet.reader_id ? { ...m, is_read: true, read_at: packet.read_at } : m
              )
            );
          }
        } else if (packet.type === "online_users_list") {
          setOnlineUsers(new Set(packet.users));
        } else if (packet.type === "online_status") {
          const userId = packet.user_id;
          if (packet.status === "online") {
            setOnlineUsers((prev) => new Set([...prev, userId]));
          } else {
            setOnlineUsers((prev) => {
              const next = new Set(prev);
              next.delete(userId);
              return next;
            });
          }
        }
      } catch (err) {
        console.error("ITSM WebSocket message error:", err);
      }
    };

    return () => {
      socket.close();
      socketRef.current = null;
    };
  }, [selectedTicket]);

  const loadQueue = async () => {
    setLoadingQueue(true);
    try {
      const data: any = await api.get("/tickets");
      setTickets(data);
    } catch (err) {
      console.error("Failed to load tickets queue:", err);
    } finally {
      setLoadingQueue(false);
    }
  };

  const loadAdministrators = async () => {
    try {
      const users: any = await api.listUsers();
      setAdministrators(users.filter((u: any) => u.role === "Administrator" || u.role === "Super Administrator" || u.role === "Admin"));
    } catch (err) {
      console.error("Failed to load staff list:", err);
    }
  };

  const fetchMyProfile = async () => {
    try {
      const allUsers = await api.listUsers();
      const name = localStorage.getItem("user_name");
      const matched = allUsers.find(u => u.full_name === name);
      if (matched) {
        setMyProfile(matched);
      }
    } catch (err) {
      console.error("Failed to load my profile info:", err);
    }
  };

  const fetchDevices = async () => {
    try {
      const items = await api.getDevices();
      setDevices(items);
    } catch (err) {
      console.error("Failed to fetch devices:", err);
    }
  };

  useEffect(() => {
    loadQueue();
    loadAdministrators();
    fetchMyProfile();
    fetchDevices();
  }, []);

  // Fetch device-specific services, software lists, and active processes
  const loadDeviceDiagnostics = async (deviceId: number) => {
    setLoadingDiagnostics(true);
    try {
      const specs = await api.getDeviceLatestTelemetry(deviceId);
      setDeviceDiagnostics({
        processes: specs.processes || [],
        services: specs.services || [],
        software: specs.software || [],
        network_interfaces: specs.network_interfaces || [],
        docker_containers: specs.docker_containers || []
      });
    } catch (err) {
      console.error("Failed to retrieve system diagnostics:", err);
    } finally {
      setLoadingDiagnostics(false);
    }
  };

  const handleSelectTicket = async (ticket: any) => {
    setLoadingDetails(true);
    try {
      const detailed: any = await api.get(`/tickets/${ticket.id}`);
      setSelectedTicket(detailed);

      // Load Chat Messages
      const chatData: any = await api.get(`/tickets/${ticket.id}/messages`);
      setMessages(chatData);

      // Mark unread messages as read
      await api.post(`/tickets/${ticket.id}/chat/read`).catch(() => {});

      // Locate device associated with this ticket
      if (ticket.device_hostname) {
        const foundDev = devices.find(d => d.hostname === ticket.device_hostname);
        if (foundDev) {
          setSelectedDevice(foundDev);
          await loadDeviceDiagnostics(foundDev.id);
        } else {
          setSelectedDevice(null);
          setDeviceDiagnostics({ processes: [], services: [], software: [] });
        }
      } else {
        setSelectedDevice(null);
        setDeviceDiagnostics({ processes: [], services: [], software: [] });
      }

      setTimeout(() => {
        if (chatScrollRef.current) {
          chatScrollRef.current.scrollTop = chatScrollRef.current.scrollHeight;
        }
      }, 50);

    } catch (err) {
      console.error("Failed to load ticket details:", err);
    } finally {
      setLoadingDetails(false);
    }
  };

  const handleCreateTicket = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await api.post("/tickets", {
        title: newTitle,
        description: newDesc,
        category: newCategory,
        priority: newPriority,
        status: "Open",
        assigned_to_id: newAssignedId ? parseInt(newAssignedId) : null
      });
      setShowCreateModal(false);
      setNewTitle("");
      setNewDesc("");
      setNewCategory("Software");
      setNewPriority("Medium");
      setNewAssignedId("");
      await loadQueue();
    } catch (err) {
      alert("Failed to create ticket.");
    }
  };

  const handleUpdateStatus = async (status: string) => {
    if (!selectedTicket) return;
    try {
      const updated = await api.put(`/tickets/${selectedTicket.id}`, { status });
      setSelectedTicket(updated);
      await loadQueue();
    } catch (err) {
      alert("Status modification error.");
    }
  };

  const handleUpdateAssignment = async (techIdStr: string) => {
    if (!selectedTicket) return;
    const assigned_to_id = techIdStr ? parseInt(techIdStr) : null;
    try {
      const updated = await api.put(`/tickets/${selectedTicket.id}`, { assigned_to_id });
      setSelectedTicket(updated);
      await loadQueue();
    } catch (err) {
      alert("Administrator assignment modification error.");
    }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setChatMessage(e.target.value);
    if (!socketRef.current || socketRef.current.readyState !== WebSocket.OPEN || !selectedTicket) return;
    
    if (e.target.value.length > 0) {
      socketRef.current.send(JSON.stringify({ type: "typing", ticket_id: selectedTicket.id, typing: true }));
      
      if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
      typingTimeoutRef.current = setTimeout(() => {
        if (socketRef.current && socketRef.current.readyState === WebSocket.OPEN && selectedTicket) {
          socketRef.current.send(JSON.stringify({ type: "typing", ticket_id: selectedTicket.id, typing: false }));
        }
      }, 2000);
    } else {
      socketRef.current.send(JSON.stringify({ type: "typing", ticket_id: selectedTicket.id, typing: false }));
    }
  };



  const handleSendChat = async (e: React.FormEvent) => {
    e.preventDefault();
    if ((!chatMessage && !selectedChatFile) || !selectedTicket) return;
    setSendingMsg(true);

    if (socketRef.current && socketRef.current.readyState === WebSocket.OPEN && selectedTicket) {
      socketRef.current.send(JSON.stringify({ type: "typing", ticket_id: selectedTicket.id, typing: false }));
    }

    try {
      const formData = new FormData();
      formData.append("message", chatMessage || `Dispatched attachment file: ${selectedChatFile?.name}`);
      if (selectedChatFile) {
        formData.append("file", selectedChatFile);
      }

      await api.post(`/tickets/${selectedTicket.id}/messages`, formData);
      setChatMessage("");
      setSelectedChatFile(null);
    } catch (err) {
      console.error("Failed to post message:", err);
    } finally {
      setSendingMsg(false);
    }
  };

  const handleRestartDevice = async () => {
    if (!selectedDevice) return;
    try {
      await api.post(`/system/restart-agent?hostname=${selectedDevice.hostname}`, {});
      alert(`Power restart command successfully sent to ${selectedDevice.hostname}`);
    } catch (err) {
      alert("Failed to dispatch device restart signal.");
    }
  };

  const filteredTickets = tickets.filter((t) => {
    const matchesSearch =
      t.title.toLowerCase().includes(search.toLowerCase()) ||
      t.description.toLowerCase().includes(search.toLowerCase());
    const matchesStatus = statusFilter ? t.status === statusFilter : true;
    return matchesSearch && matchesStatus;
  });

  // Identify employee's workstation
  const employeeDevice = myProfile
    ? devices.find(d => d.assigned_user_id === myProfile.id || d.current_user === myProfile.username)
    : null;

  // Filter diagnostics elements (services, software lists, processes) based on keyword search
  const filterDiagItems = (items: any[]) => {
    if (!diagSearch) return items;
    return items.filter(item => {
      const val = (item.name || item.display_name || item.command || "").toLowerCase();
      return val.includes(diagSearch.toLowerCase());
    });
  };

  // Metrics for Dashboard Views
  const openCount = tickets.filter(t => t.status !== "Resolved" && t.status !== "Closed").length;
  const criticalCount = tickets.filter(t => (t.priority === "Critical" || t.priority === "High") && t.status !== "Resolved").length;
  const resolvedCount = tickets.filter(t => t.status === "Resolved" || t.status === "Closed").length;

  return (
    <div className="flex flex-col h-full gap-4 text-slate-200 select-none">
      
      {/* 1. PORTAL BRANDING & OPERATIONS SUB-GAUGE */}
      <div className="flex flex-col md:flex-row items-start md:items-center justify-between bg-slate-900/60 border border-slate-800/80 p-4 rounded-xl backdrop-blur-md gap-4">
        <div>
          <h1 className="text-lg font-bold text-white tracking-wide flex items-center gap-2">
            <TicketIcon className="h-5 w-5 text-primary" />
            SupportFlow ITSM Center
          </h1>
          <p className="text-xs text-slate-500 mt-0.5">
            Logged in as <span className="text-slate-300 font-semibold">{localStorage.getItem("user_name")}</span> • Portal Role: <span className="text-primary font-semibold uppercase">{currentUserRole}</span>
          </p>
        </div>

        {/* Global Operations Metric Indicators */}
        <div className="flex items-center gap-6 text-xs bg-slate-950/40 border border-slate-800/50 p-2.5 rounded-lg">
          <div className="flex items-center gap-2 border-r border-slate-800 pr-6">
            <div className="h-2 w-2 rounded-full bg-primary animate-pulse" />
            <div>
              <p className="text-slate-500 text-[10px]">Open Incidents</p>
              <p className="font-bold text-slate-200">{openCount}</p>
            </div>
          </div>
          <div className="flex items-center gap-2 border-r border-slate-800 pr-6">
            <div className="h-2 w-2 rounded-full bg-danger" />
            <div>
              <p className="text-slate-500 text-[10px]">Critical Alerts</p>
              <p className="font-bold text-danger">{criticalCount}</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <div className="h-2 w-2 rounded-full bg-success" />
            <div>
              <p className="text-slate-500 text-[10px]">Resolved Tickets</p>
              <p className="font-bold text-success">{resolvedCount}</p>
            </div>
          </div>
        </div>
      </div>

      {/* 2. DYNAMIC WORKSPACE ROUTING */}
      <div className="flex-1 grid grid-cols-1 xl:grid-cols-3 gap-5 min-h-0">
        
        {/* LEFT TWO COLUMNS: INCIDENTS QUEUE & SELF DIAGNOSTICS */}
        <div className="xl:col-span-2 flex flex-col gap-4 min-h-0">
          
          {/* Employee's Own Assigned Machine health widgets */}
          {currentUserRole === "Viewer" && employeeDevice && (
            <div className="bg-slate-900/60 border border-slate-800/80 p-4 rounded-xl backdrop-blur-md grid grid-cols-1 md:grid-cols-4 gap-4 items-center">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-lg bg-primary/20 flex items-center justify-center border border-primary/30">
                  <Monitor className="h-5 w-5 text-primary" />
                </div>
                <div>
                  <h4 className="text-xs font-bold text-white truncate max-w-[120px]">{employeeDevice.hostname}</h4>
                  <p className="text-[10px] text-slate-500 truncate">{employeeDevice.operating_system} ({employeeDevice.ip_address})</p>
                </div>
              </div>

              {/* CPU gauge info */}
              <div className="bg-slate-950/40 p-2 rounded border border-slate-800 flex justify-between items-center text-xs">
                <div>
                  <p className="text-slate-500 text-[10px]">CPU Load</p>
                  <p className="font-bold">{employeeDevice.cpu_usage}%</p>
                </div>
                <Cpu className="h-4 w-4 text-slate-500" />
              </div>

              {/* RAM gauge info */}
              <div className="bg-slate-950/40 p-2 rounded border border-slate-800 flex justify-between items-center text-xs">
                <div>
                  <p className="text-slate-500 text-[10px]">RAM Usage</p>
                  <p className="font-bold">{employeeDevice.ram_usage}%</p>
                </div>
                <Database className="h-4 w-4 text-slate-500" />
              </div>

              {/* Network internet status */}
              <div className="bg-slate-950/40 p-2 rounded border border-slate-800 flex justify-between items-center text-xs">
                <div>
                  <p className="text-slate-500 text-[10px]">Internet Node</p>
                  <p className={`font-bold ${employeeDevice.status === "Online" ? "text-success" : "text-danger"}`}>
                    {employeeDevice.status === "Online" ? "CONNECTED" : "OFFLINE"}
                  </p>
                </div>
                <Network className="h-4 w-4 text-slate-500" />
              </div>
            </div>
          )}

          {/* Incidents Queue block */}
          <div className="flex-1 bg-slate-900/60 border border-slate-800/80 p-5 rounded-xl backdrop-blur-md flex flex-col min-h-0">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3.5 mb-4 gap-4 flex-wrap">
              <div>
                <h2 className="text-sm font-bold text-white flex items-center gap-2">
                  <TicketIcon className="h-4 w-4 text-primary" />
                  {currentUserRole === "Viewer" ? "Your Incident History" : "Corporate SupportFlow Ticket Queue"}
                </h2>
                <p className="text-[10px] text-slate-500 mt-0.5">Filter, monitor, and assign employee tickets</p>
              </div>

              <div className="flex items-center gap-2 text-xs flex-wrap">
                <div className="relative w-40">
                  <span className="absolute inset-y-0 left-2.5 flex items-center text-slate-500">
                    <Search className="h-3.5 w-3.5" />
                  </span>
                  <input
                    type="text"
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    placeholder="Search incidents..."
                    className="w-full bg-slate-950/50 border border-slate-800 pl-8 pr-3 py-1.5 rounded-lg text-[10px] text-white focus:outline-none focus:ring-1 focus:ring-primary focus:border-primary placeholder-slate-600 transition-colors"
                  />
                </div>
                <select
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value)}
                  className="bg-slate-950/50 border border-slate-800 px-2 py-1.5 rounded-lg text-[10px] text-slate-300 focus:outline-none focus:border-primary"
                >
                  <option value="">All Statuses</option>
                  <option value="Open">Open</option>
                  <option value="Assigned">Assigned</option>
                  <option value="In Progress">In Progress</option>
                  <option value="Resolved">Resolved</option>
                  <option value="Closed">Closed</option>
                </select>
                <button
                  onClick={() => setShowCreateModal(true)}
                  className="bg-primary hover:bg-primary-dark text-white px-3 py-1.5 rounded-lg text-[10px] font-bold flex items-center gap-1.5 transition-all shadow-md active:scale-95"
                >
                  <Plus className="h-3.5 w-3.5" />
                  New Incident
                </button>
              </div>
            </div>

            {/* List Table */}
            <div className="flex-grow overflow-y-auto pr-1 scrollbar-thin text-xs">
              {loadingQueue ? (
                <div className="h-full w-full flex items-center justify-center py-20">
                  <Loader className="h-6 w-6 text-primary animate-spin" />
                </div>
              ) : filteredTickets.length === 0 ? (
                <div className="h-full w-full flex flex-col items-center justify-center py-20 text-center text-slate-500 border border-dashed border-slate-800 rounded-lg">
                  <TicketIcon className="h-10 w-10 text-slate-700" />
                  <p className="mt-3 font-semibold text-slate-400">No incident tickets logged yet</p>
                  <p className="text-[10px] text-slate-600 mt-1">Submit a ticket using the 'New Incident' button</p>
                </div>
              ) : (
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="border-b border-slate-800/80 text-slate-450 font-bold sticky top-0 bg-slate-900/60 backdrop-blur z-10 text-[10px] tracking-wide uppercase">
                      <th className="pb-3 pl-2">ID</th>
                      <th className="pb-3">Title</th>
                      <th className="pb-3">Category</th>
                      <th className="pb-3">Priority</th>
                      <th className="pb-3">Status</th>
                      <th className="pb-3">Assignee</th>
                      <th className="pb-3 pr-2">Opened At</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/30 text-slate-300">
                    {filteredTickets.map((t) => (
                      <tr
                        key={t.id}
                        onClick={() => handleSelectTicket(t)}
                        className={`hover:bg-slate-850/65 cursor-pointer transition-colors ${
                          selectedTicket?.id === t.id ? "bg-slate-800/40 text-white font-medium" : ""
                        }`}
                      >
                        <td className="py-3 pl-2 text-slate-500 font-mono">#TIC-{1000 + t.id}</td>
                        <td className="py-3 font-semibold max-w-[200px] truncate">{t.title}</td>
                        <td className="py-3 text-[10px] text-slate-400 font-medium">{t.category || "General"}</td>
                        <td className="py-3">
                          <span className={`text-[8px] font-bold px-1.5 py-0.5 rounded tracking-wider uppercase ${
                            t.priority === "Critical"
                              ? "bg-danger/10 text-danger border border-danger/25"
                              : t.priority === "High"
                              ? "bg-warning/10 text-warning border border-warning/25"
                              : "bg-info/10 text-info border border-info/25"
                          }`}>
                            {t.priority}
                          </span>
                        </td>
                        <td className="py-3">
                          <span className={`text-[8px] font-bold px-1.5 py-0.5 rounded tracking-wide uppercase ${
                            t.status === "Open"
                              ? "bg-slate-800 text-slate-355"
                              : t.status === "In Progress"
                              ? "bg-warning/15 text-warning"
                              : t.status === "Resolved"
                              ? "bg-success/15 text-success"
                              : "bg-info/15 text-info"
                          }`}>
                            {t.status}
                          </span>
                        </td>
                        <td className="py-3 text-slate-400">{t.assigned_to?.full_name || "Unassigned"}</td>
                        <td className="py-3 pr-2 text-slate-550 text-[10px] font-mono">
                          {new Date(t.created_at).toLocaleString([], { hour: '2-digit', minute: '2-digit', month: 'short', day: 'numeric' })}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </div>
        </div>

        {/* RIGHT COLUMN: DETAILED INCIDENT & REMOTE SYSTEM TERMINAL */}
        <div className="bg-slate-900/60 border border-slate-800/80 rounded-xl backdrop-blur-md p-5 flex flex-col min-h-0">
          
          <AnimatePresence mode="wait">
            {!selectedTicket ? (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="h-full w-full flex flex-col items-center justify-center py-24 text-center text-slate-550"
              >
                <Activity className="h-12 w-12 text-slate-850 animate-pulse mb-3" />
                <h3 className="font-semibold text-slate-400">Select an Incident Ticket</h3>
                <p className="text-[10px] text-slate-600 mt-1 max-w-[200px]">
                  Choose any row in the incident queue to display remote telemetry, diagnostic controls, and chat portals.
                </p>
              </motion.div>
            ) : (
              <motion.div
                key={selectedTicket.id}
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                className="h-full flex flex-col min-h-0"
              >
                {/* Header details */}
                <div className="border-b border-slate-800 pb-3 mb-4 flex justify-between items-start gap-4">
                  <div>
                    <span className="text-[9px] font-mono text-slate-500 uppercase tracking-widest">
                      Incident Ticket #TIC-{1000 + selectedTicket.id}
                    </span>
                    <h3 className="text-sm font-bold text-white line-clamp-1 mt-0.5">{selectedTicket.title}</h3>
                    <p className="text-[10px] text-slate-400 mt-0.5">Category: <span className="text-slate-300 font-semibold">{selectedTicket.category || "General"}</span></p>
                  </div>
                  <button
                    onClick={() => setSelectedTicket(null)}
                    className="p-1 text-slate-500 hover:text-white rounded-lg hover:bg-slate-800/50"
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>

                {/* Body Content */}
                <div className="flex-1 overflow-y-auto space-y-4 pr-1 scrollbar-thin text-xs">
                  
                  {/* Status Assignment Controls (Admin Only) */}
                  {(currentUserRole === "Admin" || currentUserRole === "Super Administrator" || currentUserRole === "Administrator") && (
                    <div className="bg-slate-950/40 p-3 rounded-lg border border-slate-800 space-y-2.5">
                      <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
                        <Sliders className="h-3 w-3 text-primary" /> Incident Administration
                      </p>
                      
                      <div className="grid grid-cols-2 gap-3">
                        {/* Status Select */}
                        <div>
                          <label className="text-[9px] text-slate-550 block mb-1">Modify Status</label>
                          <select
                            value={selectedTicket.status}
                            onChange={(e) => handleUpdateStatus(e.target.value)}
                            className="w-full bg-slate-900 border border-slate-800 text-[10px] py-1 rounded text-slate-300 focus:outline-none focus:border-primary"
                          >
                            <option value="Open">Open</option>
                            <option value="Assigned">Assigned</option>
                            <option value="In Progress">In Progress</option>
                            <option value="Resolved">Resolved</option>
                            <option value="Closed">Closed</option>
                          </select>
                        </div>

                        {/* Assignee select */}
                        <div>
                          <label className="text-[9px] text-slate-550 block mb-1">Assign Administrator</label>
                          <select
                            value={selectedTicket.assigned_to_id || ""}
                            onChange={(e) => handleUpdateAssignment(e.target.value)}
                            className="w-full bg-slate-900 border border-slate-800 text-[10px] py-1 rounded text-slate-300 focus:outline-none focus:border-primary"
                          >
                            <option value="">Unassigned</option>
                            {administrators.map(t => (
                              <option key={t.id} value={t.id}>{t.full_name}</option>
                            ))}
                          </select>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Incident Description */}
                  <div className="space-y-1">
                    <p className="text-[9px] font-bold text-slate-500 uppercase">User Description</p>
                    <p className="text-slate-300 bg-slate-950/20 p-2.5 rounded-lg border border-slate-800/40 text-[11px] leading-relaxed">
                      {selectedTicket.description}
                    </p>
                  </div>

                  {/* AUTOMATIC RMM TELEMETRY DETAILS AT TIME OF LOGGING */}
                  {selectedTicket.device_hostname && (
                    <div className="bg-slate-950/40 p-3 rounded-lg border border-slate-800 space-y-2.5">
                      <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
                        <Activity className="h-3.5 w-3.5 text-primary animate-pulse" /> Automatic Device Registry Metadata
                      </p>

                      <div className="grid grid-cols-2 gap-x-4 gap-y-2 text-[10px]">
                        <div>
                          <span className="text-slate-550 block text-[9px]">Endpoint Hostname</span>
                          <span className="font-mono font-bold text-slate-200">{selectedTicket.device_hostname}</span>
                        </div>
                        <div>
                          <span className="text-slate-550 block text-[9px]">Local IPv4</span>
                          <span className="font-mono text-slate-200">{selectedTicket.device_ip || "Unknown"}</span>
                        </div>
                        <div>
                          <span className="text-slate-550 block text-[9px]">Hardware Model</span>
                          <span className="text-slate-300 truncate block max-w-[130px]">{selectedTicket.device_serial ? `SN: ${selectedTicket.device_serial}` : "Virtual Platform"}</span>
                        </div>
                        <div>
                          <span className="text-slate-550 block text-[9px]">Operating System</span>
                          <span className="text-slate-300 truncate block max-w-[130px]">{selectedTicket.device_os || "Unknown"}</span>
                        </div>
                        <div>
                          <span className="text-slate-550 block text-[9px]">Processor Configuration</span>
                          <span className="text-slate-400 truncate block max-w-[130px]" title={selectedTicket.device_cpu}>{selectedTicket.device_cpu || "Unknown"}</span>
                        </div>
                        <div>
                          <span className="text-slate-550 block text-[9px]">Physical Memory</span>
                          <span className="text-slate-400">{selectedTicket.device_ram || "Unknown RAM"}</span>
                        </div>
                        <div>
                          <span className="text-slate-550 block text-[9px]">Logged Active User</span>
                          <span className="text-slate-300 font-bold">{selectedTicket.device_user || "None"}</span>
                        </div>
                        <div>
                          <span className="text-slate-550 block text-[9px]">Diagnostics Location</span>
                          <span className="text-slate-400">{selectedTicket.device_location || "HQ"}</span>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* ACTIVE LIVE WORKSTATION DIAGNOSTICS & PROCESS INSPECTOR */}
                  {selectedDevice && (currentUserRole === "Admin" || currentUserRole === "Super Administrator" || currentUserRole === "Administrator") && (
                    <div className="bg-slate-950/60 p-3 rounded-lg border border-primary/20 space-y-3">
                      <div className="flex items-center justify-between">
                        <p className="text-[10px] font-bold text-primary uppercase tracking-wider flex items-center gap-1.5">
                          <Terminal className="h-3.5 w-3.5 text-primary" /> Live RMM Diagnostics Drawer
                        </p>
                        <button
                          onClick={handleRestartDevice}
                          className="bg-danger/20 hover:bg-danger/30 text-danger border border-danger/30 px-2 py-0.5 rounded text-[8px] font-bold flex items-center gap-1 transition-all"
                          title="Power Restart agent node"
                        >
                          <RefreshCw className="h-2.5 w-2.5 animate-spin-slow" /> Power Cycle Node
                        </button>
                      </div>

                      {/* Tab selection */}
                      <div className="grid grid-cols-3 gap-1 bg-slate-900 p-0.5 rounded border border-slate-800">
                        <button
                          onClick={() => { setDiagTab("services"); setDiagSearch(""); }}
                          className={`py-1 rounded text-[9px] font-bold transition-all ${diagTab === "services" ? "bg-primary text-white" : "text-slate-500 hover:text-slate-350"}`}
                        >
                          Services
                        </button>
                        <button
                          onClick={() => { setDiagTab("processes"); setDiagSearch(""); }}
                          className={`py-1 rounded text-[9px] font-bold transition-all ${diagTab === "processes" ? "bg-primary text-white" : "text-slate-500 hover:text-slate-350"}`}
                        >
                          Processes
                        </button>
                        <button
                          onClick={() => { setDiagTab("software"); setDiagSearch(""); }}
                          className={`py-1 rounded text-[9px] font-bold transition-all ${diagTab === "software" ? "bg-primary text-white" : "text-slate-500 hover:text-slate-350"}`}
                        >
                          Software
                        </button>
                      </div>

                      {/* Diagnostic search input */}
                      <input
                        type="text"
                        value={diagSearch}
                        onChange={(e) => setDiagSearch(e.target.value)}
                        placeholder={`Filter ${diagTab}...`}
                        className="w-full bg-slate-900 border border-slate-800 px-2.5 py-1 rounded text-[10px] focus:outline-none focus:border-primary text-slate-300"
                      />

                      {/* Diagnostic items list */}
                      <div className="h-36 overflow-y-auto bg-slate-900/40 border border-slate-850 p-2 rounded text-[10px] font-mono scrollbar-thin text-slate-400">
                        {loadingDiagnostics ? (
                          <div className="h-full w-full flex items-center justify-center">
                            <Loader className="h-4 w-4 animate-spin text-primary" />
                          </div>
                        ) : diagTab === "services" ? (
                          <div className="space-y-1">
                            {filterDiagItems(deviceDiagnostics.services).map((s: any, idx: number) => (
                              <div key={idx} className="flex justify-between items-center py-0.5 border-b border-slate-850/40">
                                <span className="truncate max-w-[130px]" title={s.display_name || s.name}>{s.display_name || s.name}</span>
                                <span className={`text-[8px] px-1 rounded-sm ${s.status === "running" ? "bg-success/15 text-success" : "bg-slate-800 text-slate-450"}`}>
                                  {s.status}
                                </span>
                              </div>
                            ))}
                          </div>
                        ) : diagTab === "processes" ? (
                          <div className="space-y-1">
                            {filterDiagItems(deviceDiagnostics.processes).map((p: any, idx: number) => (
                              <div key={idx} className="flex justify-between items-center py-0.5 border-b border-slate-850/40">
                                <span className="truncate max-w-[130px]">{p.name} (PID: {p.pid})</span>
                                <span className="text-slate-500 text-[8px]">{p.cpu_percent ? `${p.cpu_percent}% CPU` : ""}</span>
                              </div>
                            ))}
                          </div>
                        ) : (
                          <div className="space-y-1">
                            {filterDiagItems(deviceDiagnostics.software).map((sw: any, idx: number) => (
                              <div key={idx} className="flex justify-between items-center py-0.5 border-b border-slate-850/40">
                                <span className="truncate max-w-[130px]" title={sw.name}>{sw.name}</span>
                                <span className="text-slate-550 text-[9px]">{sw.version || "N/A"}</span>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>
                  )}

                  {/* REAL-TIME OPERATIONS CHAT PORTAL */}
                  <div className="bg-slate-950/40 p-3 rounded-lg border border-slate-800 flex flex-col h-[320px]">
                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-2 flex items-center gap-1.5">
                      <MessageSquare className="h-3.5 w-3.5 text-primary" /> Incident Communication Portal
                    </p>

                    {/* Messages Queue */}
                    <div ref={chatScrollRef} className="flex-1 overflow-y-auto space-y-2 pr-1 scrollbar-thin mb-3 text-[11px] p-2 bg-slate-900/40 border border-slate-850 rounded">
                      {messages.length === 0 ? (
                        <div className="h-full flex items-center justify-center text-center text-slate-600">
                          <p>No chat history exists. Begin communication below.</p>
                        </div>
                      ) : (
                        messages.map((msg, index) => {
                          const isMe = msg.sender_id === myProfile?.id;
                          return (
                            <div key={index} className={`flex flex-col ${isMe ? "items-end" : "items-start"}`}>
                              <span className="text-[8px] text-slate-550 mb-0.5 px-1 flex items-center gap-1.5">
                                {msg.sender?.full_name || msg.sender}
                                {onlineUsers.has(msg.sender_id) && (
                                  <span className="h-1.5 w-1.5 rounded-full bg-success animate-pulse inline-block" title="Online" />
                                )}
                              </span>
                              <div className={`p-2 rounded-lg max-w-[85%] break-words ${isMe ? "bg-primary text-white rounded-tr-none" : "bg-slate-800 text-slate-200 rounded-tl-none"}`}>
                                <p>{msg.message}</p>
                                {msg.file_name && (
                                  <a
                                    href={`http://127.0.0.1:8000/uploads/${msg.file_path?.split(/\/|\\/).pop()}`}
                                    target="_blank"
                                    rel="noreferrer"
                                    className="mt-1.5 flex items-center gap-1.5 bg-slate-950/45 p-1 rounded hover:underline text-[9px] text-white"
                                  >
                                    <Paperclip className="h-3 w-3 shrink-0" />
                                    <span className="truncate max-w-[120px]">{msg.file_name}</span>
                                  </a>
                                )}
                              </div>
                              <div className="flex items-center gap-1 mt-0.5 px-1">
                                <span className="text-[7px] text-slate-600 font-mono">
                                  {new Date(msg.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                </span>
                                {isMe && (
                                  <span className="text-[8.5px]">
                                    {msg.is_read ? (
                                      <span className="text-success font-bold" title={`Read at ${msg.read_at ? new Date(msg.read_at).toLocaleTimeString() : ""}`}>✓✓</span>
                                    ) : (
                                      <span className="text-slate-500 font-bold">✓</span>
                                    )}
                                  </span>
                                )}
                              </div>
                            </div>
                          );
                        })
                      )}
                    </div>

                    {typingStatus && (
                      <p className="text-[9px] text-slate-400 italic mb-2 animate-pulse">{typingStatus}</p>
                    )}

                    {/* Send box */}
                    <form onSubmit={handleSendChat} className="flex items-center gap-2">
                      <div className="relative flex-1 bg-slate-900 border border-slate-800 rounded-lg flex items-center">
                        
                        {/* File upload trigger */}
                        <label className="p-2 cursor-pointer text-slate-500 hover:text-slate-300">
                          <Paperclip className="h-4.5 w-4.5" />
                          <input
                            type="file"
                            onChange={(e) => setSelectedChatFile(e.target.files ? e.target.files[0] : null)}
                            className="hidden"
                          />
                        </label>

                        {selectedChatFile && (
                          <div className="absolute bottom-11 left-0 bg-slate-850 border border-slate-750 px-2 py-1 rounded text-[9px] flex items-center gap-1.5">
                            <span className="truncate max-w-[100px]">{selectedChatFile.name}</span>
                            <button type="button" onClick={() => setSelectedChatFile(null)} className="text-danger">
                              <X className="h-3 w-3" />
                            </button>
                          </div>
                        )}

                        <input
                          type="text"
                          value={chatMessage}
                          onChange={handleInputChange}
                          placeholder="Type communication message..."
                          className="flex-1 bg-transparent py-2.5 pl-1 pr-3 text-[11px] focus:outline-none placeholder-slate-650 text-white"
                        />
                      </div>
                      <button
                        type="submit"
                        disabled={sendingMsg}
                        className="bg-primary hover:bg-primary-dark text-white p-2.5 rounded-lg disabled:opacity-50 transition-colors"
                      >
                        <Send className="h-4 w-4" />
                      </button>
                    </form>
                  </div>

                </div>
              </motion.div>
            )}
          </AnimatePresence>

        </div>

      </div>

      {/* 3. NEW INCIDENT CREATOR MODAL */}
      <AnimatePresence>
        {showCreateModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 backdrop-blur-sm p-4">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-slate-900 border border-slate-800 rounded-card w-full max-w-lg p-6 shadow-2xl"
            >
              <div className="flex items-center justify-between border-b border-slate-800 pb-3 mb-4">
                <h3 className="text-sm font-bold text-white flex items-center gap-2">
                  <TicketIcon className="h-4.5 w-4.5 text-primary" /> Create Support Incident Request
                </h3>
                <button
                  onClick={() => setShowCreateModal(false)}
                  className="p-1 text-slate-500 hover:text-white rounded hover:bg-slate-800"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>

              <form onSubmit={handleCreateTicket} className="space-y-4 text-xs">
                
                {/* Title */}
                <div>
                  <label className="block text-[10px] font-bold text-slate-450 uppercase mb-1">
                    Incident Title
                  </label>
                  <input
                    type="text"
                    required
                    value={newTitle}
                    onChange={(e) => setNewTitle(e.target.value)}
                    placeholder="e.g. Printer Offline on Floor 2"
                    className="w-full bg-slate-950 border border-slate-800 px-3 py-2 rounded-lg text-white placeholder-slate-600 focus:outline-none focus:border-primary"
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  {/* Category */}
                  <div>
                    <label className="block text-[10px] font-bold text-slate-455 uppercase mb-1">
                      Category
                    </label>
                    <select
                      value={newCategory}
                      onChange={(e) => setNewCategory(e.target.value)}
                      className="w-full bg-slate-950 border border-slate-800 px-3 py-2 rounded-lg text-slate-300 focus:outline-none"
                    >
                      <option value="Software">Software Incident</option>
                      <option value="Hardware">Hardware Defect</option>
                      <option value="Network">Network Interruption</option>
                      <option value="Access">IAM / Security Access</option>
                    </select>
                  </div>

                  {/* Priority */}
                  <div>
                    <label className="block text-[10px] font-bold text-slate-455 uppercase mb-1">
                      Urgency
                    </label>
                    <select
                      value={newPriority}
                      onChange={(e) => setNewPriority(e.target.value)}
                      className="w-full bg-slate-950 border border-slate-800 px-3 py-2 rounded-lg text-slate-300 focus:outline-none"
                    >
                      <option value="Low">Low (General Inquiry)</option>
                      <option value="Medium">Medium (Functional Blockage)</option>
                      <option value="High">High (Major Operations Block)</option>
                      <option value="Critical">Critical (System Downtime / Outage)</option>
                    </select>
                  </div>
                </div>

                {/* Description */}
                <div>
                  <label className="block text-[10px] font-bold text-slate-450 uppercase mb-1">
                    Description of Symptoms
                  </label>
                  <textarea
                    required
                    rows={4}
                    value={newDesc}
                    onChange={(e) => setNewDesc(e.target.value)}
                    placeholder="Please specify error codes, messages, and detail what actions lead up to the issue..."
                    className="w-full bg-slate-950 border border-slate-800 px-3 py-2 rounded-lg text-white placeholder-slate-600 focus:outline-none focus:border-primary resize-none"
                  />
                </div>

                {/* Read only diagnostic logs attached */}
                {employeeDevice && (
                  <div className="bg-slate-955 border border-primary/20 p-3 rounded-lg text-[10px] text-slate-400 space-y-1">
                    <p className="font-bold text-primary flex items-center gap-1">
                      <Check className="h-3 w-3" /> Automatic Machine profiling attached:
                    </p>
                    <div className="grid grid-cols-2 gap-x-2">
                      <p>Hostname: <span className="font-mono text-slate-200">{employeeDevice.hostname}</span></p>
                      <p>OS Type: <span className="text-slate-200">{employeeDevice.operating_system}</span></p>
                      <p>Memory size: <span className="text-slate-200">{employeeDevice.ram}</span></p>
                      <p>Active User: <span className="text-slate-200">{employeeDevice.current_user}</span></p>
                    </div>
                  </div>
                )}

                <div className="flex justify-end gap-2 border-t border-slate-850 pt-4 mt-2">
                  <button
                    type="button"
                    onClick={() => setShowCreateModal(false)}
                    className="bg-slate-800 hover:bg-slate-700 text-white px-4 py-2 rounded-lg font-bold"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="bg-primary hover:bg-primary-dark text-white px-4 py-2 rounded-lg font-bold"
                  >
                    Log Incident
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

    </div>
  );
}
