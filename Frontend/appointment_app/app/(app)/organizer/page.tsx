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
import { motion, AnimatePresence } from "framer-motion";
import {
  Building2,
  Package,
  Clock,
  Briefcase,
  Plus,
  Check,
  Loader2,
  CheckCircle2,
  ExternalLink,
  ChevronDown,
  ChevronUp,
  Edit3,
} from "lucide-react";

type WorkingHourForm = {
  day_of_week: number;
  start_time: string;
  end_time: string;
  break_start: string;
  break_end: string;
  is_available: boolean;
};

type Toast = {
  id: string;
  message: string;
  type: "success" | "error";
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

// Toast notification component
function Toast({ message, type, onClose }: { message: string; type: "success" | "error"; onClose: () => void }) {
  useEffect(() => {
    const timer = setTimeout(onClose, 4000);
    return () => clearTimeout(timer);
  }, [onClose]);

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -20 }}
      className={`rounded-2xl border px-4 py-3 text-sm font-medium ${
        type === "success"
          ? "border-emerald-400/20 bg-emerald-500/10 text-emerald-100"
          : "border-red-400/20 bg-red-500/10 text-red-100"
      }`}
    >
      {message}
    </motion.div>
  );
}

// Skeleton loader component
function WorkspaceSkeleton() {
  return (
    <div className="space-y-8">
      <div className="h-32 rounded-3xl border border-white/10 bg-slate-950/50 animate-pulse" />
      <div className="grid gap-4 md:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="h-24 rounded-3xl border border-white/10 bg-slate-950/50 animate-pulse" />
        ))}
      </div>
      <div className="grid gap-6 xl:grid-cols-2">
        {Array.from({ length: 2 }).map((_, i) => (
          <div key={i} className="h-96 rounded-3xl border border-white/10 bg-slate-950/50 animate-pulse" />
        ))}
      </div>
    </div>
  );
}

