"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { api, setAccessToken } from "@/lib/api";
import { Button } from "@/components/ui/Button";
import { AuthError } from "@/components/auth/AuthError";
import { PasswordField } from "@/components/auth/PasswordField";

export default function ResetPasswordPage() {
  const router = useRouter();
  const [token, setToken] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    const value = new URLSearchParams(window.location.hash.slice(1)).get("token") ?? "";
    window.history.replaceState(null, "", window.location.pathname);
    const frame = window.requestAnimationFrame(() => setToken(value));
    return () => window.cancelAnimationFrame(frame);
  }, []);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      await api.post("/auth/reset-password", { token, newPassword: password });
      setAccessToken(null);
      router.replace("/login?passwordReset=1");
    } catch {
      setError("This reset link is invalid or has expired. Request a new one.");
    } finally {
      setBusy(false);
    }
  }

  return <form onSubmit={submit} className="auth-form space-y-4">
    <h1>Choose a new password</h1>
    {!token ? <AuthError message="Reset token is missing. Open the complete link from your email." heading="Reset link unavailable" /> : <>
      <label htmlFor="new-password" className="auth-label">New password (at least 8 characters)</label>
      <PasswordField id="new-password" autoComplete="new-password" minLength={8} maxLength={72} value={password} onChange={setPassword} invalid={!!error} />
      {error && <AuthError message={error} heading="We couldn't update your password" />}
      <Button type="submit" className="auth-primary w-full" disabled={busy} aria-busy={busy}>{busy ? "Updating…" : "Update password"}</Button>
    </>}
    <p className="auth-form-footer text-center text-sm"><Link href="/login" className="auth-link">Back to login</Link></p>
  </form>;
}
