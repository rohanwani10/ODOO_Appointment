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
} from "lucide-react";

import { AvailabilityCalendar } from "@/components/calendar";
import { ShareLinkDialog } from "@/components/calendar/components/share-link-dialog";
import { Button } from "@/components/ui/button";
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
    {
      id: "availability-1",
      start: at(addDays(referenceWeek, 0), 9, 0),
      end: at(addDays(referenceWeek, 0), 12, 0),
    },
    {
      id: "availability-2",
      start: at(addDays(referenceWeek, 0), 13, 0),
      end: at(addDays(referenceWeek, 0), 17, 0),
    },
    {
      id: "availability-3",
      start: at(addDays(referenceWeek, 1), 8, 30),
      end: at(addDays(referenceWeek, 1), 11, 30),
    },
    {
      id: "availability-4",
      start: at(addDays(referenceWeek, 2), 10, 0),
      end: at(addDays(referenceWeek, 2), 15, 0),
    },
    {
      id: "availability-5",
      start: at(addDays(referenceWeek, 4), 9, 0),
      end: at(addDays(referenceWeek, 4), 16, 0),
    },
  ];

  const busyBlocks: BusyBlock[] = [
    {
      id: "busy-1",
      start: at(addDays(referenceWeek, 1), 12, 0),
      end: at(addDays(referenceWeek, 1), 13, 30),
      title: "External team meeting",
      accountEmail: "work@google.com",
    },
    {
      id: "busy-2",
      start: at(addDays(referenceWeek, 3), 14, 0),
      end: at(addDays(referenceWeek, 3), 15, 0),
      title: "Blocked focus time",
      accountEmail: "calendar@google.com",
    },
  ];

  const bookedBlocks: BookedBlock[] = [
    {
      id: "booked-1",
      start: at(addDays(referenceWeek, 1), 9, 30),
      end: at(addDays(referenceWeek, 1), 10, 0),
      guestName: "Ava Thompson",
      guestEmail: "ava.thompson@example.com",
      googleEventId: "event-ava-1",
      meetLink: "https://meet.google.com/demo-ava-thompson",
      attendeeStatus: "accepted" as BookedBlock["attendeeStatus"],
    },
    {
      id: "booked-2",
      start: at(addDays(referenceWeek, 4), 13, 0),
      end: at(addDays(referenceWeek, 4), 13, 30),
      guestName: "Marcus Lee",
      guestEmail: "marcus.lee@example.com",
      googleEventId: "event-marcus-2",
      meetLink: "https://meet.google.com/demo-marcus-lee",
      attendeeStatus: "tentative" as BookedBlock["attendeeStatus"],
    },
  ];

  return {
    initialBlocks,
    busyBlocks,
    bookedBlocks,
    refreshedAt: format(new Date(), "h:mm a"),
  };
}

