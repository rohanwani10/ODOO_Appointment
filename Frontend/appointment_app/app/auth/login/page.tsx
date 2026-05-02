"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  Mail,
  Lock,
  LogIn,
  AlertCircle,
  Loader2,
  ArrowRight,
  Sparkles
} from "lucide-react";
import { motion } from "framer-motion";
import { apiFetch } from "@/lib/api";
import { setTokens } from "@/lib/auth";
import { useAuth } from "@/hooks/useAuth";
import { LoginResponse } from "@/types/user";
import Link from "next/link";
import { getErrorMessage } from "@/lib/errors";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const router = useRouter();
  const { refreshUser } = useAuth();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError("");

    try {
      const data = await apiFetch<LoginResponse>("/api/auth/login", {
        method: "POST",
        body: JSON.stringify({ email, password }),
      });

      setTokens(data.access_token, data.refresh_token);
      await refreshUser();
      const nextPath =
        typeof window !== "undefined"
          ? new URLSearchParams(window.location.search).get("next")
          : null;
      router.push(
        nextPath && nextPath.startsWith("/") ? nextPath : "/dashboard",
      );
    } catch (err) {
      setError(getErrorMessage(err, "Failed to login"));
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="relative min-h-screen overflow-hidden bg-background text-white selection:bg-primary/30">
      {/* Animated Background Elements */}
      <div className="absolute inset-0 z-0">
        <motion.div 
          animate={{ 
            scale: [1, 1.2, 1],
            rotate: [0, 90, 0],
            opacity: [0.1, 0.2, 0.1]
          }}
          transition={{ duration: 20, repeat: Infinity, ease: "linear" }}
          className="absolute -top-40 -left-40 size-[600px] rounded-full bg-primary/20 blur-[120px]" 
        />
        <motion.div 
          animate={{ 
            scale: [1, 1.1, 1],
            rotate: [0, -45, 0],
            opacity: [0.05, 0.15, 0.05]
          }}
          transition={{ duration: 15, repeat: Infinity, ease: "linear" }}
          className="absolute -bottom-40 -right-40 size-[500px] rounded-full bg-indigo-500/20 blur-[100px]" 
        />
        <div className="absolute inset-0 bg-dashboard-grid opacity-20" />
      </div>

      <header className="fixed inset-x-0 top-0 z-50 border-b border-white/5 bg-slate-950/20 backdrop-blur-md">
        <div className="mx-auto flex h-20 max-w-7xl items-center justify-between px-6 lg:px-10">
          <Link href="/" className="group flex items-center gap-3 transition-all hover:scale-105">
            <span className="flex size-10 items-center justify-center rounded-2xl bg-white text-sm font-bold text-slate-950 shadow-xl group-hover:rotate-12 transition-transform">
              C
            </span>
            <span className="text-xl font-bold tracking-tight">Calvero</span>
          </Link>
          <nav className="flex items-center gap-6">
            <Link href="/pricing" className="text-sm font-medium text-slate-400 transition-colors hover:text-white">Pricing</Link>
            <Link href="/auth/register" className="rounded-full bg-white px-5 py-2 text-sm font-bold text-slate-950 transition-all hover:scale-105 hover:bg-slate-100">Get Started</Link>
          </nav>
        </div>
      </header>

      <main className="relative z-10 flex min-h-screen items-center justify-center px-6 pt-20">
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, ease: "easeOut" }}
          className="w-full max-w-md"
        >
          {/* Intro Badge */}
          <div className="mb-10 flex justify-center">
            <div className="glass inline-flex items-center gap-2 rounded-full px-4 py-1.5 text-xs font-bold uppercase tracking-widest text-primary shadow-2xl">
              <Sparkles className="size-3.5" />
              Intelligence Awaits
            </div>
          </div>

          {/* Heading */}
          <div className="mb-10 text-center">
            <h1 className="text-gradient text-4xl font-bold tracking-tight sm:text-5xl">
              Sign In
            </h1>
            <p className="mt-4 text-slate-400">
              Access your premium scheduling suite.
            </p>
          </div>

          {/* Form Card */}
          <div className="glass-premium rounded-[40px] p-8 shadow-2xl sm:p-10">
            {error && (
              <motion.div 
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: "auto" }}
                className="mb-6 overflow-hidden"
              >
                <div className="flex items-center gap-3 rounded-2xl border border-rose-500/20 bg-rose-500/10 p-4">
                  <AlertCircle className="size-5 text-rose-400 shrink-0" />
                  <p className="text-sm font-medium text-rose-200">{error}</p>
                </div>
              </motion.div>
            )}

            <form onSubmit={handleSubmit} className="space-y-6">
              <div className="space-y-2">
                <label className="text-xs font-bold uppercase tracking-widest text-slate-500 ml-1">Email</label>
                <div className="relative">
                  <Mail className="absolute left-4 top-1/2 size-5 -translate-y-1/2 text-slate-500" />
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="w-full rounded-[20px] border border-white/5 bg-white/5 pl-12 pr-4 py-4 text-white outline-none transition-all focus:border-primary/50 focus:bg-white/[0.08]"
                    placeholder="name@example.com"
                    required
                  />
                </div>
              </div>

              <div className="space-y-2">
                <div className="flex items-center justify-between ml-1">
                  <label className="text-xs font-bold uppercase tracking-widest text-slate-500">Password</label>
                  <Link href="/auth/forgot-password" size="sm" className="text-[10px] font-bold text-primary hover:underline">Forgot?</Link>
                </div>
                <div className="relative">
                  <Lock className="absolute left-4 top-1/2 size-5 -translate-y-1/2 text-slate-500" />
                  <input
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="w-full rounded-[20px] border border-white/5 bg-white/5 pl-12 pr-4 py-4 text-white outline-none transition-all focus:border-primary/50 focus:bg-white/[0.08]"
                    placeholder="••••••••"
                    required
                  />
                </div>
              </div>

              <button
                type="submit"
                disabled={isLoading}
                className="group relative mt-4 w-full overflow-hidden rounded-[20px] bg-white py-4 font-bold text-slate-950 transition-all hover:scale-[1.02] active:scale-95 disabled:opacity-50"
              >
                <div className="relative z-10 flex items-center justify-center gap-2">
                  {isLoading ? (
                    <Loader2 className="size-5 animate-spin" />
                  ) : (
                    <>
                      Sign In
                      <ArrowRight className="size-4 transition-transform group-hover:translate-x-1" />
                    </>
                  )}
                </div>
              </button>
            </form>

            <div className="mt-8 text-center">
              <p className="text-sm text-slate-500">
                New to Calvero?{" "}
                <Link href="/auth/register" className="font-bold text-white hover:text-primary transition-colors">
                  Create account
                </Link>
              </p>
            </div>
          </div>
        </motion.div>
      </main>
    </div>
  );
}
