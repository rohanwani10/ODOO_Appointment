"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { AuthGuard } from "@/components/auth/auth-guard";
import { apiFetch } from "@/lib/api";
import {
  formatDate,
  formatTime,
  toDateInputValue,
  weekDays,
} from "@/lib/dates";
import { getErrorMessage } from "@/lib/errors";
import type { Appointment } from "@/types/booking";
import type { Organization } from "@/types/organization";
import type { Resource, ResourceType, ResourceWorkingHour } from "@/types/resource";
import type { Service } from "@/types/service";

type WorkingHourForm = {
  day_of_week: number;
  start_time: string;
  end_time: string;
  break_start: string;
  break_end: string;
  is_available: boolean;
};

function createDefaultWorkingHours() {
  return weekDays.reduce<Record<number, WorkingHourForm>>((accumulator, day) => {
    accumulator[day.value] = {
      day_of_week: day.value,
      start_time: "09:00",
      end_time: "17:00",
      break_start: "13:00",
      break_end: "14:00",
      is_available: day.value !== 0 && day.value !== 6,
    };
    return accumulator;
  }, {});
}

function timeForInput(value?: string | null) {
  return value ? value.slice(0, 5) : "";
}

function timeForApi(value: string) {
  return value.length === 5 ? `${value}:00` : value;
}

