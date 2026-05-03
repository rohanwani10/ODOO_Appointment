"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useAuth } from "@/components/auth-provider";
import { apiFetch } from "@/lib/api";
import type { Service } from "@/lib/types";

export default function HomePage() {
  const { isAuthenticated, hasRole } = useAuth();
  const [services, setServices] = useState<Service[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 6;

  useEffect(() => {
    let active = true;

    async function loadServices() {
      try {
        const data = await apiFetch<Service[]>("/api/services", {
          skipAuth: true,
        });
        if (active) {
          setServices(data);
          setCurrentPage(1);
        }
      } catch (loadError) {
        if (active) {
          setError(
            loadError instanceof Error
              ? loadError.message
              : "Unable to load services",
          );
        }
      } finally {
        if (active) {
          setIsLoading(false);
        }
      }
    }

    void loadServices();
    return () => {
      active = false;
    };
  }, []);

  const totalPages = Math.ceil(services.length / itemsPerPage);
  const startIdx = (currentPage - 1) * itemsPerPage;
  const endIdx = startIdx + itemsPerPage;
  const paginatedServices = services.slice(startIdx, endIdx);

  return (
    <div className="page">
      <section className="panel">
        <h1>FEv2 Home</h1>
        <p>
          This rebuild is functionality-first. Public users can browse services
          and book. Customers get appointments. Organizers get service and
          resource control. Admins get system views.
        </p>
        <div className="row">
          {!isAuthenticated ? <Link href="/auth/login">Login</Link> : null}
          {!isAuthenticated ? (
            <Link href="/auth/register">Register</Link>
          ) : null}
          {isAuthenticated ? (
            <Link href="/dashboard">Go to dashboard</Link>
          ) : null}
          {hasRole("ORGANIZER", "ADMIN") ? (
            <Link href="/organizer">Organizer workspace</Link>
          ) : null}
          {hasRole("ADMIN") ? <Link href="/admin">Admin</Link> : null}
        </div>
      </section>

      <section className="panel">
        <h2>Published services</h2>
        {isLoading ? <p>Loading services...</p> : null}
        {error ? <p className="error">{error}</p> : null}
        {!isLoading && services.length === 0 ? (
          <p>No published services yet.</p>
        ) : null}
        <div className="list">
          {paginatedServices.map((service) => (
            <article key={service.id} className="item">
              <h3>{service.name}</h3>
              <p>{service.description || "No description provided."}</p>
              <p>
                Duration: {service.duration_minutes} minutes | Capacity:{" "}
                {service.capacity}
              </p>
              <div className="row">
                <Link href={`/services/${service.id}`}>Book service</Link>
                {service.shareable_link ? (
                  <Link
                    href={`/services/share/${service.shareable_link}`}
                    className="button-secondary"
                  >
                    Open share link
                  </Link>
                ) : null}
              </div>
            </article>
          ))}
        </div>
        {totalPages > 1 ? (
          <div className="pagination">
            <button
              onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
              disabled={currentPage === 1}
              className="pagination-button"
            >
              Previous
            </button>
            <span className="pagination-info">
              Page {currentPage} of {totalPages}
            </span>
            <button
              onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
              disabled={currentPage === totalPages}
              className="pagination-button"
            >
              Next
            </button>
          </div>
        ) : null}
      </section>
    </div>
  );
}
