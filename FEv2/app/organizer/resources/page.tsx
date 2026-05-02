"use client";

import { useEffect, useState } from "react";
import { RequireAuth } from "@/components/require-auth";
import { apiFetch } from "@/lib/api";
import { formatDateTime } from "@/lib/format";
import type { Organization, Resource, Unavailability, WorkingHours } from "@/lib/types";

const weekDays = [
  { value: 0, label: "Sunday" },
  { value: 1, label: "Monday" },
  { value: 2, label: "Tuesday" },
  { value: 3, label: "Wednesday" },
  { value: 4, label: "Thursday" },
  { value: 5, label: "Friday" },
  { value: 6, label: "Saturday" },
];

export default function OrganizerResourcesPage() {
  const [organizations, setOrganizations] = useState<Organization[]>([]);
  const [resources, setResources] = useState<Resource[]>([]);
  const [workingHours, setWorkingHours] = useState<Record<number, WorkingHours[]>>({});
  const [unavailability, setUnavailability] = useState<Record<number, Unavailability[]>>({});
  const [selectedResourceId, setSelectedResourceId] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [resourceForm, setResourceForm] = useState({
    organization_id: "",
    name: "",
    type: "PROVIDER",
    description: "",
    capacity: "1",
  });
  const [editForm, setEditForm] = useState({
    name: "",
    description: "",
    capacity: "1",
    is_active: true,
  });
  const [hoursForm, setHoursForm] = useState({
    resource_id: "",
    day_of_week: "1",
    start_time: "09:00",
    end_time: "17:00",
    break_start: "",
    break_end: "",
    is_available: true,
  });
  const [unavailabilityForm, setUnavailabilityForm] = useState({
    resource_id: "",
    start_date_time: "",
    end_date_time: "",
    reason: "",
  });

  const selectedResource =
    resources.find((resource) => resource.id === selectedResourceId) ?? null;

  async function loadData() {
    setError(null);
    try {
      const [orgs, resourceData] = await Promise.all([
        apiFetch<Organization[]>("/api/organizations/mine"),
        apiFetch<Resource[]>("/api/resources"),
      ]);

      const [hoursEntries, unavailabilityEntries] = await Promise.all([
        Promise.all(
          resourceData.map(async (resource) => {
            const hours = await apiFetch<WorkingHours[]>(
              `/api/resources/${resource.id}/working-hours`,
            );
            return [resource.id, hours] as const;
          }),
        ),
        Promise.all(
          resourceData.map(async (resource) => {
            const periods = await apiFetch<Unavailability[]>(
              `/api/resources/${resource.id}/unavailability`,
            );
            return [resource.id, periods] as const;
          }),
        ),
      ]);

      setOrganizations(orgs);
      setResources(resourceData);
      setWorkingHours(Object.fromEntries(hoursEntries));
      setUnavailability(Object.fromEntries(unavailabilityEntries));
      setSelectedResourceId((current) => {
        if (current && resourceData.some((resource) => resource.id === current)) {
          return current;
        }
        return resourceData[0]?.id ?? null;
      });
      setResourceForm((current) => ({
        ...current,
        organization_id: current.organization_id || String(orgs[0]?.id ?? ""),
      }));
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Unable to load resources");
    }
  }

  useEffect(() => {
    void loadData();
  }, []);

  useEffect(() => {
    if (!selectedResource) {
      return;
    }

    setEditForm({
      name: selectedResource.name,
      description: selectedResource.description || "",
      capacity: String(selectedResource.capacity),
      is_active: selectedResource.is_active,
    });
    setHoursForm((current) => ({
      ...current,
      resource_id: String(selectedResource.id),
    }));
    setUnavailabilityForm((current) => ({
      ...current,
      resource_id: String(selectedResource.id),
    }));
  }, [selectedResource]);

  async function handleCreateResource(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setMessage(null);

    try {
      await apiFetch<Resource>("/api/resources", {
        method: "POST",
        body: JSON.stringify({
          organization_id: Number(resourceForm.organization_id),
          name: resourceForm.name,
          type: resourceForm.type,
          description: resourceForm.description || null,
          capacity: Number(resourceForm.capacity),
        }),
      });
      setMessage("Resource created.");
      setResourceForm((current) => ({
        ...current,
        name: "",
        description: "",
        capacity: "1",
      }));
      await loadData();
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : "Unable to create resource");
    }
  }

  async function handleUpdateResource(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!selectedResource) {
      return;
    }

    setError(null);
    setMessage(null);

    try {
      await apiFetch<Resource>(`/api/resources/${selectedResource.id}`, {
        method: "PUT",
        body: JSON.stringify({
          name: editForm.name,
          description: editForm.description || null,
          capacity: Number(editForm.capacity),
          is_active: editForm.is_active,
        }),
      });
      setMessage("Resource updated.");
      await loadData();
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : "Unable to update resource");
    }
  }

  async function handleDeleteResource(resourceId: number) {
    if (!window.confirm("Delete this resource?")) {
      return;
    }

    setError(null);
    setMessage(null);

    try {
      await apiFetch(`/api/resources/${resourceId}`, {
        method: "DELETE",
      });
      setMessage("Resource deleted.");
      await loadData();
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : "Unable to delete resource");
    }
  }

  async function handleSetWorkingHours(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setMessage(null);

    try {
      const targetResourceId = Number(hoursForm.resource_id);
      const existing = workingHours[targetResourceId]?.find(
        (entry) => entry.day_of_week === Number(hoursForm.day_of_week),
      );

      const body = {
        day_of_week: Number(hoursForm.day_of_week),
        start_time: hoursForm.start_time,
        end_time: hoursForm.end_time,
        break_start: hoursForm.break_start || null,
        break_end: hoursForm.break_end || null,
        is_available: hoursForm.is_available,
      };

      if (existing) {
        await apiFetch(`/api/resources/${targetResourceId}/working-hours/${existing.day_of_week}`, {
          method: "PUT",
          body: JSON.stringify(body),
        });
      } else {
        await apiFetch(`/api/resources/${targetResourceId}/working-hours`, {
          method: "POST",
          body: JSON.stringify(body),
        });
      }

      setMessage("Working hours saved.");
      await loadData();
    } catch (submitError) {
      setError(
        submitError instanceof Error ? submitError.message : "Unable to save working hours",
      );
    }
  }

  async function handleAddUnavailability(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setMessage(null);

    try {
      await apiFetch(`/api/resources/${Number(unavailabilityForm.resource_id)}/unavailability`, {
        method: "POST",
        body: JSON.stringify({
          start_date_time: new Date(unavailabilityForm.start_date_time).toISOString(),
          end_date_time: new Date(unavailabilityForm.end_date_time).toISOString(),
          reason: unavailabilityForm.reason || null,
        }),
      });
      setMessage("Unavailability added.");
      setUnavailabilityForm((current) => ({
        ...current,
        start_date_time: "",
        end_date_time: "",
        reason: "",
      }));
      await loadData();
    } catch (submitError) {
      setError(
        submitError instanceof Error ? submitError.message : "Unable to add unavailability",
      );
    }
  }

  async function handleDeleteUnavailability(resourceId: number, unavailabilityId: number) {
    if (!window.confirm("Delete this blackout period?")) {
      return;
    }

    setError(null);
    setMessage(null);

    try {
      await apiFetch(`/api/resources/${resourceId}/unavailability/${unavailabilityId}`, {
        method: "DELETE",
      });
      setMessage("Unavailability removed.");
      await loadData();
    } catch (submitError) {
      setError(
        submitError instanceof Error ? submitError.message : "Unable to delete unavailability",
      );
    }
  }

  return (
    <RequireAuth allowedRoles={["ORGANIZER", "ADMIN"]}>
      <div className="page">
        <section className="panel">
          <h1>Organizer resources</h1>
          <p>Create, edit, deactivate, and block resource availability.</p>
          {error ? <p className="error">{error}</p> : null}
          {message ? <p className="success">{message}</p> : null}
        </section>

        <section className="grid two">
          <div className="panel">
            <h2>Create resource</h2>
            <form className="form" onSubmit={handleCreateResource}>
              <label className="field">
                <span>Organization</span>
                <select
                  value={resourceForm.organization_id}
                  onChange={(event) =>
                    setResourceForm((current) => ({
                      ...current,
                      organization_id: event.target.value,
                    }))
                  }
                  required
                >
                  <option value="">Select organization</option>
                  {organizations.map((organization) => (
                    <option key={organization.id} value={organization.id}>
                      {organization.name}
                    </option>
                  ))}
                </select>
              </label>
              <label className="field">
                <span>Name</span>
                <input
                  value={resourceForm.name}
                  onChange={(event) =>
                    setResourceForm((current) => ({ ...current, name: event.target.value }))
                  }
                  required
                />
              </label>
              <label className="field">
                <span>Type</span>
                <select
                  value={resourceForm.type}
                  onChange={(event) =>
                    setResourceForm((current) => ({ ...current, type: event.target.value }))
                  }
                >
                  <option value="PROVIDER">Provider</option>
                  <option value="ROOM">Room</option>
                  <option value="EQUIPMENT">Equipment</option>
                </select>
              </label>
              <label className="field">
                <span>Description</span>
                <textarea
                  value={resourceForm.description}
                  onChange={(event) =>
                    setResourceForm((current) => ({ ...current, description: event.target.value }))
                  }
                />
              </label>
              <label className="field">
                <span>Capacity</span>
                <input
                  type="number"
                  min="1"
                  value={resourceForm.capacity}
                  onChange={(event) =>
                    setResourceForm((current) => ({ ...current, capacity: event.target.value }))
                  }
                  required
                />
              </label>
              <button type="submit">Create resource</button>
            </form>
          </div>

          <div className="panel">
            <h2>Edit resource</h2>
            {!selectedResource ? <p>Select a resource below.</p> : null}
            {selectedResource ? (
              <form className="form" onSubmit={handleUpdateResource}>
                <label className="field">
                  <span>Name</span>
                  <input
                    value={editForm.name}
                    onChange={(event) =>
                      setEditForm((current) => ({ ...current, name: event.target.value }))
                    }
                    required
                  />
                </label>
                <label className="field">
                  <span>Description</span>
                  <textarea
                    value={editForm.description}
                    onChange={(event) =>
                      setEditForm((current) => ({ ...current, description: event.target.value }))
                    }
                  />
                </label>
                <label className="field">
                  <span>Capacity</span>
                  <input
                    type="number"
                    min="1"
                    value={editForm.capacity}
                    onChange={(event) =>
                      setEditForm((current) => ({ ...current, capacity: event.target.value }))
                    }
                    required
                  />
                </label>
                <label className="field">
                  <span>
                    <input
                      type="checkbox"
                      checked={editForm.is_active}
                      onChange={(event) =>
                        setEditForm((current) => ({
                          ...current,
                          is_active: event.target.checked,
                        }))
                      }
                    />{" "}
                    Resource is active
                  </span>
                </label>
                <div className="actions">
                  <button type="submit">Save resource</button>
                  <button
                    type="button"
                    onClick={() => void handleDeleteResource(selectedResource.id)}
                  >
                    Delete resource
                  </button>
                </div>
              </form>
            ) : null}
          </div>
        </section>

        <section className="grid two">
          <div className="panel">
            <h2>Working hours</h2>
            <form className="form" onSubmit={handleSetWorkingHours}>
              <label className="field">
                <span>Resource</span>
                <select
                  value={hoursForm.resource_id}
                  onChange={(event) =>
                    setHoursForm((current) => ({ ...current, resource_id: event.target.value }))
                  }
                  required
                >
                  <option value="">Select resource</option>
                  {resources.map((resource) => (
                    <option key={resource.id} value={resource.id}>
                      {resource.name}
                    </option>
                  ))}
                </select>
              </label>
              <label className="field">
                <span>Day</span>
                <select
                  value={hoursForm.day_of_week}
                  onChange={(event) =>
                    setHoursForm((current) => ({ ...current, day_of_week: event.target.value }))
                  }
                >
                  {weekDays.map((day) => (
                    <option key={day.value} value={day.value}>
                      {day.label}
                    </option>
                  ))}
                </select>
              </label>
              <div className="grid two">
                <label className="field">
                  <span>Start</span>
                  <input
                    type="time"
                    value={hoursForm.start_time}
                    onChange={(event) =>
                      setHoursForm((current) => ({ ...current, start_time: event.target.value }))
                    }
                  />
                </label>
                <label className="field">
                  <span>End</span>
                  <input
                    type="time"
                    value={hoursForm.end_time}
                    onChange={(event) =>
                      setHoursForm((current) => ({ ...current, end_time: event.target.value }))
                    }
                  />
                </label>
              </div>
              <div className="grid two">
                <label className="field">
                  <span>Break start</span>
                  <input
                    type="time"
                    value={hoursForm.break_start}
                    onChange={(event) =>
                      setHoursForm((current) => ({ ...current, break_start: event.target.value }))
                    }
                  />
                </label>
                <label className="field">
                  <span>Break end</span>
                  <input
                    type="time"
                    value={hoursForm.break_end}
                    onChange={(event) =>
                      setHoursForm((current) => ({ ...current, break_end: event.target.value }))
                    }
                  />
                </label>
              </div>
              <label className="field">
                <span>
                  <input
                    type="checkbox"
                    checked={hoursForm.is_available}
                    onChange={(event) =>
                      setHoursForm((current) => ({
                        ...current,
                        is_available: event.target.checked,
                      }))
                    }
                  />{" "}
                  Available on this day
                </span>
              </label>
              <button type="submit">Save working hours</button>
            </form>
          </div>

          <div className="panel">
            <h2>Blackout periods</h2>
            <form className="form" onSubmit={handleAddUnavailability}>
              <label className="field">
                <span>Resource</span>
                <select
                  value={unavailabilityForm.resource_id}
                  onChange={(event) =>
                    setUnavailabilityForm((current) => ({
                      ...current,
                      resource_id: event.target.value,
                    }))
                  }
                  required
                >
                  <option value="">Select resource</option>
                  {resources.map((resource) => (
                    <option key={resource.id} value={resource.id}>
                      {resource.name}
                    </option>
                  ))}
                </select>
              </label>
              <label className="field">
                <span>Start</span>
                <input
                  type="datetime-local"
                  value={unavailabilityForm.start_date_time}
                  onChange={(event) =>
                    setUnavailabilityForm((current) => ({
                      ...current,
                      start_date_time: event.target.value,
                    }))
                  }
                  required
                />
              </label>
              <label className="field">
                <span>End</span>
                <input
                  type="datetime-local"
                  value={unavailabilityForm.end_date_time}
                  onChange={(event) =>
                    setUnavailabilityForm((current) => ({
                      ...current,
                      end_date_time: event.target.value,
                    }))
                  }
                  required
                />
              </label>
              <label className="field">
                <span>Reason</span>
                <textarea
                  value={unavailabilityForm.reason}
                  onChange={(event) =>
                    setUnavailabilityForm((current) => ({
                      ...current,
                      reason: event.target.value,
                    }))
                  }
                />
              </label>
              <button type="submit">Add blackout period</button>
            </form>
          </div>
        </section>

        <section className="panel">
          <h2>Resources</h2>
          {!resources.length ? <p>No resources yet.</p> : null}
          <div className="list">
            {resources.map((resource) => (
              <article key={resource.id} className="item">
                <div className="actions">
                  <h3>
                    {resource.name} <span className="badge">{resource.type}</span>
                  </h3>
                  <button type="button" onClick={() => setSelectedResourceId(resource.id)}>
                    {selectedResourceId === resource.id ? "Selected" : "Manage"}
                  </button>
                </div>
                <p>{resource.description || "No description"}</p>
                <p>Capacity: {resource.capacity}</p>
                <p>Status: {resource.is_active ? "Active" : "Inactive"}</p>
                <p>Created: {formatDateTime(resource.created_at)}</p>
                <div className="table-wrap">
                  <table>
                    <thead>
                      <tr>
                        <th>Day</th>
                        <th>Hours</th>
                        <th>Break</th>
                        <th>Available</th>
                      </tr>
                    </thead>
                    <tbody>
                      {(workingHours[resource.id] || []).map((entry) => (
                        <tr key={entry.id}>
                          <td>{weekDays.find((day) => day.value === entry.day_of_week)?.label}</td>
                          <td>
                            {entry.start_time} - {entry.end_time}
                          </td>
                          <td>
                            {entry.break_start && entry.break_end
                              ? `${entry.break_start} - ${entry.break_end}`
                              : "None"}
                          </td>
                          <td>{entry.is_available ? "Yes" : "No"}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <div className="list">
                  {(unavailability[resource.id] || []).map((period) => (
                    <article key={period.id} className="item">
                      <p>
                        {formatDateTime(period.start_date_time)} to{" "}
                        {formatDateTime(period.end_date_time)}
                      </p>
                      <p>{period.reason || "No reason provided"}</p>
                      <button
                        type="button"
                        onClick={() =>
                          void handleDeleteUnavailability(resource.id, period.id)
                        }
                      >
                        Delete blackout
                      </button>
                    </article>
                  ))}
                  {!unavailability[resource.id]?.length ? <p>No blackout periods.</p> : null}
                </div>
              </article>
            ))}
          </div>
        </section>

      </div>
    </RequireAuth>
  );
}
