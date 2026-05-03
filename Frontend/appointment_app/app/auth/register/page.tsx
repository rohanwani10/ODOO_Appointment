"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowRight, Calendar, Users } from "lucide-react";

const roles = [
  {
    title: "Customer",
    desc: "Browse services and book appointments with providers.",
    icon: Users,
    href: "/auth/register/customer",
    bg: "bg-sky-500/10",
    color: "text-sky-300",
  },
  {
    title: "Organizer",
    desc: "Manage availability, services, resources, and team scheduling.",
    icon: Calendar,
    href: "/auth/register/organizer",
    bg: "bg-indigo-500/10",
    color: "text-indigo-300",
  },
];
import { Users, Calendar, ArrowRight, Sparkles } from "lucide-react";
import { motion } from "framer-motion";
import { cn } from "@/lib/utils";

export default function RegisterPage() {
  const router = useRouter();

  return (
    <div className="relative min-h-screen overflow-hidden bg-background text-white selection:bg-primary/30">
      <div className="absolute inset-0 z-0">
        <div className="absolute -right-40 -top-40 size-[600px] rounded-full bg-primary/20 blur-[120px]" />
        <div className="absolute inset-0 bg-dashboard-grid opacity-20" />
      </div>

      <header className="fixed inset-x-0 top-0 z-50 border-b border-white/5 bg-slate-950/20 backdrop-blur-md">
        <div className="mx-auto flex h-20 max-w-7xl items-center justify-between px-6 lg:px-10">
          <Link href="/" className="group flex items-center gap-3">
            <span className="flex size-10 items-center justify-center rounded-2xl bg-white text-sm font-bold text-slate-950 shadow-xl transition-transform group-hover:rotate-12">
              M
            </span>
            <span className="text-xl font-bold tracking-tight">MeetMint</span>
          </Link>
          <nav className="flex items-center gap-6">
            <Link
              href="/auth/login"
              className="text-sm font-medium text-slate-400 transition-colors hover:text-white"
            >
              Sign In
            </Link>
          </nav>
        </div>
      </header>

      <main className="relative z-10 flex min-h-screen items-center justify-center px-6 pt-20">
        <div className="w-full max-w-3xl">
          <div className="mb-12 text-center">
            <div className="mb-6 flex justify-center">
              <div className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-4 py-1.5 text-[10px] font-bold uppercase tracking-[0.2em] text-primary shadow-2xl backdrop-blur">
                Get Started
              </div>
            </div>
            <h1 className="text-gradient text-5xl font-bold tracking-tight sm:text-6xl">
              Choose your path
            </h1>
            <p className="mt-6 text-lg text-slate-400">
              Select how you want to use MeetMint. You can always change this later.
            </p>
          </div>

          <div className="grid gap-6 sm:grid-cols-2">
            {roles.map((role) => (
              <button
                key={role.title}
                type="button"
                onClick={() => router.push(role.href)}
                className="group rounded-[40px] border border-white/10 bg-white/[0.04] p-10 text-left shadow-2xl shadow-slate-950/30 backdrop-blur transition-all hover:scale-[1.02] hover:bg-white/[0.08]"
              >
                <div
                  className={`mb-8 flex size-16 items-center justify-center rounded-3xl ${role.bg} transition-transform group-hover:scale-110`}
                >
                  <role.icon className={`size-8 ${role.color}`} />
                </div>
                <h2 className="mb-4 text-3xl font-bold text-white">
                  {role.title}
                </h2>
                <p className="mb-8 leading-relaxed text-slate-400">
                  {role.desc}
                </p>
                <div className="flex items-center gap-2 text-sm font-bold text-white transition-colors group-hover:text-primary">
                  Continue
                  <ArrowRight className="size-4 transition-transform group-hover:translate-x-1" />
                </div>
              </button>
            ))}
          </div>

          <p className="mt-12 text-center text-sm text-slate-500">
            Already have an account?{" "}
            <Link
              href="/auth/login"
              className="font-bold text-white transition-colors hover:text-primary"
            >
              Sign In
            </Link>
          </p>
        </div>
      </main>
    </div>
  );
}
