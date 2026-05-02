"use client";

import { useCallback, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  AlertCircle,
  ArrowLeft,
  ArrowRight,
  Check,
  CheckCircle2,
  Eye,
  EyeOff,
  Loader2,
  Lock,
  Mail,
  Phone,
  Sparkles,
  User,
} from "lucide-react";
import { motion, MotionConfig, useReducedMotion } from "framer-motion";
import { apiFetch } from "@/lib/api";
import { setTokens } from "@/lib/auth";
import { useAuth } from "@/hooks/useAuth";
import { LoginResponse, UserRole } from "@/types/user";
import Link from "next/link";
import { GoogleLoginButton } from "./google-login-button";

type RegisterFormState = {
  email: string;
  first_name: string;
  last_name: string;
  password: string;
  phone: string;
};

type RegisterFieldErrors = Partial<Record<keyof RegisterFormState, string>>;

type TouchedFields = Partial<Record<keyof RegisterFormState, boolean>>;

type PasswordStrength = "weak" | "medium" | "strong";

/**
 * Props for role-aware registration form.
 */
interface RegisterFormProps {
  role: UserRole;
  accentColor: string;
  heading: string;
  subtitle: string;
}

/**
 * Reusable field wrapper for labels, icon, inline errors, and valid indicators.
 */
function FormField({
  id,
  name,
  label,
  value,
  onChange,
  onBlur,
  type = "text",
  placeholder,
  required = false,
  disabled = false,
  error,
  isValid,
  describedBy,
  icon,
  rightElement,
  focusRingClass,
  autoComplete,
}: {
  id: string;
  name: keyof RegisterFormState;
  label: string;
  value: string;
  onChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  onBlur?: (e: React.FocusEvent<HTMLInputElement>) => void;
  type?: string;
  placeholder?: string;
  required?: boolean;
  disabled?: boolean;
  error?: string;
  isValid?: boolean;
  describedBy?: string;
  icon?: React.ReactNode;
  rightElement?: React.ReactNode;
  focusRingClass: string;
  autoComplete?: string;
}) {
  return (
    <div className="space-y-2">
      <label
        htmlFor={id}
        className="ml-1 block text-xs font-bold uppercase tracking-[0.14em] text-slate-200"
      >
        {label}
        {required ? <span className="ml-1 text-rose-300">*</span> : null}
      </label>

      <div className="relative">
        {icon ? (
          <span className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-slate-300">
            {icon}
          </span>
        ) : null}

        <input
          id={id}
          name={name}
          type={type}
          value={value}
          onChange={onChange}
          onBlur={onBlur}
          required={required}
          disabled={disabled}
          autoComplete={autoComplete}
          aria-invalid={!!error}
          aria-describedby={describedBy}
          placeholder={placeholder}
          className={`h-12 w-full rounded-2xl border border-white/15 bg-white/10 py-3 text-white placeholder:text-slate-300/80 outline-none transition duration-150 hover:scale-[1.005] hover:bg-white/15 ${
            icon ? "pl-12" : "pl-4"
          } ${rightElement || isValid ? "pr-12" : "pr-4"} ${focusRingClass} disabled:cursor-not-allowed disabled:opacity-60`}
        />

        {isValid && !error ? (
          <span className="pointer-events-none absolute right-4 top-1/2 -translate-y-1/2 text-emerald-300">
            <Check className="size-4" />
          </span>
        ) : null}

        {rightElement ? (
          <span className="absolute right-3 top-1/2 -translate-y-1/2">{rightElement}</span>
        ) : null}
      </div>

      {error ? (
        <p id={describedBy} className="ml-1 text-sm text-rose-200" role="alert">
          {error}
        </p>
      ) : null}
    </div>
  );
}

