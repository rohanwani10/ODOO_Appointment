"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Plus, Settings2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Spinner } from "@/components/ui/spinner";
import type { Resource, ResourceType } from "@/types/resource";
import type { EditableServiceAssignment } from "@/lib/organizer-services";

type ResourceSelectorProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  organizationId: number | null;
  resources: Resource[];
  value: EditableServiceAssignment[];
  isSaving?: boolean;
  onSave: (assignments: EditableServiceAssignment[]) => void;
  onCreateResource: (input: {
    organization_id: number;
    name: string;
    type: ResourceType;
    description: string;
    capacity: number;
  }) => Promise<Resource>;
};

type ResourceDraftForm = {
  name: string;
  type: ResourceType;
  description: string;
  capacity: string;
};

const defaultResourceDraft: ResourceDraftForm = {
  name: "",
  type: "PROVIDER",
  description: "",
  capacity: "1",
};

export function ResourceSelector({
  open,
  onOpenChange,
  organizationId,
  resources,
  value,
  isSaving = false,
  onSave,
  onCreateResource,
}: ResourceSelectorProps) {
  const [draftAssignments, setDraftAssignments] = useState<EditableServiceAssignment[]>(value);
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [createForm, setCreateForm] = useState<ResourceDraftForm>(defaultResourceDraft);
  const [createError, setCreateError] = useState<string | null>(null);
  const [isCreatingResource, setIsCreatingResource] = useState(false);

  useEffect(() => {
    if (!open) {
      return;
    }

    setDraftAssignments(value);
    setCreateError(null);
    setCreateForm(defaultResourceDraft);
    setIsCreateOpen(false);
  }, [open, value]);

  const filteredResources = useMemo(() => {
    if (!organizationId) {
      return [];
    }

    return resources.filter((resource) => resource.organization_id === organizationId);
  }, [organizationId, resources]);

  const selectedResourceIds = useMemo(
    () => new Set(draftAssignments.map((assignment) => assignment.resource_id)),
    [draftAssignments],
  );

  function toggleResource(resourceId: number, checked: boolean) {
    if (checked) {
      setDraftAssignments((current) => [
        ...current,
        {
          resource_id: resourceId,
          is_required: false,
          assignment_type: "MANUAL",
        },
      ]);
      return;
    }

    setDraftAssignments((current) =>
      current.filter((assignment) => assignment.resource_id !== resourceId),
    );
  }

  function updateAssignment(
    resourceId: number,
    patch: Partial<EditableServiceAssignment>,
  ) {
    setDraftAssignments((current) =>
      current.map((assignment) =>
        assignment.resource_id === resourceId
          ? { ...assignment, ...patch }
          : assignment,
      ),
    );
  }

  async function handleCreateResource() {
    if (!organizationId) {
      setCreateError("Select an organization before creating resources.");
      return;
    }

    const name = createForm.name.trim();
    const capacity = Number(createForm.capacity);

    if (!name) {
      setCreateError("Resource name is required.");
      return;
    }

    if (!Number.isFinite(capacity) || capacity < 1) {
      setCreateError("Capacity must be at least 1.");
      return;
    }

    setIsCreatingResource(true);
    setCreateError(null);

    try {
      const createdResource = await onCreateResource({
        organization_id: organizationId,
        name,
        type: createForm.type,
        description: createForm.description.trim(),
        capacity,
      });

      setDraftAssignments((current) => [
        ...current,
        {
          resource_id: createdResource.id,
          is_required: false,
          assignment_type: "MANUAL",
        },
      ]);
      setCreateForm(defaultResourceDraft);
      setIsCreateOpen(false);
    } catch (error) {
      setCreateError(error instanceof Error ? error.message : "Failed to create resource.");
    } finally {
      setIsCreatingResource(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[85vh] overflow-y-auto rounded-[32px] border-white/10 bg-slate-950 text-white sm:max-w-3xl">
        <DialogHeader>
          <DialogTitle className="text-2xl">Assign resources</DialogTitle>
          <DialogDescription className="text-slate-300">
            Choose which people, rooms, or equipment this service can book against.
          </DialogDescription>
        </DialogHeader>

        {!organizationId ? (
          <div className="rounded-3xl border border-amber-400/20 bg-amber-500/10 p-4 text-sm text-amber-100">
            Pick an organization in the service form first. Resource assignments are organization-specific.
          </div>
        ) : null}

        <div className="space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-3xl border border-white/10 bg-white/[0.04] p-4">
            <div>
              <p className="text-sm font-semibold text-white">Available resources</p>
              <p className="text-sm text-slate-400">
                {filteredResources.length === 0
                  ? "No resources created yet for this organization."
                  : `${filteredResources.length} resources available`}
              </p>
            </div>

            <div className="flex flex-wrap gap-2">
              <Button
                type="button"
                variant="secondary"
                onClick={() => setIsCreateOpen((current) => !current)}
                disabled={!organizationId}
              >
                <Plus className="size-4" />
                Create new resource
              </Button>
              <Link
                href="/organizer"
                className="inline-flex h-10 items-center gap-2 rounded-full border border-white/15 px-4 text-sm font-medium text-white transition-colors hover:bg-white/10"
              >
                <Settings2 className="size-4" />
                Resource workspace
              </Link>
            </div>
          </div>

          <AnimatePresence initial={false}>
            {isCreateOpen ? (
              <motion.div
                initial={{ opacity: 0, y: -8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -8 }}
                className="grid gap-4 rounded-3xl border border-sky-400/20 bg-sky-500/10 p-4 md:grid-cols-2"
              >
                <div className="space-y-2">
                  <Label htmlFor="new-resource-name">Resource name</Label>
                  <Input
                    id="new-resource-name"
                    value={createForm.name}
                    onChange={(event) =>
                      setCreateForm((current) => ({ ...current, name: event.target.value }))
                    }
                    placeholder="Dr. Morgan Lee"
                    className="border-white/10 bg-slate-950/70"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="new-resource-type">Type</Label>
                  <Select
                    value={createForm.type}
                    onValueChange={(value) =>
                      setCreateForm((current) => ({
                        ...current,
                        type: value as ResourceType,
                      }))
                    }
                  >
                    <SelectTrigger
                      id="new-resource-type"
                      className="h-11 w-full rounded-2xl border-white/10 bg-slate-950/70 text-white"
                    >
                      <SelectValue placeholder="Select type" />
                    </SelectTrigger>
                    <SelectContent className="border-white/10 bg-slate-950 text-white">
                      <SelectItem value="PROVIDER">Provider</SelectItem>
                      <SelectItem value="ROOM">Room</SelectItem>
                      <SelectItem value="EQUIPMENT">Equipment</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="new-resource-capacity">Capacity</Label>
                  <Input
                    id="new-resource-capacity"
                    type="number"
                    min={1}
                    value={createForm.capacity}
                    onChange={(event) =>
                      setCreateForm((current) => ({ ...current, capacity: event.target.value }))
                    }
                    className="border-white/10 bg-slate-950/70"
                  />
                </div>

                <div className="space-y-2 md:col-span-2">
                  <Label htmlFor="new-resource-description">Description</Label>
                  <Textarea
                    id="new-resource-description"
                    value={createForm.description}
                    onChange={(event) =>
                      setCreateForm((current) => ({
                        ...current,
                        description: event.target.value,
                      }))
                    }
                    placeholder="Optional context for this resource"
                    className="min-h-24 rounded-2xl border-white/10 bg-slate-950/70"
                  />
                </div>

                {createError ? (
                  <p className="md:col-span-2 text-sm text-rose-300" aria-live="polite">
                    {createError}
                  </p>
                ) : null}

                <div className="md:col-span-2 flex justify-end">
                  <Button type="button" onClick={handleCreateResource} disabled={isCreatingResource}>
                    {isCreatingResource ? <Spinner /> : null}
                    Add resource
                  </Button>
                </div>
              </motion.div>
            ) : null}
          </AnimatePresence>

          <div className="space-y-3">
            {filteredResources.length === 0 ? (
              <div className="rounded-3xl border border-dashed border-white/10 bg-white/[0.03] p-6 text-center text-sm text-slate-400">
                No resources exist for this organization yet.
              </div>
            ) : (
              filteredResources.map((resource) => {
                const assignment = draftAssignments.find(
                  (item) => item.resource_id === resource.id,
                );
                const isSelected = Boolean(assignment);

                return (
                  <div
                    key={resource.id}
                    className="rounded-3xl border border-white/10 bg-white/[0.03] p-4"
                  >
                    <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                      <div className="flex items-start gap-3">
                        <Checkbox
                          id={`resource-${resource.id}`}
                          checked={isSelected}
                          onCheckedChange={(checked) => toggleResource(resource.id, checked === true)}
                          className="mt-1 border-white/20"
                        />
                        <div className="space-y-1">
                          <Label
                            htmlFor={`resource-${resource.id}`}
                            className="cursor-pointer text-base font-semibold text-white"
                          >
                            {resource.name}
                          </Label>
                          <div className="flex flex-wrap gap-2 text-xs uppercase tracking-[0.18em] text-slate-400">
                            <span>{resource.type}</span>
                            <span>Capacity {resource.capacity}</span>
                            <span>{resource.is_active === false ? "Inactive" : "Active"}</span>
                          </div>
                          {resource.description ? (
                            <p className="text-sm text-slate-400">{resource.description}</p>
                          ) : null}
                        </div>
                      </div>

                      <AnimatePresence initial={false}>
                        {assignment ? (
                          <motion.div
                            initial={{ opacity: 0, y: -6 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, y: -6 }}
                            className="grid gap-3 rounded-2xl border border-white/10 bg-slate-950/60 p-3 sm:grid-cols-2"
                          >
                            <label className="flex items-center gap-3 rounded-2xl border border-white/10 px-3 py-2 text-sm text-white">
                              <Checkbox
                                checked={assignment.is_required}
                                onCheckedChange={(checked) =>
                                  updateAssignment(resource.id, { is_required: checked === true })
                                }
                                className="border-white/20"
                              />
                              Required resource
                            </label>

                            <div className="space-y-2">
                              <Label htmlFor={`assignment-type-${resource.id}`}>Assignment</Label>
                              <Select
                                value={assignment.assignment_type}
                                onValueChange={(value) =>
                                  updateAssignment(resource.id, {
                                    assignment_type: value as EditableServiceAssignment["assignment_type"],
                                  })
                                }
                              >
                                <SelectTrigger
                                  id={`assignment-type-${resource.id}`}
                                  className="h-10 w-full rounded-2xl border-white/10 bg-slate-950/80 text-white"
                                >
                                  <SelectValue placeholder="Assignment type" />
                                </SelectTrigger>
                                <SelectContent className="border-white/10 bg-slate-950 text-white">
                                  <SelectItem value="MANUAL">Manual</SelectItem>
                                  <SelectItem value="AUTO">Auto</SelectItem>
                                </SelectContent>
                              </Select>
                            </div>
                          </motion.div>
                        ) : null}
                      </AnimatePresence>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>

        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            type="button"
            onClick={() => {
              onSave(draftAssignments);
              onOpenChange(false);
            }}
            disabled={isSaving || !organizationId}
          >
            {isSaving ? <Spinner /> : null}
            Save assignments
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

