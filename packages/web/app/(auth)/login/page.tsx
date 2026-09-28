"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/authContext";
import { Input } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";
import { ApiError } from "@/lib/api";
import { GoogleSignIn } from "@/components/ui/GoogleSignIn";
import { AuthError } from "@/components/auth/AuthError";
import { PasswordField } from "@/components/auth/PasswordField";

export default function LoginPage() {
  const { login, loginWithGoogle, requestEmailCode, verifyEmailCode } = useAuth();
  const router = useRouter();
  const [emailOrUsername, setEmailOrUsername] = useState("");
  const [password, setPassword] = useState("");
  const [code, setCode] = useState("");
  const [codeSent, setCodeSent] = useState(false);
  const [codePanelOpen, setCodePanelOpen] = useState(false);
  const [codeLoading, setCodeLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      await login(emailOrUsername, password);
      router.push("/");
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Something went wrong");
    } finally {
      setLoading(false);
    }
  }

  async function onRequestCode() {
    setError(null);
    setCodeLoading(true);
    try {
      await requestEmailCode(emailOrUsername.trim());
      setCodeSent(true);
      setCodePanelOpen(true);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not send the login code");
    } finally {
      setCodeLoading(false);
    }
  }

  async function onVerifyCode() {
    setError(null);
    setCodeLoading(true);
    try {
      await verifyEmailCode(emailOrUsername.trim(), code.trim());
      router.push("/");
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not verify the login code");
    } finally {
      setCodeLoading(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className="auth-form space-y-4">
      <h1>Welcome back</h1>
      <p className="auth-support">Continue listening together.</p>
      <div className="auth-google"><GoogleSignIn onCredential={async (credential) => {
        setError(null);
        try {
          await loginWithGoogle(credential);
          router.push("/");
        } catch (err) {
          setError(err instanceof ApiError ? err.message : "Google sign-in failed");
        }
      }} /></div>
      <div className="auth-divider">or continue with email</div>
      {error && <AuthError message={error} heading="We couldn't sign you in" />}
      <div>
        <label htmlFor="login-identity" className="auth-label">Email or username</label>
        <Input id="login-identity" className="auth-input" value={emailOrUsername} onChange={(e) => setEmailOrUsername(e.target.value)} autoComplete="username" required autoFocus />
      </div>
      <div>
        <label className="auth-label" htmlFor="login-password">Password</label>
        <PasswordField id="login-password" value={password} onChange={setPassword} autoComplete="current-password" invalid={!!error} />
      </div>
      <Button type="submit" disabled={loading} aria-busy={loading} className="auth-primary w-full">
        {loading ? "Logging in…" : "Log in"}
      </Button>
      <p className="text-right text-sm"><Link href="/forgot-password" className="auth-link">Forgot password?</Link></p>
      <details className="auth-code-details" open={codePanelOpen} onToggle={(event) => setCodePanelOpen(event.currentTarget.open)}>
        <summary>Sign in with an email code</summary>
        <div className="space-y-3 pb-1">
        {!codeSent ? (
          <Button type="button" variant="secondary" className="min-h-11 w-full" disabled={codeLoading || !emailOrUsername.includes("@")} onClick={onRequestCode}>
            {codeLoading ? "Sending code…" : "Send code to email"}
          </Button>
        ) : (
          <>
            <p className="text-xs text-base-400">Enter the 6-digit code sent to {emailOrUsername.trim()}.</p>
            <Input
              aria-label="Email login code"
              inputMode="numeric"
              autoComplete="one-time-code"
              pattern="[0-9]{6}"
              maxLength={6}
              placeholder="6-digit code"
              value={code}
              onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))}
            />
            <Button type="button" variant="secondary" className="min-h-11 w-full" disabled={codeLoading || code.length !== 6} onClick={onVerifyCode}>
              {codeLoading ? "Verifying…" : "Verify code and sign in"}
            </Button>
            <button type="button" className="w-full text-xs text-accent hover:underline" disabled={codeLoading} onClick={() => { setCodeSent(false); setCode(""); }}>
              Use a different email or resend a code
            </button>
          </>
        )}
        </div>
      </details>
      <p className="auth-form-footer text-center text-sm text-base-400">
        New to Wavelength?{" "}
        <Link href="/register" className="auth-link">
          Sign up
        </Link>
      </p>
    </form>
  );
}