export default function OrganizerWorkspacePage() {
  const [organizations, setOrganizations] = useState<Organization[]>([]);
  const [resources, setResources] = useState<Resource[]>([]);
  const [services, setServices] = useState<Service[]>([]);
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [serviceResourcesById, setServiceResourcesById] = useState<
    Record<number, Resource[]>
  >({});
  const [selectedOrganizationId, setSelectedOrganizationId] = useState<number | null>(
    null,
  );
  const [selectedResourceId, setSelectedResourceId] = useState<number | null>(null);
  const [workingHours, setWorkingHours] = useState<Record<number, WorkingHourForm>>(
    createDefaultWorkingHours(),
  );
  const [existingWorkingHours, setExistingWorkingHours] = useState<
    Record<number, ResourceWorkingHour>
  >({});
  const [organizationForm, setOrganizationForm] = useState({
    name: "",
    description: "",
  });
  const [resourceForm, setResourceForm] = useState({
    name: "",
    type: "PROVIDER" as ResourceType,
    description: "",
    capacity: 1,
  });
  const [serviceForm, setServiceForm] = useState({
    name: "",
    description: "",
    duration_minutes: 30,
    capacity: 1,
    is_published: true,
    max_bookings_per_user: 1,
    requires_advance_payment: false,
    advance_payment_amount: 0,
  });
  const [selectedServiceResourceIds, setSelectedServiceResourceIds] = useState<
    number[]
  >([]);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSavingSchedule, setIsSavingSchedule] = useState(false);
  const [isSubmittingOrg, setIsSubmittingOrg] = useState(false);
  const [isSubmittingResource, setIsSubmittingResource] = useState(false);
  const [isSubmittingService, setIsSubmittingService] = useState(false);
  const [publishingServiceId, setPublishingServiceId] = useState<number | null>(null);

  const servicesById = useMemo(
    () =>
      services.reduce<Record<number, Service>>((accumulator, service) => {
        accumulator[service.id] = service;
        return accumulator;
      }, {}),
    [services],
  );

  const resourcesById = useMemo(
    () =>
      resources.reduce<Record<number, Resource>>((accumulator, resource) => {
        accumulator[resource.id] = resource;
        return accumulator;
      }, {}),
    [resources],
  );

  const loadWorkspace = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    try {
      const [organizationData, resourceData, serviceData, bookingData] =
        await Promise.all([
          apiFetch<Organization[]>("/api/organizations/mine"),
          apiFetch<Resource[]>("/api/resources"),
          apiFetch<Service[]>("/api/organizer/services"),
          apiFetch<Appointment[]>("/api/appointments"),
        ]);

      const assignmentEntries = await Promise.all(
        serviceData.map(async (service) => {
          try {
            const assigned = await apiFetch<Resource[]>(
              `/api/services/${service.id}/resources`,
            );
            return [service.id, assigned] as const;
          } catch {
            return [service.id, []] as const;
          }
        }),
      );

      setOrganizations(organizationData);
      setResources(resourceData);
      setServices(serviceData);
      setAppointments(bookingData);
      setServiceResourcesById(Object.fromEntries(assignmentEntries));

      setSelectedOrganizationId(
        (current) => current ?? organizationData[0]?.id ?? null,
      );
      setSelectedResourceId((current) => current ?? resourceData[0]?.id ?? null);
    } catch (loadError) {
      setError(getErrorMessage(loadError, "Unable to load organizer workspace."));
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadWorkspace();
  }, [loadWorkspace]);

  useEffect(() => {
    let isCancelled = false;

    async function loadWorkingHours() {
      if (!selectedResourceId) {
        setExistingWorkingHours({});
        setWorkingHours(createDefaultWorkingHours());
        return;
      }

      try {
        const data = await apiFetch<ResourceWorkingHour[]>(
          `/api/resources/${selectedResourceId}/working-hours`,
        );

        if (isCancelled) {
          return;
        }

        const existingMap = data.reduce<Record<number, ResourceWorkingHour>>(
          (accumulator, item) => {
            accumulator[item.day_of_week] = item;
            return accumulator;
          },
          {},
        );

        const merged = createDefaultWorkingHours();
        for (const item of data) {
          merged[item.day_of_week] = {
            day_of_week: item.day_of_week,
            start_time: timeForInput(item.start_time),
            end_time: timeForInput(item.end_time),
            break_start: timeForInput(item.break_start),
            break_end: timeForInput(item.break_end),
            is_available: item.is_available,
          };
        }

        setExistingWorkingHours(existingMap);
        setWorkingHours(merged);
      } catch {
        if (!isCancelled) {
          setExistingWorkingHours({});
          setWorkingHours(createDefaultWorkingHours());
        }
      }
    }

    void loadWorkingHours();

    return () => {
      isCancelled = true;
    };
  }, [selectedResourceId]);

  async function handleOrganizationSubmit(event: React.FormEvent) {
    event.preventDefault();
    setIsSubmittingOrg(true);
    setError(null);
    setMessage(null);

    try {
      const organization = await apiFetch<Organization>("/api/organizations", {
        method: "POST",
        body: JSON.stringify({
          name: organizationForm.name.trim(),
          description: organizationForm.description.trim() || null,
        }),
      });

      setOrganizationForm({ name: "", description: "" });
      setSelectedOrganizationId(organization.id);
      setMessage("Organization created.");
      await loadWorkspace();
    } catch (submitError) {
      setError(getErrorMessage(submitError, "Unable to create organization."));
    } finally {
      setIsSubmittingOrg(false);
    }
  }

  async function handleResourceSubmit(event: React.FormEvent) {
    event.preventDefault();
    if (!selectedOrganizationId) {
      setError("Create or select an organization first.");
      return;
    }

    setIsSubmittingResource(true);
    setError(null);
    setMessage(null);

    try {
      const resource = await apiFetch<Resource>("/api/resources", {
        method: "POST",
        body: JSON.stringify({
          organization_id: selectedOrganizationId,
          name: resourceForm.name.trim(),
          type: resourceForm.type,
          description: resourceForm.description.trim() || null,
          capacity: Number(resourceForm.capacity),
        }),
      });

      setResourceForm({
        name: "",
        type: "PROVIDER",
        description: "",
        capacity: 1,
      });
      setSelectedResourceId(resource.id);
      setMessage("Resource created. Configure working hours next.");
      await loadWorkspace();
    } catch (submitError) {
      setError(getErrorMessage(submitError, "Unable to create resource."));
    } finally {
      setIsSubmittingResource(false);
    }
  }

  async function handleScheduleSave() {
    if (!selectedResourceId) {
      setError("Select a resource before saving working hours.");
      return;
    }

    setIsSavingSchedule(true);
    setError(null);
    setMessage(null);

    try {
      for (const day of weekDays) {
        const entry = workingHours[day.value];
        const existing = existingWorkingHours[day.value];
        const body = {
          day_of_week: day.value,
          start_time: timeForApi(entry.start_time),
          end_time: timeForApi(entry.end_time),
          break_start: entry.break_start ? timeForApi(entry.break_start) : null,
          break_end: entry.break_end ? timeForApi(entry.break_end) : null,
          is_available: entry.is_available,
        };

        if (existing) {
          await apiFetch(
            `/api/resources/${selectedResourceId}/working-hours/${day.value}`,
            {
              method: "PUT",
              body: JSON.stringify(body),
            },
          );
        } else {
          await apiFetch(`/api/resources/${selectedResourceId}/working-hours`, {
            method: "POST",
            body: JSON.stringify(body),
          });
        }
      }

      setMessage("Weekly availability saved.");

      const updatedHours = await apiFetch<ResourceWorkingHour[]>(
        `/api/resources/${selectedResourceId}/working-hours`,
      );
      const updatedMap = updatedHours.reduce<Record<number, ResourceWorkingHour>>(
        (accumulator, item) => {
          accumulator[item.day_of_week] = item;
          return accumulator;
        },
        {},
      );
      setExistingWorkingHours(updatedMap);
    } catch (saveError) {
      setError(getErrorMessage(saveError, "Unable to save working hours."));
    } finally {
      setIsSavingSchedule(false);
    }
  }

  async function handleServiceSubmit(event: React.FormEvent) {
    event.preventDefault();
    if (!selectedOrganizationId) {
      setError("Create or select an organization first.");
      return;
    }

    setIsSubmittingService(true);
    setError(null);
    setMessage(null);

    try {
      const service = await apiFetch<Service>("/api/services", {
        method: "POST",
        body: JSON.stringify({
          organization_id: selectedOrganizationId,
          name: serviceForm.name.trim(),
          description: serviceForm.description.trim() || null,
          duration_minutes: Number(serviceForm.duration_minutes),
          capacity: Number(serviceForm.capacity),
          is_published: serviceForm.is_published,
          max_bookings_per_user: Number(serviceForm.max_bookings_per_user) || null,
          requires_advance_payment: serviceForm.requires_advance_payment,
          advance_payment_amount: serviceForm.requires_advance_payment
            ? Number(serviceForm.advance_payment_amount) || 0
            : null,
        }),
      });

      for (const resourceId of selectedServiceResourceIds) {
        await apiFetch(`/api/services/${service.id}/resources`, {
          method: "POST",
          body: JSON.stringify({
            resource_id: resourceId,
            is_required: false,
            assignment_type: "MANUAL",
          }),
        });
      }

      setServiceForm({
        name: "",
        description: "",
        duration_minutes: 30,
        capacity: 1,
        is_published: true,
        max_bookings_per_user: 1,
        requires_advance_payment: false,
        advance_payment_amount: 0,
      });
      setSelectedServiceResourceIds([]);
      setMessage("Service created.");
      await loadWorkspace();
    } catch (submitError) {
      setError(getErrorMessage(submitError, "Unable to create service."));
    } finally {
      setIsSubmittingService(false);
    }
  }

  async function handlePublishToggle(service: Service) {
    setPublishingServiceId(service.id);
    setError(null);
    setMessage(null);

    try {
      await apiFetch(
        `/api/services/${service.id}/${service.is_published ? "unpublish" : "publish"}`,
        {
          method: "POST",
        },
      );
      setMessage(
        service.is_published ? "Service unpublished." : "Service published.",
      );
      await loadWorkspace();
    } catch (toggleError) {
      setError(getErrorMessage(toggleError, "Unable to update service status."));
    } finally {
      setPublishingServiceId(null);
    }
  }

  const sortedAppointments = useMemo(
    () =>
      [...appointments].sort(
        (left, right) =>
          new Date(left.start_time).getTime() - new Date(right.start_time).getTime(),
      ),
    [appointments],
  );

  return (
    <AuthGuard allowedRoles={["ORGANIZER", "ADMIN"]}>
      <div className="space-y-8">
        <section className="rounded-3xl border border-white/10 bg-white/5 p-8 shadow-2xl shadow-slate-950/20 backdrop-blur">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <p className="text-xs uppercase tracking-[0.25em] text-sky-300/80">
                Organizer workspace
              </p>
              <h1 className="mt-2 text-4xl font-semibold tracking-tight text-white">
                Phase 2 service setup
              </h1>
              <p className="mt-3 max-w-3xl text-slate-300">
                Create your organization context, add bookable resources, define
                weekly availability, then publish services customers can book
                from the home page.
              </p>
            </div>

            <div className="flex flex-wrap gap-3">
              <Link
                href="/"
                className="rounded-full border border-white/15 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-white/10"
              >
                Customer home
              </Link>
              <Link
                href="/appointments"
                className="rounded-full bg-white px-4 py-2 text-sm font-semibold text-slate-950 transition-colors hover:bg-slate-200"
              >
                View bookings
              </Link>
            </div>
          </div>
        </section>

        {(message || error) && (
          <div
            className={`rounded-2xl p-4 text-sm ${
              error
                ? "border border-red-400/20 bg-red-500/10 text-red-100"
                : "border border-emerald-400/20 bg-emerald-500/10 text-emerald-100"
            }`}
          >
            {error || message}
          </div>
        )}

        {isLoading ? (
          <div className="rounded-3xl border border-white/10 bg-slate-950/70 p-8 text-slate-300">
            Loading workspace...
          </div>
        ) : (
          <>
            <section className="grid gap-4 md:grid-cols-4">
              <div className="rounded-3xl border border-white/10 bg-slate-950/70 p-6">
                <p className="text-xs uppercase tracking-[0.2em] text-slate-400">
                  Organizations
                </p>
                <p className="mt-3 text-3xl font-semibold text-white">
                  {organizations.length}
                </p>
              </div>
              <div className="rounded-3xl border border-white/10 bg-slate-950/70 p-6">
                <p className="text-xs uppercase tracking-[0.2em] text-slate-400">
                  Resources
                </p>
                <p className="mt-3 text-3xl font-semibold text-white">
                  {resources.length}
                </p>
              </div>
              <div className="rounded-3xl border border-white/10 bg-slate-950/70 p-6">
                <p className="text-xs uppercase tracking-[0.2em] text-slate-400">
                  Services
                </p>
                <p className="mt-3 text-3xl font-semibold text-white">
                  {services.length}
                </p>
              </div>
              <div className="rounded-3xl border border-white/10 bg-slate-950/70 p-6">
                <p className="text-xs uppercase tracking-[0.2em] text-slate-400">
                  Bookings
                </p>
                <p className="mt-3 text-3xl font-semibold text-white">
                  {appointments.length}
                </p>
              </div>
            </section>

            <section className="grid gap-6 xl:grid-cols-[0.9fr_1.1fr]">
              <form
                onSubmit={handleOrganizationSubmit}
                className="rounded-3xl border border-white/10 bg-white/5 p-6 backdrop-blur"
              >
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <p className="text-xs uppercase tracking-[0.2em] text-slate-400">
                      Step 1
                    </p>
                    <h2 className="mt-2 text-2xl font-semibold text-white">
                      Organization context
                    </h2>
                  </div>
                  <span className="rounded-full border border-white/10 px-3 py-1 text-xs uppercase tracking-[0.2em] text-slate-300">
                    {selectedOrganizationId ? `Active #${selectedOrganizationId}` : "Required"}
                  </span>
                </div>

                <div className="mt-5 space-y-4">
                  <div>
                    <label className="mb-1 block text-sm text-slate-300">
                      Active organization
                    </label>
                    <select
                      value={selectedOrganizationId ?? ""}
                      onChange={(event) =>
                        setSelectedOrganizationId(Number(event.target.value) || null)
                      }
                      className="w-full rounded-2xl border border-white/10 bg-slate-950/70 px-4 py-3 text-white outline-none"
                    >
                      <option value="">Select organization</option>
                      {organizations.map((organization) => (
                        <option key={organization.id} value={organization.id}>
                          {organization.name}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="rounded-2xl border border-white/10 bg-slate-950/60 p-4">
                    <p className="text-sm font-semibold text-white">
                      Create another organization
                    </p>
                    <div className="mt-4 space-y-4">
                      <input
                        value={organizationForm.name}
                        onChange={(event) =>
                          setOrganizationForm((current) => ({
                            ...current,
                            name: event.target.value,
                          }))
                        }
                        placeholder="Studio or clinic name"
                        className="w-full rounded-2xl border border-white/10 bg-slate-900 px-4 py-3 text-white outline-none"
                        required
                      />
                      <textarea
                        value={organizationForm.description}
                        onChange={(event) =>
                          setOrganizationForm((current) => ({
                            ...current,
                            description: event.target.value,
                          }))
                        }
                        placeholder="Short description"
                        rows={3}
                        className="w-full rounded-2xl border border-white/10 bg-slate-900 px-4 py-3 text-white outline-none"
                      />
                      <button
                        type="submit"
                        disabled={isSubmittingOrg}
                        className="rounded-full bg-sky-400 px-4 py-2 text-sm font-semibold text-slate-950 transition-colors hover:bg-sky-300 disabled:cursor-not-allowed disabled:opacity-60"
                      >
                        {isSubmittingOrg ? "Creating..." : "Create organization"}
                      </button>
                    </div>
                  </div>
                </div>
              </form>

              <form
                onSubmit={handleResourceSubmit}
                className="rounded-3xl border border-white/10 bg-slate-950/70 p-6"
              >
                <div>
                  <p className="text-xs uppercase tracking-[0.2em] text-slate-400">
                    Step 2
                  </p>
                  <h2 className="mt-2 text-2xl font-semibold text-white">
                    Create resources
                  </h2>
                </div>

                <div className="mt-5 grid gap-4 md:grid-cols-2">
                  <div>
                    <label className="mb-1 block text-sm text-slate-300">
                      Resource name
                    </label>
                    <input
                      value={resourceForm.name}
                      onChange={(event) =>
                        setResourceForm((current) => ({
                          ...current,
                          name: event.target.value,
                        }))
                      }
                      placeholder="Dr. Avery, Room 2, Camera A"
                      className="w-full rounded-2xl border border-white/10 bg-slate-900 px-4 py-3 text-white outline-none"
                      required
                    />
                  </div>
                  <div>
                    <label className="mb-1 block text-sm text-slate-300">
                      Type
                    </label>
                    <select
                      value={resourceForm.type}
                      onChange={(event) =>
                        setResourceForm((current) => ({
                          ...current,
                          type: event.target.value as ResourceType,
                        }))
                      }
                      className="w-full rounded-2xl border border-white/10 bg-slate-900 px-4 py-3 text-white outline-none"
                    >
                      <option value="PROVIDER">Provider</option>
                      <option value="ROOM">Room</option>
                      <option value="EQUIPMENT">Equipment</option>
                    </select>
                  </div>
                  <div>
                    <label className="mb-1 block text-sm text-slate-300">
                      Capacity
                    </label>
                    <input
                      type="number"
                      min="1"
                      value={resourceForm.capacity}
                      onChange={(event) =>
                        setResourceForm((current) => ({
                          ...current,
                          capacity: Number(event.target.value),
                        }))
                      }
                      className="w-full rounded-2xl border border-white/10 bg-slate-900 px-4 py-3 text-white outline-none"
                    />
                  </div>
                  <div>
                    <label className="mb-1 block text-sm text-slate-300">
                      Description
                    </label>
                    <input
                      value={resourceForm.description}
                      onChange={(event) =>
                        setResourceForm((current) => ({
                          ...current,
                          description: event.target.value,
                        }))
                      }
                      placeholder="Optional"
                      className="w-full rounded-2xl border border-white/10 bg-slate-900 px-4 py-3 text-white outline-none"
                    />
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={isSubmittingResource}
                  className="mt-5 rounded-full bg-white px-4 py-2 text-sm font-semibold text-slate-950 transition-colors hover:bg-slate-200 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {isSubmittingResource ? "Creating..." : "Create resource"}
                </button>
              </form>
            </section>

            <section className="grid gap-6 xl:grid-cols-[1.15fr_0.85fr]">
              <div className="rounded-3xl border border-white/10 bg-white/5 p-6 backdrop-blur">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
                  <div>
                    <p className="text-xs uppercase tracking-[0.2em] text-slate-400">
                      Step 3
                    </p>
                    <h2 className="mt-2 text-2xl font-semibold text-white">
                      Weekly working hours
                    </h2>
                  </div>

                  <select
                    value={selectedResourceId ?? ""}
                    onChange={(event) =>
                      setSelectedResourceId(Number(event.target.value) || null)
                    }
                    className="rounded-2xl border border-white/10 bg-slate-950 px-4 py-3 text-white outline-none"
                  >
                    <option value="">Select resource</option>
                    {resources.map((resource) => (
                      <option key={resource.id} value={resource.id}>
                        {resource.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="mt-5 space-y-3">
                  {weekDays.map((day) => {
                    const entry = workingHours[day.value];

                    return (
                      <div
                        key={day.value}
                        className="grid gap-3 rounded-2xl border border-white/10 bg-slate-950/65 p-4 md:grid-cols-[140px_100px_1fr_1fr_1fr_1fr]"
                      >
                        <div className="flex items-center justify-between gap-3">
                          <span className="font-medium text-white">{day.label}</span>
                          <label className="flex items-center gap-2 text-xs uppercase tracking-[0.2em] text-slate-400">
                            <input
                              type="checkbox"
                              checked={entry.is_available}
                              onChange={(event) =>
                                setWorkingHours((current) => ({
                                  ...current,
                                  [day.value]: {
                                    ...current[day.value],
                                    is_available: event.target.checked,
                                  },
                                }))
                              }
                            />
                            Open
                          </label>
                        </div>
                        <input
                          type="time"
                          value={entry.start_time}
                          onChange={(event) =>
                            setWorkingHours((current) => ({
                              ...current,
                              [day.value]: {
                                ...current[day.value],
                                start_time: event.target.value,
                              },
                            }))
                          }
                          className="rounded-xl border border-white/10 bg-slate-900 px-3 py-2 text-sm text-white outline-none"
                        />
                        <input
                          type="time"
                          value={entry.end_time}
                          onChange={(event) =>
                            setWorkingHours((current) => ({
                              ...current,
                              [day.value]: {
                                ...current[day.value],
                                end_time: event.target.value,
                              },
                            }))
                          }
                          className="rounded-xl border border-white/10 bg-slate-900 px-3 py-2 text-sm text-white outline-none"
                        />
                        <input
                          type="time"
                          value={entry.break_start}
                          onChange={(event) =>
                            setWorkingHours((current) => ({
                              ...current,
                              [day.value]: {
                                ...current[day.value],
                                break_start: event.target.value,
                              },
                            }))
                          }
                          className="rounded-xl border border-white/10 bg-slate-900 px-3 py-2 text-sm text-white outline-none"
                        />
                        <input
                          type="time"
                          value={entry.break_end}
                          onChange={(event) =>
                            setWorkingHours((current) => ({
                              ...current,
                              [day.value]: {
                                ...current[day.value],
                                break_end: event.target.value,
                              },
                            }))
                          }
                          className="rounded-xl border border-white/10 bg-slate-900 px-3 py-2 text-sm text-white outline-none"
                        />
                        <div className="flex items-center text-xs text-slate-400">
                          {entry.is_available ? "Active booking window" : "Closed"}
                        </div>
                      </div>
                    );
                  })}
                </div>

                <button
                  type="button"
                  disabled={isSavingSchedule || !selectedResourceId}
                  onClick={() => void handleScheduleSave()}
                  className="mt-5 rounded-full bg-sky-400 px-4 py-2 text-sm font-semibold text-slate-950 transition-colors hover:bg-sky-300 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {isSavingSchedule ? "Saving..." : "Save weekly schedule"}
                </button>
              </div>

              <form
                onSubmit={handleServiceSubmit}
                className="rounded-3xl border border-white/10 bg-slate-950/70 p-6"
              >
                <div>
                  <p className="text-xs uppercase tracking-[0.2em] text-slate-400">
                    Step 4
                  </p>
                  <h2 className="mt-2 text-2xl font-semibold text-white">
                    Create services
                  </h2>
                </div>

                <div className="mt-5 space-y-4">
                  <input
                    value={serviceForm.name}
                    onChange={(event) =>
                      setServiceForm((current) => ({
                        ...current,
                        name: event.target.value,
                      }))
                    }
                    placeholder="Consultation, Demo, Follow-up"
                    className="w-full rounded-2xl border border-white/10 bg-slate-900 px-4 py-3 text-white outline-none"
                    required
                  />
                  <textarea
                    value={serviceForm.description}
                    onChange={(event) =>
                      setServiceForm((current) => ({
                        ...current,
                        description: event.target.value,
                      }))
                    }
                    placeholder="What this service covers"
                    rows={4}
                    className="w-full rounded-2xl border border-white/10 bg-slate-900 px-4 py-3 text-white outline-none"
                  />

                  <div className="grid gap-4 sm:grid-cols-2">
                    <input
                      type="number"
                      min="5"
                      step="5"
                      value={serviceForm.duration_minutes}
                      onChange={(event) =>
                        setServiceForm((current) => ({
                          ...current,
                          duration_minutes: Number(event.target.value),
                        }))
                      }
                      className="rounded-2xl border border-white/10 bg-slate-900 px-4 py-3 text-white outline-none"
                    />
                    <input
                      type="number"
                      min="1"
                      value={serviceForm.capacity}
                      onChange={(event) =>
                        setServiceForm((current) => ({
                          ...current,
                          capacity: Number(event.target.value),
                        }))
                      }
                      className="rounded-2xl border border-white/10 bg-slate-900 px-4 py-3 text-white outline-none"
                    />
                    <input
                      type="number"
                      min="1"
                      value={serviceForm.max_bookings_per_user}
                      onChange={(event) =>
                        setServiceForm((current) => ({
                          ...current,
                          max_bookings_per_user: Number(event.target.value),
                        }))
                      }
                      className="rounded-2xl border border-white/10 bg-slate-900 px-4 py-3 text-white outline-none"
                    />
                    <label className="flex items-center gap-3 rounded-2xl border border-white/10 bg-slate-900 px-4 py-3 text-sm text-slate-200">
                      <input
                        type="checkbox"
                        checked={serviceForm.is_published}
                        onChange={(event) =>
                          setServiceForm((current) => ({
                            ...current,
                            is_published: event.target.checked,
                          }))
                        }
                      />
                      Publish immediately
                    </label>
                  </div>

                  <label className="flex items-center gap-3 rounded-2xl border border-white/10 bg-slate-900 px-4 py-3 text-sm text-slate-200">
                    <input
                      type="checkbox"
                      checked={serviceForm.requires_advance_payment}
                      onChange={(event) =>
                        setServiceForm((current) => ({
                          ...current,
                          requires_advance_payment: event.target.checked,
                        }))
                      }
                    />
                    Require advance payment
                  </label>

                  {serviceForm.requires_advance_payment && (
                    <input
                      type="number"
                      min="0"
                      step="0.01"
                      value={serviceForm.advance_payment_amount}
                      onChange={(event) =>
                        setServiceForm((current) => ({
                          ...current,
                          advance_payment_amount: Number(event.target.value),
                        }))
                      }
                      className="w-full rounded-2xl border border-white/10 bg-slate-900 px-4 py-3 text-white outline-none"
                    />
                  )}

                  <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
                    <p className="text-sm font-semibold text-white">
                      Assign resources to this service
                    </p>
                    <div className="mt-4 grid gap-2">
                      {resources.length === 0 ? (
                        <p className="text-sm text-slate-300">
                          Create at least one resource first.
                        </p>
                      ) : (
                        resources.map((resource) => {
                          const isSelected = selectedServiceResourceIds.includes(
                            resource.id,
                          );

                          return (
                            <label
                              key={resource.id}
                              className="flex items-center gap-3 rounded-2xl border border-white/10 bg-slate-950/60 px-4 py-3 text-sm text-slate-200"
                            >
                              <input
                                type="checkbox"
                                checked={isSelected}
                                onChange={(event) =>
                                  setSelectedServiceResourceIds((current) =>
                                    event.target.checked
                                      ? [...current, resource.id]
                                      : current.filter((item) => item !== resource.id),
                                  )
                                }
                              />
                              <span>
                                {resource.name} · {resource.type} · capacity {resource.capacity}
                              </span>
                            </label>
                          );
                        })
                      )}
                    </div>
                  </div>

                  <button
                    type="submit"
                    disabled={isSubmittingService}
                    className="rounded-full bg-white px-4 py-2 text-sm font-semibold text-slate-950 transition-colors hover:bg-slate-200 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    {isSubmittingService ? "Creating..." : "Create service"}
                  </button>
                </div>
              </form>
            </section>

            <section className="grid gap-6 xl:grid-cols-[1.05fr_0.95fr]">
              <div className="rounded-3xl border border-white/10 bg-slate-950/70 p-6">
                <div className="flex items-end justify-between gap-4">
                  <div>
                    <p className="text-xs uppercase tracking-[0.2em] text-slate-400">
                      Current services
                    </p>
                    <h2 className="mt-2 text-2xl font-semibold text-white">
                      Published and draft
                    </h2>
                  </div>
                </div>

                <div className="mt-5 space-y-4">
                  {services.length === 0 ? (
                    <div className="rounded-2xl border border-dashed border-white/10 bg-white/5 p-5 text-sm text-slate-300">
                      No services created yet.
                    </div>
                  ) : (
                    services.map((service) => (
                      <article
                        key={service.id}
                        className="rounded-2xl border border-white/10 bg-white/5 p-5"
                      >
                        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                          <div>
                            <div className="flex flex-wrap items-center gap-2">
                              <h3 className="text-xl font-semibold text-white">
                                {service.name}
                              </h3>
                              <span className="rounded-full border border-white/10 px-3 py-1 text-xs uppercase tracking-[0.2em] text-slate-200">
                                {service.is_published ? "Published" : "Draft"}
                              </span>
                            </div>
                            <p className="mt-2 text-sm text-slate-300">
                              {service.description || "No description."}
                            </p>
                            <p className="mt-3 text-xs text-slate-500">
                              {service.duration_minutes} min · capacity {service.capacity}
                            </p>
                            <div className="mt-4 flex flex-wrap gap-2">
                              {(serviceResourcesById[service.id] || []).map((resource) => (
                                <span
                                  key={resource.id}
                                  className="rounded-full border border-sky-300/20 bg-sky-300/10 px-3 py-1 text-xs text-sky-100"
                                >
                                  {resource.name}
                                </span>
                              ))}
                            </div>
                          </div>

                          <div className="flex flex-wrap gap-3">
                            <button
                              type="button"
                              disabled={publishingServiceId === service.id}
                              onClick={() => void handlePublishToggle(service)}
                              className="rounded-full border border-white/15 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-60"
                            >
                              {publishingServiceId === service.id
                                ? "Updating..."
                                : service.is_published
                                  ? "Unpublish"
                                  : "Publish"}
                            </button>
                            <Link
                              href={`/services/${service.id}`}
                              className="rounded-full bg-sky-400 px-4 py-2 text-sm font-semibold text-slate-950 transition-colors hover:bg-sky-300"
                            >
                              Open booking page
                            </Link>
                          </div>
                        </div>
                      </article>
                    ))
                  )}
                </div>
              </div>

              <div className="rounded-3xl border border-white/10 bg-white/5 p-6 backdrop-blur">
                <div>
                  <p className="text-xs uppercase tracking-[0.2em] text-slate-400">
                    Recent bookings
                  </p>
                  <h2 className="mt-2 text-2xl font-semibold text-white">
                    Customer activity
                  </h2>
                </div>

                <div className="mt-5 space-y-4">
                  {sortedAppointments.length === 0 ? (
                    <div className="rounded-2xl border border-dashed border-white/10 bg-slate-950/60 p-5 text-sm text-slate-300">
                      No bookings yet. Publish a service and ask a customer to book from the home page.
                    </div>
                  ) : (
                    sortedAppointments.slice(0, 8).map((appointment) => (
                      <article
                        key={appointment.id}
                        className="rounded-2xl border border-white/10 bg-slate-950/60 p-4"
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div>
                            <p className="font-semibold text-white">
                              {servicesById[appointment.service_id]?.name ||
                                `Service #${appointment.service_id}`}
                            </p>
                            <p className="mt-1 text-sm text-slate-300">
                              {formatDate(appointment.start_time)} ·{" "}
                              {formatTime(appointment.start_time)} to{" "}
                              {formatTime(appointment.end_time)}
                            </p>
                            <p className="mt-2 text-xs text-slate-500">
                              Resource:{" "}
                              {appointment.resource_id
                                ? resourcesById[appointment.resource_id]?.name ||
                                  `#${appointment.resource_id}`
                                : "Unassigned"}
                            </p>
                          </div>
                          <span className="rounded-full border border-white/10 px-3 py-1 text-xs uppercase tracking-[0.2em] text-slate-200">
                            {appointment.status}
                          </span>
                        </div>
                      </article>
                    ))
                  )}
                </div>

                <div className="mt-5 rounded-2xl border border-white/10 bg-slate-950/60 p-4 text-sm text-slate-300">
                  Today: {toDateInputValue()}.
                </div>
              </div>
            </section>
          </>
        )}
      </div>
    </AuthGuard>
  );
}
