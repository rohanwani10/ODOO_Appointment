"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { RequireAuth } from "@/components/require-auth";
import { apiFetch } from "@/lib/api";
import type { Organization, Resource, Service } from "@/lib/types";

export default function OrganizerPage() {
  const [organizations, setOrganizations] = useState<Organization[]>([]);
  const [services, setServices] = useState<Service[]>([]);
  const [resources, setResources] = useState<Resource[]>([]);
  const [form, setForm] = useState({ name: "", description: "" });
  const [error, setError] = useState<string | null>(null);

  async function loadData() {
    try {
      const [orgs, organizerServices, organizerResources] = await Promise.all([
        apiFetch<Organization[]>("/api/organizations/mine"),
        apiFetch<Service[]>("/api/organizer/services"),
        apiFetch<Resource[]>("/api/resources"),
      ]);
      setOrganizations(orgs);
      setServices(organizerServices);
      setResources(organizerResources);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Unable to load organizer data");
    }
  }

  useEffect(() => {
    void loadData();
  }, []);

  async function handleCreateOrganization(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    try {
      await apiFetch<Organization>("/api/organizations", {
        method: "POST",
        body: JSON.stringify(form),
      });
      setForm({ name: "", description: "" });
      await loadData();
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : "Unable to create organization");
    }
  }

  return (
    <RequireAuth allowedRoles={["ORGANIZER", "ADMIN"]}>
      <div className="page">
        <section className="panel">
          <h1>Organizer workspace</h1>
          <p>
            This page owns organization setup. Service and resource management live in their own
            pages.
          </p>
          <div className="row">
            <Link href="/organizer/services">Manage services</Link>
            <Link href="/organizer/resources">Manage resources</Link>
          </div>
        </section>

        <section className="grid two">
          <div className="panel">
            <h2>Your organizations</h2>
            {error ? <p className="error">{error}</p> : null}
            <div className="list">
              {organizations.map((organization) => (
                <article key={organization.id} className="item">
                  <h3>{organization.name}</h3>
                  <p>{organization.description || "No description"}</p>
                </article>
              ))}
            </div>
          </div>

          <div className="panel">
            <h2>Create organization</h2>
            <form className="form" onSubmit={handleCreateOrganization}>
              <label className="field">
                <span>Name</span>
                <input
                  value={form.name}
                  onChange={(event) => setForm((current) => ({ ...current, name: event.target.value }))}
                  required
                />
              </label>
              <label className="field">
                <span>Description</span>
                <textarea
                  value={form.description}
                  onChange={(event) =>
                    setForm((current) => ({ ...current, description: event.target.value }))
                  }
                />
              </label>
              <button type="submit">Create organization</button>
            </form>
          </div>
        </section>

        <section className="grid three">
          <div className="panel">
            <h3>Organizations</h3>
            <p>{organizations.length}</p>
          </div>
          <div className="panel">
            <h3>Services</h3>
            <p>{services.length}</p>
          </div>
          <div className="panel">
            <h3>Resources</h3>
            <p>{resources.length}</p>
          </div>
        </section>
      </div>
    </RequireAuth>
  );
}
