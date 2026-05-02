"use client";

import { useParams } from "next/navigation";
import { ServiceForm } from "@/components/organizer/service-form";

export default function EditOrganizerServicePage() {
  const params = useParams<{ id: string }>();
  const serviceId = Number(params?.id);

  return <ServiceForm mode="edit" serviceId={Number.isNaN(serviceId) ? undefined : serviceId} />;
}

