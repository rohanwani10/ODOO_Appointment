"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { apiFetch } from "@/lib/api";
import { getErrorMessage } from "@/lib/errors";
import type { Service } from "@/types/service";

export default function ShareableServiceRedirectPage() {
  const params = useParams<{ shareableLink: string }>();
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function resolveShareLink() {
      const shareableLink = params?.shareableLink;
      if (!shareableLink) {
        setError("Missing shareable link.");
        return;
      }

      try {
        const service = await apiFetch<Service>(`/api/services/shareable/${shareableLink}`);
        if (!cancelled) {
          router.replace(`/services/${service.id}`);
        }
      } catch (loadError) {
        if (!cancelled) {
          setError(getErrorMessage(loadError, "This share link is unavailable."));
        }
      }
    }

    void resolveShareLink();

    return () => {
      cancelled = true;
    };
  }, [params?.shareableLink, router]);

  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_top,rgba(59,130,246,0.18),transparent_28%),linear-gradient(180deg,#020617_0%,#0f172a_100%)] px-6 py-10 text-white">
      <div className="mx-auto max-w-3xl rounded-3xl border border-white/10 bg-white/5 p-8">
        {error ? (
          <>
            <p className="text-lg font-semibold">Service unavailable</p>
            <p className="mt-2 text-sm text-slate-300">{error}</p>
            <Link
              href="/"
              className="mt-5 inline-flex rounded-full border border-white/15 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-white/10"
            >
              Browse services
            </Link>
          </>
        ) : (
          <>
            <p className="text-lg font-semibold">Opening service</p>
            <p className="mt-2 text-sm text-slate-300">
              Resolving the shared booking link now.
            </p>
          </>
        )}
      </div>
    </div>
  );
}

