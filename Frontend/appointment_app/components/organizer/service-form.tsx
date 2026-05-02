"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";
import {
  ArrowLeft,
  Copy,
  ExternalLink,
  Globe2,
  Package,
  Receipt,
  Save,
  Settings2,
  Sparkles,
} from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { apiFetch } from "@/lib/api";
import { getErrorMessage } from "@/lib/errors";
import {
  buildServiceShareUrl,
  cloneServiceAssignments,
  cloneServiceQuestions,
  EditableQuestion,
  EditableServiceAssignment,
  serializeQuestionOptions,
  toEditableAssignment,
  toEditableQuestion,
} from "@/lib/organizer-services";
import { cn } from "@/lib/utils";
import type { OrganizerToast } from "@/components/organizer/organizer-toast-region";
import { OrganizerToastRegion } from "@/components/organizer/organizer-toast-region";
import { FormQuestionsBuilder } from "@/components/organizer/form-questions-builder";
import { PublishDialog } from "@/components/organizer/publish-dialog";
import { ResourceSelector } from "@/components/organizer/resource-selector";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Spinner } from "@/components/ui/spinner";
import { Textarea } from "@/components/ui/textarea";
import type { Organization } from "@/types/organization";
import type { Resource, ResourceType } from "@/types/resource";
import type { FormQuestion, Service, ServiceResourceAssignment } from "@/types/service";

type ServiceFormMode = "create" | "edit";

type ServiceDraft = {
  organization_id: string;
  name: string;
  description: string;
  duration_minutes: string;
  capacity: string;
  max_bookings_per_user: string;
  requires_advance_payment: boolean;
  advance_payment_amount: string;
  is_published: boolean;
};

type ServiceField =
  | "organization_id"
  | "name"
  | "description"
  | "duration_minutes"
  | "capacity"
  | "max_bookings_per_user"
  | "advance_payment_amount";

type TouchedState = Partial<Record<ServiceField, boolean>>;

type ServiceFormProps = {
  mode: ServiceFormMode;
  serviceId?: number;
};

const flashStorageKey = "organizer-service-flash";

const emptyServiceDraft: ServiceDraft = {
  organization_id: "",
  name: "",
  description: "",
  duration_minutes: "30",
  capacity: "1",
  max_bookings_per_user: "",
  requires_advance_payment: false,
  advance_payment_amount: "",
  is_published: false,
};

function buildDraftFromService(service: Service): ServiceDraft {
  return {
    organization_id: String(service.organization_id),
    name: service.name,
    description: service.description ?? "",
    duration_minutes: String(service.duration_minutes),
    capacity: String(service.capacity),
    max_bookings_per_user:
      service.max_bookings_per_user == null ? "" : String(service.max_bookings_per_user),
    requires_advance_payment: service.requires_advance_payment,
    advance_payment_amount:
      service.advance_payment_amount == null ? "" : String(service.advance_payment_amount),
    is_published: service.is_published,
  };
}

function buildValidationErrors(draft: ServiceDraft) {
  const errors: Partial<Record<ServiceField, string>> = {};
  const duration = Number(draft.duration_minutes);
  const capacity = Number(draft.capacity);
  const maxBookings = draft.max_bookings_per_user ? Number(draft.max_bookings_per_user) : null;
  const paymentAmount = draft.advance_payment_amount ? Number(draft.advance_payment_amount) : null;

  if (!draft.organization_id) {
    errors.organization_id = "Select an organization.";
  }

  if (!draft.name.trim()) {
    errors.name = "Service name is required.";
  } else if (draft.name.trim().length > 255) {
    errors.name = "Service name must be 255 characters or fewer.";
  }

  if (draft.description.length > 1000) {
    errors.description = "Description must be 1000 characters or fewer.";
  }

  if (!Number.isFinite(duration) || duration < 1 || duration > 1440) {
    errors.duration_minutes = "Duration must be between 1 and 1440 minutes.";
  }

  if (!Number.isFinite(capacity) || capacity < 1 || capacity > 100) {
    errors.capacity = "Capacity must be between 1 and 100.";
  }

  if (maxBookings !== null && (!Number.isFinite(maxBookings) || maxBookings < 1)) {
    errors.max_bookings_per_user = "Max bookings per user must be at least 1.";
  }

  if (draft.requires_advance_payment) {
    if (paymentAmount === null || !Number.isFinite(paymentAmount) || paymentAmount <= 0) {
      errors.advance_payment_amount = "Enter an advance payment amount greater than 0.";
    }
  }

  return errors;
}

