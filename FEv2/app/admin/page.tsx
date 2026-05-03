"use client";

import { useEffect, useState } from "react";
import { RequireAuth } from "@/components/require-auth";
import { apiFetch } from "@/lib/api";
import { formatDateTime } from "@/lib/format";
import type {
  AdminDashboard,
  AdminSystemMetrics,
  AdminUsersResponse,
  AuditLogItem,
  Organization,
  Resource,
  RevenueResponse,
  User,
  UserRole,
} from "@/lib/types";

export default function AdminPage() {
  const [dashboard, setDashboard] = useState<AdminDashboard | null>(null);
  const [systemMetrics, setSystemMetrics] = useState<AdminSystemMetrics | null>(null);
  const [revenue, setRevenue] = useState<RevenueResponse | null>(null);
  const [users, setUsers] = useState<AdminUsersResponse | null>(null);
  const [organizations, setOrganizations] = useState<Organization[]>([]);
  const [providers, setProviders] = useState<Resource[]>([]);
  const [auditLogs, setAuditLogs] = useState<AuditLogItem[]>([]);
  const [selectedUserId, setSelectedUserId] = useState<number | null>(null);
  const [selectedOrganizationId, setSelectedOrganizationId] = useState<number | null>(null);
  const [selectedProviderId, setSelectedProviderId] = useState<number | null>(null);
  const [userDetail, setUserDetail] = useState<User | null>(null);
  const [userForm, setUserForm] = useState({
    first_name: "",
    last_name: "",
    phone: "",
    is_active: true,
  });
  const [roleToAssign, setRoleToAssign] = useState<UserRole>("ORGANIZER");
  const [organizationCreateForm, setOrganizationCreateForm] = useState({
    name: "",
    description: "",
    admin_user_id: "",
    logo_url: "",
  });
  const [organizationEditForm, setOrganizationEditForm] = useState({
    name: "",
    description: "",
    admin_user_id: "",
    logo_url: "",
  });
  const [providerForm, setProviderForm] = useState({
    name: "",
    description: "",
    capacity: "1",
    is_active: true,
  });
  const [auditFilters, setAuditFilters] = useState({
    entity_type: "",
    action: "",
    skip: "0",
    limit: "50",
  });
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const selectedOrganization =
    organizations.find((organization) => organization.id === selectedOrganizationId) ?? null;
  const selectedProvider =
    providers.find((provider) => provider.id === selectedProviderId) ?? null;

  async function loadAuditData(filters = auditFilters) {
    const logs = await apiFetch<AuditLogItem[]>("/api/admin/reports/audit-logs", {
      params: {
        entity_type: filters.entity_type || undefined,
        action: filters.action || undefined,
        skip: filters.skip,
        limit: filters.limit,
      },
    });
    setAuditLogs(logs);
  }

  async function loadAdminData() {
    setError(null);
    try {
      const [
        dashboardData,
        metricsData,
        revenueData,
        usersData,
        organizationsData,
        providersData,
      ] = await Promise.all([
        apiFetch<AdminDashboard>("/api/admin/dashboard"),
        apiFetch<AdminSystemMetrics>("/api/admin/reports/system-metrics"),
        apiFetch<RevenueResponse>("/api/admin/reports/revenue"),
        apiFetch<AdminUsersResponse>("/api/admin/users", {
          params: {
            limit: "100",
          },
        }),
        apiFetch<Organization[]>("/api/admin/organizations"),
        apiFetch<Resource[]>("/api/admin/providers"),
      ]);

      setDashboard(dashboardData);
      setSystemMetrics(metricsData);
      setRevenue(revenueData);
      setUsers(usersData);
      setOrganizations(organizationsData);
      setProviders(providersData);
      setSelectedUserId((current) => current ?? usersData.users[0]?.id ?? null);
      setSelectedOrganizationId((current) => current ?? organizationsData[0]?.id ?? null);
      setSelectedProviderId((current) => current ?? providersData[0]?.id ?? null);
      await loadAuditData();
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Unable to load admin data");
    }
  }

  async function loadUserDetail(userId: number) {
    const detail = await apiFetch<User>(`/api/admin/users/${userId}`);
    setUserDetail(detail);
    setUserForm({
      first_name: detail.first_name,
      last_name: detail.last_name,
      phone: detail.phone || "",
      is_active: detail.is_active,
    });
  }

  useEffect(() => {
    void loadAdminData();
  }, []);

  useEffect(() => {
    if (!selectedUserId) {
      setUserDetail(null);
      return;
    }

    void loadUserDetail(selectedUserId);
  }, [selectedUserId]);

  useEffect(() => {
    if (!selectedOrganization) {
      return;
    }

    setOrganizationEditForm({
      name: selectedOrganization.name,
      description: selectedOrganization.description || "",
      admin_user_id: String(selectedOrganization.admin_user_id),
      logo_url: selectedOrganization.logo_url || "",
    });
  }, [selectedOrganization]);

  useEffect(() => {
    if (!selectedProvider) {
      return;
    }

    setProviderForm({
      name: selectedProvider.name,
      description: selectedProvider.description || "",
      capacity: String(selectedProvider.capacity),
      is_active: selectedProvider.is_active,
    });
  }, [selectedProvider]);

  async function handleUserUpdate(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!selectedUserId) {
      return;
    }

    setError(null);
    setMessage(null);

    try {
      await apiFetch(`/api/admin/users/${selectedUserId}`, {
        method: "PUT",
        body: JSON.stringify({
          first_name: userForm.first_name,
          last_name: userForm.last_name,
          phone: userForm.phone || null,
          is_active: userForm.is_active,
        }),
      });
      setMessage("User updated.");
      await loadAdminData();
      await loadUserDetail(selectedUserId);
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : "Unable to update user");
    }
  }

  async function handleAssignRole() {
    if (!selectedUserId) {
      return;
    }

    setError(null);
    setMessage(null);

    try {
      await apiFetch(`/api/admin/users/${selectedUserId}/roles`, {
        method: "POST",
        body: JSON.stringify({
          role: roleToAssign,
        }),
      });
      setMessage(`Role ${roleToAssign} assigned.`);
      await loadAdminData();
      await loadUserDetail(selectedUserId);
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : "Unable to assign role");
    }
  }

  async function handleRemoveRole(role: string) {
    if (!selectedUserId) {
      return;
    }

    setError(null);
    setMessage(null);

    try {
      await apiFetch(`/api/admin/users/${selectedUserId}/roles/${role}`, {
        method: "DELETE",
      });
      setMessage(`Role ${role} removed.`);
      await loadAdminData();
      await loadUserDetail(selectedUserId);
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : "Unable to remove role");
    }
  }

  async function handleDeleteUser() {
    if (!selectedUserId || !window.confirm("Delete this user?")) {
      return;
    }

    setError(null);
    setMessage(null);

    try {
      await apiFetch(`/api/admin/users/${selectedUserId}`, {
        method: "DELETE",
      });
      setMessage("User deleted.");
      setSelectedUserId(null);
      await loadAdminData();
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : "Unable to delete user");
    }
  }

  async function handleCreateOrganization(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setMessage(null);

    try {
      await apiFetch("/api/admin/organizations", {
        method: "POST",
        body: JSON.stringify({
          name: organizationCreateForm.name,
          description: organizationCreateForm.description || null,
          admin_user_id: organizationCreateForm.admin_user_id
            ? Number(organizationCreateForm.admin_user_id)
            : null,
          logo_url: organizationCreateForm.logo_url || null,
        }),
      });
      setMessage("Organization created.");
      setOrganizationCreateForm({
        name: "",
        description: "",
        admin_user_id: "",
        logo_url: "",
      });
      await loadAdminData();
    } catch (submitError) {
      setError(
        submitError instanceof Error ? submitError.message : "Unable to create organization",
      );
    }
  }

  async function handleUpdateOrganization(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!selectedOrganizationId) {
      return;
    }

    setError(null);
    setMessage(null);

    try {
      await apiFetch(`/api/admin/organizations/${selectedOrganizationId}`, {
        method: "PUT",
        body: JSON.stringify({
          name: organizationEditForm.name,
          description: organizationEditForm.description || null,
          admin_user_id: Number(organizationEditForm.admin_user_id),
          logo_url: organizationEditForm.logo_url || null,
        }),
      });
      setMessage("Organization updated.");
      await loadAdminData();
    } catch (submitError) {
      setError(
        submitError instanceof Error ? submitError.message : "Unable to update organization",
      );
    }
  }

  async function handleDeleteOrganization() {
    if (!selectedOrganizationId || !window.confirm("Delete this organization?")) {
      return;
    }

    setError(null);
    setMessage(null);

    try {
      await apiFetch(`/api/admin/organizations/${selectedOrganizationId}`, {
        method: "DELETE",
      });
      setMessage("Organization deleted.");
      setSelectedOrganizationId(null);
      await loadAdminData();
    } catch (submitError) {
      setError(
        submitError instanceof Error ? submitError.message : "Unable to delete organization",
      );
    }
  }

  async function handleUpdateProvider(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!selectedProviderId) {
      return;
    }

    setError(null);
    setMessage(null);

    try {
      await apiFetch(`/api/admin/providers/${selectedProviderId}`, {
        method: "PUT",
        body: JSON.stringify({
          name: providerForm.name,
          description: providerForm.description || null,
          capacity: Number(providerForm.capacity),
          is_active: providerForm.is_active,
        }),
      });
      setMessage("Provider updated.");
      await loadAdminData();
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : "Unable to update provider");
    }
  }

  async function handleReloadAuditLogs(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setMessage(null);

    try {
      await loadAuditData();
      setMessage("Audit logs refreshed.");
    } catch (submitError) {
      setError(
        submitError instanceof Error ? submitError.message : "Unable to load audit logs",
      );
    }
  }

  return (
    <RequireAuth allowedRoles={["ADMIN"]}>
      <div className="page">
        <section className="panel">
          <h1>Admin</h1>
          <p>Manage users, organizations, providers, and system reports.</p>
          {error ? <p className="error">{error}</p> : null}
          {message ? <p className="success">{message}</p> : null}
        </section>

        <section className="grid three">
          <div className="panel">
            <h2>Users</h2>
            <p>{dashboard?.total_users ?? "-"}</p>
          </div>
          <div className="panel">
            <h2>Organizations</h2>
            <p>{dashboard?.total_organizations ?? "-"}</p>
          </div>
          <div className="panel">
            <h2>Appointments</h2>
            <p>{dashboard?.total_appointments ?? "-"}</p>
          </div>
          <div className="panel">
            <h2>Services</h2>
            <p>{dashboard?.total_services ?? "-"}</p>
          </div>
          <div className="panel">
            <h2>Providers</h2>
            <p>{dashboard?.total_providers ?? "-"}</p>
          </div>
          <div className="panel">
            <h2>Estimated revenue</h2>
            <p>{revenue?.revenue ?? 0}</p>
          </div>
        </section>

        <section className="grid two">
          <div className="panel">
            <h2>Users</h2>
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>ID</th>
                    <th>Name</th>
                    <th>Email</th>
                    <th>Roles</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {(users?.users ?? []).map((user) => (
                    <tr key={user.id}>
                      <td>{user.id}</td>
                      <td>
                        {user.first_name} {user.last_name}
                      </td>
                      <td>{user.email}</td>
                      <td>{user.roles.join(", ")}</td>
                      <td>
                        <button type="button" onClick={() => setSelectedUserId(user.id)}>
                          Manage
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          <div className="panel">
            <h2>User management</h2>
            {!userDetail ? <p>Select a user to manage.</p> : null}
            {userDetail ? (
              <>
                <p>
                  Managing user #{userDetail.id}: {userDetail.email}
                </p>
                <form className="form" onSubmit={handleUserUpdate}>
                  <label className="field">
                    <span>First name</span>
                    <input
                      value={userForm.first_name}
                      onChange={(event) =>
                        setUserForm((current) => ({
                          ...current,
                          first_name: event.target.value,
                        }))
                      }
                      required
                    />
                  </label>
                  <label className="field">
                    <span>Last name</span>
                    <input
                      value={userForm.last_name}
                      onChange={(event) =>
                        setUserForm((current) => ({
                          ...current,
                          last_name: event.target.value,
                        }))
                      }
                      required
                    />
                  </label>
                  <label className="field">
                    <span>Phone</span>
                    <input
                      value={userForm.phone}
                      onChange={(event) =>
                        setUserForm((current) => ({
                          ...current,
                          phone: event.target.value,
                        }))
                      }
                    />
                  </label>
                  <label className="field">
                    <span>
                      <input
                        type="checkbox"
                        checked={userForm.is_active}
                        onChange={(event) =>
                          setUserForm((current) => ({
                            ...current,
                            is_active: event.target.checked,
                          }))
                        }
                      />{" "}
                      User is active
                    </span>
                  </label>
                  <button type="submit">Save user</button>
                </form>
                <div className="field">
                  <span>Assign role</span>
                  <div className="actions">
                    <select
                      value={roleToAssign}
                      onChange={(event) => setRoleToAssign(event.target.value as UserRole)}
                    >
                      <option value="CUSTOMER">CUSTOMER</option>
                      <option value="ORGANIZER">ORGANIZER</option>
                      <option value="ADMIN">ADMIN</option>
                    </select>
                    <button type="button" onClick={() => void handleAssignRole()}>
                      Assign role
                    </button>
                  </div>
                </div>
                <div className="list">
                  {userDetail.roles.map((role) => (
                    <article key={role} className="item">
                      <p>{role}</p>
                      <button type="button" onClick={() => void handleRemoveRole(role)}>
                        Remove role
                      </button>
                    </article>
                  ))}
                </div>
                <button type="button" onClick={() => void handleDeleteUser()}>
                  Delete user
                </button>
              </>
            ) : null}
          </div>
        </section>

        <section className="grid two">
          <div className="panel">
            <h2>Create organization</h2>
            <form className="form" onSubmit={handleCreateOrganization}>
              <label className="field">
                <span>Name</span>
                <input
                  value={organizationCreateForm.name}
                  onChange={(event) =>
                    setOrganizationCreateForm((current) => ({
                      ...current,
                      name: event.target.value,
                    }))
                  }
                  required
                />
              </label>
              <label className="field">
                <span>Description</span>
                <textarea
                  value={organizationCreateForm.description}
                  onChange={(event) =>
                    setOrganizationCreateForm((current) => ({
                      ...current,
                      description: event.target.value,
                    }))
                  }
                />
              </label>
              <label className="field">
                <span>Admin user ID</span>
                <input
                  type="number"
                  min="1"
                  value={organizationCreateForm.admin_user_id}
                  onChange={(event) =>
                    setOrganizationCreateForm((current) => ({
                      ...current,
                      admin_user_id: event.target.value,
                    }))
                  }
                />
              </label>
              <label className="field">
                <span>Logo URL</span>
                <input
                  value={organizationCreateForm.logo_url}
                  onChange={(event) =>
                    setOrganizationCreateForm((current) => ({
                      ...current,
                      logo_url: event.target.value,
                    }))
                  }
                />
              </label>
              <button type="submit">Create organization</button>
            </form>
          </div>

          <div className="panel">
            <h2>Manage organization</h2>
            <label className="field">
              <span>Select organization</span>
              <select
                value={selectedOrganizationId ?? ""}
                onChange={(event) => setSelectedOrganizationId(Number(event.target.value))}
              >
                <option value="">Select organization</option>
                {organizations.map((organization) => (
                  <option key={organization.id} value={organization.id}>
                    {organization.name}
                  </option>
                ))}
              </select>
            </label>
            {selectedOrganization ? (
              <form className="form" onSubmit={handleUpdateOrganization}>
                <label className="field">
                  <span>Name</span>
                  <input
                    value={organizationEditForm.name}
                    onChange={(event) =>
                      setOrganizationEditForm((current) => ({
                        ...current,
                        name: event.target.value,
                      }))
                    }
                    required
                  />
                </label>
                <label className="field">
                  <span>Description</span>
                  <textarea
                    value={organizationEditForm.description}
                    onChange={(event) =>
                      setOrganizationEditForm((current) => ({
                        ...current,
                        description: event.target.value,
                      }))
                    }
                  />
                </label>
                <label className="field">
                  <span>Admin user ID</span>
                  <input
                    type="number"
                    min="1"
                    value={organizationEditForm.admin_user_id}
                    onChange={(event) =>
                      setOrganizationEditForm((current) => ({
                        ...current,
                        admin_user_id: event.target.value,
                      }))
                    }
                    required
                  />
                </label>
                <label className="field">
                  <span>Logo URL</span>
                  <input
                    value={organizationEditForm.logo_url}
                    onChange={(event) =>
                      setOrganizationEditForm((current) => ({
                        ...current,
                        logo_url: event.target.value,
                      }))
                    }
                  />
                </label>
                <div className="actions">
                  <button type="submit">Save organization</button>
                  <button type="button" onClick={() => void handleDeleteOrganization()}>
                    Delete organization
                  </button>
                </div>
              </form>
            ) : (
              <p>Select an organization to edit.</p>
            )}
          </div>
        </section>

        <section className="grid two">
          <div className="panel">
            <h2>Organizations</h2>
            <div className="list">
              {organizations.map((organization) => (
                <article key={organization.id} className="item">
                  <h3>{organization.name}</h3>
                  <p>{organization.description || "No description"}</p>
                  <p>Admin user ID: {organization.admin_user_id}</p>
                  <p>Created: {formatDateTime(organization.created_at)}</p>
                </article>
              ))}
            </div>
          </div>

          <div className="panel">
            <h2>Providers</h2>
            <label className="field">
              <span>Select provider</span>
              <select
                value={selectedProviderId ?? ""}
                onChange={(event) => setSelectedProviderId(Number(event.target.value))}
              >
                <option value="">Select provider</option>
                {providers.map((provider) => (
                  <option key={provider.id} value={provider.id}>
                    {provider.name}
                  </option>
                ))}
              </select>
            </label>
            {selectedProvider ? (
              <form className="form" onSubmit={handleUpdateProvider}>
                <label className="field">
                  <span>Name</span>
                  <input
                    value={providerForm.name}
                    onChange={(event) =>
                      setProviderForm((current) => ({
                        ...current,
                        name: event.target.value,
                      }))
                    }
                    required
                  />
                </label>
                <label className="field">
                  <span>Description</span>
                  <textarea
                    value={providerForm.description}
                    onChange={(event) =>
                      setProviderForm((current) => ({
                        ...current,
                        description: event.target.value,
                      }))
                    }
                  />
                </label>
                <label className="field">
                  <span>Capacity</span>
                  <input
                    type="number"
                    min="1"
                    value={providerForm.capacity}
                    onChange={(event) =>
                      setProviderForm((current) => ({
                        ...current,
                        capacity: event.target.value,
                      }))
                    }
                    required
                  />
                </label>
                <label className="field">
                  <span>
                    <input
                      type="checkbox"
                      checked={providerForm.is_active}
                      onChange={(event) =>
                        setProviderForm((current) => ({
                          ...current,
                          is_active: event.target.checked,
                        }))
                      }
                    />{" "}
                    Provider is active
                  </span>
                </label>
                <button type="submit">Save provider</button>
              </form>
            ) : (
              <p>No provider selected.</p>
            )}
          </div>
        </section>

        <section className="grid three">
          <div className="panel">
            <h2>Role counts</h2>
            <p>Customers: {systemMetrics?.role_counts.customers ?? "-"}</p>
            <p>Organizers: {systemMetrics?.role_counts.organizers ?? "-"}</p>
            <p>Admins: {systemMetrics?.role_counts.admins ?? "-"}</p>
          </div>
          <div className="panel">
            <h2>System activity</h2>
            <p>Active services: {systemMetrics?.active_services ?? "-"}</p>
            <p>Active providers: {systemMetrics?.active_providers ?? "-"}</p>
            <p>Upcoming appointments: {dashboard?.upcoming_appointments ?? "-"}</p>
          </div>
          <div className="panel">
            <h2>Appointment health</h2>
            <p>Total appointments: {systemMetrics?.total_appointments ?? "-"}</p>
            <p>Cancelled appointments: {systemMetrics?.cancelled_appointments ?? "-"}</p>
          </div>
        </section>

        <section className="panel">
          <h2>Audit logs</h2>
          <form className="form" onSubmit={handleReloadAuditLogs}>
            <div className="grid two">
              <label className="field">
                <span>Entity type</span>
                <input
                  value={auditFilters.entity_type}
                  onChange={(event) =>
                    setAuditFilters((current) => ({
                      ...current,
                      entity_type: event.target.value,
                    }))
                  }
                />
              </label>
              <label className="field">
                <span>Action</span>
                <input
                  value={auditFilters.action}
                  onChange={(event) =>
                    setAuditFilters((current) => ({
                      ...current,
                      action: event.target.value,
                    }))
                  }
                />
              </label>
            </div>
            <div className="grid two">
              <label className="field">
                <span>Skip</span>
                <input
                  type="number"
                  min="0"
                  value={auditFilters.skip}
                  onChange={(event) =>
                    setAuditFilters((current) => ({
                      ...current,
                      skip: event.target.value,
                    }))
                  }
                />
              </label>
              <label className="field">
                <span>Limit</span>
                <input
                  type="number"
                  min="1"
                  value={auditFilters.limit}
                  onChange={(event) =>
                    setAuditFilters((current) => ({
                      ...current,
                      limit: event.target.value,
                    }))
                  }
                />
              </label>
            </div>
            <button type="submit">Reload logs</button>
          </form>
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>ID</th>
                  <th>Entity</th>
                  <th>Action</th>
                  <th>User</th>
                  <th>Created</th>
                </tr>
              </thead>
              <tbody>
                {auditLogs.map((log) => (
                  <tr key={log.id}>
                    <td>{log.id}</td>
                    <td>
                      {log.entity_type} #{log.entity_id}
                    </td>
                    <td>{log.action}</td>
                    <td>{log.user_id ?? "system"}</td>
                    <td>{formatDateTime(log.created_at)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      </div>
    </RequireAuth>
  );
}
