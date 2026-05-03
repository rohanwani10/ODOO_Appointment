"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { 
  LayoutDashboard, 
  Clock, 
  Settings, 
  Building2,
  BriefcaseBusiness,
  ShieldCheck,
} from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { cn } from "@/lib/utils";
import { motion } from "framer-motion";

const baseSidebarItems = [
  { icon: LayoutDashboard, label: "Overview", href: "/dashboard", match: "exact" as const },
  { icon: Clock, label: "Appointments", href: "/appointments", match: "prefix" as const },
  { icon: Settings, label: "Settings", href: "/settings", match: "prefix" as const },
];

const organizerSidebarItems = [
  { icon: Building2, label: "Workspace", href: "/organizer", match: "exact" as const },
  { icon: BriefcaseBusiness, label: "Services", href: "/organizer/services", match: "prefix" as const },
];

const adminSidebarItems = [
  { icon: ShieldCheck, label: "Admin", href: "/admin", match: "prefix" as const },
];

export function Sidebar() {
  const pathname = usePathname();
  const { isOrganizer, isAdmin } = useAuth();
  const sidebarItems = [
    ...baseSidebarItems,
    ...(isOrganizer ? organizerSidebarItems : []),
    ...(isAdmin ? adminSidebarItems : []),
  ];

  return (
    <aside className="fixed left-0 top-0 z-50 flex h-screen w-20 flex-col items-center border-r border-white/5 bg-slate-950/80 pb-8 pt-6 backdrop-blur-xl">
      <Link href="/dashboard" className="group relative mb-12 flex size-12 items-center justify-center rounded-2xl bg-white transition-all hover:scale-110">
        <span className="text-xl font-bold text-slate-950">C</span>
        <div className="absolute -inset-2 -z-10 rounded-3xl bg-white/20 blur-xl opacity-0 group-hover:opacity-100 transition-opacity" />
      </Link>

      <div className="flex flex-1 flex-col items-center gap-4">
        <nav className="flex flex-col items-center gap-4">
          {sidebarItems.map((item) => {
            const isActive =
              item.match === "prefix"
                ? pathname === item.href || pathname?.startsWith(`${item.href}/`)
                : pathname === item.href;
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

      <div className="mt-auto" />
    </aside>
  );
}
