"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import {
  CalendarClock,
  Copy,
  ExternalLink,
  LayoutGrid,
  List,
  Loader2,
  Plus,
  RefreshCw,
  Search,
  Trash2,
  Wand2,
} from "lucide-react";
import { buildServiceShareUrl } from "@/lib/organizer-services";
import { formatDate } from "@/lib/dates";
import { cn } from "@/lib/utils";
import { PublishDialog } from "@/components/organizer/publish-dialog";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { Resource } from "@/types/resource";
import type { Service, ServiceResourceAssignment } from "@/types/service";

export type OrganizerServiceFilter = "all" | "published" | "draft" | "upcoming";
export type OrganizerServiceSort = "newest" | "oldest" | "name" | "duration" | "capacity";
export type OrganizerServiceView = "grid" | "table";

type ServiceListProps = {
  services: Service[];
  isLoading: boolean;
  error: string | null;
  searchValue: string;
  activeFilter: OrganizerServiceFilter;
  sortValue: OrganizerServiceSort;
  viewMode: OrganizerServiceView;
  lastUpdatedLabel: string;
  resourcesById: Record<number, Resource>;
  assignmentsByServiceId: Record<number, ServiceResourceAssignment[]>;
  upcomingServiceIds: Set<number>;
  pendingServiceId?: number | null;
  duplicateServiceId?: number | null;
  deleteServiceId?: number | null;
  onRetry: () => void;
  onSearchChange: (value: string) => void;
  onFilterChange: (value: OrganizerServiceFilter) => void;
  onSortChange: (value: OrganizerServiceSort) => void;
  onViewModeChange: (value: OrganizerServiceView) => void;
  onTogglePublish: (service: Service, nextPublishedState: boolean) => void;
  onDelete: (service: Service) => void;
  onDuplicate: (service: Service) => void;
  onCopyLink: (service: Service) => void;
  onRefresh: () => void;
};

const filterChips: Array<{ value: OrganizerServiceFilter; label: string }> = [
  { value: "all", label: "All" },
  { value: "published", label: "Published" },
  { value: "draft", label: "Draft" },
  { value: "upcoming", label: "Upcoming" },
];

const sortOptions: Array<{ value: OrganizerServiceSort; label: string }> = [
  { value: "newest", label: "Newest first" },
  { value: "oldest", label: "Oldest first" },
  { value: "name", label: "Name" },
  { value: "duration", label: "Duration" },
  { value: "capacity", label: "Capacity" },
];

function ServiceListSkeleton() {
  return (
    <div className="grid gap-4 xl:grid-cols-2">
      {Array.from({ length: 6 }).map((_, index) => (
        <div
          key={index}
          className="h-60 animate-pulse rounded-[32px] border border-white/10 bg-white/[0.04]"
        />
      ))}
    </div>
  );
}

