"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { Users, Calendar, ArrowRight } from "lucide-react";
import { GoogleLoginButton } from "@/components/auth/google-login-button";
import { useState } from "react";

export default function RegisterPage() {
  const router = useRouter();

  return (
    <div className="relative min-h-screen overflow-hidden bg-background text-white selection:bg-primary/30">
      {/* Animated Background */}
      <div className="absolute inset-0 z-0">
        <motion.div 
          animate={{ scale: [1, 1.2, 1], opacity: [0.1, 0.2, 0.1] }}
          transition={{ duration: 15, repeat: Infinity }}
          className="absolute -top-40 -right-40 size-[600px] rounded-full bg-primary/20 blur-[120px]" 
        />
        <div className="absolute inset-0 bg-dashboard-grid opacity-20" />
      </div>

      <header className="fixed inset-x-0 top-0 z-50 border-b border-white/5 bg-slate-950/20 backdrop-blur-md">
        <div className="mx-auto flex h-20 max-w-7xl items-center justify-between px-6 lg:px-10">
          <Link href="/" className="group flex items-center gap-3">
            <span className="flex size-10 items-center justify-center rounded-2xl bg-white text-sm font-bold text-slate-950 shadow-xl group-hover:rotate-12 transition-transform">
              C
            </span>
            <span className="text-xl font-bold tracking-tight">Calvero</span>
          </Link>
          <nav className="flex items-center gap-6">
            <Link href="/auth/login" className="text-sm font-medium text-slate-400 transition-colors hover:text-white">Sign In</Link>
          </nav>
        </div>
      </header>

      <main className="relative z-10 flex min-h-screen items-center justify-center px-6 pt-20">
        <div className="w-full max-w-3xl">
          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="mb-12 text-center"
          >
            <div className="mb-6 flex justify-center">
              <div className="glass inline-flex items-center gap-2 rounded-full px-4 py-1.5 text-[10px] font-bold uppercase tracking-[0.2em] text-primary shadow-2xl">
                <Sparkles className="size-3.5" />
                Join the Future
              </div>
            </div>
            <h1 className="text-gradient text-5xl font-bold tracking-tight sm:text-6xl">
              Choose your path
            </h1>
            <p className="mt-6 text-lg text-slate-400">
              Select your primary role to begin your premium scheduling journey.
            </p>
          </motion.div>

          <div className="grid gap-6 sm:grid-cols-2">
            {[
              {
                title: "Customer",
                desc: "Browse services and book appointments with world-class providers.",
                icon: Users,
                href: "/auth/register/customer",
                color: "group-hover:text-sky-400",
                bg: "bg-sky-500/10"
              },
              {
                title: "Organizer",
                desc: "Scale your operations with automated availability and team sync.",
                icon: Calendar,
                href: "/auth/register/organizer",
                color: "group-hover:text-indigo-400",
                bg: "bg-indigo-500/10"
              }
            ].map((role, i) => (
              <motion.button
                key={role.title}
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ delay: i * 0.1 }}
                onClick={() => router.push(role.href)}
                className="group glass-premium rounded-[40px] p-10 text-left transition-all hover:scale-[1.02] hover:bg-white/[0.08]"
              >
                <div className={cn("mb-8 flex size-16 items-center justify-center rounded-3xl transition-transform group-hover:scale-110", role.bg)}>
                  <role.icon className={cn("size-8", role.color)} />
                </div>
                <h2 className="text-3xl font-bold text-white mb-4">{role.title}</h2>
                <p className="text-slate-400 leading-relaxed mb-8">{role.desc}</p>
                <div className="flex items-center gap-2 text-sm font-bold text-white group-hover:text-primary transition-colors">
                  Continue Path
                  <ArrowRight className="size-4 transition-transform group-hover:translate-x-1" />
                </div>
              </motion.button>
            ))}
          </div>

          <p className="mt-12 text-center text-sm text-slate-500">
            Already have an account?{" "}
            <Link href="/auth/login" className="font-bold text-white hover:text-primary transition-colors">
              Sign In
            </Link>
          </p>
        </div>
      </main>
    </div>
  );
}
