import React, { useState, useEffect } from "react";
import { api } from "../services/api";
import { Plus, Trash2, Briefcase } from "lucide-react";

export default function Departments() {
  const [departments, setDepartments] = useState<any[]>([]);
  const [orgs, setOrgs] = useState<any[]>([]);
  const [name, setName] = useState("");
  const [selectedOrgId, setSelectedOrgId] = useState("");
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [loading, setLoading] = useState(false);

  const userRole = localStorage.getItem("role") || "EMPLOYEE";

  const fetchData = async () => {
    try {
      setLoading(true);
      const deptData: any = await api.get("/departments");
      setDepartments(deptData || []);

      if (userRole === "SUPER_ADMIN") {
        const orgData: any = await api.get("/organizations");
        setOrgs(orgData || []);
      }
      setError("");
    } catch (err: any) {
      setError(err.message || "Failed to load departments data");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;

    try {
      const payload: any = { name };
      if (userRole === "SUPER_ADMIN") {
        if (!selectedOrgId) {
          setError("Please select an organization");
          return;
        }
        payload.organization_id = parseInt(selectedOrgId);
      }
      await api.post("/departments", payload);
      setName("");
      setSelectedOrgId("");
      setSuccess("Department created successfully!");
      fetchData();
      setTimeout(() => setSuccess(""), 4000);
    } catch (err: any) {
      setError(err.message || "Failed to create department");
    }
  };

  const handleDelete = async (id: number) => {
    if (!window.confirm("Are you sure you want to delete this department?")) return;
    try {
      await api.delete(`/departments/${id}`);
      setSuccess("Department deleted successfully!");
      fetchData();
      setTimeout(() => setSuccess(""), 4000);
    } catch (err: any) {
      setError(err.message || "Failed to delete department");
    }
  };

  return (
    <div className="p-8 max-w-7xl mx-auto font-sans text-slate-800 dark:text-slate-200">
      <div className="flex justify-between items-center mb-8">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Departments</h1>
          <p className="text-slate-500 dark:text-slate-400 mt-1">
            Define organizational boundaries for ticket workflows and department-based dashboards.
          </p>
        </div>
        <Briefcase className="h-10 w-10 text-primary opacity-75" />
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

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Create Form */}
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 shadow-sm h-fit">
          <h2 className="text-xl font-bold mb-4">Add Department</h2>
          <form onSubmit={handleCreate} className="space-y-4">
            <div>
              <label className="block text-sm font-semibold mb-2">Department Name</label>
              <input
                type="text"
                placeholder="e.g. Finance Operations"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full px-4 py-3 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 focus:outline-none focus:border-primary transition-colors text-sm"
                required
              />
            </div>

            {userRole === "SUPER_ADMIN" && (
              <div>
                <label className="block text-sm font-semibold mb-2">Assign Organization</label>
                <select
                  value={selectedOrgId}
                  onChange={(e) => setSelectedOrgId(e.target.value)}
                  className="w-full px-4 py-3 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 focus:outline-none focus:border-primary transition-colors text-sm"
                  required
                >
                  <option value="">Select Organization</option>
                  {orgs.map((o) => (
                    <option key={o.id} value={o.id}>
                      {o.name}
                    </option>
                  ))}
                </select>
              </div>
            )}

            <button
              type="submit"
              className="w-full flex items-center justify-center gap-2 py-3 px-4 bg-primary text-white font-semibold rounded-xl hover:bg-primary/95 transition-colors text-sm shadow-md shadow-primary/10"
            >
              <Plus className="h-4 w-4" />
              Add Department
            </button>
          </form>
        </div>

        {/* List Table */}
        <div className="lg:col-span-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl overflow-hidden shadow-sm">
          <div className="px-6 py-4 border-b border-slate-200 dark:border-slate-800 flex justify-between items-center">
            <h2 className="text-lg font-bold">Active Departments</h2>
            <span className="bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 text-xs px-2.5 py-1 rounded-full font-semibold">
              {departments.length} total
            </span>
          </div>

          {loading ? (
            <div className="p-12 text-center text-slate-500 dark:text-slate-400 text-sm">
              Loading departments...
            </div>
          ) : departments.length === 0 ? (
            <div className="p-12 text-center text-slate-500 dark:text-slate-400 text-sm">
              No departments registered yet.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full border-collapse text-left">
                <thead>
                  <tr className="bg-slate-50/75 dark:bg-slate-950/50 text-slate-500 dark:text-slate-400 text-xs uppercase font-bold border-b border-slate-200 dark:border-slate-800">
                    <th className="px-6 py-4">Department Name</th>
                    {userRole === "SUPER_ADMIN" && <th className="px-6 py-4">Organization</th>}
                    <th className="px-6 py-4">Created At</th>
                    <th className="px-6 py-4 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-150 dark:divide-slate-850 text-sm">
                  {departments.map((d) => (
                    <tr key={d.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-950/20 transition-colors">
                      <td className="px-6 py-4 font-bold">{d.name}</td>
                      {userRole === "SUPER_ADMIN" && (
                        <td className="px-6 py-4 text-slate-600 dark:text-slate-350">
                          {d.organization?.name || "N/A"}
                        </td>
                      )}
                      <td className="px-6 py-4 text-slate-500 dark:text-slate-400 text-xs">
                        {new Date(d.created_at).toLocaleDateString()}
                      </td>
                      <td className="px-6 py-4 text-right">
                        <button
                          onClick={() => handleDelete(d.id)}
                          className="p-2 text-red-500 hover:text-red-700 hover:bg-red-50 dark:hover:bg-red-950/25 rounded-xl transition-all"
                          title="Delete Department"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
