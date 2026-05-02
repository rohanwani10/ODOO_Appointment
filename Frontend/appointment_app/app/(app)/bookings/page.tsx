"use client";

import { useMemo, useState, useCallback, useTransition } from "react";
import { addDays, format, set } from "date-fns";
import {
  Calendar,
  RefreshCw,
  CheckCircle2,
  AlertCircle,
  Clock,
  CircleDot,
  Loader2,
} from "lucide-react";

import { BookingsList } from "@/components/bookings/bookings-list";
import { Button } from "@/components/ui/button";
import type { AttendeeStatus } from "@/components/calendar/types";

interface HostBooking {
  _id: string;
  guestName: string;
  guestEmail: string;
  startTime: string;
  endTime: string;
  notes?: string;
  meetLink?: string;
  googleEventId?: string;
  guestStatus?: AttendeeStatus;
}

function at(referenceDate: Date, hours: number, minutes: number) {
  return set(referenceDate, {
    hours,
    minutes,
    seconds: 0,
    milliseconds: 0,
  });
}

function createDemoBookings(snapshotSeed: number): HostBooking[] {
  const today = new Date();
  const offset = snapshotSeed % 3;

  const statuses: AttendeeStatus[] = [
    "accepted",
    "tentative",
    "accepted",
    "tentative",
    "accepted",
  ];
  const guestNames = [
    "Sarah Johnson",
    "Michael Chen",
    "Emily Rodriguez",
    "James Wilson",
    "Lisa Anderson",
  ];
  const guestEmails = [
    "sarah.johnson@example.com",
    "michael.chen@example.com",
    "emily.rodriguez@example.com",
    "james.wilson@example.com",
    "lisa.anderson@example.com",
  ];

  const bookings: HostBooking[] = [
    {
      _id: "booking-1",
      guestName: guestNames[0],
      guestEmail: guestEmails[0],
      startTime: at(addDays(today, 1), 10, 0).toISOString(),
      endTime: at(addDays(today, 1), 10, 30).toISOString(),
      notes: "Initial consultation to discuss project scope",
      meetLink: "https://meet.google.com/abc-def-ghi",
      googleEventId: "evt-1",
      guestStatus: statuses[0],
    },
    {
      _id: "booking-2",
      guestName: guestNames[1],
      guestEmail: guestEmails[1],
      startTime: at(addDays(today, 1), 14, 0).toISOString(),
      endTime: at(addDays(today, 1), 14, 45).toISOString(),
      notes: "Follow-up discussion",
      meetLink: "https://meet.google.com/jkl-mno-pqr",
      googleEventId: "evt-2",
      guestStatus: statuses[1],
    },
    {
      _id: "booking-3",
      guestName: guestNames[2],
      guestEmail: guestEmails[2],
      startTime: at(addDays(today, 2), 9, 30).toISOString(),
      endTime: at(addDays(today, 2), 10, 15).toISOString(),
      notes: "Product demo and Q&A",
      meetLink: "https://meet.google.com/stu-vwx-yz",
      googleEventId: "evt-3",
      guestStatus: statuses[2],
    },
    {
      _id: "booking-4",
      guestName: guestNames[3],
      guestEmail: guestEmails[3],
      startTime: at(addDays(today, 3), 13, 0).toISOString(),
      endTime: at(addDays(today, 3), 13, 45).toISOString(),
      notes: undefined,
      meetLink: "https://meet.google.com/abc-123-def",
      googleEventId: "evt-4",
      guestStatus: statuses[3],
    },
    {
      _id: "booking-5",
      guestName: guestNames[4],
      guestEmail: guestEmails[4],
      startTime: at(addDays(today, 5), 11, 0).toISOString(),
      endTime: at(addDays(today, 5), 12, 0).toISOString(),
      notes: "Deep dive technical discussion",
      meetLink: "https://meet.google.com/ghi-456-jkl",
      googleEventId: "evt-5",
      guestStatus: statuses[4],
    },
  ];

  // Rotate based on seed for demo purposes
  if (offset === 1) {
    return bookings.slice(0, 2);
  } else if (offset === 2) {
    return bookings.slice(0, 3);
  }

  return bookings;
}

function StatBadge({
  icon: Icon,
  label,
  count,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  count: number;
}) {
  return (
    <div className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-1">
      <Icon className="h-3.5 w-3.5 text-white/60" />
      <span className="text-xs font-medium text-white/80">
        {count} {label}
      </span>
    </div>
  );
}