function assignmentsEqual(
  first: EditableServiceAssignment[],
  second: EditableServiceAssignment[],
) {
  if (first.length !== second.length) {
    return false;
  }

  const firstMap = new Map(first.map((assignment) => [assignment.resource_id, assignment]));
  return second.every((assignment) => {
    const candidate = firstMap.get(assignment.resource_id);
    return (
      candidate?.is_required === assignment.is_required &&
      candidate?.assignment_type === assignment.assignment_type
    );
  });
}

function questionsEqual(first: EditableQuestion[], second: EditableQuestion[]) {
  if (first.length !== second.length) {
    return false;
  }

  return first.every((question, index) => {
    const candidate = second[index];
    return (
      candidate &&
      question.id === candidate.id &&
      question.question_text === candidate.question_text &&
      question.field_type === candidate.field_type &&
      question.is_required === candidate.is_required &&
      question.presentation === candidate.presentation &&
      question.options.join("||") === candidate.options.join("||")
    );
  });
}

function writeFlashToast(message: string, tone: OrganizerToast["tone"]) {
  if (typeof window === "undefined") {
    return;
  }

  window.sessionStorage.setItem(
    flashStorageKey,
    JSON.stringify({
      id: `flash-${Date.now()}`,
      message,
      tone,
    }),
  );
}

function useFlashToast(addToast: (message: string, tone: OrganizerToast["tone"]) => void) {
  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }

    const raw = window.sessionStorage.getItem(flashStorageKey);
    if (!raw) {
      return;
    }

    try {
      const parsed = JSON.parse(raw) as OrganizerToast;
      if (parsed?.message && parsed?.tone) {
        addToast(parsed.message, parsed.tone);
      }
    } catch {
      // Ignore invalid flash payloads.
    }

    window.sessionStorage.removeItem(flashStorageKey);
  }, [addToast]);
}

function StatPill({
  label,
  value,
  accentClass,
}: {
  label: string;
  value: string;
  accentClass: string;
}) {
  return (
    <div className="rounded-3xl border border-white/10 bg-white/[0.04] px-4 py-3">
      <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400">
        {label}
      </p>
      <p className={cn("mt-2 text-lg font-semibold", accentClass)}>{value}</p>
    </div>
  );
}

