"use client";

import { useEffect, useState } from "react";
import { apiFetch } from "@/lib/api";
import { AdminUsersResponse, User, UserRole } from "@/types/user";
import { motion, AnimatePresence } from "framer-motion";
import { 
  ShieldCheck, 
  UserPlus, 
  Trash2, 
  UserCheck, 
  Filter, 
  Search,
  MoreVertical,
  Activity,
  ArrowUpRight
} from "lucide-react";
import { cn } from "@/lib/utils";

const roleOptions: UserRole[] = ["CUSTOMER", "ORGANIZER", "ADMIN"];

const roleColors: Record<string, string> = {
  ADMIN: "text-amber-400 bg-amber-400/10 border-amber-400/20",
  ORGANIZER: "text-indigo-400 bg-indigo-400/10 border-indigo-400/20",
  CUSTOMER: "text-sky-400 bg-sky-400/10 border-sky-400/20",
};

export default function AdminDashboard() {
  const [data, setData] = useState<AdminUsersResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [roleByUser, setRoleByUser] = useState<Record<number, UserRole>>({});
  const [savingUserId, setSavingUserId] = useState<number | null>(null);

  const fetchUsers = async () => {
    setLoading(true);
    try {
      const response = await apiFetch<AdminUsersResponse>("/api/admin/users", {
        params: { skip: "0", limit: "50" },
      });
      setData(response);
      setRoleByUser(
        response.users.reduce<Record<number, UserRole>>((acc, user) => {
          acc[user.id] = user.roles[0] || "CUSTOMER";
          return acc;
        }, {}),
      );
    } catch (err: any) {
      setError(err.message || "Failed to load users.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchUsers();
  }, []);

  const assignRole = async (userId: number, role: UserRole) => {
    setSavingUserId(userId);
    try {
      await apiFetch(`/api/admin/users/${userId}/roles`, {
        method: "POST",
        body: JSON.stringify({ role }),
      });
      await fetchUsers();
    } catch (err: any) {
      setError(err.message || "Failed to assign role.");
    } finally {
      setSavingUserId(null);
    }
  };

  const removeRole = async (userId: number, role: UserRole) => {
    setSavingUserId(userId);
    try {
      await apiFetch(`/api/admin/users/${userId}/roles/${role}`, { method: "DELETE" });
      await fetchUsers();
    } catch (err: any) {
      setError(err.message || "Failed to remove role.");
    } finally {
      setSavingUserId(null);
    }
  };

  const deleteUser = async (user: User) => {
    if (!window.confirm(`Delete ${user.email}?`)) return;
    setSavingUserId(user.id);
    try {
      await apiFetch(`/api/admin/users/${user.id}`, { method: "DELETE" });
      await fetchUsers();
    } catch (err: any) {
      setError(err.message || "Failed to delete user.");
    } finally {
      setSavingUserId(null);
    }
  };

  return (
    <div className="space-y-10">
      {/* Page Header */}
      <motion.section 
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        className="glass-premium rounded-[40px] p-10"
      >
        <div className="flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
          <div className="space-y-2">
            <div className="flex items-center gap-2 text-amber-400 font-bold uppercase tracking-widest text-[10px]">
              <ShieldCheck className="size-3.5" />
              Administrative Command
            </div>
            <h1 className="text-gradient text-4xl font-bold tracking-tight">
              User Intelligence
            </h1>
            <p className="text-slate-400 max-w-xl">
              Monitor account health, manage global roles, and govern the Calvero platform ecosystem.
            </p>
          </div>
          
          <div className="flex items-center gap-3">
             <div className="glass flex items-center gap-3 rounded-2xl px-4 py-2 border-white/5">
                <Search className="size-4 text-slate-500" />
                <input className="bg-transparent outline-none text-sm text-white placeholder:text-slate-600 w-32 focus:w-48 transition-all" placeholder="Search accounts..." />
             </div>
             <button className="glass size-10 flex items-center justify-center rounded-2xl border-white/5 text-slate-400 hover:text-white transition-colors">
                <Filter className="size-4" />
             </button>
          </div>
        </div>
      </motion.section>

      {error && (
        <div className="rounded-[32px] border border-rose-500/20 bg-rose-500/10 p-6 text-sm font-medium text-rose-200">
          {error}
        </div>
      )}

      {loading ? (
        <div className="flex h-64 items-center justify-center">
          <motion.div animate={{ rotate: 360 }} transition={{ duration: 1, repeat: Infinity, ease: "linear" }} className="size-10 rounded-full border-t-2 border-amber-400" />
        </div>
      ) : (
        <div className="glass overflow-hidden rounded-[40px] border border-white/5">
          <div className="flex items-center justify-between border-b border-white/5 px-8 py-6">
            <div className="flex items-center gap-3">
              <Activity className="size-4 text-amber-400" />
              <span className="text-sm font-bold text-white uppercase tracking-widest">{data?.total || 0} Registered Entities</span>
            </div>
            <button className="text-xs font-bold text-primary hover:underline uppercase tracking-widest">Export Dataset</button>
          </div>

          <div className="divide-y divide-white/5">
            <AnimatePresence>
              {data?.users.map((user, i) => {
                const selectedRole = roleByUser[user.id] || "CUSTOMER";
                return (
                  <motion.div
                    layout
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ delay: i * 0.03 }}
                    key={user.id}
                    className="group flex flex-col gap-6 px-8 py-8 lg:flex-row lg:items-center hover:bg-white/[0.02] transition-all"
                  >
                    <div className="flex-1">
                      <div className="flex items-center gap-3 mb-1">
                        <h3 className="text-lg font-bold text-white">
                          {user.first_name} {user.last_name}
                        </h3>
                        <span className={cn("rounded-full px-3 py-0.5 text-[9px] font-bold uppercase tracking-tighter", user.is_active ? "text-emerald-400 bg-emerald-400/10" : "text-slate-500 bg-white/5")}>
                          {user.is_active ? "Active" : "Disabled"}
                        </span>
                      </div>
                      <p className="text-sm text-slate-500 flex items-center gap-2">
                        {user.email} 
                        <span className="size-1 rounded-full bg-slate-800" />
                        <span className="text-[10px] font-mono uppercase tracking-widest opacity-50">UID {user.id}</span>
                      </p>
                    </div>

                    <div className="flex flex-wrap items-center gap-2">
                      {user.roles.map((role) => (
                        <span key={role} className={cn("rounded-full border px-3 py-0.5 text-[10px] font-bold uppercase tracking-widest", roleColors[role])}>
                          {role}
                        </span>
                      ))}
                    </div>

                    <div className="flex flex-wrap items-center gap-3 lg:ml-auto">
                      <select
                        value={selectedRole}
                        onChange={(e) => setRoleByUser((c) => ({ ...c, [user.id]: e.target.value as UserRole }))}
                        className="glass h-10 rounded-xl border-white/5 bg-slate-900 px-4 text-xs font-bold text-white outline-none focus:border-amber-400/50"
                      >
                        {roleOptions.map((r) => <option key={r} value={r}>{r}</option>)}
                      </select>

                      <button
                        onClick={() => assignRole(user.id, selectedRole)}
                        disabled={savingUserId === user.id}
                        className="glass flex size-10 items-center justify-center rounded-xl border-white/5 text-amber-400 hover:bg-amber-400 hover:text-slate-950 transition-all disabled:opacity-30"
                      >
                        <UserPlus className="size-4" />
                      </button>

                      <button
                        onClick={() => deleteUser(user)}
                        disabled={savingUserId === user.id}
                        className="glass flex size-10 items-center justify-center rounded-xl border-white/5 text-rose-500 hover:bg-rose-500 hover:text-white transition-all"
                      >
                        <Trash2 className="size-4" />
                      </button>
                      
                      <div className="size-10 flex items-center justify-center rounded-xl text-slate-600 hover:text-white cursor-pointer transition-colors">
                        <MoreVertical className="size-4" />
                      </div>
                    </div>
                  </motion.div>
                );
              })}
            </AnimatePresence>
          </div>
        </div>
      )}
    </div>
  );
}
