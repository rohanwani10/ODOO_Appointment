"use client";

import { useState } from "react";
import { apiFetch } from "@/lib/api";

export default function VerifyOtpPage() {
  const [email, setEmail] = useState("");
  const [otp, setOtp] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isSending, setIsSending] = useState(false);
  const [isVerifying, setIsVerifying] = useState(false);

  async function handleSendOtp() {
    setMessage(null);
    setError(null);
    setIsSending(true);
    try {
      const response = await apiFetch<{ message: string }>("/api/auth/send-otp", {
        method: "POST",
        skipAuth: true,
        body: JSON.stringify({ email }),
      });
      setMessage(response.message);
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : "Unable to send OTP");
    } finally {
      setIsSending(false);
    }
  }

  async function handleVerify(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMessage(null);
    setError(null);
    setIsVerifying(true);
    try {
      const response = await apiFetch<{ message: string }>("/api/auth/verify-otp", {
        method: "POST",
        skipAuth: true,
        body: JSON.stringify({ email, otp }),
      });
      setMessage(response.message);
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : "Unable to verify OTP");
    } finally {
      setIsVerifying(false);
    }
  }

  return (
    <div className="page">
      <section className="panel">
        <h1>Verify OTP</h1>
        <div className="form">
          <label className="field">
            <span>Email</span>
            <input type="email" value={email} onChange={(event) => setEmail(event.target.value)} required />
          </label>
          <button type="button" onClick={() => void handleSendOtp()} disabled={isSending || !email}>
            {isSending ? "Sending OTP..." : "Send OTP"}
          </button>
        </div>
        <form className="form" onSubmit={handleVerify}>
          <label className="field">
            <span>OTP</span>
            <input value={otp} onChange={(event) => setOtp(event.target.value)} required />
          </label>
          {message ? <p className="success">{message}</p> : null}
          {error ? <p className="error">{error}</p> : null}
          <button type="submit" disabled={isVerifying || !email || !otp}>
            {isVerifying ? "Verifying..." : "Verify OTP"}
          </button>
        </form>
      </section>
    </div>
  );
}