export function ServiceForm({ mode, serviceId }: ServiceFormProps) {
  const router = useRouter();
  const { user, isAdmin } = useAuth();

  const [form, setForm] = useState<ServiceDraft>(emptyServiceDraft);
  const [touched, setTouched] = useState<TouchedState>({});
  const [organizations, setOrganizations] = useState<Organization[]>([]);
  const [resources, setResources] = useState<Resource[]>([]);
  const [service, setService] = useState<Service | null>(null);
  const [assignments, setAssignments] = useState<EditableServiceAssignment[]>([]);
  const [questions, setQuestions] = useState<EditableQuestion[]>([]);
  const [initialAssignments, setInitialAssignments] = useState<EditableServiceAssignment[]>([]);
  const [initialQuestions, setInitialQuestions] = useState<EditableQuestion[]>([]);
  const [origin, setOrigin] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [pageError, setPageError] = useState<string | null>(null);
  const [isResourceDialogOpen, setIsResourceDialogOpen] = useState(false);
  const [publishDialogOpen, setPublishDialogOpen] = useState(false);
  const [publishIntent, setPublishIntent] = useState(false);
  const [toasts, setToasts] = useState<OrganizerToast[]>([]);

  const validationErrors = useMemo(() => buildValidationErrors(form), [form]);
  const initialCreateDraft = useMemo(
    () => ({
      ...emptyServiceDraft,
      organization_id: organizations[0] ? String(organizations[0].id) : "",
    }),
    [organizations],
  );
  const selectedOrganizationId = form.organization_id ? Number(form.organization_id) : null;
  const selectedOrganization = organizations.find(
    (organization) => organization.id === selectedOrganizationId,
  );
  const filteredResources = useMemo(
    () =>
      selectedOrganizationId == null
        ? []
        : resources.filter((resource) => resource.organization_id === selectedOrganizationId),
    [resources, selectedOrganizationId],
  );
  const assignedResources = useMemo(
    () =>
      assignments
        .map((assignment) => ({
          assignment,
          resource: resources.find((resource) => resource.id === assignment.resource_id),
        }))
        .filter((item): item is { assignment: EditableServiceAssignment; resource: Resource } =>
          Boolean(item.resource),
        ),
    [assignments, resources],
  );
  const shareUrl = useMemo(() => {
    if (!service || !origin) {
      return "";
    }

    return buildServiceShareUrl(service, origin);
  }, [origin, service]);

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

  useFlashToast(addToast);

  const loadServiceData = useCallback(
    async (targetServiceId: number) => {
      const [serviceData, assignmentData, questionData] = await Promise.all([
        apiFetch<Service>(`/api/organizer/services/${targetServiceId}`),
        apiFetch<ServiceResourceAssignment[]>(
          `/api/organizer/services/${targetServiceId}/resources`,
        ),
        apiFetch<FormQuestion[]>(
          `/api/organizer/services/${targetServiceId}/form-questions`,
        ),
      ]);

      const editableAssignments = assignmentData.map(toEditableAssignment);
      const editableQuestions = questionData.map(toEditableQuestion);

      setService(serviceData);
      setForm(buildDraftFromService(serviceData));
      setAssignments(editableAssignments);
      setInitialAssignments(cloneServiceAssignments(editableAssignments));
      setQuestions(editableQuestions);
      setInitialQuestions(cloneServiceQuestions(editableQuestions));
      setTouched({});
    },
    [],
  );

  const loadForm = useCallback(async () => {
    if (!user) {
      return;
    }

    setIsLoading(true);
    setPageError(null);

    try {
      const organizationRequest = isAdmin
        ? apiFetch<Organization[]>("/api/admin/organizations")
        : apiFetch<Organization[]>("/api/organizations/mine");

      const [organizationData, resourceData] = await Promise.all([
        organizationRequest,
        apiFetch<Resource[]>("/api/resources"),
      ]);

      setOrganizations(organizationData);
      setResources(resourceData);

      if (mode === "edit") {
        if (!serviceId) {
          throw new Error("Missing service id.");
        }

        await loadServiceData(serviceId);
      } else {
        const defaultOrganizationId = organizationData[0]
          ? String(organizationData[0].id)
          : "";
        setForm((current) => ({
          ...current,
          organization_id: current.organization_id || defaultOrganizationId,
        }));
        setAssignments([]);
        setInitialAssignments([]);
        setQuestions([]);
        setInitialQuestions([]);
        setService(null);
        setTouched({});
      }
    } catch (error) {
      setPageError(getErrorMessage(error, "Failed to load service workspace."));
    } finally {
      setIsLoading(false);
    }
  }, [isAdmin, loadServiceData, mode, serviceId, user]);

  useEffect(() => {
    if (typeof window !== "undefined") {
      setOrigin(window.location.origin);
    }
  }, []);

  useEffect(() => {
    void loadForm();
  }, [loadForm]);

  useEffect(() => {
    if (selectedOrganizationId == null) {
      return;
    }

    const allowedResourceIds = new Set(
      resources
        .filter((resource) => resource.organization_id === selectedOrganizationId)
        .map((resource) => resource.id),
    );

    setAssignments((current) =>
      current.filter((assignment) => allowedResourceIds.has(assignment.resource_id)),
    );
  }, [resources, selectedOrganizationId]);

  function markTouched(field: ServiceField) {
    setTouched((current) => ({ ...current, [field]: true }));
  }

  function updateField<K extends keyof ServiceDraft>(field: K, value: ServiceDraft[K]) {
    setForm((current) => ({ ...current, [field]: value }));
  }

  async function copyShareLink() {
    if (!shareUrl) {
      addToast("Publish the service to generate a share link.", "error");
      return;
    }

    try {
      await navigator.clipboard.writeText(shareUrl);
      addToast("Share link copied to clipboard.", "success");
    } catch (error) {
      addToast(getErrorMessage(error, "Failed to copy link."), "error");
    }
  }

  async function createResource(input: {
    organization_id: number;
    name: string;
    type: ResourceType;
    description: string;
    capacity: number;
  }) {
    const createdResource = await apiFetch<Resource>("/api/resources", {
      method: "POST",
      body: JSON.stringify(input),
    });

    setResources((current) => [createdResource, ...current]);
    addToast("Resource created and available for assignment.", "success");
    return createdResource;
  }

  async function syncAssignments(targetServiceId: number, nextAssignments: EditableServiceAssignment[]) {
    const initialById = new Map(
      initialAssignments.map((assignment) => [assignment.resource_id, assignment]),
    );
    const nextById = new Map(nextAssignments.map((assignment) => [assignment.resource_id, assignment]));

    for (const assignment of nextAssignments) {
      const existing = initialById.get(assignment.resource_id);
      if (!existing) {
        await apiFetch(`/api/services/${targetServiceId}/resources`, {
          method: "POST",
          body: JSON.stringify(assignment),
        });
        continue;
      }

      if (
        existing.is_required !== assignment.is_required ||
        existing.assignment_type !== assignment.assignment_type
      ) {
        await apiFetch(`/api/services/${targetServiceId}/resources/${assignment.resource_id}`, {
          method: "PUT",
          body: JSON.stringify({
            is_required: assignment.is_required,
            assignment_type: assignment.assignment_type,
          }),
        });
      }
    }

    for (const assignment of initialAssignments) {
      if (!nextById.has(assignment.resource_id)) {
        await apiFetch(`/api/services/${targetServiceId}/resources/${assignment.resource_id}`, {
          method: "DELETE",
        });
      }
    }
  }

  async function syncQuestions(targetServiceId: number, nextQuestions: EditableQuestion[]) {
    const initialById = new Map(
      initialQuestions
        .filter((question) => question.id != null)
        .map((question) => [question.id as number, question]),
    );
    const nextQuestionIds = new Set<number>();

    for (const [index, question] of nextQuestions.entries()) {
      const payload = {
        question_text: question.question_text.trim(),
        field_type: question.field_type,
        is_required: question.is_required,
        options: serializeQuestionOptions(question),
        display_order: index,
      };

      if (question.id != null) {
        nextQuestionIds.add(question.id);
        const initialQuestion = initialById.get(question.id);
        const didChange =
          !initialQuestion ||
          initialQuestion.question_text !== payload.question_text ||
          initialQuestion.field_type !== payload.field_type ||
          initialQuestion.is_required !== payload.is_required ||
          initialQuestion.presentation !== question.presentation ||
          initialQuestion.options.join("||") !== question.options.join("||") ||
          initialQuestions.findIndex((item) => item.id === question.id) !== index;

        if (didChange) {
          await apiFetch(`/api/services/${targetServiceId}/form-questions/${question.id}`, {
            method: "PUT",
            body: JSON.stringify(payload),
          });
        }
        continue;
      }

      await apiFetch(`/api/services/${targetServiceId}/form-questions`, {
        method: "POST",
        body: JSON.stringify(payload),
      });
    }

    for (const question of initialQuestions) {
      if (question.id != null && !nextQuestionIds.has(question.id)) {
        await apiFetch(`/api/services/${targetServiceId}/form-questions/${question.id}`, {
          method: "DELETE",
        });
      }
    }
  }

  async function ensureShareableLink(currentService: Service) {
    if (!currentService.is_published || currentService.shareable_link) {
      return currentService;
    }

    const shareData = await apiFetch<{ shareable_link: string }>(
      `/api/services/${currentService.id}/shareable-link`,
      { method: "POST" },
    );

    return {
      ...currentService,
      shareable_link: shareData.shareable_link,
    };
  }

  async function persistService(nextPublishedState?: boolean) {
    const nextTouched: TouchedState = {
      organization_id: true,
      name: true,
      description: true,
      duration_minutes: true,
      capacity: true,
      max_bookings_per_user: true,
      advance_payment_amount: true,
    };
    setTouched(nextTouched);

    const draftForSave: ServiceDraft = {
      ...form,
      is_published:
        typeof nextPublishedState === "boolean" ? nextPublishedState : form.is_published,
    };

    const errors = buildValidationErrors(draftForSave);
    if (Object.keys(errors).length > 0) {
      addToast("Fix the highlighted fields before saving.", "error");
      return;
    }

    const payload = {
      organization_id: Number(draftForSave.organization_id),
      name: draftForSave.name.trim(),
      description: draftForSave.description.trim() || null,
      duration_minutes: Number(draftForSave.duration_minutes),
      capacity: Number(draftForSave.capacity),
      is_published: draftForSave.is_published,
      max_bookings_per_user: draftForSave.max_bookings_per_user
        ? Number(draftForSave.max_bookings_per_user)
        : null,
      requires_advance_payment: draftForSave.requires_advance_payment,
      advance_payment_amount: draftForSave.requires_advance_payment
        ? Number(draftForSave.advance_payment_amount)
        : null,
    };

    setIsSaving(true);

    try {
      const savedService =
        mode === "edit" && serviceId
          ? await apiFetch<Service>(`/api/services/${serviceId}`, {
              method: "PUT",
              body: JSON.stringify(payload),
            })
          : await apiFetch<Service>("/api/services", {
              method: "POST",
              body: JSON.stringify(payload),
            });

      const serviceWithLink = await ensureShareableLink(savedService);

      await syncAssignments(savedService.id, assignments);
      await syncQuestions(savedService.id, questions);

      setForm(buildDraftFromService(serviceWithLink));
      setService(serviceWithLink);

      if (mode === "create") {
        writeFlashToast(
          serviceWithLink.is_published
            ? "Service published and ready to share."
            : "Service saved successfully.",
          "success",
        );
        router.replace(`/organizer/services/${savedService.id}/edit`);
        return;
      }

      await loadServiceData(savedService.id);
      setService(serviceWithLink);

      addToast(
        serviceWithLink.is_published
          ? "Service saved and available to customers."
          : "Service saved successfully.",
        "success",
      );
    } catch (error) {
      addToast(getErrorMessage(error, "Failed to save service."), "error");
    } finally {
      setIsSaving(false);
    }
  }

  const showError = (field: ServiceField) =>
    touched[field] ? validationErrors[field] : undefined;
  const isDirty =
    service == null
      ? JSON.stringify(form) !== JSON.stringify(initialCreateDraft) ||
        assignments.length > 0 ||
        questions.length > 0
      : !assignmentsEqual(assignments, initialAssignments) ||
        !questionsEqual(questions, initialQuestions) ||
        JSON.stringify(buildDraftFromService(service)) !== JSON.stringify(form);

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="h-32 animate-pulse rounded-[32px] border border-white/10 bg-white/[0.04]" />
        <div className="grid gap-6 xl:grid-cols-[1.3fr_0.9fr]">
          <div className="h-[620px] animate-pulse rounded-[32px] border border-white/10 bg-white/[0.04]" />
          <div className="h-[620px] animate-pulse rounded-[32px] border border-white/10 bg-white/[0.04]" />
        </div>
      </div>
    );
  }

  if (pageError) {
    return (
      <div className="rounded-[32px] border border-rose-400/20 bg-rose-500/10 p-8 text-white">
        <p className="text-lg font-semibold">Service workspace unavailable</p>
        <p className="mt-2 text-sm text-rose-100">{pageError}</p>
        <div className="mt-5 flex flex-wrap gap-3">
          <Button type="button" onClick={() => void loadForm()}>
            Retry
          </Button>
          <Link
            href="/organizer/services"
            className="inline-flex h-10 items-center rounded-full border border-white/15 px-4 text-sm font-medium text-white transition-colors hover:bg-white/10"
          >
            Back to services
          </Link>
        </div>
      </div>
    );
  }

  return (
    <>
      <OrganizerToastRegion toasts={toasts} onDismiss={dismissToast} />

      <div className="space-y-8">
        <section className="relative overflow-hidden rounded-[36px] border border-white/10 bg-[radial-gradient(circle_at_top_right,rgba(56,189,248,0.16),transparent_34%),radial-gradient(circle_at_bottom_left,rgba(14,165,233,0.12),transparent_28%),linear-gradient(135deg,rgba(15,23,42,0.95),rgba(2,6,23,0.92))] p-8 text-white">
          <div className="absolute inset-0 bg-[linear-gradient(120deg,transparent,rgba(255,255,255,0.03),transparent)]" />
          <div className="relative flex flex-col gap-6 xl:flex-row xl:items-end xl:justify-between">
            <div className="space-y-4">
              <Link
                href="/organizer/services"
                className="inline-flex items-center gap-2 rounded-full border border-white/15 px-4 py-2 text-sm font-medium text-white/80 transition-colors hover:bg-white/10 hover:text-white"
              >
                <ArrowLeft className="size-4" />
                Back to services
              </Link>
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.22em] text-sky-200/80">
                  Organizer service management
                </p>
                <h1 className="mt-3 text-4xl font-semibold tracking-tight">
                  {mode === "create"
                    ? "Create a service customers can book"
                    : service?.name || "Edit service"}
                </h1>
                <p className="mt-3 max-w-3xl text-sm text-slate-300 sm:text-base">
                  Define the booking offer, attach operational resources, and tune the customer intake flow in one place.
                </p>
              </div>
            </div>

            <div className="grid gap-3 sm:grid-cols-3">
              <StatPill
                label="Status"
                value={form.is_published ? "Published" : "Draft"}
                accentClass={form.is_published ? "text-emerald-300" : "text-slate-100"}
              />
              <StatPill
                label="Resources"
                value={String(assignments.length)}
                accentClass="text-sky-200"
              />
              <StatPill
                label="Questions"
                value={String(questions.length)}
                accentClass="text-indigo-200"
              />
            </div>
          </div>
        </section>

        <div className="grid gap-6 xl:grid-cols-[1.3fr_0.9fr]">
          <div className="space-y-6">
            <section className="rounded-[32px] border border-white/10 bg-white/[0.04] p-6 text-white">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="text-sm font-semibold">Basic info</p>
                  <p className="mt-1 text-sm text-slate-400">
                    Name the service and define booking volume.
                  </p>
                </div>
                <div className="rounded-2xl border border-sky-400/20 bg-sky-400/10 p-3 text-sky-200">
                  <Sparkles className="size-5" />
                </div>
              </div>

              <div className="mt-6 grid gap-5">
                <div className="space-y-2">
                  <Label htmlFor="service-organization">Organization</Label>
                  <Select
                    value={form.organization_id}
                    onValueChange={(value) => {
                      updateField("organization_id", value);
                      markTouched("organization_id");
                    }}
                  >
                    <SelectTrigger
                      id="service-organization"
                      className={cn(
                        "h-11 w-full rounded-2xl border-white/10 bg-slate-950/70 text-white",
                        showError("organization_id") ? "border-rose-400/50" : "",
                      )}
                      aria-invalid={Boolean(showError("organization_id"))}
                    >
                      <SelectValue placeholder="Select organization" />
                    </SelectTrigger>
                    <SelectContent className="border-white/10 bg-slate-950 text-white">
                      {organizations.map((organization) => (
                        <SelectItem key={organization.id} value={String(organization.id)}>
                          {organization.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {showError("organization_id") ? (
                    <p className="text-sm text-rose-300">{validationErrors.organization_id}</p>
                  ) : null}
                </div>

                <div className="space-y-2">
                  <Label htmlFor="service-name">Service name</Label>
                  <Input
                    id="service-name"
                    value={form.name}
                    onChange={(event) => updateField("name", event.target.value)}
                    onBlur={() => markTouched("name")}
                    maxLength={255}
                    aria-invalid={Boolean(showError("name"))}
                    className={cn(
                      "h-11 rounded-2xl border-white/10 bg-slate-950/70 text-white",
                      showError("name") ? "border-rose-400/50" : "",
                    )}
                    placeholder="Executive consultation"
                  />
                  <div className="flex items-center justify-between text-xs text-slate-400">
                    <span>{showError("name") ?? "What customers see on the booking page."}</span>
                    <span>{form.name.length}/255</span>
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="service-description">Description</Label>
                  <Textarea
                    id="service-description"
                    value={form.description}
                    onChange={(event) => updateField("description", event.target.value)}
                    onBlur={() => markTouched("description")}
                    maxLength={1000}
                    aria-invalid={Boolean(showError("description"))}
                    className={cn(
                      "min-h-32 rounded-2xl border-white/10 bg-slate-950/70 text-white",
                      showError("description") ? "border-rose-400/50" : "",
                    )}
                    placeholder="Explain the format, expected outcome, or what to bring."
                  />
                  <div className="flex items-center justify-between text-xs text-slate-400">
                    <span>
                      {showError("description") ?? "Keep this short and customer-facing."}
                    </span>
                    <span>{form.description.length}/1000</span>
                  </div>
                </div>

                <div className="grid gap-5 md:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor="service-duration">Duration in minutes</Label>
                    <Input
                      id="service-duration"
                      type="number"
                      min={1}
                      max={1440}
                      value={form.duration_minutes}
                      onChange={(event) => updateField("duration_minutes", event.target.value)}
                      onBlur={() => markTouched("duration_minutes")}
                      aria-invalid={Boolean(showError("duration_minutes"))}
                      className={cn(
                        "h-11 rounded-2xl border-white/10 bg-slate-950/70 text-white",
                        showError("duration_minutes") ? "border-rose-400/50" : "",
                      )}
                    />
                    {showError("duration_minutes") ? (
                      <p className="text-sm text-rose-300">
                        {validationErrors.duration_minutes}
                      </p>
                    ) : null}
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="service-capacity">Capacity</Label>
                    <Input
                      id="service-capacity"
                      type="number"
                      min={1}
                      max={100}
                      value={form.capacity}
                      onChange={(event) => updateField("capacity", event.target.value)}
                      onBlur={() => markTouched("capacity")}
                      aria-invalid={Boolean(showError("capacity"))}
                      className={cn(
                        "h-11 rounded-2xl border-white/10 bg-slate-950/70 text-white",
                        showError("capacity") ? "border-rose-400/50" : "",
                      )}
                    />
                    {showError("capacity") ? (
                      <p className="text-sm text-rose-300">{validationErrors.capacity}</p>
                    ) : null}
                  </div>
                </div>
              </div>
            </section>

            <section className="rounded-[32px] border border-white/10 bg-white/[0.04] p-6 text-white">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="text-sm font-semibold">Resources and assignment</p>
                  <p className="mt-1 text-sm text-slate-400">
                    Connect providers, rooms, or equipment to this booking type.
                  </p>
                </div>
                <div className="rounded-2xl border border-sky-400/20 bg-sky-400/10 p-3 text-sky-200">
                  <Package className="size-5" />
                </div>
              </div>

              <div className="mt-6 grid gap-4">
                <div className="rounded-3xl border border-white/10 bg-slate-950/50 p-4">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div>
                      <p className="text-sm font-semibold text-white">
                        {assignments.length === 0
                          ? "No resources assigned"
                          : `${assignments.length} resource${assignments.length === 1 ? "" : "s"} assigned`}
                      </p>
                      <p className="text-sm text-slate-400">
                        {selectedOrganization
                          ? `Using resources from ${selectedOrganization.name}`
                          : "Select an organization to load resource inventory."}
                      </p>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <Button
                        type="button"
                        variant="secondary"
                        onClick={() => setIsResourceDialogOpen(true)}
                      >
                        <Settings2 className="size-4" />
                        Manage resources
                      </Button>
                      <Link
                        href="/organizer"
                        className="inline-flex h-10 items-center rounded-full border border-white/15 px-4 text-sm font-medium text-white transition-colors hover:bg-white/10"
                      >
                        Open workspace
                      </Link>
                    </div>
                  </div>
                </div>

                {assignedResources.length === 0 ? (
                  <div className="rounded-3xl border border-dashed border-white/10 bg-slate-950/40 p-6 text-sm text-slate-400">
                    Assign at least one resource so customers can book against real availability.
                  </div>
                ) : (
                  <div className="grid gap-3">
                    {assignedResources.map(({ assignment, resource }) => (
                      <div
                        key={resource.id}
                        className="flex flex-col gap-3 rounded-3xl border border-white/10 bg-slate-950/55 p-4 md:flex-row md:items-center md:justify-between"
                      >
                        <div>
                          <p className="font-semibold text-white">{resource.name}</p>
                          <p className="mt-1 text-sm text-slate-400">
                            {resource.type} · Capacity {resource.capacity}
                          </p>
                        </div>
                        <div className="flex flex-wrap gap-2">
                          <span className="rounded-full border border-white/10 px-3 py-1 text-xs font-semibold uppercase tracking-[0.16em] text-slate-200">
                            {assignment.assignment_type === "AUTO" ? "Auto assign" : "Manual assign"}
                          </span>
                          {assignment.is_required ? (
                            <span className="rounded-full border border-emerald-400/20 bg-emerald-500/10 px-3 py-1 text-xs font-semibold uppercase tracking-[0.16em] text-emerald-200">
                              Required
                            </span>
                          ) : null}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </section>

            <section className="rounded-[32px] border border-white/10 bg-white/[0.04] p-6 text-white">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="text-sm font-semibold">Booking rules</p>
                  <p className="mt-1 text-sm text-slate-400">
                    Set customer limits and optional payment requirements.
                  </p>
                </div>
                <div className="rounded-2xl border border-sky-400/20 bg-sky-400/10 p-3 text-sky-200">
                  <Receipt className="size-5" />
                </div>
              </div>

              <div className="mt-6 grid gap-5">
                <div className="space-y-2">
                  <Label htmlFor="service-max-bookings">Max bookings per user</Label>
                  <Input
                    id="service-max-bookings"
                    type="number"
                    min={1}
                    value={form.max_bookings_per_user}
                    onChange={(event) => updateField("max_bookings_per_user", event.target.value)}
                    onBlur={() => markTouched("max_bookings_per_user")}
                    aria-invalid={Boolean(showError("max_bookings_per_user"))}
                    className={cn(
                      "h-11 rounded-2xl border-white/10 bg-slate-950/70 text-white",
                      showError("max_bookings_per_user") ? "border-rose-400/50" : "",
                    )}
                    placeholder="Optional"
                  />
                  <p className="text-sm text-slate-400">
                    {showError("max_bookings_per_user") ??
                      "Leave blank for unlimited bookings per customer."}
                  </p>
                </div>

                <label className="flex items-center gap-3 rounded-3xl border border-white/10 bg-slate-950/50 px-4 py-4 text-sm text-white">
                  <Checkbox
                    checked={form.requires_advance_payment}
                    onCheckedChange={(checked) => {
                      updateField("requires_advance_payment", checked === true);
                      if (checked !== true) {
                        updateField("advance_payment_amount", "");
                      }
                    }}
                    className="border-white/20"
                  />
                  Require advance payment
                </label>

                {form.requires_advance_payment ? (
                  <div className="space-y-2">
                    <Label htmlFor="service-payment-amount">Advance payment amount</Label>
                    <Input
                      id="service-payment-amount"
                      type="number"
                      min={0}
                      step="0.01"
                      value={form.advance_payment_amount}
                      onChange={(event) =>
                        updateField("advance_payment_amount", event.target.value)
                      }
                      onBlur={() => markTouched("advance_payment_amount")}
                      aria-invalid={Boolean(showError("advance_payment_amount"))}
                      className={cn(
                        "h-11 rounded-2xl border-white/10 bg-slate-950/70 text-white",
                        showError("advance_payment_amount") ? "border-rose-400/50" : "",
                      )}
                      placeholder="49.00"
                    />
                    <p className="text-sm text-slate-400">
                      {showError("advance_payment_amount") ??
                        "Shown to customers before they confirm the appointment."}
                    </p>
                  </div>
                ) : null}
              </div>
            </section>

            <FormQuestionsBuilder questions={questions} onChange={setQuestions} />
          </div>

          <aside className="space-y-6">
            <section className="rounded-[32px] border border-white/10 bg-white/[0.04] p-6 text-white">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="text-sm font-semibold">Publishing workflow</p>
                  <p className="mt-1 text-sm text-slate-400">
                    Save as draft, then publish when the customer-facing flow is ready.
                  </p>
                </div>
                <div className="rounded-2xl border border-sky-400/20 bg-sky-400/10 p-3 text-sky-200">
                  <Globe2 className="size-5" />
                </div>
              </div>

              <div className="mt-6 space-y-4 rounded-3xl border border-white/10 bg-slate-950/55 p-4">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <p className="font-semibold text-white">Current status</p>
                    <p className="text-sm text-slate-400">
                      {form.is_published
                        ? "Customers can book this service."
                        : "Only organizers can see this as a working draft."}
                    </p>
                  </div>
                  <span
                    className={cn(
                      "rounded-full border px-3 py-1 text-xs font-semibold uppercase tracking-[0.16em]",
                      form.is_published
                        ? "border-emerald-400/20 bg-emerald-500/10 text-emerald-200"
                        : "border-white/10 bg-white/[0.04] text-slate-200",
                    )}
                  >
                    {form.is_published ? "Published" : "Draft"}
                  </span>
                </div>

                {shareUrl ? (
                  <div className="rounded-3xl border border-white/10 bg-white/[0.03] p-4">
                    <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">
                      Shareable link
                    </p>
                    <p className="mt-2 break-all text-sm text-slate-200">{shareUrl}</p>
                    <div className="mt-4 flex flex-wrap gap-2">
                      <Button type="button" variant="secondary" onClick={copyShareLink}>
                        <Copy className="size-4" />
                        Copy link
                      </Button>
                      <Link
                        href={shareUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex h-10 items-center gap-2 rounded-full border border-white/15 px-4 text-sm font-medium text-white transition-colors hover:bg-white/10"
                      >
                        <ExternalLink className="size-4" />
                        Open
                      </Link>
                    </div>
                  </div>
                ) : (
                  <div className="rounded-3xl border border-dashed border-white/10 bg-white/[0.03] p-4 text-sm text-slate-400">
                    Publish this service to generate a shareable booking link.
                  </div>
                )}

                <div className="flex flex-col gap-2">
                  <Button
                    type="button"
                    variant={form.is_published ? "outline" : "default"}
                    onClick={() => {
                      setPublishIntent(!form.is_published);
                      setPublishDialogOpen(true);
                    }}
                    disabled={isSaving}
                    className={form.is_published ? "border-white/15" : ""}
                  >
                    {form.is_published ? "Unpublish service" : "Publish service"}
                  </Button>
                  <p className="text-xs text-slate-500">
                    Publishing uses the same validated service payload as save, so drafts do not leak broken data.
                  </p>
                </div>
              </div>
            </section>

            <section className="rounded-[32px] border border-white/10 bg-white/[0.04] p-6 text-white">
              <p className="text-sm font-semibold">Save checklist</p>
              <div className="mt-4 space-y-3 text-sm text-slate-300">
                <div className="rounded-2xl border border-white/10 bg-slate-950/55 px-4 py-3">
                  Basic info and booking rules are validated before save.
                </div>
                <div className="rounded-2xl border border-white/10 bg-slate-950/55 px-4 py-3">
                  Resource assignments sync after the core service record is saved.
                </div>
                <div className="rounded-2xl border border-white/10 bg-slate-950/55 px-4 py-3">
                  Question order is persisted from the drag-and-drop list.
                </div>
              </div>

              <div className="mt-6 flex flex-col gap-3">
                <Button
                  type="button"
                  onClick={() => void persistService()}
                  disabled={isSaving}
                  className="h-11"
                >
                  {isSaving ? <Spinner /> : <Save className="size-4" />}
                  {mode === "create" ? "Create service" : "Save changes"}
                </Button>
                <Link
                  href="/organizer/services"
                  className="inline-flex h-11 items-center justify-center rounded-full border border-white/15 px-4 text-sm font-medium text-white transition-colors hover:bg-white/10"
                >
                  Cancel
                </Link>
                <p className="text-xs text-slate-500">
                  {isDirty ? "You have unsaved changes." : "Everything is saved."}
                </p>
              </div>
            </section>
          </aside>
        </div>
      </div>

      <ResourceSelector
        open={isResourceDialogOpen}
        onOpenChange={setIsResourceDialogOpen}
        organizationId={selectedOrganizationId}
        resources={filteredResources}
        value={assignments}
        onSave={setAssignments}
        onCreateResource={createResource}
      />

      <PublishDialog
        open={publishDialogOpen}
        onOpenChange={setPublishDialogOpen}
        serviceName={form.name.trim() || "this service"}
        nextPublishedState={publishIntent}
        isSubmitting={isSaving}
        onConfirm={() => {
          setPublishDialogOpen(false);
          void persistService(publishIntent);
        }}
      />
    </>
  );
}
