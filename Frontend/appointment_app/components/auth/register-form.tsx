"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { apiFetch } from "@/lib/api";
import { setTokens } from "@/lib/auth";
import { useAuth } from "@/hooks/useAuth";
import { LoginResponse, UserRole } from "@/types/user";
import Link from "next/link";

interface RegisterFormProps {
  role: UserRole;
  accentColor: string; // tailwind color prefix, e.g. "sky" or "violet"
  heading: string;
  subtitle: string;
}

export default function RegisterForm({
  role,
  accentColor,
  heading,
  subtitle,
}: RegisterFormProps) {
  const [formData, setFormData] = useState({
    email: "",
    first_name: "",
    last_name: "",
    password: "",
    phone: "",
  });
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const router = useRouter();
  const { refreshUser } = useAuth();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError("");

    try {
      const payload = {
        ...formData,
        email: formData.email.trim(),
        first_name: formData.first_name.trim(),
        last_name: formData.last_name.trim(),
        phone: formData.phone.trim() || null,
        role,
      };

      const data = await apiFetch<LoginResponse>("/api/auth/register", {
        method: "POST",
        body: JSON.stringify(payload),
      });

      setTokens(data.access_token, data.refresh_token);
      await refreshUser();
      router.push(
        `/auth/verify-otp?email=${encodeURIComponent(payload.email)}`,
      );
    } catch (err: any) {
      setError(err.message || "Registration failed");
    } finally {
      setIsLoading(false);
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setFormData((prev) => ({
      ...prev,
      [e.target.name]: e.target.value,
    }));
  };

  // Dynamic accent classes
  const btnBg =
    accentColor === "violet"
      ? "bg-violet-400 hover:bg-violet-300"
      : "bg-sky-400 hover:bg-sky-300";
  const inputFocus =
    accentColor === "violet"
      ? "focus:border-violet-400/70 focus:ring-violet-400/20"
      : "focus:border-sky-400/70 focus:ring-sky-400/20";
  const pillBg =
    accentColor === "violet"
      ? "border-violet-300/25 bg-violet-300/10 text-violet-200"
      : "border-sky-300/25 bg-sky-300/10 text-sky-200";

  return (
    <div className="flex min-h-screen items-center justify-center bg-[radial-gradient(circle_at_top,rgba(59,130,246,0.18),transparent_40%),linear-gradient(180deg,#020617_0%,#0f172a_100%)] px-4 py-12">
      <div className="w-full max-w-md rounded-3xl border border-white/10 bg-white/5 p-8 text-white shadow-2xl shadow-slate-950/30 backdrop-blur">
        <div className="mb-6 flex items-center gap-3">
          <span
            className={`inline-flex rounded-full border px-3 py-1 text-xs uppercase tracking-[0.2em] ${pillBg}`}
          >
            {role}
          </span>
          <Link
            href="/auth/register"
            className="text-xs text-slate-400 transition-colors hover:text-white"
          >
            ← Change
          </Link>
        </div>

        <h1 className="mb-2 text-3xl font-semibold tracking-tight text-white">
          {heading}
        </h1>
        <p className="mb-8 text-sm text-slate-300">{subtitle}</p>

        {error && (
          <div className="mb-6 rounded-2xl border border-red-400/20 bg-red-500/10 p-4 text-sm text-red-100">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="mb-1 block text-sm font-medium text-slate-200">
                First name
              </label>
              <input
                type="text"
                name="first_name"
                value={formData.first_name}
                onChange={handleChange}
                className={`w-full rounded-2xl border border-white/10 bg-slate-950/70 px-4 py-3 text-white outline-none transition-colors placeholder:text-slate-500 ${inputFocus}`}
                placeholder="John"
                required
              />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-slate-200">
                Last name
              </label>
              <input
                type="text"
                name="last_name"
                value={formData.last_name}
                onChange={handleChange}
                className={`w-full rounded-2xl border border-white/10 bg-slate-950/70 px-4 py-3 text-white outline-none transition-colors placeholder:text-slate-500 ${inputFocus}`}
                placeholder="Doe"
                required
              />
            </div>
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium text-slate-200">
              Email address
            </label>
            <input
              type="email"
              name="email"
              value={formData.email}
              onChange={handleChange}
              className={`w-full rounded-2xl border border-white/10 bg-slate-950/70 px-4 py-3 text-white outline-none transition-colors placeholder:text-slate-500 ${inputFocus}`}
              placeholder="name@example.com"
              required
            />
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium text-slate-200">
              Phone (optional)
            </label>
            <input
              type="tel"
              name="phone"
              value={formData.phone}
              onChange={handleChange}
              className={`w-full rounded-2xl border border-white/10 bg-slate-950/70 px-4 py-3 text-white outline-none transition-colors placeholder:text-slate-500 ${inputFocus}`}
              placeholder="+1234567890"
            />
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium text-slate-200">
              Password
            </label>
            <input
              type="password"
              name="password"
              value={formData.password}
              onChange={handleChange}
              className={`w-full rounded-2xl border border-white/10 bg-slate-950/70 px-4 py-3 text-white outline-none transition-colors placeholder:text-slate-500 ${inputFocus}`}
              placeholder="••••••••"
              required
            />
          </div>

          <button
            type="submit"
            disabled={isLoading}
            className={`mt-4 w-full rounded-2xl px-4 py-3 font-semibold text-slate-950 transition-colors disabled:cursor-not-allowed disabled:opacity-60 ${btnBg}`}
          >
            {isLoading ? "Creating account..." : "Create account"}
          </button>
        </form>

        <p className="mt-8 text-center text-sm text-slate-300">
          Already have an account?{" "}
          <Link
            href="/auth/login"
            className="font-medium text-sky-300 hover:text-sky-200"
          >
            Login
          </Link>
        </p>
      </div>
    </div>
  );
}
