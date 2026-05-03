"use client";

import { Suspense, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useAuth } from "@/components/auth-provider";

function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const nextPath = searchParams.get("next") || "/dashboard";
  const { login } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setIsSubmitting(true);

    try {
      await login(email, password);
      router.replace(nextPath);
    } catch (submitError) {
      setError(
        submitError instanceof Error ? submitError.message : "Login failed",
      );
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <section className="panel login-panel">
      <div className="login-header">
        <h1>Welcome Back</h1>
        <p>Sign in to your account to continue</p>
      </div>
      <form className="form" onSubmit={handleSubmit}>
        <div className="field">
          <label>Email Address</label>
          <input
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            type="email"
            placeholder="name@example.com"
            required
          />
        </div>
        <div className="field">
          <label>Password</label>
          <input
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            type="password"
            placeholder="••••••••"
            required
          />
        </div>
        {error ? <p className="error">{error}</p> : null}
        <button type="submit" disabled={isSubmitting} className="button">
          {isSubmitting ? "Signing in..." : "Sign In"}
        </button>
      </form>
      <div className="login-footer">
        <p className="muted">
          Don't have an account? <a href="/auth/register">Create one</a>
        </p>
        <p className="muted">
          <a href="/auth/forgot-password">Forgot password?</a>
        </p>
      </div>
    </section>
  );
}

export default function LoginPage() {
  return (
    <div className="page login-page">
      <Suspense fallback={<p className="muted">Loading login...</p>}>
        <LoginForm />
      </Suspense>
    </div>
  );
}