function validateName(value: string): string | undefined {
  const normalized = value.trim();
  if (!normalized) return "This field is required.";
  const nameRegex = /^[A-Za-z]+(?:[ '-][A-Za-z]+)*$/;
  if (!nameRegex.test(normalized)) {
    return "Use letters only (spaces, hyphens, apostrophes allowed).";
  }
  return undefined;
}

function validateEmail(value: string): string | undefined {
  const normalized = value.trim();
  if (!normalized) return "Email is required.";
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(normalized)) return "Enter a valid email address.";
  return undefined;
}

/**
 * Password rule check used for both inline guidance and submit gating.
 */
function getPasswordValidation(value: string): { valid: boolean; message: string } {
  const hasLength = value.length >= 8;
  const hasUppercase = /[A-Z]/.test(value);
  const hasNumber = /\d/.test(value);
  const valid = hasLength && hasUppercase && hasNumber;

  if (valid) {
    return { valid: true, message: "Strong enough for account creation." };
  }

  return {
    valid: false,
    message: "At least 8 characters, 1 uppercase letter, and 1 number.",
  };
}

function getPasswordStrength(value: string): PasswordStrength {
  let score = 0;
  if (value.length >= 8) score += 1;
  if (/[A-Z]/.test(value)) score += 1;
  if (/[a-z]/.test(value)) score += 1;
  if (/\d/.test(value)) score += 1;
  if (/[^A-Za-z0-9]/.test(value)) score += 1;

  if (score >= 4) return "strong";
  if (score >= 2) return "medium";
  return "weak";
}

function mapApiError(message: string): string {
  const lower = message.toLowerCase();
  if (lower.includes("email") && (lower.includes("exists") || lower.includes("already"))) {
    return "Email already exists. Please use a different email or sign in.";
  }
  if (lower.includes("otp")) {
    return "Could not start verification. Please try again.";
  }
  if (lower.includes("network") || lower.includes("fetch")) {
    return "Network issue detected. Check your connection and retry.";
  }
  return "We could not create your account right now. Please try again.";
}

function mapGoogleError(message: string): string {
  const lower = message.toLowerCase();
  if (lower.includes("client") || lower.includes("google_client_id")) {
    return "Google login is not configured right now. Please use email registration.";
  }
  if (lower.includes("popup") || lower.includes("closed")) {
    return "Google login was canceled before completion.";
  }
  return "Google login failed. Try again.";
}

function AnimatedBackground({ reduceMotion }: { reduceMotion: boolean }) {
  return (
    <div className="absolute inset-0 z-0" aria-hidden="true">
      <motion.div
        animate={
          reduceMotion
            ? undefined
            : {
                scale: [1, 1.2, 1],
                rotate: [0, 90, 0],
                opacity: [0.1, 0.2, 0.1],
              }
        }
        transition={
          reduceMotion
            ? { duration: 0 }
            : { duration: 20, repeat: Infinity, ease: "linear" }
        }
        className="absolute -left-40 -top-40 size-[600px] rounded-full bg-primary/20 blur-[120px]"
      />
      <motion.div
        animate={
          reduceMotion
            ? undefined
            : {
                scale: [1, 1.1, 1],
                rotate: [0, -45, 0],
                opacity: [0.05, 0.15, 0.05],
              }
        }
        transition={
          reduceMotion
            ? { duration: 0 }
            : { duration: 15, repeat: Infinity, ease: "linear" }
        }
        className="absolute -bottom-40 -right-40 size-[500px] rounded-full bg-indigo-500/20 blur-[100px]"
      />
      <div className="absolute inset-0 bg-dashboard-grid opacity-20" />
    </div>
  );
}

export default function RegisterForm({
  role,
  accentColor,
  heading,
  subtitle,
}: RegisterFormProps) {
  const [formData, setFormData] = useState<RegisterFormState>({
    email: "",
    first_name: "",
    last_name: "",
    password: "",
    phone: "",
  });
  const [fieldErrors, setFieldErrors] = useState<RegisterFieldErrors>({});
  const [touched, setTouched] = useState<TouchedFields>({});
  const [apiError, setApiError] = useState("");
  const [successMessage, setSuccessMessage] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isGoogleLoading, setIsGoogleLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  const router = useRouter();
  const { refreshUser } = useAuth();
  const shouldReduceMotion = useReducedMotion();

  const accentMap = useMemo(
    () => ({
      sky: {
        badge:
          "border-sky-300/40 bg-sky-950/45 text-sky-100",
        button: "bg-sky-400 text-slate-950 hover:bg-sky-300",
        ring: "focus-visible:border-sky-300 focus-visible:ring-sky-300/70",
      },
      violet: {
        badge:
          "border-violet-300/40 bg-violet-950/45 text-violet-100",
        button: "bg-violet-400 text-slate-950 hover:bg-violet-300",
        ring: "focus-visible:border-violet-300 focus-visible:ring-violet-300/70",
      },
    }),
    [],
  );

  const colors =
    accentMap[accentColor as keyof typeof accentMap] ?? accentMap.sky;

  const passwordValidation = useMemo(
    () => getPasswordValidation(formData.password),
    [formData.password],
  );

  const passwordStrength = useMemo(
    () => getPasswordStrength(formData.password),
    [formData.password],
  );

  const computedErrors = useMemo<RegisterFieldErrors>(() => {
    const first_name = validateName(formData.first_name);
    const last_name = validateName(formData.last_name);
    const email = validateEmail(formData.email);
    const password = passwordValidation.valid ? undefined : passwordValidation.message;
    return { first_name, last_name, email, password };
  }, [formData, passwordValidation]);

  const requiredValid = useMemo(() => {
    return !computedErrors.first_name && !computedErrors.last_name && !computedErrors.email && !computedErrors.password;
  }, [computedErrors]);

  const isFieldValid = useCallback(
    (field: keyof RegisterFormState) => {
      const value = formData[field].trim();
      if (!value && field !== "phone") return false;
      return !computedErrors[field];
    },
    [computedErrors, formData],
  );

  const validateSingleField = useCallback(
    (name: keyof RegisterFormState, value: string) => {
      if (name === "email") return validateEmail(value);
      if (name === "first_name" || name === "last_name") return validateName(value);
      if (name === "password") return getPasswordValidation(value).valid ? undefined : getPasswordValidation(value).message;
      return undefined;
    },
    [],
  );

  const handleFieldChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const { name, value } = e.target as { name: keyof RegisterFormState; value: string };
      setFormData((prev) => ({ ...prev, [name]: value }));

      if (name !== "email") {
        const nextError = validateSingleField(name, value);
        setFieldErrors((prev) => ({ ...prev, [name]: nextError }));
      } else if (touched.email) {
        setFieldErrors((prev) => ({ ...prev, email: validateEmail(value) }));
      }
    },
    [touched.email, validateSingleField],
  );

  const handleFieldBlur = useCallback(
    (e: React.FocusEvent<HTMLInputElement>) => {
      const { name, value } = e.target as { name: keyof RegisterFormState; value: string };
      setTouched((prev) => ({ ...prev, [name]: true }));
      const nextError = validateSingleField(name, value);
      setFieldErrors((prev) => ({ ...prev, [name]: nextError }));
    },
    [validateSingleField],
  );

  const handleSubmit = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();
      setApiError("");
      setSuccessMessage("");

      const nextTouched: TouchedFields = {
        email: true,
        first_name: true,
        last_name: true,
        password: true,
      };
      setTouched((prev) => ({ ...prev, ...nextTouched }));
      setFieldErrors((prev) => ({ ...prev, ...computedErrors }));

      if (!requiredValid) {
        return;
      }

      setIsSubmitting(true);

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
        setSuccessMessage("Account created! Redirecting...");
        await new Promise((resolve) => setTimeout(resolve, 900));
        router.push(`/auth/verify-otp?email=${encodeURIComponent(payload.email)}`);
      } catch (err) {
        const msg = err instanceof Error ? err.message : "Registration failed";
        setApiError(mapApiError(msg));
      } finally {
        setIsSubmitting(false);
      }
    },
    [computedErrors, formData, refreshUser, requiredValid, role, router],
  );

  const fieldMotion = useMemo(
    () => ({
      initial: shouldReduceMotion ? { opacity: 1, y: 0 } : { opacity: 0, y: 14 },
      animate: { opacity: 1, y: 0 },
      transition: shouldReduceMotion ? { duration: 0 } : { duration: 0.28, ease: "easeOut" },
    }),
    [shouldReduceMotion],
  );

  const strengthMeta = useMemo(() => {
    if (passwordStrength === "strong") {
      return { label: "Strong", bar: "w-full bg-emerald-400", text: "text-emerald-200" };
    }
    if (passwordStrength === "medium") {
      return { label: "Medium", bar: "w-2/3 bg-amber-300", text: "text-amber-100" };
    }
    return { label: "Weak", bar: "w-1/3 bg-rose-300", text: "text-rose-100" };
  }, [passwordStrength]);

  return (
    <MotionConfig reducedMotion="user">
      <div className="relative min-h-screen overflow-hidden bg-background text-white selection:bg-primary/30">
        <AnimatedBackground reduceMotion={!!shouldReduceMotion} />

        <header className="fixed inset-x-0 top-0 z-50 border-b border-white/5 bg-slate-950/20 backdrop-blur-md">
          <div className="mx-auto flex h-20 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-10">
            <Link
              href="/"
              className="group flex items-center gap-3 rounded-xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/80 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-950"
            >
              <span className="flex size-10 items-center justify-center rounded-2xl bg-white text-sm font-bold text-slate-950 shadow-xl transition-transform group-hover:rotate-12">
                C
              </span>
              <span className="text-xl font-bold tracking-tight">Calvero</span>
            </Link>
            <nav className="flex items-center gap-4 sm:gap-6">
              <Link
                href="/pricing"
                className="rounded-md text-sm font-semibold text-slate-200 transition-colors hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/80 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-950"
              >
                Pricing
              </Link>
              <Link
                href="/auth/login"
                className="rounded-full bg-white px-4 py-2 text-sm font-bold text-slate-950 transition-all hover:bg-slate-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/80 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-950 sm:px-5"
              >
                Sign In
              </Link>
            </nav>
          </div>
        </header>

        <main className="relative z-10 mx-auto flex min-h-screen w-full max-w-3xl items-center justify-center px-4 pb-10 pt-24 sm:px-6">
          <motion.div
            initial={shouldReduceMotion ? { opacity: 1 } : { opacity: 0, y: 20 }}
            animate={shouldReduceMotion ? { opacity: 1 } : { opacity: 1, y: 0 }}
            transition={{ duration: shouldReduceMotion ? 0 : 0.45, ease: "easeOut" }}
            className="w-full"
          >
            <Link
              href="/auth/register"
              className="mb-5 inline-flex min-h-11 items-center gap-2 rounded-lg px-1 text-sm font-semibold text-slate-200 transition hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/80 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-900"
            >
              <ArrowLeft className="size-4" />
              Change role
            </Link>

            <div className="mb-6 flex items-center justify-between gap-3">
              <span className={`inline-flex rounded-full border px-3 py-1.5 text-xs font-semibold uppercase tracking-[0.2em] ${colors.badge}`}>
                {role === "CUSTOMER" ? "Customer" : "Organizer"}
              </span>
              <div className="glass inline-flex items-center gap-2 rounded-full px-3 py-1 text-[11px] font-bold uppercase tracking-[0.18em] text-primary">
                <Sparkles className="size-3.5" />
                Secure onboarding
              </div>
            </div>

            <div className="mb-6 sm:mb-8">
              <h1 className="text-gradient text-3xl font-bold tracking-tight sm:text-5xl">
                {heading}
              </h1>
              <p className="mt-3 text-sm text-slate-200 sm:text-base">{subtitle}</p>
            </div>

            <section className="glass-premium relative rounded-[32px] p-5 shadow-2xl sm:rounded-[40px] sm:p-8" aria-label="Registration form">
              {isSubmitting ? (
                <div className="absolute inset-0 z-20 flex items-center justify-center rounded-[32px] bg-slate-950/45 backdrop-blur-[2px] sm:rounded-[40px]">
                  <div className="inline-flex items-center gap-2 rounded-full border border-white/20 bg-white/10 px-4 py-2 text-sm font-semibold text-white">
                    <Loader2 className="size-4 animate-spin" />
                    Creating your account...
                  </div>
                </div>
              ) : null}

              {apiError ? (
                <div
                  className="mb-4 rounded-2xl border border-rose-400/45 bg-rose-950/45 p-4 text-rose-50"
                  role="alert"
                  aria-live="assertive"
                >
                  <div className="flex items-start gap-3">
                    <AlertCircle className="mt-0.5 size-5 shrink-0 text-rose-200" />
                    <div className="flex-1 space-y-1">
                      <p className="text-sm font-semibold">Couldn’t create account</p>
                      <p className="text-sm text-rose-100/95">{apiError}</p>
                    </div>
                    <button
                      type="button"
                      onClick={() => setApiError("")}
                      className="rounded-md border border-rose-200/60 px-2 py-1 text-xs font-semibold transition hover:bg-rose-900/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-200"
                    >
                      Dismiss
                    </button>
                  </div>
                </div>
              ) : null}

              {successMessage ? (
                <div className="mb-4 rounded-2xl border border-emerald-300/45 bg-emerald-900/45 p-4" aria-live="polite">
                  <div className="flex items-center gap-2 text-emerald-50">
                    <CheckCircle2 className="size-5 text-emerald-200" />
                    <p className="text-sm font-semibold">{successMessage}</p>
                  </div>
                </div>
              ) : null}

              <form onSubmit={handleSubmit} className="space-y-4" noValidate>
                <fieldset disabled={isSubmitting} className="space-y-4">
                  <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                    <motion.div {...fieldMotion}>
                      <FormField
                        id="first_name"
                        name="first_name"
                        label="First Name"
                        value={formData.first_name}
                        onChange={handleFieldChange}
                        onBlur={handleFieldBlur}
                        required
                        disabled={isSubmitting}
                        placeholder="John"
                        icon={<User className="size-5" />}
                        error={touched.first_name ? fieldErrors.first_name : undefined}
                        isValid={touched.first_name && isFieldValid("first_name")}
                        describedBy="first-name-error"
                        autoComplete="given-name"
                        focusRingClass={`focus-visible:ring-2 ${colors.ring}`}
                      />
                    </motion.div>

                    <motion.div
                      {...fieldMotion}
                      transition={
                        shouldReduceMotion ? { duration: 0 } : { duration: 0.28, ease: "easeOut", delay: 0.04 }
                      }
                    >
                      <FormField
                        id="last_name"
                        name="last_name"
                        label="Last Name"
                        value={formData.last_name}
                        onChange={handleFieldChange}
                        onBlur={handleFieldBlur}
                        required
                        disabled={isSubmitting}
                        placeholder="Doe"
                        icon={<User className="size-5" />}
                        error={touched.last_name ? fieldErrors.last_name : undefined}
                        isValid={touched.last_name && isFieldValid("last_name")}
                        describedBy="last-name-error"
                        autoComplete="family-name"
                        focusRingClass={`focus-visible:ring-2 ${colors.ring}`}
                      />
                    </motion.div>
                  </div>

                  <motion.div
                    {...fieldMotion}
                    transition={
                      shouldReduceMotion ? { duration: 0 } : { duration: 0.28, ease: "easeOut", delay: 0.08 }
                    }
                  >
                    <FormField
                      id="email"
                      name="email"
                      label="Email Address"
                      value={formData.email}
                      onChange={handleFieldChange}
                      onBlur={handleFieldBlur}
                      required
                      disabled={isSubmitting}
                      placeholder="name@example.com"
                      icon={<Mail className="size-5" />}
                      error={touched.email ? fieldErrors.email : undefined}
                      isValid={touched.email && isFieldValid("email")}
                      describedBy="email-error"
                      autoComplete="email"
                      type="email"
                      focusRingClass={`focus-visible:ring-2 ${colors.ring}`}
                    />
                  </motion.div>

                  <motion.div
                    {...fieldMotion}
                    transition={
                      shouldReduceMotion ? { duration: 0 } : { duration: 0.28, ease: "easeOut", delay: 0.12 }
                    }
                  >
                    <FormField
                      id="phone"
                      name="phone"
                      label="Phone (Optional)"
                      value={formData.phone}
                      onChange={handleFieldChange}
                      onBlur={handleFieldBlur}
                      disabled={isSubmitting}
                      placeholder="+1234567890"
                      icon={<Phone className="size-5" />}
                      autoComplete="tel"
                      type="tel"
                      focusRingClass={`focus-visible:ring-2 ${colors.ring}`}
                    />
                  </motion.div>

                  <motion.div
                    {...fieldMotion}
                    transition={
                      shouldReduceMotion ? { duration: 0 } : { duration: 0.28, ease: "easeOut", delay: 0.16 }
                    }
                    className="space-y-2"
                  >
                    <FormField
                      id="password"
                      name="password"
                      label="Password"
                      value={formData.password}
                      onChange={handleFieldChange}
                      onBlur={handleFieldBlur}
                      required
                      disabled={isSubmitting}
                      placeholder="••••••••"
                      icon={<Lock className="size-5" />}
                      type={showPassword ? "text" : "password"}
                      error={touched.password ? fieldErrors.password : undefined}
                      isValid={touched.password && isFieldValid("password")}
                      describedBy="password-error"
                      autoComplete="new-password"
                      focusRingClass={`focus-visible:ring-2 ${colors.ring}`}
                      rightElement={
                        <button
                          type="button"
                          onClick={() => setShowPassword((prev) => !prev)}
                          aria-label={showPassword ? "Hide password" : "Show password"}
                          className="inline-flex min-h-11 min-w-11 items-center justify-center rounded-lg text-slate-200 transition hover:bg-white/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/80"
                        >
                          {showPassword ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
                        </button>
                      }
                    />

                    <div className="ml-1 space-y-1.5">
                      <div className="h-1.5 w-full rounded-full bg-white/10">
                        <div className={`h-1.5 rounded-full transition-all ${strengthMeta.bar}`} />
                      </div>
                      <p className={`text-xs font-medium ${strengthMeta.text}`}>
                        Password strength: {strengthMeta.label}
                      </p>
                      <p className="text-xs text-slate-200/90">
                        At least 8 characters, 1 uppercase letter, and 1 number.
                      </p>
                    </div>
                  </motion.div>

                  <motion.div
                    {...fieldMotion}
                    transition={
                      shouldReduceMotion ? { duration: 0 } : { duration: 0.28, ease: "easeOut", delay: 0.2 }
                    }
                  >
                    <button
                      type="submit"
                      disabled={!requiredValid || isSubmitting}
                      className={`group relative inline-flex h-12 w-full items-center justify-center gap-2 rounded-2xl font-bold transition hover:scale-[1.01] active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-60 ${colors.button}`}
                    >
                      {isSubmitting ? (
                        <>
                          <Loader2 className="size-4 animate-spin" />
                          Creating Account...
                        </>
                      ) : (
                        <>
                          Create account
                          <ArrowRight className="size-4 transition-transform group-hover:translate-x-0.5" />
                        </>
                      )}
                    </button>
                  </motion.div>
                </fieldset>
              </form>

              <div
                className="mt-4"
                onClickCapture={() => {
                  if (!isSubmitting) setIsGoogleLoading(true);
                }}
              >
                <GoogleLoginButton
                  onSuccess={async () => {
                    await refreshUser();
                    router.push("/dashboard");
                  }}
                  onError={(msg) => {
                    setIsGoogleLoading(false);
                    setApiError(mapGoogleError(msg));
                  }}
                  isLoading={isSubmitting}
                  className="h-12 w-full rounded-2xl border border-white/20 bg-white/90 px-4 py-3 text-sm font-semibold text-slate-900 transition hover:bg-white"
                />
                {isGoogleLoading ? (
                  <p className="mt-2 flex items-center gap-2 text-xs text-slate-200" aria-live="polite">
                    <Loader2 className="size-3.5 animate-spin" />
                    Redirecting to Google...
                  </p>
                ) : null}
              </div>

              <div className="relative my-6">
                <div className="absolute inset-0 flex items-center">
                  <div className="w-full border-t border-white/20" />
                </div>
                <div className="relative flex justify-center text-sm">
                  <span className="bg-slate-900/60 px-3 text-slate-100">Already have an account?</span>
                </div>
              </div>

              <Link
                href="/auth/login"
                className="inline-flex h-12 w-full items-center justify-center rounded-2xl border border-white/20 px-4 py-3 text-sm font-semibold text-white transition hover:bg-white/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/80 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-900"
              >
                Sign in instead
              </Link>
            </section>

            <p className="mt-6 text-center text-xs text-slate-200/90">
              By signing up, you agree to our{" "}
              <Link
                href="#"
                className="font-semibold text-white transition hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/80"
              >
                Terms of Service
              </Link>{" "}
              and{" "}
              <Link
                href="#"
                className="font-semibold text-white transition hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/80"
              >
                Privacy Policy
              </Link>
            </p>
          </motion.div>
        </main>
      </div>
    </MotionConfig>
  );
}