// Collapsible form section component
function FormSection({
  title,
  subtitle,
  step,
  icon: Icon,
  isOpen,
  onToggle,
  children,
  isCompleted,
}: {
  title: string;
  subtitle: string;
  step: number;
  icon: React.ComponentType<{ className?: string }>;
  isOpen: boolean;
  onToggle: () => void;
  children: React.ReactNode;
  isCompleted?: boolean;
}) {
  return (
    <motion.div className="rounded-3xl border border-white/10 bg-white/5 backdrop-blur overflow-hidden">
      <button
        onClick={onToggle}
        className="w-full px-6 py-4 flex items-center justify-between hover:bg-white/10 transition-colors"
      >
        <div className="flex items-center gap-4">
          <div className="flex size-10 items-center justify-center rounded-xl bg-sky-400/20">
            {isCompleted ? (
              <CheckCircle2 className="size-5 text-emerald-400" />
            ) : (
              <Icon className="size-5 text-sky-300" />
            )}
          </div>
          <div className="text-left">
            <p className="text-xs uppercase tracking-[0.2em] text-slate-400">Step {step}</p>
            <p className="font-semibold text-white">{title}</p>
            <p className="text-sm text-slate-300">{subtitle}</p>
          </div>
        </div>
        {isOpen ? (
          <ChevronUp className="size-5 text-slate-400" />
        ) : (
          <ChevronDown className="size-5 text-slate-400" />
        )}
      </button>
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="overflow-hidden border-t border-white/10 bg-slate-950/40"
          >
            <div className="p-6 space-y-4">{children}</div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

// Stats card component
function StatsCard({
  label,
  value,
  icon: Icon,
  color,
}: {
  label: string;
  value: number;
  icon: React.ComponentType<{ className?: string }>;
  color: "sky" | "emerald" | "violet" | "amber";
}) {
  const colorMap = {
    sky: "bg-sky-500/20 text-sky-300",
    emerald: "bg-emerald-500/20 text-emerald-300",
    violet: "bg-violet-500/20 text-violet-300",
    amber: "bg-amber-500/20 text-amber-300",
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="rounded-3xl border border-white/10 bg-slate-950/70 p-6 hover:bg-slate-950/90 transition-colors"
    >
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-xs uppercase tracking-[0.2em] text-slate-400">{label}</p>
          <p className="mt-3 text-3xl font-bold text-white">{value}</p>
        </div>
        <div className={`rounded-xl p-3 ${colorMap[color]}`}>
          <Icon className="size-6" />
        </div>
      </div>
    </motion.div>
  );
}

// Form input component with validation
function FormInput({
  label,
  placeholder,
  value,
  onChange,
  error,
  type = "text",
  required = false,
  rows,
}: {
  label?: string;
  placeholder?: string;
  value: string | number;
  onChange: (value: string | number) => void;
  error?: string;
  type?: string;
  required?: boolean;
  rows?: number;
}) {
  const Component = rows ? "textarea" : "input";

  return (
    <div>
      {label && (
        <label className="block mb-2 text-sm font-medium text-slate-200">
          {label}
          {required && <span className="text-red-400 ml-1">*</span>}
        </label>
      )}
      <Component
        value={value}
        onChange={(e: any) => onChange(e.target.value)}
        placeholder={placeholder}
        type={type}
        rows={rows}
        required={required}
        className={`w-full rounded-2xl border px-4 py-3 text-white outline-none transition-colors ${
          error
            ? "border-red-400/50 bg-red-500/10 focus:border-red-400"
            : "border-white/10 bg-slate-900 focus:border-sky-400 focus:ring-sky-400/20 focus:ring-1"
        }`}
      />
      {error && <p className="mt-1 text-xs text-red-400">{error}</p>}
    </div>
  );
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
  
  const [isLoading, setIsLoading] = useState(true);
  const [isSavingSchedule, setIsSavingSchedule] = useState(false);
  const [isSubmittingOrg, setIsSubmittingOrg] = useState(false);
  const [isSubmittingResource, setIsSubmittingResource] = useState(false);
  const [isSubmittingService, setIsSubmittingService] = useState(false);
  const [publishingServiceId, setPublishingServiceId] = useState<number | null>(null);

  const [toasts, setToasts] = useState<Toast[]>([]);
  
  // Form validation errors
  const [orgErrors, setOrgErrors] = useState<Record<string, string>>({});
  const [resourceErrors, setResourceErrors] = useState<Record<string, string>>({});
  const [serviceErrors, setServiceErrors] = useState<Record<string, string>>({});

  // Collapsible sections
  const [openSections, setOpenSections] = useState({
    org: organizations.length === 0,
    resource: resources.length === 0,
    schedule: false,
    service: services.length === 0,
  });

  const addToast = (message: string, type: "success" | "error") => {
    const id = Date.now().toString();
    setToasts((prev) => [...prev, { id, message, type }]);
  };

  const removeToast = (id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  };

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
      addToast(getErrorMessage(loadError, "Failed to load workspace"), "error");
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

  function validateOrganization() {
    const errors: Record<string, string> = {};
    if (!organizationForm.name.trim()) {
      errors.name = "Organization name is required";
    }
    if (organizationForm.name.trim().length < 2) {
      errors.name = "Name must be at least 2 characters";
    }
    setOrgErrors(errors);
    return Object.keys(errors).length === 0;
  }

  function validateResource() {
    const errors: Record<string, string> = {};
    if (!resourceForm.name.trim()) {
      errors.name = "Resource name is required";
    }
    if (resourceForm.name.trim().length < 2) {
      errors.name = "Name must be at least 2 characters";
    }
    if (resourceForm.capacity < 1) {
      errors.capacity = "Capacity must be at least 1";
    }
    setResourceErrors(errors);
    return Object.keys(errors).length === 0;
  }

  function validateService() {
    const errors: Record<string, string> = {};
    if (!serviceForm.name.trim()) {
      errors.name = "Service name is required";
    }
    if (serviceForm.name.trim().length < 2) {
      errors.name = "Name must be at least 2 characters";
    }
    if (serviceForm.duration_minutes < 5) {
      errors.duration_minutes = "Duration must be at least 5 minutes";
    }
    if (serviceForm.capacity < 1) {
      errors.capacity = "Capacity must be at least 1";
    }
    if (serviceForm.requires_advance_payment && serviceForm.advance_payment_amount <= 0) {
      errors.advance_payment_amount = "Payment amount must be greater than 0";
    }
    setServiceErrors(errors);
    return Object.keys(errors).length === 0;
  }

  async function handleOrganizationSubmit(event: React.FormEvent) {
    event.preventDefault();
    if (!validateOrganization()) return;

    setIsSubmittingOrg(true);

    try {
      const organization = await apiFetch<Organization>("/api/organizations", {
        method: "POST",
        body: JSON.stringify({
          name: organizationForm.name.trim(),
          description: organizationForm.description.trim() || null,
        }),
      });

      setOrganizationForm({ name: "", description: "" });
      setOrgErrors({});
      setSelectedOrganizationId(organization.id);
      addToast("Organization created successfully", "success");
      await loadWorkspace();
    } catch (submitError) {
      addToast(getErrorMessage(submitError, "Failed to create organization"), "error");
    } finally {
      setIsSubmittingOrg(false);
    }
  }

  async function handleResourceSubmit(event: React.FormEvent) {
    event.preventDefault();
    if (!validateResource()) return;
    if (!selectedOrganizationId) {
      addToast("Create or select an organization first", "error");
      return;
    }

    setIsSubmittingResource(true);

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
      setResourceErrors({});
      setSelectedResourceId(resource.id);
      setOpenSections((prev) => ({ ...prev, schedule: true }));
      addToast("Resource created. Configure working hours next", "success");
      await loadWorkspace();
    } catch (submitError) {
      addToast(getErrorMessage(submitError, "Failed to create resource"), "error");
    } finally {
      setIsSubmittingResource(false);
    }
  }

  async function handleScheduleSave() {
    if (!selectedResourceId) {
      addToast("Select a resource before saving working hours", "error");
      return;
    }

    setIsSavingSchedule(true);

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

      addToast("Working hours saved successfully", "success");

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
      addToast(getErrorMessage(saveError, "Failed to save working hours"), "error");
    } finally {
      setIsSavingSchedule(false);
    }
  }

  async function handleServiceSubmit(event: React.FormEvent) {
    event.preventDefault();
    if (!validateService()) return;
    if (!selectedOrganizationId) {
      addToast("Create or select an organization first", "error");
      return;
    }

    setIsSubmittingService(true);

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
      setServiceErrors({});
      addToast("Service created successfully", "success");
      await loadWorkspace();
    } catch (submitError) {
      addToast(getErrorMessage(submitError, "Failed to create service"), "error");
    } finally {
      setIsSubmittingService(false);
    }
  }

  async function handlePublishToggle(service: Service) {
    setPublishingServiceId(service.id);

    try {
      await apiFetch(
        `/api/services/${service.id}/${service.is_published ? "unpublish" : "publish"}`,
        {
          method: "POST",
        },
      );
      addToast(
        service.is_published ? "Service unpublished" : "Service published",
        "success",
      );
      await loadWorkspace();
    } catch (toggleError) {
      addToast(getErrorMessage(toggleError, "Failed to update service status"), "error");
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

  const completionStatus = useMemo(
    () => ({
      org: organizations.length > 0,
      resource: resources.length > 0,
      schedule: Object.values(existingWorkingHours).some((h) => h.is_available),
      service: services.length > 0,
    }),
    [organizations, resources, existingWorkingHours, services],
  );

  if (isLoading) {
    return (
      <AuthGuard allowedRoles={["ORGANIZER", "ADMIN"]}>
        <WorkspaceSkeleton />
      </AuthGuard>
    );
  }

  return (
    <AuthGuard allowedRoles={["ORGANIZER", "ADMIN"]}>
      <div className="space-y-8">
        {/* Toast notifications */}
        <AnimatePresence mode="popLayout">
          <div className="fixed bottom-8 right-8 z-50 space-y-3">
            {toasts.map((toast) => (
              <Toast
                key={toast.id}
                message={toast.message}
                type={toast.type}
                onClose={() => removeToast(toast.id)}
              />
            ))}
          </div>
        </AnimatePresence>

        {/* Header */}
        <motion.section
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="rounded-3xl border border-white/10 bg-gradient-to-br from-white/5 to-white/0 p-8 backdrop-blur"
        >
          <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <p className="text-xs uppercase tracking-[0.25em] text-sky-300/80">
                Organizer workspace
              </p>
              <h1 className="mt-2 text-4xl font-bold tracking-tight text-white">
                Service Management
              </h1>
              <p className="mt-3 max-w-3xl text-slate-300">
                Set up your organization, define resources, configure availability, and publish services for customers to book.
              </p>
            </div>

            <div className="flex flex-wrap gap-3">
              <Link
                href="/"
                className="inline-flex items-center gap-2 rounded-full border border-white/15 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-white/10"
              >
                <ExternalLink className="size-4" />
                Customer home
              </Link>
              <Link
                href="/appointments"
                className="inline-flex items-center gap-2 rounded-full bg-sky-400 px-4 py-2 text-sm font-semibold text-slate-950 transition-colors hover:bg-sky-300"
              >
                <Edit3 className="size-4" />
                All bookings
              </Link>
            </div>
          </div>
        </motion.section>

        {/* Stats */}
        <div className="grid gap-4 md:grid-cols-4">
          <StatsCard
            label="Organizations"
            value={organizations.length}
            icon={Building2}
            color="sky"
          />
          <StatsCard
            label="Resources"
            value={resources.length}
            icon={Package}
            color="emerald"
          />
          <StatsCard
            label="Services"
            value={services.length}
            icon={Briefcase}
            color="violet"
          />
          <StatsCard
            label="Total Bookings"
            value={appointments.length}
            icon={Clock}
            color="amber"
          />
        </div>

        {/* Onboarding progress */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="rounded-2xl border border-white/10 bg-slate-950/50 p-4"
        >
          <p className="text-sm font-medium text-slate-200 mb-3">Setup Progress</p>
          <div className="flex gap-2">
            {[
              { label: "Org", completed: completionStatus.org },
              { label: "Resources", completed: completionStatus.resource },
              { label: "Hours", completed: completionStatus.schedule },
              { label: "Services", completed: completionStatus.service },
            ].map((step, i) => (
              <div
                key={i}
                className={`flex-1 h-2 rounded-full transition-colors ${
                  step.completed ? "bg-emerald-400" : "bg-slate-700"
                }`}
                title={step.label}
              />
            ))}
          </div>
        </motion.div>

        {/* Forms sections */}
        <div className="space-y-4">
          {/* Organization */}
          <FormSection
            title="Organization Context"
            subtitle="Your business entity"
            step={1}
            icon={Building2}
            isOpen={openSections.org}
            onToggle={() => setOpenSections((p) => ({ ...p, org: !p.org }))}
            isCompleted={completionStatus.org}
          >
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-200 mb-2">
                  Active Organization
                </label>
                {organizations.length > 0 ? (
                  <select
                    value={selectedOrganizationId ?? ""}
                    onChange={(e) => setSelectedOrganizationId(Number(e.target.value) || null)}
                    className="w-full rounded-2xl border border-white/10 bg-slate-950 px-4 py-3 text-white outline-none focus:border-sky-400 focus:ring-sky-400/20 focus:ring-1"
                  >
                    <option value="">Select organization</option>
                    {organizations.map((org) => (
                      <option key={org.id} value={org.id}>
                        {org.name}
                      </option>
                    ))}
                  </select>
                ) : (
                  <p className="text-sm text-slate-400">No organizations yet. Create one below.</p>
                )}
              </div>

              <div className="rounded-2xl border border-white/10 bg-slate-950/60 p-4 space-y-4">
                <p className="text-sm font-semibold text-white">Create New Organization</p>
                <FormInput
                  label="Organization Name"
                  placeholder="Your studio, clinic, or agency"
                  value={organizationForm.name}
                  onChange={(v) => setOrganizationForm((p) => ({ ...p, name: v as string }))}
                  error={orgErrors.name}
                  required
                />
                <FormInput
                  label="Description"
                  placeholder="Brief description of your organization"
                  value={organizationForm.description}
                  onChange={(v) => setOrganizationForm((p) => ({ ...p, description: v as string }))}
                  rows={3}
                />
                <button
                  onClick={handleOrganizationSubmit}
                  disabled={isSubmittingOrg}
                  className="w-full rounded-full bg-sky-400 hover:bg-sky-300 disabled:opacity-60 disabled:cursor-not-allowed px-4 py-2 text-sm font-semibold text-slate-950 transition-colors flex items-center justify-center gap-2"
                >
                  {isSubmittingOrg ? (
                    <>
                      <Loader2 className="size-4 animate-spin" />
                      Creating...
                    </>
                  ) : (
                    <>
                      <Plus className="size-4" />
                      Create Organization
                    </>
                  )}
                </button>
              </div>
            </div>
          </FormSection>

          {/* Resources */}
          <FormSection
            title="Bookable Resources"
            subtitle="Providers, rooms, equipment"
            step={2}
            icon={Package}
            isOpen={openSections.resource}
            onToggle={() => setOpenSections((p) => ({ ...p, resource: !p.resource }))}
            isCompleted={completionStatus.resource}
          >
            <div className="space-y-4">
              {selectedOrganizationId ? (
                <>
                  <div className="grid gap-4 md:grid-cols-2">
                    <FormInput
                      label="Resource Name"
                      placeholder="Dr. Smith, Meeting Room A"
                      value={resourceForm.name}
                      onChange={(v) => setResourceForm((p) => ({ ...p, name: v as string }))}
                      error={resourceErrors.name}
                      required
                    />
                    <div>
                      <label className="block mb-2 text-sm font-medium text-slate-200">
                        Type <span className="text-red-400">*</span>
                      </label>
                      <select
                        value={resourceForm.type}
                        onChange={(e) => setResourceForm((p) => ({ ...p, type: e.target.value as ResourceType }))}
                        className="w-full rounded-2xl border border-white/10 bg-slate-900 px-4 py-3 text-white outline-none focus:border-sky-400 focus:ring-sky-400/20 focus:ring-1"
                      >
                        <option value="PROVIDER">Provider</option>
                        <option value="ROOM">Room</option>
                        <option value="EQUIPMENT">Equipment</option>
                      </select>
                    </div>
                    <FormInput
                      label="Capacity"
                      value={resourceForm.capacity}
                      onChange={(v) => setResourceForm((p) => ({ ...p, capacity: Number(v) }))}
                      error={resourceErrors.capacity}
                      type="number"
                      required
                    />
                    <FormInput
                      label="Description"
                      placeholder="Optional details"
                      value={resourceForm.description}
                      onChange={(v) => setResourceForm((p) => ({ ...p, description: v as string }))}
                    />
                  </div>

                  <button
                    onClick={handleResourceSubmit}
                    disabled={isSubmittingResource}
                    className="w-full rounded-full bg-white hover:bg-slate-200 disabled:opacity-60 disabled:cursor-not-allowed text-slate-950 px-4 py-2 text-sm font-semibold transition-colors flex items-center justify-center gap-2"
                  >
                    {isSubmittingResource ? (
                      <>
                        <Loader2 className="size-4 animate-spin" />
                        Creating...
                      </>
                    ) : (
                      <>
                        <Plus className="size-4" />
                        Create Resource
                      </>
                    )}
                  </button>

                  {resources.length > 0 && (
                    <div className="rounded-2xl border border-white/10 bg-slate-950/40 p-3">
                      <p className="text-xs text-slate-400 mb-2">Resources ({resources.length})</p>
                      <div className="flex flex-wrap gap-2">
                        {resources.map((r) => (
                          <span
                            key={r.id}
                            className="inline-flex items-center gap-1 rounded-full border border-white/10 bg-slate-950 px-3 py-1 text-xs text-slate-200"
                          >
                            {r.name}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}
                </>
              ) : (
                <div className="rounded-2xl border border-dashed border-white/10 bg-slate-950/40 p-4 text-center">
                  <p className="text-sm text-slate-400">Create an organization first</p>
                </div>
              )}
            </div>
          </FormSection>

          {/* Working Hours */}
          <FormSection
            title="Weekly Availability"
            subtitle="Configure working hours per resource"
            step={3}
            icon={Clock}
            isOpen={openSections.schedule}
            onToggle={() => setOpenSections((p) => ({ ...p, schedule: !p.schedule }))}
            isCompleted={completionStatus.schedule}
          >
            <div className="space-y-4">
              {resources.length > 0 ? (
                <>
                  <div>
                    <label className="block text-sm font-medium text-slate-200 mb-2">
                      Select Resource
                    </label>
                    <select
                      value={selectedResourceId ?? ""}
                      onChange={(e) => setSelectedResourceId(Number(e.target.value) || null)}
                      className="w-full rounded-2xl border border-white/10 bg-slate-950 px-4 py-3 text-white outline-none focus:border-sky-400 focus:ring-sky-400/20 focus:ring-1"
                    >
                      <option value="">Select a resource</option>
                      {resources.map((r) => (
                        <option key={r.id} value={r.id}>
                          {r.name}
                        </option>
                      ))}
                    </select>
                  </div>

                  {selectedResourceId && (
                    <div className="space-y-3">
                      {weekDays.map((day) => {
                        const entry = workingHours[day.value];
                        return (
                          <div
                            key={day.value}
                            className="rounded-2xl border border-white/10 bg-slate-950/40 p-4 space-y-3"
                          >
                            <div className="flex items-center justify-between">
                              <span className="font-medium text-white">{day.label}</span>
                              <label className="flex items-center gap-2 text-xs text-slate-300 cursor-pointer">
                                <input
                                  type="checkbox"
                                  checked={entry.is_available}
                                  onChange={(e) =>
                                    setWorkingHours((p) => ({
                                      ...p,
                                      [day.value]: { ...p[day.value], is_available: e.target.checked },
                                    }))
                                  }
                                  className="rounded"
                                />
                                Open for bookings
                              </label>
                            </div>

                            {entry.is_available && (
                              <div className="grid gap-3 sm:grid-cols-4">
                                <div>
                                  <label className="block text-xs text-slate-400 mb-1">Start</label>
                                  <input
                                    type="time"
                                    value={entry.start_time}
                                    onChange={(e) =>
                                      setWorkingHours((p) => ({
                                        ...p,
                                        [day.value]: { ...p[day.value], start_time: e.target.value },
                                      }))
                                    }
                                    className="w-full rounded-lg border border-white/10 bg-slate-900 px-3 py-2 text-sm text-white outline-none focus:border-sky-400"
                                  />
                                </div>
                                <div>
                                  <label className="block text-xs text-slate-400 mb-1">End</label>
                                  <input
                                    type="time"
                                    value={entry.end_time}
                                    onChange={(e) =>
                                      setWorkingHours((p) => ({
                                        ...p,
                                        [day.value]: { ...p[day.value], end_time: e.target.value },
                                      }))
                                    }
                                    className="w-full rounded-lg border border-white/10 bg-slate-900 px-3 py-2 text-sm text-white outline-none focus:border-sky-400"
                                  />
                                </div>
                                <div>
                                  <label className="block text-xs text-slate-400 mb-1">Break start</label>
                                  <input
                                    type="time"
                                    value={entry.break_start}
                                    onChange={(e) =>
                                      setWorkingHours((p) => ({
                                        ...p,
                                        [day.value]: { ...p[day.value], break_start: e.target.value },
                                      }))
                                    }
                                    className="w-full rounded-lg border border-white/10 bg-slate-900 px-3 py-2 text-sm text-white outline-none focus:border-sky-400"
                                  />
                                </div>
                                <div>
                                  <label className="block text-xs text-slate-400 mb-1">Break end</label>
                                  <input
                                    type="time"
                                    value={entry.break_end}
                                    onChange={(e) =>
                                      setWorkingHours((p) => ({
                                        ...p,
                                        [day.value]: { ...p[day.value], break_end: e.target.value },
                                      }))
                                    }
                                    className="w-full rounded-lg border border-white/10 bg-slate-900 px-3 py-2 text-sm text-white outline-none focus:border-sky-400"
                                  />
                                </div>
                              </div>
                            )}
                          </div>
                        );
                      })}

                      <button
                        onClick={() => void handleScheduleSave()}
                        disabled={isSavingSchedule}
                        className="w-full rounded-full bg-sky-400 hover:bg-sky-300 disabled:opacity-60 disabled:cursor-not-allowed px-4 py-2 text-sm font-semibold text-slate-950 transition-colors flex items-center justify-center gap-2"
                      >
                        {isSavingSchedule ? (
                          <>
                            <Loader2 className="size-4 animate-spin" />
                            Saving...
                          </>
                        ) : (
                          <>
                            <Check className="size-4" />
                            Save Weekly Schedule
                          </>
                        )}
                      </button>
                    </div>
                  )}
                </>
              ) : (
                <div className="rounded-2xl border border-dashed border-white/10 bg-slate-950/40 p-4 text-center">
                  <p className="text-sm text-slate-400">Create resources first</p>
                </div>
              )}
            </div>
          </FormSection>

          {/* Services */}
          <FormSection
            title="Bookable Services"
            subtitle="What customers can reserve"
            step={4}
            icon={Briefcase}
            isOpen={openSections.service}
            onToggle={() => setOpenSections((p) => ({ ...p, service: !p.service }))}
            isCompleted={completionStatus.service}
          >
            <div className="space-y-4">
              {selectedOrganizationId ? (
                <>
                  <FormInput
                    label="Service Name"
                    placeholder="Consultation, Session, Demo"
                    value={serviceForm.name}
                    onChange={(v) => setServiceForm((p) => ({ ...p, name: v as string }))}
                    error={serviceErrors.name}
                    required
                  />
                  <FormInput
                    label="Description"
                    placeholder="What this service includes"
                    value={serviceForm.description}
                    onChange={(v) => setServiceForm((p) => ({ ...p, description: v as string }))}
                    rows={4}
                  />

                  <div className="grid gap-4 md:grid-cols-2">
                    <FormInput
                      label="Duration (minutes)"
                      value={serviceForm.duration_minutes}
                      onChange={(v) => setServiceForm((p) => ({ ...p, duration_minutes: Number(v) }))}
                      error={serviceErrors.duration_minutes}
                      type="number"
                      required
                    />
                    <FormInput
                      label="Capacity"
                      value={serviceForm.capacity}
                      onChange={(v) => setServiceForm((p) => ({ ...p, capacity: Number(v) }))}
                      error={serviceErrors.capacity}
                      type="number"
                      required
                    />
                    <FormInput
                      label="Max bookings per user"
                      value={serviceForm.max_bookings_per_user}
                      onChange={(v) => setServiceForm((p) => ({ ...p, max_bookings_per_user: Number(v) }))}
                      type="number"
                    />
                    <label className="flex items-center gap-3 rounded-2xl border border-white/10 bg-slate-900 px-4 py-3 text-sm text-slate-200 cursor-pointer hover:bg-slate-850">
                      <input
                        type="checkbox"
                        checked={serviceForm.is_published}
                        onChange={(e) => setServiceForm((p) => ({ ...p, is_published: e.target.checked }))}
                      />
                      Publish immediately
                    </label>
                  </div>

                  <label className="flex items-center gap-3 rounded-2xl border border-white/10 bg-slate-900 px-4 py-3 text-sm text-slate-200 cursor-pointer hover:bg-slate-850">
                    <input
                      type="checkbox"
                      checked={serviceForm.requires_advance_payment}
                      onChange={(e) => setServiceForm((p) => ({ ...p, requires_advance_payment: e.target.checked }))}
                    />
                    Require advance payment
                  </label>

                  {serviceForm.requires_advance_payment && (
                    <FormInput
                      label="Payment Amount ($)"
                      value={serviceForm.advance_payment_amount}
                      onChange={(v) => setServiceForm((p) => ({ ...p, advance_payment_amount: Number(v) }))}
                      error={serviceErrors.advance_payment_amount}
                      type="number"
                    />
                  )}

                  <div className="rounded-2xl border border-white/10 bg-slate-950/40 p-4 space-y-3">
                    <p className="text-sm font-semibold text-white">Assign Resources</p>
                    {resources.length > 0 ? (
                      <div className="space-y-2">
                        {resources.map((resource) => {
                          const isSelected = selectedServiceResourceIds.includes(resource.id);
                          return (
                            <label
                              key={resource.id}
                              className="flex items-center gap-3 rounded-2xl border border-white/10 bg-slate-950/60 px-4 py-3 text-sm text-slate-200 cursor-pointer hover:bg-slate-950/80 transition-colors"
                            >
                              <input
                                type="checkbox"
                                checked={isSelected}
                                onChange={(e) =>
                                  setSelectedServiceResourceIds((p) =>
                                    e.target.checked
                                      ? [...p, resource.id]
                                      : p.filter((id) => id !== resource.id),
                                  )
                                }
                              />
                              <span>
                                {resource.name} · {resource.type} (capacity {resource.capacity})
                              </span>
                            </label>
                          );
                        })}
                      </div>
                    ) : (
                      <p className="text-xs text-slate-400">Create resources first</p>
                    )}
                  </div>

                  <button
                    onClick={handleServiceSubmit}
                    disabled={isSubmittingService}
                    className="w-full rounded-full bg-white hover:bg-slate-200 disabled:opacity-60 disabled:cursor-not-allowed text-slate-950 px-4 py-2 text-sm font-semibold transition-colors flex items-center justify-center gap-2"
                  >
                    {isSubmittingService ? (
                      <>
                        <Loader2 className="size-4 animate-spin" />
                        Creating...
                      </>
                    ) : (
                      <>
                        <Plus className="size-4" />
                        Create Service
                      </>
                    )}
                  </button>
                </>
              ) : (
                <div className="rounded-2xl border border-dashed border-white/10 bg-slate-950/40 p-4 text-center">
                  <p className="text-sm text-slate-400">Create an organization first</p>
                </div>
              )}
            </div>
          </FormSection>
        </div>

        {/* Services and bookings grid */}
        {services.length > 0 || appointments.length > 0 ? (
          <div className="grid gap-6 lg:grid-cols-2">
            {/* Services */}
            {services.length > 0 && (
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className="rounded-3xl border border-white/10 bg-white/5 p-6 backdrop-blur"
              >
                <div className="mb-6">
                  <p className="text-xs uppercase tracking-[0.2em] text-slate-400">Catalog</p>
                  <h2 className="mt-2 text-2xl font-semibold text-white">Published Services</h2>
                </div>

                <div className="space-y-4">
                  {services.map((service) => (
                    <motion.div
                      key={service.id}
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      className="rounded-2xl border border-white/10 bg-slate-950/40 p-4 hover:bg-slate-950/60 transition-colors"
                    >
                      <div className="flex items-start justify-between gap-3 mb-3">
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-1">
                            <h3 className="font-semibold text-white">{service.name}</h3>
                            <span className={`text-xs px-2 py-1 rounded-full ${
                              service.is_published
                                ? "bg-emerald-500/20 text-emerald-300"
                                : "bg-slate-600/20 text-slate-300"
                            }`}>
                              {service.is_published ? "Published" : "Draft"}
                            </span>
                          </div>
                          <p className="text-sm text-slate-300 line-clamp-1">
                            {service.description || "No description"}
                          </p>
                          <p className="text-xs text-slate-400 mt-2">
                            {service.duration_minutes}min · {service.capacity} capacity
                          </p>
                        </div>
                        <button
                          onClick={() => void handlePublishToggle(service)}
                          disabled={publishingServiceId === service.id}
                          className={`px-3 py-1 rounded-full text-xs font-semibold transition-colors disabled:opacity-50 ${
                            service.is_published
                              ? "border border-white/15 hover:bg-white/10 text-white"
                              : "bg-emerald-500/20 text-emerald-300 hover:bg-emerald-500/30"
                          }`}
                        >
                          {publishingServiceId === service.id ? "..." : service.is_published ? "Unpublish" : "Publish"}
                        </button>
                      </div>
                      {(serviceResourcesById[service.id] || []).length > 0 && (
                        <div className="flex flex-wrap gap-1">
                          {(serviceResourcesById[service.id] || []).map((r) => (
                            <span key={r.id} className="text-xs px-2 py-0.5 rounded-full bg-sky-500/20 text-sky-300">
                              {r.name}
                            </span>
                          ))}
                        </div>
                      )}
                    </motion.div>
                  ))}
                </div>
              </motion.div>
            )}

            {/* Recent bookings */}
            {appointments.length > 0 && (
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className="rounded-3xl border border-white/10 bg-white/5 p-6 backdrop-blur"
              >
                <div className="mb-6">
                  <p className="text-xs uppercase tracking-[0.2em] text-slate-400">Activity</p>
                  <h2 className="mt-2 text-2xl font-semibold text-white">Recent Bookings</h2>
                </div>

                <div className="space-y-3 max-h-96 overflow-y-auto">
                  {sortedAppointments.slice(0, 8).map((appointment) => (
                    <motion.div
                      key={appointment.id}
                      initial={{ opacity: 0, x: -10 }}
                      animate={{ opacity: 1, x: 0 }}
                      className="rounded-2xl border border-white/10 bg-slate-950/40 p-3 text-sm"
                    >
                      <div className="flex items-start justify-between gap-2 mb-1">
                        <p className="font-medium text-white line-clamp-1">
                          {servicesById[appointment.service_id]?.name || `Service #${appointment.service_id}`}
                        </p>
                        <span className={`text-xs px-2 py-0.5 rounded-full whitespace-nowrap flex-shrink-0 ${
                          appointment.status === "confirmed"
                            ? "bg-emerald-500/20 text-emerald-300"
                            : appointment.status === "cancelled"
                              ? "bg-red-500/20 text-red-300"
                              : "bg-amber-500/20 text-amber-300"
                        }`}>
                          {appointment.status}
                        </span>
                      </div>
                      <p className="text-xs text-slate-400">
                        {formatDate(appointment.start_time)} · {formatTime(appointment.start_time)}
                      </p>
                    </motion.div>
                  ))}
                </div>
              </motion.div>
            )}
          </div>
        ) : null}
      </div>
    </AuthGuard>
  );
}
