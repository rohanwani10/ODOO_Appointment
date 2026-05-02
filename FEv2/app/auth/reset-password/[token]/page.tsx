"use client";

import { useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { apiFetch } from "@/lib/api";

export default function ResetPasswordPage() {
  const params = useParams<{ token: string }>();
  const router = useRouter();
  const [newPassword, setNewPassword] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMessage(null);
    setError(null);
    setIsSubmitting(true);

    try {
      const response = await apiFetch<{ message: string }>("/api/auth/reset-password", {
        method: "POST",
        skipAuth: true,
        body: JSON.stringify({
          token: params.token,
          new_password: newPassword,
        }),
      });
      setMessage(response.message);
      setTimeout(() => {
        router.replace("/auth/login");
      }, 1200);
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : "Reset failed");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <div className="page">
      <section className="panel">
        <h1>Reset password</h1>
        <form className="form" onSubmit={handleSubmit}>
          <label className="field">
            <span>New password</span>
            <input
              type="password"
              value={newPassword}
              onChange={(event) => setNewPassword(event.target.value)}
              required
            />
          </label>
          {message ? <p className="success">{message}</p> : null}
          {error ? <p className="error">{error}</p> : null}
          <button type="submit" disabled={isSubmitting}>
            {isSubmitting ? "Resetting..." : "Reset password"}
          </button>
        </form>
      </section>
    </div>
  );
}
