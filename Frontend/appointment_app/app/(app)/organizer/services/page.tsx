"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import {
  Suspense,
  useCallback,
  useDeferredValue,
  useEffect,
  useMemo,
  useState,
} from "react";
import { formatDistanceToNow } from "date-fns";
import { useAuth } from "@/hooks/useAuth";
import { apiFetch } from "@/lib/api";
import { getErrorMessage } from "@/lib/errors";
import { buildServiceShareUrl } from "@/lib/organizer-services";
import {
  OrganizerServiceFilter,
  OrganizerServiceSort,
  OrganizerServiceView,
  ServiceList,
} from "@/components/organizer/service-list";
import type { OrganizerToast } from "@/components/organizer/organizer-toast-region";
import { OrganizerToastRegion } from "@/components/organizer/organizer-toast-region";
import type { Appointment } from "@/types/booking";
import type { Resource } from "@/types/resource";
import type { FormQuestion, Service, ServiceResourceAssignment } from "@/types/service";

const defaultFilter: OrganizerServiceFilter = "all";
const defaultSort: OrganizerServiceSort = "newest";
const defaultView: OrganizerServiceView = "grid";

function isFutureAppointment(appointment: Appointment) {
  return (
    appointment.status !== "CANCELLED" &&
    appointment.status !== "COMPLETED" &&
    appointment.status !== "NO_SHOW" &&
    new Date(appointment.start_time).getTime() > Date.now()
  );
}

function OrganizerServicesPageFallback() {
  return (
    <div className="space-y-6">
      <div className="h-32 animate-pulse rounded-[32px] border border-white/10 bg-white/[0.04]" />
      <div className="h-[520px] animate-pulse rounded-[32px] border border-white/10 bg-white/[0.04]" />
    </div>
  );
}