function StatCard({
  icon: Icon,
  label,
  value,
  detail,
}: {
  icon: ElementType;
  label: string;
  value: string;
  detail: string;
}) {
  return (
    <div className="rounded-[1.5rem] border border-white/10 bg-white/[0.04] p-4 shadow-[0_10px_30px_rgba(2,6,23,0.15)]">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-xs uppercase tracking-[0.24em] text-white/45">
            {label}
          </p>
          <p className="mt-3 text-3xl font-semibold tracking-tight text-white">
            {value}
          </p>
          <p className="mt-2 text-sm leading-6 text-white/60">{detail}</p>
        </div>
        <div className="flex size-11 items-center justify-center rounded-2xl bg-white/10 text-white">
          <Icon className="size-5" />
        </div>
      </div>
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
    <div className="space-y-6">
      <section className="rounded-[2rem] border border-white/10 bg-[linear-gradient(135deg,rgba(15,23,42,0.98),rgba(17,24,39,0.92)),radial-gradient(circle_at_top_right,rgba(59,130,246,0.18),transparent_28%),radial-gradient(circle_at_bottom_left,rgba(14,165,233,0.12),transparent_24%)] p-6 shadow-[0_30px_100px_rgba(2,6,23,0.34)] sm:p-8">
        <div className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
          <div className="max-w-3xl">
            <div className="inline-flex items-center gap-2 rounded-full border border-sky-300/20 bg-sky-400/10 px-3 py-1 text-xs font-semibold uppercase tracking-[0.24em] text-sky-100">
              <CalendarClock className="size-3.5" />
              Availability
            </div>
            <h1 className="mt-4 text-4xl font-semibold tracking-tight text-white sm:text-5xl">
              Set Your Availability
            </h1>
            <p className="mt-4 max-w-2xl text-base leading-8 text-slate-300 sm:text-lg">
              Drag to create availability blocks, resize them to tighten your
              windows, and keep external busy time and booked meetings in clear
              view while you work.
            </p>
            <p className="mt-3 text-sm text-slate-400">
              Last refreshed at {refreshedAt}.
            </p>

            <div className="mt-5 flex flex-wrap gap-2">
              {[
                {
                  label: "Availability",
                  tone: "bg-sky-400/15 text-sky-100 border-sky-300/20",
                },
                {
                  label: "Busy",
                  tone: "bg-amber-400/15 text-amber-100 border-amber-300/20",
                },
                {
                  label: "Booked",
                  tone: "bg-blue-400/15 text-blue-100 border-blue-300/20",
                },
                {
                  label: "Unsaved changes",
                  tone: "bg-white/10 text-white border-white/10",
                },
              ].map((item) => (
                <span
                  key={item.label}
                  className={`inline-flex items-center gap-2 rounded-full border px-3 py-1 text-xs font-medium ${item.tone}`}
                >
                  <CircleDot className="size-3" />
                  {item.label}
                </span>
              ))}
            </div>
          </div>

          <div className="flex flex-wrap gap-3">
            <Button
              variant="outline"
              onClick={handleRefresh}
              className="border-white/15 bg-white/5 text-white hover:bg-white/10"
            >
              <RefreshCw className="size-4" />
              Refresh
            </Button>
            <ShareLinkDialog />
          </div>
        </div>

        <div className="mt-6 grid gap-4 md:grid-cols-3">
          <StatCard
            icon={CalendarRange}
            label="Availability blocks"
            value={String(initialBlocks.length)}
            detail="Edit open hours directly on the calendar and save them when you are ready."
          />
          <StatCard
            icon={Users}
            label="External busy blocks"
            value={String(busyBlocks.length)}
            detail="Imported busy time is read-only so you can keep the host calendar in sync."
          />
          <StatCard
            icon={BadgeCheck}
            label="Booked meetings"
            value={String(bookedBlocks.length)}
            detail="Click a booking to inspect the guest, timing, status, and Google Meet link."
          />
        </div>
      </section>

      <section className="rounded-[2rem] border border-white/10 bg-slate-950/80 p-4 shadow-[0_24px_80px_rgba(2,6,23,0.35)] sm:p-5">
        <div className="mb-4 flex flex-col gap-4 border-b border-white/10 pb-4 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <p className="text-sm font-semibold uppercase tracking-[0.24em] text-white/45">
              Calendar editor
            </p>
            <p className="mt-2 max-w-3xl text-sm leading-7 text-white/65 sm:text-base">
              Use Month, Week, and Day views to review the schedule, create
              blocks by dragging in empty space, and use Copy Day or Clear Week
              from the toolbar for bulk changes.
            </p>
          </div>
          <div className="flex flex-wrap gap-2 text-xs font-medium text-white/70">
            <span className="rounded-full border border-sky-300/20 bg-sky-400/10 px-3 py-1 text-sky-100">
              Availability blocks
            </span>
            <span className="rounded-full border border-amber-300/20 bg-amber-400/10 px-3 py-1 text-amber-100">
              External busy blocks
            </span>
            <span className="rounded-full border border-blue-300/20 bg-blue-400/10 px-3 py-1 text-blue-100">
              Booked meetings
            </span>
          </div>
        </div>

        <div className="overflow-hidden rounded-[1.5rem] border border-white/10 bg-[linear-gradient(180deg,rgba(255,255,255,0.04),rgba(255,255,255,0.02))] p-3">
          <AvailabilityCalendar
            initialBlocks={initialBlocks}
            busyBlocks={busyBlocks}
            bookedBlocks={bookedBlocks}
          />
        </div>
      </section>
    </div>
  );
}
