"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useAuth } from "@/hooks/useAuth";
import { apiFetch } from "@/lib/api";
import { formatDate, formatTime } from "@/lib/dates";
import { getErrorMessage } from "@/lib/errors";
import { cn } from "@/lib/utils";
import { motion, AnimatePresence } from "framer-motion";
import { 
  Calendar, 
  Clock, 
  User, 
  ChevronRight, 
  XCircle, 
  Search,
  LayoutGrid,
  Filter
} from "lucide-react";
import type { Appointment } from "@/types/booking";
import type { Resource } from "@/types/resource";
import type { Service } from "@/types/service";

const statusColors: Record<string, string> = {
  CONFIRMED: "text-emerald-400 bg-emerald-400/10 border-emerald-400/20",
  PENDING: "text-amber-400 bg-amber-400/10 border-amber-400/20",
  CANCELLED: "text-rose-400 bg-rose-400/10 border-rose-400/20",
  COMPLETED: "text-indigo-400 bg-indigo-400/10 border-indigo-400/20",
};

export default function AppointmentsPage() {
  const { isOrganizer } = useAuth();
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [servicesById, setServicesById] = useState<Record<number, Service>>({});
  const [resourcesById, setResourcesById] = useState<Record<number, Resource>>({});
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [cancellingId, setCancellingId] = useState<number | null>(null);

  const loadAppointments = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    try {
      const appointmentData = await apiFetch<Appointment[]>("/api/appointments");
      const serviceIds = Array.from(new Set(appointmentData.map((item) => item.service_id)));

      const [serviceRecords, resourceRecords] = await Promise.all([
        Promise.all(
          serviceIds.map(async (serviceId) => {
            try {
              return await apiFetch<Service>(`/api/services/${serviceId}`);
            } catch {
              return null;
            }
          }),
        ),
        isOrganizer ? apiFetch<Resource[]>("/api/resources") : Promise.resolve([]),
      ]);

      const serviceMap = serviceRecords.reduce<Record<number, Service>>((acc, s) => {
        if (s) acc[s.id] = s;
        return acc;
      }, {});

      const resourceMap = resourceRecords.reduce<Record<number, Resource>>((acc, r) => {
        acc[r.id] = r;
        return acc;
      }, {});

      setAppointments(appointmentData);
      setServicesById(serviceMap);
      setResourcesById(resourceMap);
    } catch (err) {
      setError(getErrorMessage(err, "Unable to load appointments."));
    } finally {
      setIsLoading(false);
    }
  }, [isOrganizer]);

  useEffect(() => {
    loadAppointments();
  }, [loadAppointments]);

  const sortedAppointments = useMemo(
    () => [...appointments].sort((a, b) => new Date(a.start_time).getTime() - new Date(b.start_time).getTime()),
    [appointments]
  );

  async function handleCancel(appointmentId: number) {
    if (!confirm("Are you sure you want to cancel this appointment?")) return;
    setCancellingId(appointmentId);
    try {
      await apiFetch(`/api/appointments/${appointmentId}`, { method: "DELETE" });
      await loadAppointments();
    } catch (err) {
      setError(getErrorMessage(err, "Unable to cancel appointment."));
    } finally {
      setCancellingId(null);
    }
  }

  return (
    <div className="space-y-10">
      {/* Page Header */}
      <motion.section 
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        className="glass-premium rounded-[40px] p-10"
      >
        <div className="flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
          <div className="space-y-2">
            <div className="flex items-center gap-2 text-primary font-bold uppercase tracking-widest text-[10px]">
              <LayoutGrid className="size-3" />
              Scheduling Suite
            </div>
            <h1 className="text-gradient text-4xl font-bold tracking-tight">
              {isOrganizer ? "Booking Stream" : "Your Appointments"}
            </h1>
            <p className="text-slate-400 max-w-xl">
              {isOrganizer 
                ? "Live view of all incoming customer requests and active service sessions."
                : "A centralized history of all your past and upcoming scheduled events."}
            </p>
          </div>
          
          <div className="flex items-center gap-3">
             <div className="glass flex items-center gap-3 rounded-2xl px-4 py-2 border-white/5">
                <Search className="size-4 text-slate-500" />
                <input className="bg-transparent outline-none text-sm text-white placeholder:text-slate-600 w-32 focus:w-48 transition-all" placeholder="Filter..." />
             </div>
             <button className="glass size-10 flex items-center justify-center rounded-2xl border-white/5 text-slate-400 hover:text-white transition-colors">
                <Filter className="size-4" />
             </button>
          </div>
        </div>
      </motion.section>

      {error && (
        <div className="rounded-3xl border border-rose-500/20 bg-rose-500/10 p-6 text-sm font-medium text-rose-200">
          {error}
        </div>
      )}

      {isLoading ? (
        <div className="flex h-64 items-center justify-center">
          <motion.div 
            animate={{ rotate: 360 }}
            transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
            className="size-10 rounded-full border-t-2 border-primary" 
          />
        </div>
      ) : sortedAppointments.length === 0 ? (
        <motion.div 
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="glass rounded-[40px] p-20 text-center"
        >
          <div className="mx-auto mb-6 flex size-20 items-center justify-center rounded-[32px] bg-white/5 text-slate-600">
            <Calendar className="size-10" />
          </div>
          <h2 className="text-2xl font-bold text-white">No entries found</h2>
          <p className="mt-2 text-slate-400">Start by browsing services to create your first booking.</p>
          <Link href="/" className="mt-8 inline-flex items-center gap-2 rounded-2xl bg-white px-8 py-3 text-sm font-bold text-slate-950 transition-all hover:scale-105">
            Browse Catalog
          </Link>
        </motion.div>
      ) : (
        <div className="grid gap-4">
          <AnimatePresence mode="popLayout">
            {sortedAppointments.map((apt, i) => (
              <motion.article
                layout
                key={apt.id}
                initial={{ opacity: 0, scale: 0.98 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.95 }}
                transition={{ delay: i * 0.05 }}
                className="group glass relative overflow-hidden rounded-[32px] p-6 transition-all hover:bg-white/[0.08] hover:shadow-2xl"
              >
                <div className="flex flex-col gap-6 lg:flex-row lg:items-center">
                  {/* Status & Service Icon */}
                  <div className="flex items-center gap-6">
                    <div className="flex size-16 shrink-0 items-center justify-center rounded-3xl bg-white/5 text-white">
                      <Calendar className="size-7" />
                    </div>
                    <div>
                      <div className="flex items-center gap-3 mb-1">
                        <h3 className="text-xl font-bold text-white group-hover:text-primary transition-colors">
                          {servicesById[apt.service_id]?.name || "Unknown Service"}
                        </h3>
                        <span className={cn("rounded-full border px-3 py-0.5 text-[10px] font-bold tracking-widest uppercase", statusColors[apt.status] || "text-slate-400 bg-white/5 border-white/10")}>
                          {apt.status}
                        </span>
                      </div>
                      <div className="flex flex-wrap items-center gap-4 text-sm text-slate-500">
                        <div className="flex items-center gap-2">
                          <Calendar className="size-3.5" />
                          {formatDate(apt.start_time)}
                        </div>
                        <div className="flex items-center gap-2">
                          <Clock className="size-3.5" />
                          {formatTime(apt.start_time)} - {formatTime(apt.end_time)}
                        </div>
                        <div className="flex items-center gap-2">
                          <User className="size-3.5" />
                          {resourcesById[apt.resource_id]?.name || "Auto-assign"}
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="ml-auto flex items-center gap-3">
                    {!isOrganizer && apt.status !== "CANCELLED" && (
                      <button
                        onClick={() => handleCancel(apt.id)}
                        disabled={cancellingId === apt.id}
                        className="glass flex size-12 items-center justify-center rounded-2xl border-white/5 text-rose-500 transition-all hover:bg-rose-500 hover:text-white"
                      >
                        <XCircle className="size-5" />
                      </button>
                    )}
                    <Link
                      href={`/appointments/${apt.id}`}
                      className="glass group/btn flex h-12 items-center gap-2 rounded-2xl border-white/5 bg-white/5 px-6 text-sm font-bold text-white transition-all hover:bg-primary hover:text-white"
                    >
                      Manage
                      <ChevronRight className="size-4 transition-transform group-hover/btn:translate-x-1" />
                    </Link>
                  </div>
                </div>
              </motion.article>
            ))}
          </AnimatePresence>
        </div>
      )}
    </div>
  );
}
