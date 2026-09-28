"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { api, setAccessToken } from "@/lib/api";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/Button";

export default function VerifyEmailChangePage() {
  const router = useRouter();
  const [token, setToken] = useState("");
  const [status, setStatus] = useState("Checking verification link…");
  const [verified, setVerified] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    const value = new URLSearchParams(window.location.hash.slice(1)).get("token") ?? "";
    window.history.replaceState(null, "", window.location.pathname);
    if (!value) {
      window.requestAnimationFrame(() => setStatus("Verification token is missing. Request a new email change link."));
      return;
    }
    window.requestAnimationFrame(() => {
      setToken(value);
      setStatus("Confirm that you want to use this email address.");
    });
  }, []);

  async function confirm() {
    setBusy(true);
    try {
      await api.post("/auth/verify-email-change", { token });
      setAccessToken(null);
      setToken("");
      setVerified(true);
      setStatus("Email updated. Your sessions have been signed out for security.");
    } catch {
      setStatus("This verification link is invalid or has expired.");
    } finally {
      setBusy(false);
    }
  }

  return <div className="auth-form space-y-4">
    <h1>Confirm your address</h1>
    <p role="status" aria-live="polite" className="rounded-xl border border-white/[0.07] bg-white/[0.025] p-4 text-sm leading-relaxed text-base-300">{status}</p>
    {token && !verified && <Button className="auth-primary w-full" disabled={busy} aria-busy={busy} onClick={confirm}>{busy ? "Verifying…" : "Confirm email change"}</Button>}
    {verified && <Button className="auth-primary w-full" onClick={() => router.push("/login")}>Sign in again</Button>}
    <p className="auth-form-footer text-center text-sm"><Link href="/login" className="auth-link">Go to login</Link></p>
  </div>;
}
