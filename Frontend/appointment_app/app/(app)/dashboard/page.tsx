"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  ArrowRight,
  BadgeCheck,
  Building2,
  CalendarClock,
  ClipboardList,
  Shield,
  Sparkles,
  Users,
  Wrench,
  TrendingUp,
  Activity,
  Zap,
  Plus
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { useAuth } from "@/hooks/useAuth";
import { apiFetch } from "@/lib/api";
import { formatDate, formatDateTime, formatTime } from "@/lib/dates";
import { getErrorMessage } from "@/lib/errors";
import { cn } from "@/lib/utils";
import type { Appointment } from "@/types/booking";
import type { Resource } from "@/types/resource";
import type { Service } from "@/types/service";
import type { AdminUsersResponse } from "@/types/user";

const statusClasses: Record<string, string> = {
  CONFIRMED: "border-emerald-500/20 bg-emerald-500/10 text-emerald-400",
  PENDING: "border-amber-500/20 bg-amber-500/10 text-amber-400",
  RESCHEDULED: "border-sky-500/20 bg-sky-500/10 text-sky-400",
  COMPLETED: "border-indigo-500/20 bg-indigo-500/10 text-indigo-400",
  CANCELLED: "border-rose-500/20 bg-rose-500/10 text-rose-400",
};

const containerVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: {
      staggerChildren: 0.1
    }
  }
};

const itemVariants = {
  hidden: { y: 20, opacity: 0 },
  visible: {
    y: 0,
    opacity: 1,
    transition: {
      type: "spring",
      stiffness: 100
    }
  }
};