export default function BookingsPage() {
  const [snapshotSeed, setSnapshotSeed] = useState(0);
  const [isRefreshing, startRefresh] = useTransition();
  const [isLoadingBookings, setIsLoadingBookings] = useState(false);

  const bookings = useMemo(
    () => createDemoBookings(snapshotSeed),
    [snapshotSeed],
  );

  const handleRefresh = useCallback(() => {
    startRefresh(() => {
      // Simulate API call delay
      return new Promise((resolve) => {
        setTimeout(() => {
          setSnapshotSeed((prev) => prev + 1);
          resolve(undefined);
        }, 600);
      });
    });
  }, []);

  const acceptedCount = bookings.filter(
    (b) => b.guestStatus === "accepted",
  ).length;
  const tentativeCount = bookings.filter(
    (b) => b.guestStatus === "tentative",
  ).length;
  const pendingCount = bookings.filter(
    (b) => !b.guestStatus || b.guestStatus === "needsAction",
  ).length;

  return (
    <div className="space-y-6">
      {/* Hero Section */}
      <section className="rounded-[2rem] border border-white/10 bg-[linear-gradient(135deg,rgba(15,23,42,0.98),rgba(17,24,39,0.92)),radial-gradient(circle_at_top_right,rgba(59,130,246,0.18),transparent_28%),radial-gradient(circle_at_bottom_left,rgba(14,165,233,0.12),transparent_24%)] p-6 shadow-[0_30px_100px_rgba(2,6,23,0.34)] sm:p-8">
        <div className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
          <div className="flex-1">
            <div className="inline-flex items-center gap-2 rounded-full border border-sky-300/20 bg-sky-400/10 px-3 py-1 text-xs font-semibold uppercase tracking-[0.24em] text-sky-100">
              <Calendar className="size-3.5" />
              Bookings
            </div>
            <h1 className="mt-4 text-4xl font-semibold tracking-tight text-white sm:text-5xl">
              Your Bookings
            </h1>
            <p className="mt-4 max-w-2xl text-base leading-8 text-slate-300 sm:text-lg">
              Manage your upcoming meetings and guest bookings. View
              confirmation statuses, join video calls, and handle cancellations
              all in one place.
            </p>

            {/* Status Badges */}
            <div className="mt-6 flex flex-wrap gap-3">
              <StatBadge
                icon={CheckCircle2}
                label="Confirmed"
                count={acceptedCount}
              />
              <StatBadge
                icon={AlertCircle}
                label="Tentative"
                count={tentativeCount}
              />
              <StatBadge icon={Clock} label="Awaiting" count={pendingCount} />
              <StatBadge
                icon={Calendar}
                label="Total"
                count={bookings.length}
              />
            </div>
          </div>

          {/* Refresh Button */}
          <Button
            onClick={handleRefresh}
            disabled={isRefreshing || isLoadingBookings}
            variant="outline"
            size="lg"
            className="self-start whitespace-nowrap lg:self-end"
          >
            {isRefreshing || isLoadingBookings ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Refreshing...
              </>
            ) : (
              <>
                <RefreshCw className="mr-2 h-4 w-4" />
                Refresh
              </>
            )}
          </Button>
        </div>

        {/* Color Legend */}
        <div className="mt-6 flex flex-wrap gap-2 border-t border-white/10 pt-6">
          {[
            {
              label: "Accepted",
              tone: "bg-green-600/15 text-green-100 border-green-500/20",
              icon: CheckCircle2,
            },
            {
              label: "Tentative",
              tone: "bg-amber-500/15 text-amber-100 border-amber-400/20",
              icon: AlertCircle,
            },
            {
              label: "Awaiting Response",
              tone: "bg-slate-500/15 text-slate-100 border-slate-400/20",
              icon: Clock,
            },
          ].map((item) => {
            const Icon = item.icon;
            return (
              <span
                key={item.label}
                className={`inline-flex items-center gap-2 rounded-full border px-3 py-1 text-xs font-medium ${item.tone}`}
              >
                <Icon className="size-3" />
                {item.label}
              </span>
            );
          })}
        </div>
      </section>

      {/* Bookings List */}
      {isLoadingBookings ? (
        <div className="rounded-lg border border-white/10 p-12 text-center">
          <Loader2 className="mx-auto h-8 w-8 animate-spin text-white/40 mb-4" />
          <p className="text-white/60">Loading your bookings...</p>
        </div>
      ) : (
        <BookingsList bookings={bookings} />
      )}
    </div>
  );
}
