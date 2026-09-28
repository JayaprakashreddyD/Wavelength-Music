"use client";

import { useState } from "react";
import Link from "next/link";
import { api } from "@/lib/api";
import { Input } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";
import { AuthError } from "@/components/auth/AuthError";

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      await api.post("/auth/forgot-password", { email });
      setSent(true);
    } catch {
      setError("We couldn't process that request. Please try again shortly.");
    } finally {
      setBusy(false);
    }
  }

  return <form onSubmit={submit} className="auth-form space-y-4">
    <h1>Find your way back</h1>
    {sent ? <p className="text-sm text-base-300">If an account with that email can reset a password, a reset link will be sent.</p> : <>
      <p className="text-sm text-base-300">Enter your account email. We’ll send a reset link if password sign-in is enabled.</p>
      <label htmlFor="reset-email" className="auth-label">Email address</label>
      <Input id="reset-email" className="auth-input" type="email" autoComplete="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
      {error && <AuthError message={error} heading="We couldn't send the reset link" />}
      <Button type="submit" className="auth-primary w-full" disabled={busy} aria-busy={busy}>{busy ? "Sending…" : "Send reset link"}</Button>
    </>}
    <p className="auth-form-footer text-center text-sm"><Link href="/login" className="auth-link">Back to login</Link></p>
  </form>;
}