export default function DashboardPage() {
  const { user, isAdmin, isOrganizer, logout } = useAuth();
  const router = useRouter();
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [serviceNamesById, setServiceNamesById] = useState<Record<number, string>>({});
  const [organizerServices, setOrganizerServices] = useState<Service[]>([]);
  const [publicServices, setPublicServices] = useState<Service[]>([]);
  const [resources, setResources] = useState<Resource[]>([]);
  const [adminUserCount, setAdminUserCount] = useState<number | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadDashboard = async (refresh = false) => {
    if (refresh) setIsRefreshing(true);
    else setIsLoading(true);
    setError(null);

    try {
      const [
        appointmentData,
        organizerServiceData,
        publicServiceData,
        resourceData,
        adminUsersData,
      ] = await Promise.all([
        apiFetch<Appointment[]>("/api/appointments"),
        isOrganizer ? apiFetch<Service[]>("/api/organizer/services") : Promise.resolve([]),
        apiFetch<Service[]>("/api/services"),
        isOrganizer ? apiFetch<Resource[]>("/api/resources") : Promise.resolve([]),
        isAdmin ? apiFetch<AdminUsersResponse>("/api/admin/users", { params: { skip: "0", limit: "1" } }) : Promise.resolve(null),
      ]);

      const serviceMap = [...organizerServiceData, ...publicServiceData].reduce<Record<number, string>>(
        (acc, s) => ({ ...acc, [s.id]: s.name }),
        {}
      );

      setAppointments(appointmentData);
      setOrganizerServices(organizerServiceData);
      setPublicServices(publicServiceData);
      setResources(resourceData);
      setAdminUserCount(adminUsersData?.total ?? null);
      setServiceNamesById(serviceMap);
    } catch (err) {
      setError(getErrorMessage(err, "Unable to load dashboard data."));
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  };

  useEffect(() => {
    loadDashboard();
  }, [isAdmin, isOrganizer]);

  const sortedAppointments = [...appointments].sort(
    (a, b) => new Date(a.start_time).getTime() - new Date(b.start_time).getTime()
  );
  const upcomingAppointments = sortedAppointments.filter(
    (a) => a.status !== "CANCELLED" && new Date(a.start_time).getTime() >= Date.now()
  );
  const nextAppointment = upcomingAppointments[0] ?? null;
  const recentAppointments = [...sortedAppointments].reverse().slice(0, 4);

  return (
    <motion.div 
      variants={containerVariants}
      initial="hidden"
      animate="visible"
      className="space-y-10 pb-20"
    >
      {/* Hero Section */}
      <motion.section 
        variants={itemVariants}
        className="glass-premium relative overflow-hidden rounded-[40px] p-10 lg:p-12"
      >
        <div className="absolute -right-20 -top-20 size-80 rounded-full bg-primary/20 blur-[100px]" />
        <div className="absolute -left-20 -bottom-20 size-80 rounded-full bg-indigo-500/10 blur-[100px]" />
        
        <div className="relative z-10 grid gap-12 lg:grid-cols-[1fr_0.4fr]">
          <div className="space-y-6">
            <div className="flex items-center gap-3">
              <span className="glass rounded-full px-4 py-1.5 text-[10px] font-bold uppercase tracking-[0.2em] text-primary">
                Live Overview
              </span>
              <span className="h-1 w-1 rounded-full bg-white/20" />
              <span className="text-xs font-medium text-slate-400">
                {user?.roles?.join(" / ")}
              </span>
            </div>

            <h1 className="text-gradient text-5xl font-bold tracking-tight lg:text-6xl">
              {isOrganizer ? "Ops Center" : "Welcome back"}, <br />
              <span className="text-white">{user?.first_name}</span>.
            </h1>
            
            <p className="max-w-xl text-lg leading-relaxed text-slate-400">
              {isOrganizer 
                ? "Your centralized hub for managing services, schedules, and resource performance." 
                : "A streamlined overview of your upcoming sessions and essential booking tools."}
            </p>

            <div className="flex flex-wrap gap-4 pt-4">
              <Link href="/appointments" className="flex items-center gap-2 rounded-2xl bg-white px-8 py-4 text-sm font-bold text-slate-950 transition-all hover:scale-105 hover:bg-slate-100">
                Manage Bookings
                <ArrowRight className="size-4" />
              </Link>
              <button 
                onClick={() => loadDashboard(true)}
                className="glass rounded-2xl px-8 py-4 text-sm font-bold text-white transition-all hover:bg-white/10"
              >
                {isRefreshing ? "Syncing..." : "Refresh Pulse"}
              </button>
            </div>
          </div>

          <div className="flex flex-col justify-center gap-6">
             <div className="glass group rounded-[32px] p-6 transition-all hover:bg-white/[0.08]">
                <div className="flex items-center justify-between mb-4">
                  <p className="text-[10px] font-bold uppercase tracking-widest text-slate-500">Next Event</p>
                  <CalendarClock className="size-5 text-primary" />
                </div>
                <p className="text-2xl font-bold text-white">
                  {nextAppointment ? formatDate(nextAppointment.start_time) : "Clear Sky"}
                </p>
                {nextAppointment && (
                  <p className="mt-2 text-xs font-medium text-slate-400">
                    {serviceNamesById[nextAppointment.service_id]} @ {formatTime(nextAppointment.start_time)}
                  </p>
                )}
             </div>

             <div className="glass group rounded-[32px] p-6 transition-all hover:bg-white/[0.08]">
                <div className="flex items-center justify-between mb-4">
                  <p className="text-[10px] font-bold uppercase tracking-widest text-slate-500">System Trust</p>
                  <BadgeCheck className={cn("size-5", user?.is_verified ? "text-emerald-400" : "text-amber-400")} />
                </div>
                <p className="text-2xl font-bold text-white">
                  {user?.is_verified ? "Verified" : "Pending"}
                </p>
                <p className="mt-2 text-xs font-medium text-slate-400">{user?.email}</p>
             </div>
          </div>
        </div>
      </motion.section>

      {/* Main Stats Grid */}
      <motion.section 
        variants={itemVariants}
        className="grid gap-6 md:grid-cols-2 lg:grid-cols-4"
      >
        {[
          { label: "Active Bookings", value: upcomingAppointments.length, icon: Activity, color: "text-primary" },
          { label: "Total Completed", value: appointments.filter(a => a.status === "COMPLETED").length, icon: Zap, color: "text-amber-400" },
          { label: "Services", value: isOrganizer ? organizerServices.length : publicServices.length, icon: Sparkles, color: "text-indigo-400" },
          { label: "Load Velocity", value: "98%", icon: TrendingUp, color: "text-emerald-400" },
        ].map((stat, i) => (
          <div key={i} className="glass group relative overflow-hidden rounded-[32px] p-8 transition-all hover:bg-white/[0.07]">
            <div className={cn("mb-6 flex size-12 items-center justify-center rounded-2xl bg-white/5 transition-transform group-hover:scale-110", stat.color)}>
              <stat.icon className="size-6" />
            </div>
            <p className="text-[10px] font-bold uppercase tracking-widest text-slate-500">{stat.label}</p>
            <p className="mt-2 text-4xl font-bold text-white">{stat.value}</p>
          </div>
        ))}
      </motion.section>

      <div className="grid gap-8 lg:grid-cols-[1fr_0.45fr]">
        {/* Timeline / Activity */}
        <motion.section 
          variants={itemVariants}
          className="glass rounded-[40px] p-10"
        >
          <div className="flex items-center justify-between mb-10">
            <h2 className="text-2xl font-bold text-white">Activity Stream</h2>
            <Link href="/appointments" className="text-xs font-bold uppercase tracking-widest text-primary hover:underline">View All</Link>
          </div>

          <div className="space-y-6">
            {isLoading ? (
              <div className="flex h-40 items-center justify-center text-slate-500">Syncing with server...</div>
            ) : recentAppointments.length === 0 ? (
              <div className="flex h-40 flex-col items-center justify-center rounded-3xl border border-dashed border-white/10 bg-white/5 text-slate-500">
                <CalendarClock className="size-10 mb-4 opacity-20" />
                <p>No recent activity detected.</p>
              </div>
            ) : (
              recentAppointments.map((apt, i) => (
                <motion.div 
                  key={apt.id}
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: i * 0.1 }}
                  className="group relative flex items-center gap-6 rounded-[28px] border border-white/5 bg-white/[0.02] p-6 transition-all hover:bg-white/[0.05]"
                >
                  <div className="hidden size-14 shrink-0 items-center justify-center rounded-2xl bg-white/5 text-slate-400 lg:flex">
                    {formatTime(apt.start_time).split(':')[0]}
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center gap-3">
                      <h3 className="font-bold text-white">{serviceNamesById[apt.service_id]}</h3>
                      <span className={cn("rounded-full border px-3 py-0.5 text-[10px] font-bold tracking-tighter", statusClasses[apt.status])}>
                        {apt.status}
                      </span>
                    </div>
                    <p className="mt-1 text-sm text-slate-500">
                      {formatDate(apt.start_time)} at {formatTime(apt.start_time)}
                    </p>
                  </div>
                  <Link href={`/appointments/${apt.id}`} className="flex size-10 items-center justify-center rounded-full bg-white/5 text-white transition-all hover:bg-primary hover:text-white">
                    <ArrowRight className="size-4" />
                  </Link>
                </motion.div>
              ))
            )}
          </div>
        </motion.section>

        {/* Action Center */}
        <motion.section 
          variants={itemVariants}
          className="space-y-6"
        >
          <div className="glass-premium rounded-[40px] p-8">
            <h2 className="mb-6 text-xl font-bold text-white">Quick Actions</h2>
            <div className="grid gap-3">
              {[
                { label: "Book New", href: "/", icon: Plus },
                { label: "Update Profile", href: "/settings", icon: Shield },
                { label: "Check Analytics", href: "/dashboard", icon: TrendingUp },
              ].map((action, i) => (
                <Link key={i} href={action.href} className="group flex items-center justify-between rounded-2xl border border-white/5 bg-white/5 p-4 transition-all hover:bg-white/10">
                  <div className="flex items-center gap-3">
                    <div className="flex size-10 items-center justify-center rounded-xl bg-white/5 text-slate-300 transition-colors group-hover:bg-primary group-hover:text-white">
                      <action.icon className="size-4" />
                    </div>
                    <span className="text-sm font-bold text-slate-200">{action.label}</span>
                  </div>
                  <ArrowRight className="size-4 text-slate-600 transition-transform group-hover:translate-x-1" />
                </Link>
              ))}
            </div>
          </div>

          <div className="glass rounded-[40px] p-8">
            <div className="flex items-center gap-3 mb-6">
              <div className="flex size-10 items-center justify-center rounded-xl bg-indigo-500/20 text-indigo-400">
                <Wrench className="size-5" />
              </div>
              <h2 className="text-xl font-bold text-white">Workspace</h2>
            </div>
            <div className="space-y-4">
              <div className="flex items-center justify-between p-2">
                <span className="text-sm text-slate-400 font-medium">Monthly Target</span>
                <span className="text-sm font-bold text-white">84%</span>
              </div>
              <div className="h-2 w-full rounded-full bg-white/5 overflow-hidden">
                <motion.div 
                  initial={{ width: 0 }}
                  animate={{ width: "84%" }}
                  transition={{ duration: 1.5, ease: "easeOut" }}
                  className="h-full bg-primary" 
                />
              </div>
              <p className="text-[10px] text-center text-slate-500 font-bold uppercase tracking-widest pt-2">
                Performance Optimized
              </p>
            </div>
          </div>
        </motion.section>
      </div>
    </motion.div>
  );
}
