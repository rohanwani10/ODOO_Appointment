"use client";

import { useEffect, useState } from "react";
import { apiFetch } from "@/lib/api";
import { AdminUsersResponse, User, UserRole } from "@/types/user";

const roleOptions: UserRole[] = ["CUSTOMER", "ORGANIZER", "ADMIN"];

export default function AdminDashboard() {
  const [data, setData] = useState<AdminUsersResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [roleByUser, setRoleByUser] = useState<Record<number, UserRole>>({});
  const [savingUserId, setSavingUserId] = useState<number | null>(null);

  const fetchUsers = async () => {
    setLoading(true);
    setError("");

    try {
      const response = await apiFetch<AdminUsersResponse>("/api/admin/users", {
        params: { skip: "0", limit: "50" },
      });

      setData(response);
      setRoleByUser(
        response.users.reduce<Record<number, UserRole>>((accumulator, user) => {
          accumulator[user.id] = user.roles[0] || "CUSTOMER";
          return accumulator;
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
    setError("");

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
    setError("");

    try {
      await apiFetch(`/api/admin/users/${userId}/roles/${role}`, {
        method: "DELETE",
      });
      await fetchUsers();
    } catch (err: any) {
      setError(err.message || "Failed to remove role.");
    } finally {
      setSavingUserId(null);
    }
  };

  const deleteUser = async (user: User) => {
    if (!window.confirm(`Delete ${user.email}? This is a soft delete.`)) {
      return;
    }

    setSavingUserId(user.id);
    setError("");

    try {
      await apiFetch(`/api/admin/users/${user.id}`, {
        method: "DELETE",
      });
      await fetchUsers();
    } catch (err: any) {
      setError(err.message || "Failed to delete user.");
    } finally {
      setSavingUserId(null);
    }
  };

  return (
    <div className="space-y-6">
      <section className="rounded-3xl border border-white/10 bg-white/5 p-8 backdrop-blur">
        <p className="text-xs uppercase tracking-[0.25em] text-amber-200/80">
          Admin
        </p>
        <h1 className="mt-2 text-3xl font-semibold tracking-tight text-white">
          User management
        </h1>
        <p className="mt-2 max-w-2xl text-slate-300">
          Manage account roles and deactivate users from the current backend.
        </p>
      </section>

      {error && (
        <div className="rounded-2xl border border-red-400/20 bg-red-500/10 p-4 text-sm text-red-100">
          {error}
        </div>
      )}

      {loading ? (
        <div className="rounded-3xl border border-white/10 bg-slate-950/70 p-8 text-slate-300">
          Loading users...
        </div>
      ) : (
        <div className="overflow-hidden rounded-3xl border border-white/10 bg-slate-950/70">
          <div className="border-b border-white/10 px-6 py-4 text-sm text-slate-300">
            {data?.total || 0} users loaded
          </div>
          <div className="divide-y divide-white/10">
            {data?.users.map((user) => {
              const selectedRole = roleByUser[user.id] || "CUSTOMER";

              return (
                <div
                  key={user.id}
                  className="grid gap-4 px-6 py-5 lg:grid-cols-[1.4fr_0.8fr_1fr_auto] lg:items-center"
                >
                  <div>
                    <p className="font-semibold text-white">
                      {user.first_name} {user.last_name}
                    </p>
                    <p className="text-sm text-slate-400">{user.email}</p>
                    <p className="text-xs text-slate-500">ID {user.id}</p>
                  </div>

                  <div>
                    <p className="text-xs uppercase tracking-[0.2em] text-slate-500">
                      Status
                    </p>
                    <p className="mt-1 text-sm text-slate-200">
                      {user.is_active ? "Active" : "Inactive"} /{" "}
                      {user.is_verified ? "Verified" : "Unverified"}
                    </p>
                  </div>

                  <div>
                    <p className="text-xs uppercase tracking-[0.2em] text-slate-500">
                      Roles
                    </p>
                    <div className="mt-2 flex flex-wrap gap-2">
                      {user.roles.map((role) => (
                        <span
                          key={role}
                          className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs text-white"
                        >
                          {role}
                        </span>
                      ))}
                    </div>
                  </div>

                  <div className="flex flex-wrap gap-2 lg:justify-end">
                    <select
                      value={selectedRole}
                      onChange={(event) =>
                        setRoleByUser((current) => ({
                          ...current,
                          [user.id]: event.target.value as UserRole,
                        }))
                      }
                      className="rounded-full border border-white/10 bg-slate-900 px-3 py-2 text-sm text-white outline-none"
                    >
                      {roleOptions.map((role) => (
                        <option key={role} value={role}>
                          {role}
                        </option>
                      ))}
                    </select>
                    <button
                      onClick={() => assignRole(user.id, selectedRole)}
                      disabled={savingUserId === user.id}
                      className="rounded-full bg-sky-400 px-3 py-2 text-sm font-semibold text-slate-950 transition-colors hover:bg-sky-300 disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      Add role
                    </button>
                    {user.roles.map((role) => (
                      <button
                        key={role}
                        onClick={() => removeRole(user.id, role)}
                        disabled={savingUserId === user.id}
                        className="rounded-full border border-white/10 px-3 py-2 text-sm text-white/80 transition-colors hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-60"
                      >
                        Remove {role}
                      </button>
                    ))}
                    <button
                      onClick={() => deleteUser(user)}
                      disabled={savingUserId === user.id}
                      className="rounded-full border border-red-400/20 bg-red-500/10 px-3 py-2 text-sm text-red-100 transition-colors hover:bg-red-500/20 disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      Delete
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
