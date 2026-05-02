"use client";

import { useEffect, useMemo, useState } from "react";
import { RequireAuth } from "@/components/require-auth";
import { apiFetch } from "@/lib/api";
import type {
  FormQuestion,
  Organization,
  Resource,
  Service,
  ServiceResourceAssignment,
} from "@/lib/types";

const emptyCreateForm = {
  organization_id: "",
  name: "",
  description: "",
  duration_minutes: "30",
  capacity: "1",
  max_bookings_per_user: "",
  requires_advance_payment: false,
  advance_payment_amount: "",
};

const emptyQuestionForm = {
  question_text: "",
  field_type: "TEXT",
  is_required: true,
  options: "",
  display_order: "0",
};

export default function OrganizerServicesPage() {
  const [services, setServices] = useState<Service[]>([]);
  const [organizations, setOrganizations] = useState<Organization[]>([]);
  const [resources, setResources] = useState<Resource[]>([]);
  const [selectedServiceId, setSelectedServiceId] = useState<number | null>(null);
  const [selectedService, setSelectedService] = useState<Service | null>(null);
  const [assignments, setAssignments] = useState<ServiceResourceAssignment[]>([]);
  const [questions, setQuestions] = useState<FormQuestion[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [createForm, setCreateForm] = useState(emptyCreateForm);
  const [editForm, setEditForm] = useState(emptyCreateForm);
  const [assignmentForm, setAssignmentForm] = useState({
    resource_id: "",
    is_required: false,
    assignment_type: "MANUAL",
  });
  const [questionForm, setQuestionForm] = useState(emptyQuestionForm);
  const [editingQuestionId, setEditingQuestionId] = useState<number | null>(null);

  const selectedAssignmentResourceIds = useMemo(
    () => new Set(assignments.map((assignment) => assignment.resource_id)),
    [assignments],
  );

  async function loadBaseData() {
    const [orgs, organizerServices, organizerResources] = await Promise.all([
      apiFetch<Organization[]>("/api/organizations/mine"),
      apiFetch<Service[]>("/api/organizer/services"),
      apiFetch<Resource[]>("/api/resources"),
    ]);

    setOrganizations(orgs);
    setServices(organizerServices);
    setResources(organizerResources);
    setCreateForm((current) => ({
      ...current,
      organization_id: current.organization_id || String(orgs[0]?.id ?? ""),
    }));
    setSelectedServiceId((current) => current ?? organizerServices[0]?.id ?? null);
  }

  async function loadSelectedService(serviceId: number) {
    const [service, serviceAssignments, serviceQuestions] = await Promise.all([
      apiFetch<Service>(`/api/organizer/services/${serviceId}`),
      apiFetch<ServiceResourceAssignment[]>(
        `/api/organizer/services/${serviceId}/resources`,
      ),
      apiFetch<FormQuestion[]>(`/api/organizer/services/${serviceId}/form-questions`),
    ]);

    setSelectedService(service);
    setAssignments(serviceAssignments);
    setQuestions(serviceQuestions);
    setEditForm({
      organization_id: String(service.organization_id),
      name: service.name,
      description: service.description || "",
      duration_minutes: String(service.duration_minutes),
      capacity: String(service.capacity),
      max_bookings_per_user: service.max_bookings_per_user
        ? String(service.max_bookings_per_user)
        : "",
      requires_advance_payment: service.requires_advance_payment,
      advance_payment_amount: service.advance_payment_amount
        ? String(service.advance_payment_amount)
        : "",
    });
    setAssignmentForm((current) => ({
      ...current,
      resource_id:
        current.resource_id ||
        String(
          resources.find(
            (resource) =>
              resource.organization_id === service.organization_id &&
              !selectedAssignmentResourceIds.has(resource.id),
          )?.id ?? "",
        ),
    }));
  }

  async function loadData() {
    setError(null);
    await loadBaseData();
  }

  useEffect(() => {
    void loadData().catch((loadError) => {
      setError(loadError instanceof Error ? loadError.message : "Unable to load services");
    });
  }, []);

  useEffect(() => {
    if (!selectedServiceId) {
      setSelectedService(null);
      setAssignments([]);
      setQuestions([]);
      return;
    }

    void loadSelectedService(selectedServiceId).catch((loadError) => {
      setError(loadError instanceof Error ? loadError.message : "Unable to load service detail");
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedServiceId]);

  async function refreshAll(serviceId?: number | null) {
    await loadBaseData();
    const nextServiceId = serviceId ?? selectedServiceId;
    if (nextServiceId) {
      setSelectedServiceId(nextServiceId);
      await loadSelectedService(nextServiceId);
    }
  }

  function setFeedback(nextMessage: string) {
    setMessage(nextMessage);
    setError(null);
  }

  async function handleCreate(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    try {
      const createdService = await apiFetch<Service>("/api/services", {
        method: "POST",
        body: JSON.stringify({
          organization_id: Number(createForm.organization_id),
          name: createForm.name,
          description: createForm.description || null,
          duration_minutes: Number(createForm.duration_minutes),
          capacity: Number(createForm.capacity),
          max_bookings_per_user: createForm.max_bookings_per_user
            ? Number(createForm.max_bookings_per_user)
            : null,
          requires_advance_payment: createForm.requires_advance_payment,
          advance_payment_amount: createForm.requires_advance_payment
            ? Number(createForm.advance_payment_amount || 0)
            : null,
        }),
      });
      setCreateForm((current) => ({
        ...current,
        name: "",
        description: "",
        duration_minutes: "30",
        capacity: "1",
        max_bookings_per_user: "",
        requires_advance_payment: false,
        advance_payment_amount: "",
      }));
      await refreshAll(createdService.id);
      setFeedback("Service created.");
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : "Unable to create service");
    }
  }

  async function handleUpdateService(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!selectedService) {
      return;
    }

    try {
      await apiFetch<Service>(`/api/services/${selectedService.id}`, {
        method: "PUT",
        body: JSON.stringify({
          name: editForm.name,
          description: editForm.description || null,
          duration_minutes: Number(editForm.duration_minutes),
          capacity: Number(editForm.capacity),
          max_bookings_per_user: editForm.max_bookings_per_user
            ? Number(editForm.max_bookings_per_user)
            : null,
          requires_advance_payment: editForm.requires_advance_payment,
          advance_payment_amount: editForm.requires_advance_payment
            ? Number(editForm.advance_payment_amount || 0)
            : null,
        }),
      });
      await refreshAll(selectedService.id);
      setFeedback("Service updated.");
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : "Unable to update service");
    }
  }

  async function togglePublish(service: Service) {
    try {
      await apiFetch(`/api/services/${service.id}/${service.is_published ? "unpublish" : "publish"}`, {
        method: "POST",
      });
      await refreshAll(service.id);
      setFeedback(service.is_published ? "Service unpublished." : "Service published.");
    } catch (actionError) {
      setError(actionError instanceof Error ? actionError.message : "Unable to update publish status");
    }
  }

  async function deleteService(serviceId: number) {
    try {
      await apiFetch(`/api/services/${serviceId}`, { method: "DELETE" });
      const remaining = services.filter((service) => service.id !== serviceId);
      setSelectedServiceId(remaining[0]?.id ?? null);
      await loadBaseData();
      setFeedback("Service deleted.");
    } catch (actionError) {
      setError(actionError instanceof Error ? actionError.message : "Unable to delete service");
    }
  }

  async function generateShareLink() {
    if (!selectedService) {
      return;
    }

    try {
      const response = await apiFetch<{ shareable_link: string }>(
        `/api/services/${selectedService.id}/shareable-link`,
        { method: "POST" },
      );
      await refreshAll(selectedService.id);
      setFeedback(`Shareable link generated: ${response.shareable_link}`);
    } catch (actionError) {
      setError(actionError instanceof Error ? actionError.message : "Unable to generate share link");
    }
  }

  async function handleAddAssignment(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!selectedService) {
      return;
    }

    try {
      await apiFetch(`/api/services/${selectedService.id}/resources`, {
        method: "POST",
        body: JSON.stringify({
          resource_id: Number(assignmentForm.resource_id),
          is_required: assignmentForm.is_required,
          assignment_type: assignmentForm.assignment_type,
        }),
      });
      await refreshAll(selectedService.id);
      setAssignmentForm({
        resource_id: "",
        is_required: false,
        assignment_type: "MANUAL",
      });
      setFeedback("Resource assigned to service.");
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : "Unable to assign resource");
    }
  }

  async function updateAssignment(
    assignment: ServiceResourceAssignment,
    field: "is_required" | "assignment_type",
    value: boolean | "MANUAL" | "AUTO",
  ) {
    if (!selectedService) {
      return;
    }

    try {
      await apiFetch(`/api/services/${selectedService.id}/resources/${assignment.resource_id}`, {
        method: "PUT",
        body: JSON.stringify({ [field]: value }),
      });
      await refreshAll(selectedService.id);
      setFeedback("Service assignment updated.");
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : "Unable to update assignment");
    }
  }

  async function removeAssignment(resourceId: number) {
    if (!selectedService) {
      return;
    }

    try {
      await apiFetch(`/api/services/${selectedService.id}/resources/${resourceId}`, {
        method: "DELETE",
      });
      await refreshAll(selectedService.id);
      setFeedback("Resource removed from service.");
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : "Unable to remove assignment");
    }
  }

  function startEditQuestion(question: FormQuestion) {
    setEditingQuestionId(question.id);
    setQuestionForm({
      question_text: question.question_text,
      field_type: question.field_type,
      is_required: question.is_required,
      options: question.options || "",
      display_order: String(question.display_order),
    });
  }

  function resetQuestionForm() {
    setEditingQuestionId(null);
    setQuestionForm(emptyQuestionForm);
  }

  async function handleQuestionSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!selectedService) {
      return;
    }

    const body = {
      question_text: questionForm.question_text,
      field_type: questionForm.field_type,
      is_required: questionForm.is_required,
      options: questionForm.options || null,
      display_order: Number(questionForm.display_order || 0),
    };

    try {
      if (editingQuestionId) {
        await apiFetch(`/api/services/${selectedService.id}/form-questions/${editingQuestionId}`, {
          method: "PUT",
          body: JSON.stringify(body),
        });
        setFeedback("Question updated.");
      } else {
        await apiFetch(`/api/services/${selectedService.id}/form-questions`, {
          method: "POST",
          body: JSON.stringify(body),
        });
        setFeedback("Question created.");
      }
      resetQuestionForm();
      await refreshAll(selectedService.id);
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : "Unable to save question");
    }
  }

  async function deleteQuestion(questionId: number) {
    if (!selectedService) {
      return;
    }

    try {
      await apiFetch(`/api/services/${selectedService.id}/form-questions/${questionId}`, {
        method: "DELETE",
      });
      await refreshAll(selectedService.id);
      setFeedback("Question deleted.");
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : "Unable to delete question");
    }
  }

  const availableResources = resources.filter(
    (resource) =>
      resource.organization_id === selectedService?.organization_id &&
      !selectedAssignmentResourceIds.has(resource.id),
  );

  return (
    <RequireAuth allowedRoles={["ORGANIZER", "ADMIN"]}>
      <div className="page">
        <section className="panel">
          <h1>Organizer services</h1>
          <p>Create, edit, publish, assign resources, and manage booking questions.</p>
          {message ? <p className="success">{message}</p> : null}
          {error ? <p className="error">{error}</p> : null}
        </section>

        <section className="grid two">
          <div className="panel">
            <h2>Create service</h2>
            <form className="form" onSubmit={handleCreate}>
              <label className="field">
                <span>Organization</span>
                <select
                  value={createForm.organization_id}
                  onChange={(event) =>
                    setCreateForm((current) => ({ ...current, organization_id: event.target.value }))
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
                  value={createForm.name}
                  onChange={(event) => setCreateForm((current) => ({ ...current, name: event.target.value }))}
                  required
                />
              </label>
              <label className="field">
                <span>Description</span>
                <textarea
                  value={createForm.description}
                  onChange={(event) => setCreateForm((current) => ({ ...current, description: event.target.value }))}
                />
              </label>
              <div className="grid two">
                <label className="field">
                  <span>Duration</span>
                  <input
                    type="number"
                    value={createForm.duration_minutes}
                    onChange={(event) =>
                      setCreateForm((current) => ({ ...current, duration_minutes: event.target.value }))
                    }
                    required
                  />
                </label>
                <label className="field">
                  <span>Capacity</span>
                  <input
                    type="number"
                    value={createForm.capacity}
                    onChange={(event) =>
                      setCreateForm((current) => ({ ...current, capacity: event.target.value }))
                    }
                    required
                  />
                </label>
              </div>
              <label className="field">
                <span>Max bookings per user</span>
                <input
                  type="number"
                  value={createForm.max_bookings_per_user}
                  onChange={(event) =>
                    setCreateForm((current) => ({ ...current, max_bookings_per_user: event.target.value }))
                  }
                />
              </label>
              <label className="field">
                <span>
                  <input
                    type="checkbox"
                    checked={createForm.requires_advance_payment}
                    onChange={(event) =>
                      setCreateForm((current) => ({
                        ...current,
                        requires_advance_payment: event.target.checked,
                      }))
                    }
                  />{" "}
                  Requires advance payment
                </span>
              </label>
              {createForm.requires_advance_payment ? (
                <label className="field">
                  <span>Advance amount</span>
                  <input
                    type="number"
                    value={createForm.advance_payment_amount}
                    onChange={(event) =>
                      setCreateForm((current) => ({ ...current, advance_payment_amount: event.target.value }))
                    }
                  />
                </label>
              ) : null}
              <button type="submit">Create service</button>
            </form>
          </div>

          <div className="panel">
            <h2>Service list</h2>
            <div className="list">
              {services.map((service) => (
                <article key={service.id} className="item">
                  <h3>{service.name}</h3>
                  <p>{service.description || "No description"}</p>
                  <p>
                    Status: {service.is_published ? "Published" : "Draft"} | Duration:{" "}
                    {service.duration_minutes} | Capacity: {service.capacity}
                  </p>
                  <div className="row">
                    <button type="button" onClick={() => setSelectedServiceId(service.id)}>
                      Manage
                    </button>
                    <button type="button" onClick={() => void togglePublish(service)}>
                      {service.is_published ? "Unpublish" : "Publish"}
                    </button>
                    <button type="button" onClick={() => void deleteService(service.id)}>
                      Delete
                    </button>
                  </div>
                </article>
              ))}
            </div>
          </div>
        </section>

        {selectedService ? (
          <section className="grid two">
            <div className="panel">
              <h2>Manage service: {selectedService.name}</h2>
              <p>Share link: {selectedService.shareable_link || "Not generated"}</p>
              <div className="row">
                <button type="button" onClick={() => void generateShareLink()}>
                  Generate share link
                </button>
                {selectedService.shareable_link ? (
                  <a href={`/services/share/${selectedService.shareable_link}`} target="_blank" rel="noreferrer">
                    Open share page
                  </a>
                ) : null}
              </div>
              <form className="form" onSubmit={handleUpdateService}>
                <label className="field">
                  <span>Name</span>
                  <input
                    value={editForm.name}
                    onChange={(event) => setEditForm((current) => ({ ...current, name: event.target.value }))}
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
                <div className="grid two">
                  <label className="field">
                    <span>Duration</span>
                    <input
                      type="number"
                      value={editForm.duration_minutes}
                      onChange={(event) =>
                        setEditForm((current) => ({ ...current, duration_minutes: event.target.value }))
                      }
                    />
                  </label>
                  <label className="field">
                    <span>Capacity</span>
                    <input
                      type="number"
                      value={editForm.capacity}
                      onChange={(event) =>
                        setEditForm((current) => ({ ...current, capacity: event.target.value }))
                      }
                    />
                  </label>
                </div>
                <label className="field">
                  <span>Max bookings per user</span>
                  <input
                    type="number"
                    value={editForm.max_bookings_per_user}
                    onChange={(event) =>
                      setEditForm((current) => ({ ...current, max_bookings_per_user: event.target.value }))
                    }
                  />
                </label>
                <label className="field">
                  <span>
                    <input
                      type="checkbox"
                      checked={editForm.requires_advance_payment}
                      onChange={(event) =>
                        setEditForm((current) => ({
                          ...current,
                          requires_advance_payment: event.target.checked,
                        }))
                      }
                    />{" "}
                    Requires advance payment
                  </span>
                </label>
                {editForm.requires_advance_payment ? (
                  <label className="field">
                    <span>Advance amount</span>
                    <input
                      type="number"
                      value={editForm.advance_payment_amount}
                      onChange={(event) =>
                        setEditForm((current) => ({ ...current, advance_payment_amount: event.target.value }))
                      }
                    />
                  </label>
                ) : null}
                <button type="submit">Save service updates</button>
              </form>
            </div>

            <div className="panel">
              <h2>Assigned resources</h2>
              <form className="form" onSubmit={handleAddAssignment}>
                <label className="field">
                  <span>Resource</span>
                  <select
                    value={assignmentForm.resource_id}
                    onChange={(event) =>
                      setAssignmentForm((current) => ({ ...current, resource_id: event.target.value }))
                    }
                    required
                  >
                    <option value="">Select resource</option>
                    {availableResources.map((resource) => (
                      <option key={resource.id} value={resource.id}>
                        {resource.name} ({resource.type})
                      </option>
                    ))}
                  </select>
                </label>
                <label className="field">
                  <span>
                    <input
                      type="checkbox"
                      checked={assignmentForm.is_required}
                      onChange={(event) =>
                        setAssignmentForm((current) => ({ ...current, is_required: event.target.checked }))
                      }
                    />{" "}
                    Required resource
                  </span>
                </label>
                <label className="field">
                  <span>Assignment type</span>
                  <select
                    value={assignmentForm.assignment_type}
                    onChange={(event) =>
                      setAssignmentForm((current) => ({
                        ...current,
                        assignment_type: event.target.value as "MANUAL" | "AUTO",
                      }))
                    }
                  >
                    <option value="MANUAL">Manual</option>
                    <option value="AUTO">Auto</option>
                  </select>
                </label>
                <button type="submit">Assign resource</button>
              </form>

              <div className="table-wrap">
                <table>
                  <thead>
                    <tr>
                      <th>Resource</th>
                      <th>Required</th>
                      <th>Assignment type</th>
                      <th>Remove</th>
                    </tr>
                  </thead>
                  <tbody>
                    {assignments.map((assignment) => {
                      const resource = resources.find((item) => item.id === assignment.resource_id);
                      return (
                        <tr key={assignment.id}>
                          <td>{resource?.name || assignment.resource_id}</td>
                          <td>
                            <input
                              type="checkbox"
                              checked={assignment.is_required}
                              onChange={(event) =>
                                void updateAssignment(assignment, "is_required", event.target.checked)
                              }
                            />
                          </td>
                          <td>
                            <select
                              value={assignment.assignment_type}
                              onChange={(event) =>
                                void updateAssignment(
                                  assignment,
                                  "assignment_type",
                                  event.target.value as "MANUAL" | "AUTO",
                                )
                              }
                            >
                              <option value="MANUAL">MANUAL</option>
                              <option value="AUTO">AUTO</option>
                            </select>
                          </td>
                          <td>
                            <button type="button" onClick={() => void removeAssignment(assignment.resource_id)}>
                              Remove
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          </section>
        ) : null}

        {selectedService ? (
          <section className="grid two">
            <div className="panel">
              <h2>{editingQuestionId ? "Edit question" : "Create question"}</h2>
              <form className="form" onSubmit={handleQuestionSubmit}>
                <label className="field">
                  <span>Question text</span>
                  <input
                    value={questionForm.question_text}
                    onChange={(event) =>
                      setQuestionForm((current) => ({ ...current, question_text: event.target.value }))
                    }
                    required
                  />
                </label>
                <label className="field">
                  <span>Field type</span>
                  <select
                    value={questionForm.field_type}
                    onChange={(event) =>
                      setQuestionForm((current) => ({ ...current, field_type: event.target.value }))
                    }
                  >
                    {["TEXT", "EMAIL", "PHONE", "TEXTAREA", "SELECT", "CHECKBOX", "DATE"].map((type) => (
                      <option key={type} value={type}>
                        {type}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="field">
                  <span>
                    <input
                      type="checkbox"
                      checked={questionForm.is_required}
                      onChange={(event) =>
                        setQuestionForm((current) => ({ ...current, is_required: event.target.checked }))
                      }
                    />{" "}
                    Required
                  </span>
                </label>
                <label className="field">
                  <span>Options (JSON array or comma-separated)</span>
                  <input
                    value={questionForm.options}
                    onChange={(event) =>
                      setQuestionForm((current) => ({ ...current, options: event.target.value }))
                    }
                  />
                </label>
                <label className="field">
                  <span>Display order</span>
                  <input
                    type="number"
                    value={questionForm.display_order}
                    onChange={(event) =>
                      setQuestionForm((current) => ({ ...current, display_order: event.target.value }))
                    }
                  />
                </label>
                <div className="row">
                  <button type="submit">{editingQuestionId ? "Update question" : "Create question"}</button>
                  {editingQuestionId ? (
                    <button type="button" onClick={resetQuestionForm}>
                      Cancel edit
                    </button>
                  ) : null}
                </div>
              </form>
            </div>

            <div className="panel">
              <h2>Booking questions</h2>
              <div className="list">
                {questions.map((question) => (
                  <article key={question.id} className="item">
                    <h3>{question.question_text}</h3>
                    <p>
                      Type: {question.field_type} | Required: {question.is_required ? "Yes" : "No"} |
                      Order: {question.display_order}
                    </p>
                    <p>Options: {question.options || "None"}</p>
                    <div className="row">
                      <button type="button" onClick={() => startEditQuestion(question)}>
                        Edit
                      </button>
                      <button type="button" onClick={() => void deleteQuestion(question.id)}>
                        Delete
                      </button>
                    </div>
                  </article>
                ))}
              </div>
            </div>
          </section>
        ) : null}
      </div>
    </RequireAuth>
  );
}
