"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { 
  LayoutDashboard, 
  CalendarDays, 
  Clock, 
  Settings, 
  Plus,
  Users,
  MessageSquare,
  Sparkles
} from "lucide-react";
import { cn } from "@/lib/utils";
import { motion } from "framer-motion";

const sidebarItems = [
  { icon: LayoutDashboard, label: "Overview", href: "/dashboard" },
  { icon: CalendarDays, label: "Availability", href: "/dashboard/availability" },
  { icon: Clock, label: "Bookings", href: "/appointments" },
  { icon: MessageSquare, label: "Feedback", href: "/feedback" },
  { icon: Users, label: "Team", href: "/team" },
  { icon: Settings, label: "Settings", href: "/settings" },
];

export function Sidebar() {
  const pathname = usePathname();

  return (
    <aside className="fixed left-0 top-0 z-50 flex h-screen w-20 flex-col items-center border-r border-white/5 bg-slate-950/80 pb-8 pt-6 backdrop-blur-xl">
      <Link href="/dashboard" className="group relative mb-12 flex size-12 items-center justify-center rounded-2xl bg-white transition-all hover:scale-110">
        <span className="text-xl font-bold text-slate-950">C</span>
        <div className="absolute -inset-2 -z-10 rounded-3xl bg-white/20 blur-xl opacity-0 group-hover:opacity-100 transition-opacity" />
      </Link>

      <div className="flex flex-1 flex-col items-center gap-4">
        <button className="group relative mb-4 flex size-12 items-center justify-center rounded-2xl border border-white/10 bg-white/5 transition-all hover:bg-white/10">
          <Plus className="size-6 text-white transition-transform group-hover:rotate-90" />
        </button>

        <nav className="flex flex-col items-center gap-4">
          {sidebarItems.map((item) => {
            const isActive = pathname === item.href;
            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  "group relative flex size-12 items-center justify-center rounded-2xl transition-all",
                  isActive 
                    ? "bg-primary text-primary-foreground shadow-lg shadow-primary/20" 
                    : "text-slate-400 hover:bg-white/5 hover:text-white"
                )}
              >
                <item.icon className="size-5" />
                
                {/* Tooltip */}
                <div className="absolute left-full ml-4 hidden rounded-lg border border-white/10 bg-slate-900 px-3 py-1.5 text-xs font-medium text-white shadow-xl group-hover:block whitespace-nowrap">
                  {item.label}
                </div>

                {isActive && (
                  <motion.div 
                    layoutId="sidebar-active"
                    className="absolute -left-3 h-6 w-1 rounded-r-full bg-primary"
                  />
                )}
              </Link>
            );
          })}
        </nav>
      </div>

      <div className="mt-auto flex flex-col items-center gap-6">
        <button className="group relative flex size-12 items-center justify-center rounded-2xl text-slate-400 transition-all hover:bg-white/5 hover:text-white">
          <Sparkles className="size-5" />
          <div className="absolute -top-1 -right-1 size-2 rounded-full bg-sky-400" />
        </button>
        
        <div className="size-10 rounded-full border border-white/10 bg-white/5 p-0.5">
           <div className="h-full w-full rounded-full bg-gradient-to-tr from-indigo-500 via-sky-400 to-emerald-400" />
        </div>
      </div>
    </aside>
  );
}