export function ServiceList({
  services,
  isLoading,
  error,
  searchValue,
  activeFilter,
  sortValue,
  viewMode,
  lastUpdatedLabel,
  resourcesById,
  assignmentsByServiceId,
  upcomingServiceIds,
  pendingServiceId = null,
  duplicateServiceId = null,
  deleteServiceId = null,
  onRetry,
  onSearchChange,
  onFilterChange,
  onSortChange,
  onViewModeChange,
  onTogglePublish,
  onDelete,
  onDuplicate,
  onCopyLink,
  onRefresh,
}: ServiceListProps) {
  const [publishTarget, setPublishTarget] = useState<Service | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Service | null>(null);

  const emptyState = useMemo(() => {
    if (searchValue || activeFilter !== "all") {
      return {
        title: "No matching services",
        description:
          "Adjust the search or filters to surface a different service set.",
      };
    }

    return {
      title: "Create your first service to get started",
      description:
        "Draft the booking offer, attach resources, and publish when it is customer-ready.",
    };
  }, [activeFilter, searchValue]);

  const origin = typeof window === "undefined" ? "" : window.location.origin;

  return (
    <>
      <div className="space-y-6">
        <section className="rounded-[36px] border border-white/10 bg-[radial-gradient(circle_at_top_right,rgba(56,189,248,0.18),transparent_32%),linear-gradient(135deg,rgba(15,23,42,0.95),rgba(2,6,23,0.94))] p-8 text-white">
          <div className="flex flex-col gap-6 xl:flex-row xl:items-end xl:justify-between">
            <div className="space-y-4">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.22em] text-sky-200/80">
                  Organizer services
                </p>
                <h1 className="mt-3 text-4xl font-semibold tracking-tight">
                  Service operations, publishing, and booking setup
                </h1>
                <p className="mt-3 max-w-3xl text-sm text-slate-300 sm:text-base">
                  Search across your service catalog, duplicate proven setups, and publish changes without leaving the organizer workspace.
                </p>
              </div>
            </div>

            <div className="flex flex-wrap gap-3">
              <Button type="button" variant="outline" onClick={onRefresh} className="border-white/15">
                <RefreshCw className="size-4" />
                Refresh
              </Button>
              <Link
                href="/organizer/services/create"
                className="inline-flex h-10 items-center gap-2 rounded-full bg-sky-400 px-4 text-sm font-semibold text-slate-950 transition-colors hover:bg-sky-300"
              >
                <Plus className="size-4" />
                Create service
              </Link>
            </div>
          </div>
        </section>

        <section className="rounded-[32px] border border-white/10 bg-white/[0.04] p-5 text-white">
          <div className="flex flex-col gap-4">
            <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
              <div className="relative w-full max-w-xl">
                <Search className="pointer-events-none absolute left-4 top-1/2 size-4 -translate-y-1/2 text-slate-500" />
                <Input
                  value={searchValue}
                  onChange={(event) => onSearchChange(event.target.value)}
                  placeholder="Search by name or description"
                  className="h-12 rounded-full border-white/10 bg-slate-950/70 pl-11 text-white"
                  aria-label="Search services"
                />
              </div>

              <div className="flex flex-wrap items-center gap-3">
                <Select value={sortValue} onValueChange={(value) => onSortChange(value as OrganizerServiceSort)}>
                  <SelectTrigger className="h-11 w-[180px] rounded-full border-white/10 bg-slate-950/70 text-white">
                    <SelectValue placeholder="Sort by" />
                  </SelectTrigger>
                  <SelectContent className="border-white/10 bg-slate-950 text-white">
                    {sortOptions.map((option) => (
                      <SelectItem key={option.value} value={option.value}>
                        {option.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>

                <div className="inline-flex rounded-full border border-white/10 bg-slate-950/70 p-1">
                  <button
                    type="button"
                    onClick={() => onViewModeChange("grid")}
                    className={cn(
                      "inline-flex h-9 items-center gap-2 rounded-full px-4 text-sm font-medium transition-colors",
                      viewMode === "grid"
                        ? "bg-white text-slate-950"
                        : "text-slate-300 hover:text-white",
                    )}
                  >
                    <LayoutGrid className="size-4" />
                    Grid
                  </button>
                  <button
                    type="button"
                    onClick={() => onViewModeChange("table")}
                    className={cn(
                      "inline-flex h-9 items-center gap-2 rounded-full px-4 text-sm font-medium transition-colors",
                      viewMode === "table"
                        ? "bg-white text-slate-950"
                        : "text-slate-300 hover:text-white",
                    )}
                  >
                    <List className="size-4" />
                    Table
                  </button>
                </div>
              </div>
            </div>

            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex flex-wrap gap-2">
                {filterChips.map((chip) => (
                  <button
                    key={chip.value}
                    type="button"
                    onClick={() => onFilterChange(chip.value)}
                    className={cn(
                      "rounded-full border px-4 py-2 text-sm font-medium transition-colors",
                      chip.value === activeFilter
                        ? "border-sky-400/20 bg-sky-400 text-slate-950"
                        : "border-white/10 bg-white/[0.03] text-slate-200 hover:bg-white/10",
                    )}
                  >
                    {chip.label}
                  </button>
                ))}
              </div>
              <p className="text-sm text-slate-400">Last updated {lastUpdatedLabel}</p>
            </div>
          </div>
        </section>

        {error && !isLoading ? (
          <div className="rounded-[32px] border border-rose-400/20 bg-rose-500/10 p-5 text-white">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p className="font-semibold">Failed to load services</p>
                <p className="mt-1 text-sm text-rose-100">{error}</p>
              </div>
              <Button type="button" onClick={onRetry}>
                Retry
              </Button>
            </div>
          </div>
        ) : null}

        {isLoading ? (
          <ServiceListSkeleton />
        ) : services.length === 0 ? (
          <div className="rounded-[32px] border border-dashed border-white/10 bg-white/[0.03] p-10 text-center text-white">
            <p className="text-2xl font-semibold">{emptyState.title}</p>
            <p className="mx-auto mt-3 max-w-2xl text-sm text-slate-400">
              {emptyState.description}
            </p>
            {!searchValue && activeFilter === "all" ? (
              <Link
                href="/organizer/services/create"
                className="mt-6 inline-flex h-11 items-center gap-2 rounded-full bg-sky-400 px-5 text-sm font-semibold text-slate-950 transition-colors hover:bg-sky-300"
              >
                <Plus className="size-4" />
                Create service
              </Link>
            ) : null}
          </div>
        ) : viewMode === "grid" ? (
          <div className="grid gap-5 xl:grid-cols-2">
            <AnimatePresence initial={false}>
              {services.map((service) => {
                const assignments = assignmentsByServiceId[service.id] ?? [];
                const resourcePills = assignments
                  .map((assignment) => resourcesById[assignment.resource_id]?.name)
                  .filter(Boolean) as string[];
                const shareUrl = origin ? buildServiceShareUrl(service, origin) : "";

                return (
                  <motion.article
                    key={service.id}
                    layout
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -8 }}
                    className="rounded-[32px] border border-white/10 bg-white/[0.04] p-6 text-white"
                  >
                    <div className="flex flex-col gap-5">
                      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                        <div className="space-y-3">
                          <div className="flex flex-wrap items-center gap-2">
                            <span
                              className={cn(
                                "rounded-full border px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.16em]",
                                service.is_published
                                  ? "border-emerald-400/20 bg-emerald-500/10 text-emerald-200"
                                  : "border-white/10 bg-white/[0.04] text-slate-200",
                              )}
                            >
                              {service.is_published ? "Published" : "Draft"}
                            </span>
                            {upcomingServiceIds.has(service.id) ? (
                              <span className="rounded-full border border-sky-400/20 bg-sky-500/10 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.16em] text-sky-200">
                                Upcoming bookings
                              </span>
                            ) : null}
                          </div>
                          <div>
                            <Link
                              href={`/organizer/services/${service.id}/edit`}
                              className="text-2xl font-semibold tracking-tight text-white transition-colors hover:text-sky-200"
                            >
                              {service.name}
                            </Link>
                            <p className="mt-2 line-clamp-2 text-sm text-slate-400">
                              {service.description || "No description added yet."}
                            </p>
                          </div>
                        </div>

                        <div className="grid min-w-[190px] gap-2 rounded-3xl border border-white/10 bg-slate-950/55 p-4 text-sm">
                          <div className="flex items-center justify-between gap-3">
                            <span className="text-slate-400">Duration</span>
                            <span className="font-semibold text-white">
                              {service.duration_minutes} min
                            </span>
                          </div>
                          <div className="flex items-center justify-between gap-3">
                            <span className="text-slate-400">Capacity</span>
                            <span className="font-semibold text-white">{service.capacity}</span>
                          </div>
                          <div className="flex items-center justify-between gap-3">
                            <span className="text-slate-400">Created</span>
                            <span className="font-semibold text-white">
                              {formatDate(service.created_at)}
                            </span>
                          </div>
                        </div>
                      </div>

                      <div className="space-y-3">
                        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
                          Assigned resources
                        </p>
                        {resourcePills.length === 0 ? (
                          <p className="text-sm text-slate-400">
                            No resources assigned yet.
                          </p>
                        ) : (
                          <div className="flex flex-wrap gap-2">
                            {resourcePills.map((resourceName) => (
                              <span
                                key={`${service.id}-${resourceName}`}
                                className="rounded-full border border-white/10 bg-slate-950/60 px-3 py-1.5 text-xs font-medium text-slate-200"
                              >
                                {resourceName}
                              </span>
                            ))}
                          </div>
                        )}
                      </div>

                      <div className="flex flex-wrap gap-2">
                        <Link
                          href={`/organizer/services/${service.id}/edit`}
                          className="inline-flex h-10 items-center rounded-full border border-white/15 px-4 text-sm font-medium text-white transition-colors hover:bg-white/10"
                        >
                          Edit
                        </Link>
                        <Link
                          href={`/appointments?q=${encodeURIComponent(service.name)}`}
                          className="inline-flex h-10 items-center gap-2 rounded-full border border-white/15 px-4 text-sm font-medium text-white transition-colors hover:bg-white/10"
                        >
                          <CalendarClock className="size-4" />
                          View bookings
                        </Link>
                        <Button
                          type="button"
                          variant="outline"
                          onClick={() => onDuplicate(service)}
                          disabled={duplicateServiceId === service.id}
                          className="border-white/15"
                        >
                          {duplicateServiceId === service.id ? (
                            <Loader2 className="size-4 animate-spin" />
                          ) : (
                            <Wand2 className="size-4" />
                          )}
                          Duplicate
                        </Button>
                        <Button
                          type="button"
                          variant="outline"
                          onClick={() => setPublishTarget(service)}
                          disabled={pendingServiceId === service.id}
                          className="border-white/15"
                        >
                          {pendingServiceId === service.id ? (
                            <Loader2 className="size-4 animate-spin" />
                          ) : null}
                          {service.is_published ? "Unpublish" : "Publish"}
                        </Button>
                        {service.is_published && shareUrl ? (
                          <>
                            <Button
                              type="button"
                              variant="outline"
                              onClick={() => onCopyLink(service)}
                              className="border-white/15"
                            >
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
                          </>
                        ) : null}
                        <Button
                          type="button"
                          variant="outline"
                          onClick={() => setDeleteTarget(service)}
                          disabled={deleteServiceId === service.id}
                          className="border-rose-400/20 text-rose-200 hover:bg-rose-500/10"
                        >
                          {deleteServiceId === service.id ? (
                            <Loader2 className="size-4 animate-spin" />
                          ) : (
                            <Trash2 className="size-4" />
                          )}
                          Delete
                        </Button>
                      </div>
                    </div>
                  </motion.article>
                );
              })}
            </AnimatePresence>
          </div>
        ) : (
          <div className="overflow-hidden rounded-[32px] border border-white/10 bg-white/[0.04]">
            <div className="grid grid-cols-[1.7fr_0.65fr_0.65fr_1fr_0.8fr_1.8fr] gap-4 border-b border-white/10 px-6 py-4 text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">
              <span>Service</span>
              <span>Duration</span>
              <span>Capacity</span>
              <span>Resources</span>
              <span>Status</span>
              <span>Actions</span>
            </div>
            <div className="divide-y divide-white/10">
              {services.map((service) => {
                const assignments = assignmentsByServiceId[service.id] ?? [];
                const resourcePills = assignments
                  .map((assignment) => resourcesById[assignment.resource_id]?.name)
                  .filter(Boolean) as string[];

                return (
                  <div
                    key={service.id}
                    className="grid grid-cols-[1.7fr_0.65fr_0.65fr_1fr_0.8fr_1.8fr] gap-4 px-6 py-5 text-sm text-white"
                  >
                    <div>
                      <Link
                        href={`/organizer/services/${service.id}/edit`}
                        className="font-semibold text-white transition-colors hover:text-sky-200"
                      >
                        {service.name}
                      </Link>
                      <p className="mt-1 line-clamp-2 text-slate-400">
                        {service.description || "No description added yet."}
                      </p>
                    </div>
                    <span>{service.duration_minutes} min</span>
                    <span>{service.capacity}</span>
                    <div className="flex flex-wrap gap-2">
                      {resourcePills.slice(0, 2).map((resourceName) => (
                        <span
                          key={`${service.id}-${resourceName}`}
                          className="rounded-full border border-white/10 px-2.5 py-1 text-xs text-slate-200"
                        >
                          {resourceName}
                        </span>
                      ))}
                      {resourcePills.length > 2 ? (
                        <span className="rounded-full border border-white/10 px-2.5 py-1 text-xs text-slate-400">
                          +{resourcePills.length - 2}
                        </span>
                      ) : null}
                    </div>
                    <span
                      className={cn(
                        "w-fit rounded-full border px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.16em]",
                        service.is_published
                          ? "border-emerald-400/20 bg-emerald-500/10 text-emerald-200"
                          : "border-white/10 bg-white/[0.04] text-slate-200",
                      )}
                    >
                      {service.is_published ? "Published" : "Draft"}
                    </span>
                    <div className="flex flex-wrap gap-2">
                      <Link
                        href={`/organizer/services/${service.id}/edit`}
                        className="inline-flex h-9 items-center rounded-full border border-white/15 px-3 text-sm font-medium text-white transition-colors hover:bg-white/10"
                      >
                        Edit
                      </Link>
                      <Link
                        href={`/appointments?q=${encodeURIComponent(service.name)}`}
                        className="inline-flex h-9 items-center rounded-full border border-white/15 px-3 text-sm font-medium text-white transition-colors hover:bg-white/10"
                      >
                        Bookings
                      </Link>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => onDuplicate(service)}
                        disabled={duplicateServiceId === service.id}
                        className="border-white/15"
                      >
                        Duplicate
                      </Button>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => setPublishTarget(service)}
                        className="border-white/15"
                      >
                        {service.is_published ? "Unpublish" : "Publish"}
                      </Button>
                      {service.is_published ? (
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={() => onCopyLink(service)}
                          className="border-white/15"
                        >
                          Copy link
                        </Button>
                      ) : null}
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => setDeleteTarget(service)}
                        className="border-rose-400/20 text-rose-200 hover:bg-rose-500/10"
                      >
                        Delete
                      </Button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>

      <PublishDialog
        open={publishTarget != null}
        onOpenChange={(open) => {
          if (!open) {
            setPublishTarget(null);
          }
        }}
        serviceName={publishTarget?.name ?? "this service"}
        nextPublishedState={!publishTarget?.is_published}
        isSubmitting={publishTarget != null && pendingServiceId === publishTarget.id}
        onConfirm={() => {
          if (publishTarget) {
            onTogglePublish(publishTarget, !publishTarget.is_published);
          }
          setPublishTarget(null);
        }}
      />

      <Dialog open={deleteTarget != null} onOpenChange={(open) => {
        if (!open) {
          setDeleteTarget(null);
        }
      }}>
        <DialogContent className="max-w-md rounded-[28px] border-white/10 bg-slate-950 text-white">
          <DialogHeader>
            <DialogTitle className="text-xl">Delete service</DialogTitle>
            <DialogDescription className="text-slate-300">
              Delete {deleteTarget?.name}. This removes it from organizer management and customer booking surfaces.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setDeleteTarget(null)}>
              Cancel
            </Button>
            <Button
              type="button"
              variant="destructive"
              disabled={deleteTarget != null && deleteServiceId === deleteTarget.id}
              onClick={() => {
                if (deleteTarget) {
                  onDelete(deleteTarget);
                }
                setDeleteTarget(null);
              }}
            >
              {deleteTarget != null && deleteServiceId === deleteTarget.id ? (
                <Loader2 className="size-4 animate-spin" />
              ) : null}
              Delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
