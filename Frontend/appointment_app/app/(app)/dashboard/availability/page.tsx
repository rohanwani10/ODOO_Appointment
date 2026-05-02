"use client";

import { useMemo, useState, type ElementType } from "react";
import { addDays, format, set, startOfWeek } from "date-fns";
import {
  CalendarClock,
  RefreshCw,
  BadgeCheck,
  CalendarRange,
  Users,
  CircleDot,
  Settings2,
  Sparkles
} from "lucide-react";
import { motion } from "framer-motion";
import { AvailabilityCalendar } from "@/components/calendar";
import { ShareLinkDialog } from "@/components/calendar/components/share-link-dialog";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type {
  BookedBlock,
  BusyBlock,
  TimeBlock,
} from "@/components/calendar/types";

function at(referenceDate: Date, hours: number, minutes: number) {
  return set(referenceDate, {
    hours,
    minutes,
    seconds: 0,
    milliseconds: 0,
  });
}

function createDemoBlocks(snapshotSeed: number) {
  const weekStart = startOfWeek(new Date(), { weekStartsOn: 1 });
  const offset = snapshotSeed % 2;
  const referenceWeek = addDays(weekStart, offset);

  const initialBlocks: TimeBlock[] = [
    { id: "availability-1", start: at(addDays(referenceWeek, 0), 9, 0), end: at(addDays(referenceWeek, 0), 12, 0) },
    { id: "availability-2", start: at(addDays(referenceWeek, 0), 13, 0), end: at(addDays(referenceWeek, 0), 17, 0) },
    { id: "availability-3", start: at(addDays(referenceWeek, 1), 8, 30), end: at(addDays(referenceWeek, 1), 11, 30) },
    { id: "availability-4", start: at(addDays(referenceWeek, 2), 10, 0), end: at(addDays(referenceWeek, 2), 15, 0) },
    { id: "availability-5", start: at(addDays(referenceWeek, 4), 9, 0), end: at(addDays(referenceWeek, 4), 16, 0) },
  ];

  const busyBlocks: BusyBlock[] = [
    { id: "busy-1", start: at(addDays(referenceWeek, 1), 12, 0), end: at(addDays(referenceWeek, 1), 13, 30), title: "External team meeting", accountEmail: "work@google.com" },
    { id: "busy-2", start: at(addDays(referenceWeek, 3), 14, 0), end: at(addDays(referenceWeek, 3), 15, 0), title: "Blocked focus time", accountEmail: "calendar@google.com" },
  ];

  const bookedBlocks: BookedBlock[] = [
    { id: "booked-1", start: at(addDays(referenceWeek, 1), 9, 30), end: at(addDays(referenceWeek, 1), 10, 0), guestName: "Ava Thompson", guestEmail: "ava.thompson@example.com", googleEventId: "event-ava-1", meetLink: "https://meet.google.com/demo-ava-thompson", attendeeStatus: "accepted" },
    { id: "booked-2", start: at(addDays(referenceWeek, 4), 13, 0), end: at(addDays(referenceWeek, 4), 13, 30), guestName: "Marcus Lee", guestEmail: "marcus.lee@example.com", googleEventId: "event-marcus-2", meetLink: "https://meet.google.com/demo-marcus-lee", attendeeStatus: "tentative" },
  ];

  return { initialBlocks, busyBlocks, bookedBlocks, refreshedAt: format(new Date(), "h:mm a") };
}

function StatCard({ icon: Icon, label, value, color }: { icon: ElementType; label: string; value: string; color: string }) {
  return (
    <div className="glass group relative overflow-hidden rounded-[32px] p-6 transition-all hover:bg-white/[0.08]">
      <div className="flex items-center justify-between mb-4">
        <p className="text-[10px] font-bold uppercase tracking-widest text-slate-500">{label}</p>
        <div className={cn("flex size-8 items-center justify-center rounded-xl bg-white/5", color)}>
          <Icon className="size-4" />
        </div>
      </div>
      <p className="text-3xl font-bold text-white">{value}</p>
    </div>
  );
}

export default function AvailabilityDashboardPage() {
  const [snapshotSeed, setSnapshotSeed] = useState(0);

  const { initialBlocks, busyBlocks, bookedBlocks, refreshedAt } = useMemo(
    () => createDemoBlocks(snapshotSeed),
    [snapshotSeed],
  );

  const handleRefresh = () => {
    setSnapshotSeed((value) => value + 1);
  };

  return (
    <motion.div 
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="space-y-10 pb-20"
    >
      {/* Header Section */}
      <section className="glass-premium relative overflow-hidden rounded-[40px] p-10 lg:p-12">
        <div className="absolute -right-20 -top-20 size-80 rounded-full bg-primary/20 blur-[100px]" />
        
        <div className="relative z-10 flex flex-col gap-10 lg:flex-row lg:items-end lg:justify-between">
          <div className="space-y-6">
            <div className="flex items-center gap-2 text-primary font-bold uppercase tracking-widest text-[10px]">
              <Sparkles className="size-3.5" />
              Availability Engine
            </div>
            <h1 className="text-gradient text-5xl font-bold tracking-tight lg:text-6xl">
              Manage Windows
            </h1>
            <p className="max-w-2xl text-lg leading-relaxed text-slate-400">
              Drag to create availability blocks, sync external calendars, and maintain full control over your scheduling windows.
            </p>
            <div className="flex flex-wrap gap-2">
               {["Availability", "Busy Time", "Bookings"].map((tag) => (
                 <span key={tag} className="glass flex items-center gap-2 rounded-full px-4 py-1.5 text-[10px] font-bold uppercase tracking-widest text-slate-400">
                    <CircleDot className="size-3 text-primary" />
                    {tag}
                 </span>
               ))}
            </div>
          </div>

          <div className="flex flex-wrap gap-3">
             <Button variant="outline" onClick={handleRefresh} className="glass h-12 rounded-2xl border-white/5 bg-white/5 px-6 text-white hover:bg-white/10 transition-all">
                <RefreshCw className="mr-2 size-4" />
                Sync Calendar
             </Button>
             <ShareLinkDialog />
          </div>
        </div>

        <div className="mt-12 grid gap-6 md:grid-cols-3">
          <StatCard icon={CalendarRange} label="Open Blocks" value={String(initialBlocks.length)} color="text-primary" />
          <StatCard icon={Users} label="External Busy" value={String(busyBlocks.length)} color="text-amber-400" />
          <StatCard icon={BadgeCheck} label="Confirmed Bookings" value={String(bookedBlocks.length)} color="text-emerald-400" />
        </div>
      </section>

      {/* Calendar Section */}
      <section className="glass rounded-[40px] p-6 lg:p-10">
        <div className="mb-10 flex flex-col gap-6 border-b border-white/5 pb-8 lg:flex-row lg:items-center lg:justify-between">
          <div className="space-y-1">
            <h2 className="text-2xl font-bold text-white">Visual Editor</h2>
            <p className="text-sm text-slate-500">Live synchronization with Google Calendar active.</p>
          </div>
          <div className="flex items-center gap-2">
             <button className="glass flex items-center gap-2 rounded-2xl px-4 py-2 text-xs font-bold text-slate-400 hover:text-white transition-colors">
                <Settings2 className="size-4" />
                Configure Rules
             </button>
          </div>
        </div>

        <div className="glass-premium overflow-hidden rounded-[32px] p-2">
          <AvailabilityCalendar
            initialBlocks={initialBlocks}
            busyBlocks={busyBlocks}
            bookedBlocks={bookedBlocks}
          />
        </div>
      </section>
    </motion.div>
  );
}
