"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { apiFetch } from "@/lib/api";
import type { Service } from "@/lib/types";

export default function ShareableServicePage() {
  const params = useParams<{ shareableLink: string }>();
  const [service, setService] = useState<Service | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;

    async function loadService() {
      try {
        const data = await apiFetch<Service>(
          `/api/services/shareable/${params.shareableLink}`,
          { skipAuth: true },
        );
        if (active) {
          setService(data);
        }
      } catch (loadError) {
        if (active) {
          setError(loadError instanceof Error ? loadError.message : "Unable to load service");
        }
      }
    }

    void loadService();
    return () => {
      active = false;
    };
  }, [params.shareableLink]);

  if (error) {
    return <p className="error">{error}</p>;
  }

  if (!service) {
    return <p>Loading service...</p>;
  }

  return (
    <div className="page">
      <section className="panel">
        <h1>{service.name}</h1>
        <p>{service.description}</p>
        <p>
          <Link href={`/services/${service.id}`}>Continue to booking</Link>
        </p>
      </section>
    </div>
  );
}