function OrganizerServicesPageContent() {
  const { user } = useAuth();
  const pathname = usePathname();
  const router = useRouter();
  const searchParams = useSearchParams();

  const [services, setServices] = useState<Service[]>([]);
  const [resourcesById, setResourcesById] = useState<Record<number, Resource>>({});
  const [assignmentsByServiceId, setAssignmentsByServiceId] = useState<
    Record<number, ServiceResourceAssignment[]>
  >({});
  const [upcomingServiceIds, setUpcomingServiceIds] = useState<Set<number>>(new Set());
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const [pendingServiceId, setPendingServiceId] = useState<number | null>(null);
  const [duplicateServiceId, setDuplicateServiceId] = useState<number | null>(null);
  const [deleteServiceId, setDeleteServiceId] = useState<number | null>(null);
  const [toasts, setToasts] = useState<OrganizerToast[]>([]);

  const query = useMemo(
    () => new URLSearchParams(searchParams.toString()),
    [searchParams],
  );
  const searchValue = query.get("q") ?? "";
  const filterValue = (query.get("filter") ?? defaultFilter) as OrganizerServiceFilter;
  const sortValue = (query.get("sort") ?? defaultSort) as OrganizerServiceSort;
  const viewValue = (query.get("view") ?? defaultView) as OrganizerServiceView;
  const deferredSearchValue = useDeferredValue(searchValue.trim().toLowerCase());

  const addToast = useCallback((message: string, tone: OrganizerToast["tone"]) => {
    setToasts((current) => [
      ...current,
      {
        id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
        message,
        tone,
      },
    ]);
  }, []);

  const dismissToast = useCallback((id: string) => {
    setToasts((current) => current.filter((toast) => toast.id !== id));
  }, []);

  const updateQuery = useCallback(
    (patch: Partial<Record<"q" | "filter" | "sort" | "view", string | null>>) => {
      const next = new URLSearchParams(searchParams.toString());
      Object.entries(patch).forEach(([key, value]) => {
        const shouldDelete =
          value == null ||
          value === "" ||
          (key === "filter" && value === defaultFilter) ||
          (key === "sort" && value === defaultSort) ||
          (key === "view" && value === defaultView);

        if (shouldDelete) {
          next.delete(key);
          return;
        }
        next.set(key, value);
      });

      router.replace(next.toString() ? `${pathname}?${next.toString()}` : pathname, {
        scroll: false,
      });
    },
    [pathname, router, searchParams],
  );

  const loadServices = useCallback(async () => {
    if (!user) {
      return;
    }

    setIsLoading(true);
    setLoadError(null);

    try {
      const [serviceData, resourceData, appointmentData] = await Promise.all([
        apiFetch<Service[]>("/api/organizer/services"),
        apiFetch<Resource[]>("/api/resources"),
        apiFetch<Appointment[]>("/api/appointments"),
      ]);

      const assignmentResults = await Promise.allSettled(
        serviceData.map((service) =>
          apiFetch<ServiceResourceAssignment[]>(
            `/api/organizer/services/${service.id}/resources`,
          ),
        ),
      );

      const nextAssignments: Record<number, ServiceResourceAssignment[]> = {};
      assignmentResults.forEach((result, index) => {
        const serviceId = serviceData[index].id;
        if (result.status === "fulfilled") {
          nextAssignments[serviceId] = result.value;
          return;
        }

        nextAssignments[serviceId] = [];
      });

      if (assignmentResults.some((result) => result.status === "rejected")) {
        addToast("Some resource assignments could not be loaded.", "error");
      }

      setServices(serviceData);
      setResourcesById(
        resourceData.reduce<Record<number, Resource>>((accumulator, resource) => {
          accumulator[resource.id] = resource;
          return accumulator;
        }, {}),
      );
      setAssignmentsByServiceId(nextAssignments);
      setUpcomingServiceIds(
        new Set(
          appointmentData.filter(isFutureAppointment).map((appointment) => appointment.service_id),
        ),
      );
      setLastUpdated(new Date());
    } catch (error) {
      setLoadError(getErrorMessage(error, "Failed to load organizer services."));
    } finally {
      setIsLoading(false);
    }
  }, [addToast, user]);

  useEffect(() => {
    void loadServices();
  }, [loadServices]);

  useEffect(() => {
    const interval = window.setInterval(() => {
      void loadServices();
    }, 30000);

    return () => window.clearInterval(interval);
  }, [loadServices]);

  const filteredServices = useMemo(() => {
    const filtered = services.filter((service) => {
      const matchesSearch =
        deferredSearchValue.length === 0 ||
        service.name.toLowerCase().includes(deferredSearchValue) ||
        (service.description ?? "").toLowerCase().includes(deferredSearchValue);

      if (!matchesSearch) {
        return false;
      }

      if (filterValue === "published") {
        return service.is_published;
      }

      if (filterValue === "draft") {
        return !service.is_published;
      }

      if (filterValue === "upcoming") {
        return upcomingServiceIds.has(service.id);
      }

      return true;
    });

    return filtered.sort((left, right) => {
      switch (sortValue) {
        case "oldest":
          return new Date(left.created_at).getTime() - new Date(right.created_at).getTime();
        case "name":
          return left.name.localeCompare(right.name);
        case "duration":
          return left.duration_minutes - right.duration_minutes;
        case "capacity":
          return left.capacity - right.capacity;
        case "newest":
        default:
          return new Date(right.created_at).getTime() - new Date(left.created_at).getTime();
      }
    });
  }, [deferredSearchValue, filterValue, services, sortValue, upcomingServiceIds]);

  async function handleCopyLink(service: Service) {
    try {
      const origin = window.location.origin;
      const url = buildServiceShareUrl(service, origin);
      await navigator.clipboard.writeText(url);
      addToast("Share link copied to clipboard.", "success");
    } catch (error) {
      addToast(getErrorMessage(error, "Failed to copy link."), "error");
    }
  }

  async function handleTogglePublish(service: Service, nextPublishedState: boolean) {
    setPendingServiceId(service.id);

    try {
      const updated = await apiFetch<Service>(`/api/services/${service.id}`, {
        method: "PUT",
        body: JSON.stringify({ is_published: nextPublishedState }),
      });

      let nextService = updated;
      if (nextPublishedState && !updated.shareable_link) {
        const share = await apiFetch<{ shareable_link: string }>(
          `/api/services/${service.id}/shareable-link`,
          { method: "POST" },
        );
        nextService = { ...updated, shareable_link: share.shareable_link };
      }

      setServices((current) =>
        current.map((candidate) => (candidate.id === service.id ? nextService : candidate)),
      );
      addToast(
        nextPublishedState
          ? "Service published and available to customers."
          : "Service moved back to draft.",
        "success",
      );
    } catch (error) {
      addToast(getErrorMessage(error, "Failed to update publish state."), "error");
    } finally {
      setPendingServiceId(null);
    }
  }

  async function handleDelete(service: Service) {
    setDeleteServiceId(service.id);

    try {
      await apiFetch(`/api/services/${service.id}`, { method: "DELETE" });
      setServices((current) => current.filter((candidate) => candidate.id !== service.id));
      setAssignmentsByServiceId((current) => {
        const next = { ...current };
        delete next[service.id];
        return next;
      });
      addToast("Service deleted.", "success");
    } catch (error) {
      addToast(getErrorMessage(error, "Failed to delete service."), "error");
    } finally {
      setDeleteServiceId(null);
    }
  }

  async function handleDuplicate(service: Service) {
    setDuplicateServiceId(service.id);

    try {
      const sourceQuestions = await apiFetch<FormQuestion[]>(
        `/api/organizer/services/${service.id}/form-questions`,
      );

      const createdService = await apiFetch<Service>("/api/services", {
        method: "POST",
        body: JSON.stringify({
          organization_id: service.organization_id,
          name: `${service.name} (Copy)`,
          description: service.description ?? null,
          duration_minutes: service.duration_minutes,
          capacity: service.capacity,
          is_published: false,
          max_bookings_per_user: service.max_bookings_per_user,
          requires_advance_payment: service.requires_advance_payment,
          advance_payment_amount: service.advance_payment_amount,
        }),
      });

      const sourceAssignments = assignmentsByServiceId[service.id] ?? [];

      await Promise.all([
        ...sourceAssignments.map((assignment) =>
          apiFetch(`/api/services/${createdService.id}/resources`, {
            method: "POST",
            body: JSON.stringify({
              resource_id: assignment.resource_id,
              is_required: assignment.is_required,
              assignment_type: assignment.assignment_type,
            }),
          }),
        ),
        ...sourceQuestions.map((question, index) =>
          apiFetch(`/api/services/${createdService.id}/form-questions`, {
            method: "POST",
            body: JSON.stringify({
              question_text: question.question_text,
              field_type: question.field_type,
              is_required: question.is_required,
              options: question.options,
              display_order: index,
            }),
          }),
        ),
      ]);

      setServices((current) => [createdService, ...current]);
      setAssignmentsByServiceId((current) => ({
        ...current,
        [createdService.id]: sourceAssignments,
      }));
      addToast("Service duplicated as a draft.", "success");
    } catch (error) {
      addToast(getErrorMessage(error, "Failed to duplicate service."), "error");
    } finally {
      setDuplicateServiceId(null);
    }
  }

  const lastUpdatedLabel = lastUpdated
    ? formatDistanceToNow(lastUpdated, { addSuffix: true })
    : "just now";

  return (
    <>
      <OrganizerToastRegion toasts={toasts} onDismiss={dismissToast} />
      <ServiceList
        services={filteredServices}
        isLoading={isLoading}
        error={loadError}
        searchValue={searchValue}
        activeFilter={filterValue}
        sortValue={sortValue}
        viewMode={viewValue}
        lastUpdatedLabel={lastUpdatedLabel}
        resourcesById={resourcesById}
        assignmentsByServiceId={assignmentsByServiceId}
        upcomingServiceIds={upcomingServiceIds}
        pendingServiceId={pendingServiceId}
        duplicateServiceId={duplicateServiceId}
        deleteServiceId={deleteServiceId}
        onRetry={() => void loadServices()}
        onRefresh={() => void loadServices()}
        onSearchChange={(value) => updateQuery({ q: value || null })}
        onFilterChange={(value) =>
          updateQuery({ filter: value === defaultFilter ? null : value })
        }
        onSortChange={(value) => updateQuery({ sort: value === defaultSort ? null : value })}
        onViewModeChange={(value) => updateQuery({ view: value === defaultView ? null : value })}
        onTogglePublish={(service, nextPublishedState) =>
          void handleTogglePublish(service, nextPublishedState)
        }
        onDelete={(service) => void handleDelete(service)}
        onDuplicate={(service) => void handleDuplicate(service)}
        onCopyLink={(service) => void handleCopyLink(service)}
      />
    </>
  );
}

export default function OrganizerServicesPage() {
  return (
    <Suspense fallback={<OrganizerServicesPageFallback />}>
      <OrganizerServicesPageContent />
    </Suspense>
  );
}
