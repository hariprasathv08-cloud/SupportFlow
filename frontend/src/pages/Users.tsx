import { useState, useEffect, useRef } from "react";
import {
  Users as UsersIcon,
  RefreshCw,
  Search,
  Plus,
  Trash2,
  X,
  User,
  ShieldCheck,
  FolderOpen,
  Calendar,
  Terminal,
  Grid,
  ChevronLeft,
  ChevronRight,
  Filter,
  Check,
  Lock,
  Settings,
  Key,
  Database,
  ArrowRight,
  Info,
  Clock
} from "lucide-react";
import api from "../services/api";

export default function Users() {
  const [users, setUsers] = useState<any[]>([]);
  const [roles, setRoles] = useState<any[]>([]);
  const [permissions, setPermissions] = useState<any[]>([]);
  const [auditLogs, setAuditLogs] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState("");

  const [activeDirectorySynced, setActiveDirectorySynced] = useState(false);
  const [csvImported, setCsvImported] = useState(false);

  // Tab: "users", "roles", "audit"
  const [activeConsoleTab, setActiveConsoleTab] = useState("users");

  // Selection states
  const [selectedUserIds, setSelectedUserIds] = useState<number[]>([]);
  const [selectedUser, setSelectedUser] = useState<any>(null);
  const [profileTab, setProfileTab] = useState("overview");

  // Filter States
  const [showFilters, setShowFilters] = useState(false);
  const [filterRole, setFilterRole] = useState("");
  const [filterStatus, setFilterStatus] = useState("");
  const [filterDept, setFilterDept] = useState("");

  // Pagination states
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

  // Column Chooser
  const [visibleColumns, setVisibleColumns] = useState<Record<string, boolean>>({
    username: true,
    full_name: true,
    email: true,
    role: true,
    department: true,
    status: true,
    mfa_enabled: true,
    last_login: true,
    created_at: true
  });
  const [showColumnChooser, setShowColumnChooser] = useState(false);

  // Column widths
  const [columnWidths, setColumnWidths] = useState<Record<string, number>>({
    username: 110,
    full_name: 140,
    email: 180,
    role: 130,
    department: 120,
    status: 90,
    mfa_enabled: 90,
    last_login: 120,
    created_at: 110
  });

  // Role builder inputs
  const [newRoleName, setNewRoleName] = useState("");
  const [newRoleDesc, setNewRoleDesc] = useState("");
  const [selectedPermissionIds, setSelectedPermissionIds] = useState<number[]>([]);

  // User Creator states
  const [isAddingUser, setIsAddingUser] = useState(false);
  const [createUserEmail, setCreateUserEmail] = useState("");
  const [createUserName, setCreateUserName] = useState("");
  const [createUserUsername, setCreateUserUsername] = useState("");
  const [createUserPass, setCreateUserPass] = useState("");
  const [createUserRole, setCreateUserRole] = useState("");
  const [createUserDept, setCreateUserDept] = useState("IT Support");
  const [createUserTitle, setCreateUserTitle] = useState("IT Specialist");
  const [createUserPhone, setCreateUserPhone] = useState("");
  const [createUserManager, setCreateUserManager] = useState("");

  // Edit Security States
  const [editUserRoleId, setEditUserRoleId] = useState<number | string>("");
  const [editUserStatus, setEditUserStatus] = useState("");
  const [editUserMfa, setEditUserMfa] = useState(false);

  const currentUserEmail = localStorage.getItem("email") || "";
  const currentUserName = localStorage.getItem("user_name") || "Admin";
  const currentUserRole = localStorage.getItem("role") || "Viewer";

  const loadIAMData = async () => {
    setLoading(true);
    try {
      const userList = await api.listUsers();
      setUsers(userList);

      const roleList = await api.getRoles();
      setRoles(roleList);

      const permList = await api.getPermissions();
      setPermissions(permList);

      const logs = await api.getAuditLogs();
      setAuditLogs(logs);
    } catch (err) {
      console.error("IAM load error:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadIAMData();
  }, []);

  // Update profile inputs
  useEffect(() => {
    if (selectedUser) {
      setEditUserRoleId(selectedUser.role_detail?.id || "");
      setEditUserStatus(selectedUser.status || "Active");
      setEditUserMfa(selectedUser.mfa_enabled || false);
    }
  }, [selectedUser]);

  // Bulk Actions
  const handleBulkDelete = async () => {
    if (selectedUserIds.length === 0) return;
    if (!confirm(`Are you sure you want to delete ${selectedUserIds.length} user accounts?`)) return;
    try {
      await api.bulkDeleteUsers(selectedUserIds);
      setSelectedUserIds([]);
      loadIAMData();
    } catch (err: any) {
      alert(`Bulk Delete Error: ${err.message}`);
    }
  };

  const handleBulkStatus = async (status: string) => {
    if (selectedUserIds.length === 0) return;
    try {
      await api.bulkStatusUsers(selectedUserIds, status);
      setSelectedUserIds([]);
      loadIAMData();
    } catch (err: any) {
      alert(`Bulk Status Error: ${err.message}`);
    }
  };

  // AD and CSV Sync Trigger
  const handleADSync = async () => {
    setLoading(true);
    try {
      const data = await api.syncActiveDirectory();
      setActiveDirectorySynced(true);
      alert(data.message);
      loadIAMData();
    } catch (err: any) {
      alert(`Active Directory sync failed: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  const handleCSVImport = async () => {
    setLoading(true);
    try {
      const data = await api.importCsvUsers();
      setCsvImported(true);
      alert(data.message);
      loadIAMData();
    } catch (err: any) {
      alert(`CSV import failed: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  // Create User
  const handleCreateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    const payload = {
      email: createUserEmail,
      full_name: createUserName,
      username: createUserUsername,
      password: createUserPass,
      role_id: Number(createUserRole) || null,
      department: createUserDept,
      job_title: createUserTitle,
      phone: createUserPhone,
      manager: createUserManager
    };

    try {
      await api.createUser(payload);
      setIsAddingUser(false);
      loadIAMData();
    } catch (err: any) {
      alert(`User Creation Error: ${err.message}`);
    }
  };

  // Update single user assignments
  const handleEditSecuritySubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedUser) return;
    try {
      const payload = {
        role_id: Number(editUserRoleId) || null,
        status: editUserStatus,
        mfa_enabled: editUserMfa
      };
      const updated = await api.updateUser(selectedUser.id, payload);
      setSelectedUser(updated);
      loadIAMData();
      alert("User security settings updated.");
    } catch (err: any) {
      alert(`Save Security Error: ${err.message}`);
    }
  };

  // Create custom role
  const handleCreateRole = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newRoleName) return;
    try {
      await api.createRole(newRoleName, newRoleDesc, selectedPermissionIds);
      setNewRoleName("");
      setNewRoleDesc("");
      setSelectedPermissionIds([]);
      loadIAMData();
      alert("Custom security role registered.");
    } catch (err: any) {
      alert(`Role Creation Error: ${err.message}`);
    }
  };

  const handleDeleteUser = async (id: number) => {
    if (!confirm("Are you sure you want to delete this user account?")) return;
    try {
      await api.deleteUser(id);
      loadIAMData();
    } catch (err: any) {
      alert(`Delete Error: ${err.message}`);
    }
  };

  const toggleSelectUser = (id: number) => {
    setSelectedUserIds((prev) =>
      prev.includes(id) ? prev.filter((uid) => uid !== id) : [...prev, id]
    );
  };

  const handleSelectAll = () => {
    if (selectedUserIds.length === paginatedUsers.length) {
      setSelectedUserIds([]);
    } else {
      setSelectedUserIds(paginatedUsers.map((u) => u.id));
    }
  };

  // Resize column logic
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

  // Apply filters
  const filteredUsers = users.filter((u) => {
    const matchesSearch =
      (u.full_name || "").toLowerCase().includes(search.toLowerCase()) ||
      (u.username || "").toLowerCase().includes(search.toLowerCase()) ||
      (u.email || "").toLowerCase().includes(search.toLowerCase()) ||
      (u.department || "").toLowerCase().includes(search.toLowerCase()) ||
      (u.job_title || "").toLowerCase().includes(search.toLowerCase());

    const matchesRole = filterRole ? u.role === filterRole : true;
    const matchesStatus = filterStatus ? u.status === filterStatus : true;
    const matchesDept = filterDept ? (u.department || "").toLowerCase() === filterDept.toLowerCase() : true;

    return matchesSearch && matchesRole && matchesStatus && matchesDept;
  });

  // Paginated users
  const totalItems = filteredUsers.length;
  const totalPages = Math.ceil(totalItems / pageSize) || 1;
  const startIndex = (currentPage - 1) * pageSize;
  const paginatedUsers = filteredUsers.slice(startIndex, startIndex + pageSize);

  // Departments list
  const departments = Array.from(new Set(users.map((u) => u.department).filter(Boolean))) as string[];

  return (
    <div className="flex flex-col gap-6">
      {/* Title Controls */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold tracking-tight text-slate-800 dark:text-white">
            Identity & Access Management (IAM)
          </h1>
          <p className="text-xs text-slate-500 mt-0.5">
            Administer operational staff profiles, Active Directory linkages, and granular security role privileges
          </p>
        </div>

        <div className="flex gap-2">
          {currentUserRole !== "Viewer" && (
            <button
              onClick={() => setIsAddingUser(true)}
              className="flex items-center gap-1.5 px-4 py-2 bg-primary hover:bg-primary-dark text-white rounded-xl text-xs font-semibold shadow-md transition-all active:scale-[0.98]"
            >
              <Plus className="h-4 w-4" />
              Add Corporate User
            </button>
          )}
          <button
            onClick={handleADSync}
            className="flex items-center gap-1.5 px-3 py-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 hover:bg-slate-50 rounded-xl text-xs font-semibold text-slate-700 dark:text-slate-200 transition-colors shadow-sm"
          >
            <Database className="h-4 w-4 text-slate-400" />
            Sync AD / LDAP
          </button>
        </div>
      </div>

      {/* Directory Navigation Tabs */}
      <div className="flex border-b border-slate-200 dark:border-slate-800 gap-6 text-xs font-semibold text-slate-400">
        <button
          onClick={() => setActiveConsoleTab("users")}
          className={`pb-2 border-b-2 flex items-center gap-1.5 transition-colors ${
            activeConsoleTab === "users" ? "border-primary text-primary font-bold" : "border-transparent hover:text-slate-750"
          }`}
        >
          <UsersIcon className="h-4 w-4" />
          Active Directory Users ({users.length})
        </button>
        <button
          onClick={() => setActiveConsoleTab("roles")}
          className={`pb-2 border-b-2 flex items-center gap-1.5 transition-colors ${
            activeConsoleTab === "roles" ? "border-primary text-primary font-bold" : "border-transparent hover:text-slate-750"
          }`}
        >
          <Key className="h-4 w-4" />
          Role Templates & Permissions ({roles.length})
        </button>
        <button
          onClick={() => setActiveConsoleTab("audit")}
          className={`pb-2 border-b-2 flex items-center gap-1.5 transition-colors ${
            activeConsoleTab === "audit" ? "border-primary text-primary font-bold" : "border-transparent hover:text-slate-750"
          }`}
        >
          <Clock className="h-4 w-4" />
          IAM Access Audit Logs
        </button>
      </div>

      {/* Onboarding Wizard - Shown when there are no users in directory */}
      {users.length === 0 && !loading && (
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-card p-6 shadow-soft flex flex-col items-center justify-center text-center max-w-lg mx-auto my-10 text-xs">
          <UsersIcon className="h-14 w-14 text-primary/80 mb-3 animate-pulse" />
          <h2 className="text-base font-bold text-slate-800 dark:text-white">No Users Found in Directory</h2>
          <p className="text-slate-450 mt-1 max-w-sm">
            Populate your corporate staff profiles list by manual enrollment, CSV templates import, or mapping your Active Directory LDAP catalog.
          </p>

          <div className="grid grid-cols-3 gap-2 mt-6 w-full">
            <button onClick={() => setIsAddingUser(true)} className="py-2 px-3 bg-primary text-white rounded-lg font-bold hover:bg-primary-dark shadow">
              Create User
            </button>
            <button onClick={handleCSVImport} className="py-2 px-3 bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-850 rounded-lg font-bold text-slate-700 dark:text-slate-200 hover:bg-slate-50 transition-colors">
              Import CSV
            </button>
            <button onClick={handleADSync} className="py-2 px-3 bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-850 rounded-lg font-bold text-slate-700 dark:text-slate-200 hover:bg-slate-50 transition-colors">
              Connect AD
            </button>
          </div>
        </div>
      )}

      {/* Directory Workspace */}
      {users.length > 0 && activeConsoleTab === "users" && (
        <div className="flex flex-col gap-4">
          {/* Action Bar */}
          <div className="flex flex-col sm:flex-row items-center justify-between gap-3 text-xs">
            <div className="relative w-full sm:w-80">
              <span className="absolute inset-y-0 left-3 flex items-center text-slate-400">
                <Search className="h-4 w-4" />
              </span>
              <input
                type="text"
                value={search}
                onChange={(e) => { setSearch(e.target.value); setCurrentPage(1); }}
                placeholder="Search users by Name, Username, Email, Title..."
                className="w-full bg-white dark:bg-slate-900 pl-10 pr-4 py-2 rounded-xl border border-slate-200 dark:border-slate-850 text-xs focus:outline-none focus:ring-1 focus:ring-primary focus:border-primary text-slate-800 dark:text-white"
              />
            </div>

            {/* Configs */}
            <div className="flex items-center gap-2 self-end sm:self-auto">
              {/* Bulk actions dropdown */}
              {selectedUserIds.length > 0 && (
                <div className="flex items-center gap-1.5 border border-primary/20 bg-primary/5 rounded-xl px-2.5 py-1 text-primary font-bold">
                  <span>{selectedUserIds.length} Selected</span>
                  <div className="h-4 w-[1px] bg-primary/20 mx-1" />
                  <button onClick={() => handleBulkStatus("Active")} className="hover:underline text-[10px]">Activate</button>
                  <button onClick={() => handleBulkStatus("Suspended")} className="hover:underline text-[10px] text-warning">Suspend</button>
                  <button onClick={handleBulkDelete} className="hover:underline text-[10px] text-danger">Delete</button>
                </div>
              )}

              <button
                onClick={() => setShowFilters(!showFilters)}
                className={`flex items-center gap-1.5 px-3 py-2 border rounded-xl font-semibold shadow-sm transition-colors ${
                  showFilters ? "bg-primary/10 border-primary/20 text-primary" : "bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-200"
                }`}
              >
                <Filter className="h-3.5 w-3.5" />
                Filters
              </button>

              {/* Column chooser */}
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
                      <label key={col} className="flex items-center gap-2 cursor-pointer text-slate-700 dark:text-slate-350">
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

          {/* Advanced filters */}
          {showFilters && (
            <div className="bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl p-4 grid grid-cols-1 sm:grid-cols-3 gap-4 text-xs">
              <div className="flex flex-col gap-1">
                <span className="font-semibold text-slate-450">Filter Role</span>
                <select
                  value={filterRole}
                  onChange={(e) => { setFilterRole(e.target.value); setCurrentPage(1); }}
                  className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg p-2"
                >
                  <option value="">All Roles</option>
                  {roles.map((r) => <option key={r.name} value={r.name}>{r.name}</option>)}
                </select>
              </div>

              <div className="flex flex-col gap-1">
                <span className="font-semibold text-slate-450">Filter Status</span>
                <select
                  value={filterStatus}
                  onChange={(e) => { setFilterStatus(e.target.value); setCurrentPage(1); }}
                  className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg p-2"
                >
                  <option value="">All Statuses</option>
                  <option value="Active">Active</option>
                  <option value="Suspended">Suspended</option>
                  <option value="Lockout">Lockout</option>
                </select>
              </div>

              <div className="flex flex-col gap-1">
                <span className="font-semibold text-slate-450">Filter Department</span>
                <select
                  value={filterDept}
                  onChange={(e) => { setFilterDept(e.target.value); setCurrentPage(1); }}
                  className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg p-2"
                >
                  <option value="">All Departments</option>
                  {departments.map((d) => <option key={d} value={d}>{d}</option>)}
                </select>
              </div>
            </div>
          )}

          {/* Users Table */}
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-card shadow-soft overflow-hidden">
            <div className="overflow-x-auto min-w-full relative">
              <table className="min-w-full divide-y divide-slate-100 dark:divide-slate-800 text-left text-xs table-fixed">
                <thead>
                  <tr className="bg-slate-50 dark:bg-slate-950 text-slate-400 font-bold sticky top-0 z-10">
                    <th className="w-12 py-3 px-4">
                      <input
                        type="checkbox"
                        checked={selectedUserIds.length === paginatedUsers.length && paginatedUsers.length > 0}
                        onChange={handleSelectAll}
                        className="rounded text-primary focus:ring-primary"
                      />
                    </th>
                    {visibleColumns.username && (
                      <th style={{ width: columnWidths.username }} className="py-3 px-4 relative truncate">
                        Username
                        <span onMouseDown={(e) => handleResizeStart(e, "username")} className="absolute right-0 top-0 bottom-0 w-1.5 cursor-col-resize hover:bg-primary/40" />
                      </th>
                    )}
                    {visibleColumns.full_name && (
                      <th style={{ width: columnWidths.full_name }} className="py-3 px-4 relative truncate">
                        Full Name
                        <span onMouseDown={(e) => handleResizeStart(e, "full_name")} className="absolute right-0 top-0 bottom-0 w-1.5 cursor-col-resize hover:bg-primary/40" />
                      </th>
                    )}
                    {visibleColumns.email && (
                      <th style={{ width: columnWidths.email }} className="py-3 px-4 relative truncate">
                        Email Address
                        <span onMouseDown={(e) => handleResizeStart(e, "email")} className="absolute right-0 top-0 bottom-0 w-1.5 cursor-col-resize hover:bg-primary/40" />
                      </th>
                    )}
                    {visibleColumns.role && (
                      <th style={{ width: columnWidths.role }} className="py-3 px-4 relative truncate">
                        Role Group
                        <span onMouseDown={(e) => handleResizeStart(e, "role")} className="absolute right-0 top-0 bottom-0 w-1.5 cursor-col-resize hover:bg-primary/40" />
                      </th>
                    )}
                    {visibleColumns.department && (
                      <th style={{ width: columnWidths.department }} className="py-3 px-4 relative truncate">
                        Department
                        <span onMouseDown={(e) => handleResizeStart(e, "department")} className="absolute right-0 top-0 bottom-0 w-1.5 cursor-col-resize hover:bg-primary/40" />
                      </th>
                    )}
                    {visibleColumns.status && (
                      <th style={{ width: columnWidths.status }} className="py-3 px-4 relative truncate">
                        Status
                        <span onMouseDown={(e) => handleResizeStart(e, "status")} className="absolute right-0 top-0 bottom-0 w-1.5 cursor-col-resize hover:bg-primary/40" />
                      </th>
                    )}
                    {visibleColumns.mfa_enabled && (
                      <th style={{ width: columnWidths.mfa_enabled }} className="py-3 px-4 relative truncate">
                        MFA status
                        <span onMouseDown={(e) => handleResizeStart(e, "mfa_enabled")} className="absolute right-0 top-0 bottom-0 w-1.5 cursor-col-resize hover:bg-primary/40" />
                      </th>
                    )}
                    {visibleColumns.last_login && (
                      <th style={{ width: columnWidths.last_login }} className="py-3 px-4 relative truncate">
                        Last Login
                        <span onMouseDown={(e) => handleResizeStart(e, "last_login")} className="absolute right-0 top-0 bottom-0 w-1.5 cursor-col-resize hover:bg-primary/40" />
                      </th>
                    )}
                    {visibleColumns.created_at && (
                      <th style={{ width: columnWidths.created_at }} className="py-3 px-4 relative truncate">
                        Created At
                        <span onMouseDown={(e) => handleResizeStart(e, "created_at")} className="absolute right-0 top-0 bottom-0 w-1.5 cursor-col-resize hover:bg-primary/40" />
                      </th>
                    )}
                    <th className="py-3 px-4 text-right w-20">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800 text-slate-700 dark:text-slate-300">
                  {paginatedUsers.map((u) => (
                    <tr
                      key={u.id}
                      className={`hover:bg-slate-50/50 dark:hover:bg-slate-950 transition-colors cursor-pointer ${
                        selectedUser?.id === u.id ? "bg-primary/5" : ""
                      }`}
                      onClick={() => { setSelectedUser(u); setProfileTab("overview"); }}
                    >
                      <td className="py-3 px-4" onClick={(e) => e.stopPropagation()}>
                        <input
                          type="checkbox"
                          checked={selectedUserIds.includes(u.id)}
                          onChange={() => toggleSelectUser(u.id)}
                          className="rounded text-primary focus:ring-primary"
                        />
                      </td>
                      {visibleColumns.username && (
                        <td className="py-3 px-4 font-mono truncate">{u.username || "N/A"}</td>
                      )}
                      {visibleColumns.full_name && (
                        <td className="py-3 px-4 font-bold text-slate-800 dark:text-slate-100 flex items-center gap-2 truncate">
                          <img src={u.avatar} className="h-6 w-6 rounded-full shrink-0" alt="Avatar" />
                          {u.full_name}
                        </td>
                      )}
                      {visibleColumns.email && (
                        <td className="py-3 px-4 truncate">{u.email}</td>
                      )}
                      {visibleColumns.role && (
                        <td className="py-3 px-4 truncate">
                          <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-bold ${
                            u.role === "Super Administrator" ? "bg-danger/10 text-danger" : u.role === "Administrator" ? "bg-orange-500/10 text-orange-500" : "bg-slate-100 dark:bg-slate-800 text-slate-400"
                          }`}>
                            {u.role}
                          </span>
                        </td>
                      )}
                      {visibleColumns.department && (
                        <td className="py-3 px-4 truncate">{u.department || "N/A"}</td>
                      )}
                      {visibleColumns.status && (
                        <td className="py-3 px-4">
                          <span className={`px-2 py-0.5 rounded text-[9px] font-bold uppercase tracking-wider ${
                            u.status === "Active" ? "bg-success/10 text-success" : "bg-slate-100 dark:bg-slate-800 text-slate-400"
                          }`}>{u.status}</span>
                        </td>
                      )}
                      {visibleColumns.mfa_enabled && (
                        <td className="py-3 px-4">
                          <span className={`px-1.5 py-0.5 rounded text-[9px] font-bold ${u.mfa_enabled ? 'bg-success/10 text-success' : 'bg-slate-100 dark:bg-slate-800 text-slate-400'}`}>
                            {u.mfa_enabled ? "Enabled" : "Disabled"}
                          </span>
                        </td>
                      )}
                      {visibleColumns.last_login && (
                        <td className="py-3 px-4 text-slate-400 truncate">
                          {u.last_login ? new Date(u.last_login).toLocaleDateString() : "Never"}
                        </td>
                      )}
                      {visibleColumns.created_at && (
                        <td className="py-3 px-4 text-slate-400 truncate">
                          {new Date(u.created_at).toLocaleDateString()}
                        </td>
                      )}
                      <td className="py-3 px-4 text-right" onClick={(e) => e.stopPropagation()}>
                        <button
                          disabled={u.email === currentUserEmail}
                          onClick={() => handleDeleteUser(u.id)}
                          className="p-1 rounded text-slate-400 hover:text-danger hover:bg-danger/5 transition-colors disabled:opacity-50"
                          title="Delete User"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Pagination Controls */}
            <div className="bg-slate-50 dark:bg-slate-950 border-t border-slate-100 dark:border-slate-800 p-3.5 flex items-center justify-between text-xs shrink-0">
              <span className="text-slate-400 font-semibold">
                Showing {startIndex + 1} - {Math.min(startIndex + pageSize, totalItems)} of {totalItems} users
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

      {/* Tab 2: Custom Roles Builder & Security Profiles */}
      {activeConsoleTab === "roles" && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 text-xs">
          {/* Roles list */}
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-card p-5 shadow-soft lg:col-span-8 flex flex-col h-[520px] overflow-hidden">
            <h3 className="font-bold text-slate-800 dark:text-white mb-3">Security Role Catalog</h3>
            <div className="flex-1 overflow-y-auto scrollbar-thin">
              <table className="w-full text-left">
                <thead>
                  <tr className="border-b text-slate-400">
                    <th className="pb-1.5">Role Name</th>
                    <th className="pb-1.5">Description</th>
                    <th className="pb-1.5">Template</th>
                    <th className="pb-1.5 text-right">Permissions Count</th>
                  </tr>
                </thead>
                <tbody>
                  {roles.map((r) => (
                    <tr key={r.id} className="border-b border-slate-50/50 dark:border-slate-800/30">
                      <td className="py-2.5 font-bold text-slate-800 dark:text-slate-100">{r.name}</td>
                      <td className="py-2.5 text-slate-500">{r.description}</td>
                      <td className="py-2.5 text-slate-450">{r.is_custom ? "Custom" : "Default"}</td>
                      <td className="py-2.5 text-right font-semibold text-primary">{(r.permissions || []).length} perms</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Role Creator */}
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-card p-5 shadow-soft lg:col-span-4 flex flex-col h-[520px] overflow-hidden">
            <h3 className="font-bold text-slate-800 dark:text-white mb-3">Create Custom Security Role</h3>
            <form onSubmit={handleCreateRole} className="flex flex-col gap-3.5 flex-1 overflow-hidden">
              <div className="flex flex-col gap-1 shrink-0">
                <label className="font-semibold text-slate-400">Role Name</label>
                <input
                  type="text"
                  required
                  value={newRoleName}
                  onChange={(e) => setNewRoleName(e.target.value)}
                  placeholder="e.g. Asset Auditor Specialist"
                  className="bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg p-2 focus:outline-none focus:ring-1 focus:ring-primary"
                />
              </div>

              <div className="flex flex-col gap-1 shrink-0">
                <label className="font-semibold text-slate-400">Role Description</label>
                <input
                  type="text"
                  value={newRoleDesc}
                  onChange={(e) => setNewRoleDesc(e.target.value)}
                  placeholder="Read access with asset logging overrides"
                  className="bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg p-2 focus:outline-none focus:ring-1 focus:ring-primary"
                />
              </div>

              <div className="flex flex-col gap-1 flex-1 overflow-hidden">
                <label className="font-semibold text-slate-400 shrink-0">Assign Role Permissions</label>
                <div className="flex-1 overflow-y-auto scrollbar-thin border border-slate-100 dark:border-slate-800 rounded-lg p-2 bg-slate-50 dark:bg-slate-950 flex flex-col gap-1.5">
                  {permissions.map((p) => {
                    const checked = selectedPermissionIds.includes(p.id);
                    return (
                      <label key={p.id} className="flex items-center gap-2 cursor-pointer text-slate-600 dark:text-slate-350">
                        <input
                          type="checkbox"
                          checked={checked}
                          onChange={() => setSelectedPermissionIds(prev => checked ? prev.filter(pid => pid !== p.id) : [...prev, p.id])}
                          className="rounded text-primary focus:ring-primary"
                        />
                        <span className="font-semibold truncate" title={p.description}>{p.name}</span>
                      </label>
                    );
                  })}
                </div>
              </div>

              <button type="submit" className="w-full py-2 bg-primary hover:bg-primary-dark text-white rounded-lg font-bold shrink-0">
                Register Custom Role
              </button>
            </form>
          </div>
        </div>
      )}

      {/* Tab 3: Access Audit Logs Timeline */}
      {activeConsoleTab === "audit" && (
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-card p-5 shadow-soft flex flex-col h-[520px] overflow-hidden text-xs">
          <h3 className="font-bold text-slate-800 dark:text-white mb-4">IAM Administrative Audit Trail</h3>
          <div className="flex-1 overflow-y-auto pr-1 scrollbar-thin flex flex-col gap-4 relative pl-4 border-l border-slate-100 dark:border-slate-800 ml-2">
            {auditLogs.map((log) => (
              <div key={log.id} className="relative flex flex-col gap-1">
                <span className="absolute -left-[21px] top-1.5 h-2 w-2 rounded-full bg-primary" />
                <div className="flex justify-between font-bold text-slate-700 dark:text-slate-250">
                  <span>Action: {log.action}</span>
                  <span className="text-[10px] text-slate-400 font-medium">{new Date(log.created_at).toLocaleString()}</span>
                </div>
                <p className="text-slate-450 text-[10px] leading-relaxed">{log.details}</p>
              </div>
            ))}
            {auditLogs.length === 0 && (
              <div className="h-full flex flex-col items-center justify-center text-slate-400">
                <Info className="h-8 w-8 text-slate-450 mb-2" />
                No administrative audit logs captured yet.
              </div>
            )}
          </div>
        </div>
      )}

      {/* Create Corporate User Modal */}
      {isAddingUser && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-card p-6 w-full max-w-lg shadow-xl relative animate-in fade-in zoom-in-95 duration-200 text-xs">
            <button onClick={() => setIsAddingUser(false)} className="absolute right-4 top-4 text-slate-400 hover:text-slate-600">
              <X className="h-4 w-4" />
            </button>

            <h3 className="text-sm font-bold text-slate-800 dark:text-white mb-4">Enroll Corporate Employee</h3>
            <form onSubmit={handleCreateUser} className="flex flex-col gap-3">
              <div className="grid grid-cols-2 gap-3">
                <div className="flex flex-col gap-1">
                  <label className="font-semibold text-slate-400">Full Name</label>
                  <input
                    type="text"
                    required
                    value={createUserName}
                    onChange={(e) => setCreateUserName(e.target.value)}
                    placeholder="Carol Danvers"
                    className="bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg p-2 focus:outline-none"
                  />
                </div>
                <div className="flex flex-col gap-1">
                  <label className="font-semibold text-slate-400">Corporate Email</label>
                  <input
                    type="email"
                    required
                    value={createUserEmail}
                    onChange={(e) => setCreateUserEmail(e.target.value)}
                    placeholder="carol.danvers@helpdeskx.com"
                    className="bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg p-2 focus:outline-none"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="flex flex-col gap-1">
                  <label className="font-semibold text-slate-400">Username</label>
                  <input
                    type="text"
                    value={createUserUsername}
                    onChange={(e) => setCreateUserUsername(e.target.value)}
                    placeholder="cdanvers"
                    className="bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg p-2 focus:outline-none"
                  />
                </div>
                <div className="flex flex-col gap-1">
                  <label className="font-semibold text-slate-400">Password</label>
                  <input
                    type="password"
                    required
                    value={createUserPass}
                    onChange={(e) => setCreateUserPass(e.target.value)}
                    placeholder="••••••••"
                    className="bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg p-2 focus:outline-none"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="flex flex-col gap-1">
                  <label className="font-semibold text-slate-400">Security Role</label>
                  <select
                    value={createUserRole}
                    onChange={(e) => setCreateUserRole(e.target.value)}
                    className="bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg p-2"
                  >
                    <option value="">Select Role Group</option>
                    {roles.map((r) => <option key={r.id} value={r.id}>{r.name}</option>)}
                  </select>
                </div>
                <div className="flex flex-col gap-1">
                  <label className="font-semibold text-slate-400">Department</label>
                  <input
                    type="text"
                    value={createUserDept}
                    onChange={(e) => setCreateUserDept(e.target.value)}
                    className="bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg p-2"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="flex flex-col gap-1">
                  <label className="font-semibold text-slate-400">Job Title</label>
                  <input
                    type="text"
                    value={createUserTitle}
                    onChange={(e) => setCreateUserTitle(e.target.value)}
                    className="bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg p-2"
                  />
                </div>
                <div className="flex flex-col gap-1">
                  <label className="font-semibold text-slate-400">Direct Manager</label>
                  <input
                    type="text"
                    value={createUserManager}
                    onChange={(e) => setCreateUserManager(e.target.value)}
                    className="bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg p-2"
                  />
                </div>
              </div>

              <div className="flex flex-col gap-1">
                <label className="font-semibold text-slate-400">Phone</label>
                <input
                  type="text"
                  value={createUserPhone}
                  onChange={(e) => setCreateUserPhone(e.target.value)}
                  placeholder="555-019-998"
                  className="bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg p-2"
                />
              </div>

              <button type="submit" className="w-full mt-2 py-2 bg-primary hover:bg-primary-dark text-white rounded-lg font-bold">
                Enroll Account
              </button>
            </form>
          </div>
        </div>
      )}

      {/* Slide-out IAM User Profile Drawer */}
      {selectedUser && (
        <div className="fixed inset-y-0 right-0 w-full sm:w-[600px] bg-white dark:bg-slate-950 border-l border-slate-200 dark:border-slate-800 shadow-2xl z-40 flex flex-col animate-in slide-in-from-right duration-250 text-xs">
          {/* Drawer Header */}
          <div className="p-4 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between shrink-0">
            <div className="flex items-center gap-3">
              <img src={selectedUser.avatar} className="h-10 w-10 rounded-full" alt="Avatar" />
              <div>
                <h3 className="text-sm font-bold text-slate-800 dark:text-white flex items-center gap-2">
                  {selectedUser.full_name}
                </h3>
                <p className="text-[10px] text-slate-400 mt-0.5">Username: {selectedUser.username || "N/A"}</p>
              </div>
            </div>
            <button
              onClick={() => setSelectedUser(null)}
              className="p-1.5 hover:bg-slate-100 rounded-lg transition-colors text-slate-400 hover:text-slate-650"
            >
              <X className="h-5 w-5" />
            </button>
          </div>

          {/* Drawer Tabs */}
          <div className="px-4 border-b border-slate-100 dark:border-slate-800 flex gap-4 shrink-0 text-slate-400 font-semibold">
            {["overview", "security", "activity"].map((tab) => (
              <button
                key={tab}
                onClick={() => setProfileTab(tab)}
                className={`py-2.5 border-b-2 capitalize transition-colors ${
                  profileTab === tab ? "border-primary text-primary font-bold" : "border-transparent hover:text-slate-700"
                }`}
              >
                {tab}
              </button>
            ))}
          </div>

          {/* Drawer Body */}
          <div className="flex-1 overflow-y-auto p-4 scrollbar-thin">
            {profileTab === "overview" && (
              <div className="flex flex-col gap-4">
                <span className="font-bold text-slate-400 uppercase tracking-wider text-[10px] border-b pb-1">Corporate Details</span>
                <div className="grid grid-cols-2 gap-4">
                  <div className="bg-slate-50 dark:bg-slate-900/40 p-3 rounded-lg">
                    <span className="text-slate-400">Department</span>
                    <p className="font-bold text-slate-700 dark:text-slate-200 mt-1">{selectedUser.department || "N/A"}</p>
                  </div>
                  <div className="bg-slate-50 dark:bg-slate-900/40 p-3 rounded-lg">
                    <span className="text-slate-400">Job Title</span>
                    <p className="font-bold text-slate-700 dark:text-slate-200 mt-1">{selectedUser.job_title || "N/A"}</p>
                  </div>
                  <div className="bg-slate-50 dark:bg-slate-900/40 p-3 rounded-lg">
                    <span className="text-slate-400">Direct Manager</span>
                    <p className="font-bold text-slate-700 dark:text-slate-200 mt-1">{selectedUser.manager || "N/A"}</p>
                  </div>
                  <div className="bg-slate-50 dark:bg-slate-900/40 p-3 rounded-lg">
                    <span className="text-slate-400">Corporate Phone</span>
                    <p className="font-bold text-slate-700 dark:text-slate-200 mt-1">{selectedUser.phone || "N/A"}</p>
                  </div>
                  <div className="bg-slate-50 dark:bg-slate-900/40 p-3 rounded-lg col-span-2">
                    <span className="text-slate-400">Email Address</span>
                    <p className="font-bold text-slate-700 dark:text-slate-200 mt-1">{selectedUser.email}</p>
                  </div>
                </div>
              </div>
            )}

            {profileTab === "security" && (
              <div className="flex flex-col gap-5">
                <span className="font-bold text-slate-400 uppercase tracking-wider text-[10px] border-b pb-1">Privileges & MFA Policies</span>
                <form onSubmit={handleEditSecuritySubmit} className="flex flex-col gap-4">
                  <div className="flex flex-col gap-1">
                    <label className="font-semibold text-slate-400">Assigned Role</label>
                    <select
                      value={editUserRoleId}
                      onChange={(e) => setEditUserRoleId(e.target.value)}
                      className="bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-850 rounded-lg p-2 focus:outline-none"
                    >
                      <option value="">Inherit default Viewer role</option>
                      {roles.map((r) => <option key={r.id} value={r.id}>{r.name}</option>)}
                    </select>
                  </div>

                  <div className="flex flex-col gap-1">
                    <label className="font-semibold text-slate-400">Account status</label>
                    <select
                      value={editUserStatus}
                      onChange={(e) => setEditUserStatus(e.target.value)}
                      className="bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-850 rounded-lg p-2 focus:outline-none"
                    >
                      <option value="Active">Active</option>
                      <option value="Suspended">Suspended</option>
                      <option value="Lockout">Lockout</option>
                    </select>
                  </div>

                  <div className="flex items-center gap-2 mt-2">
                    <input
                      type="checkbox"
                      id="mfa"
                      checked={editUserMfa}
                      onChange={() => setEditUserMfa(!editUserMfa)}
                      className="rounded text-primary focus:ring-primary"
                    />
                    <label htmlFor="mfa" className="font-semibold text-slate-700 dark:text-slate-200 cursor-pointer">
                      Enforce MFA Security Protocol (TOTP Authenticator Ready)
                    </label>
                  </div>

                  <button type="submit" className="w-full mt-2 py-2 bg-primary hover:bg-primary-dark text-white rounded-lg font-bold">
                    Update Security Policy
                  </button>
                </form>

                {/* Permissions Assigned Overview */}
                <div className="mt-2 flex flex-col gap-2">
                  <span className="font-bold text-slate-400 uppercase tracking-wider text-[10px]">Inherited Role Permissions</span>
                  <div className="flex flex-wrap gap-1.5">
                    {(selectedUser.role_detail?.permissions || []).map((p: any) => (
                      <span key={p.id} className="px-2 py-0.5 bg-primary/10 text-primary border border-primary/10 rounded-full text-[10px] font-semibold">
                        {p.name}
                      </span>
                    ))}
                    {(selectedUser.role_detail?.permissions || []).length === 0 && (
                      <span className="text-slate-400">No security permissions inherited. Default viewer mapping.</span>
                    )}
                  </div>
                </div>
              </div>
            )}

            {profileTab === "activity" && (
              <div className="flex flex-col gap-3">
                <span className="font-bold text-slate-400 uppercase tracking-wider text-[10px] border-b pb-1">Activity Log</span>
                <div className="flex flex-col gap-3 relative pl-3 border-l border-slate-100 dark:border-slate-800 ml-1">
                  {auditLogs.filter(l => l.user_id === selectedUser.id).map((log) => (
                    <div key={log.id} className="relative flex flex-col gap-0.5">
                      <span className="absolute -left-[16px] top-1.5 h-1.5 w-1.5 rounded-full bg-slate-400" />
                      <div className="flex justify-between font-bold text-slate-750">
                        <span>{log.action}</span>
                        <span className="text-[9px] text-slate-450 font-medium">{new Date(log.created_at).toLocaleDateString()}</span>
                      </div>
                      <p className="text-[10px] text-slate-400 leading-relaxed">{log.details}</p>
                    </div>
                  ))}
                  {auditLogs.filter(l => l.user_id === selectedUser.id).length === 0 && (
                    <div className="text-center py-6 text-slate-400">No activity logs recorded for this employee profile.</div>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
