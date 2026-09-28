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

export default function RegisterPage() {
  const { register, loginWithGoogle } = useAuth();
  const router = useRouter();
  const [username, setUsername] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      await register(username, email, password);
      router.push("/");
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Something went wrong");
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className="auth-form space-y-4">
      <h1>Create your account</h1>
      <p className="auth-support">Join Wavelength and listen together.</p>
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
      {error && <AuthError message={error} heading="We couldn't create your account" />}
      <div>
        <label htmlFor="register-username" className="auth-label">Username</label>
        <Input id="register-username" className="auth-input" value={username} onChange={(e) => setUsername(e.target.value)} autoComplete="username" required autoFocus minLength={3} />
      </div>
      <div>
        <label htmlFor="register-email" className="auth-label">Email</label>
        <Input id="register-email" className="auth-input" type="email" value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="email" required />
      </div>
      <div>
        <label htmlFor="register-password" className="auth-label">Password</label>
        <PasswordField id="register-password" value={password} onChange={setPassword} autoComplete="new-password" minLength={8} invalid={!!error} />
      </div>
      <Button type="submit" disabled={loading} aria-busy={loading} className="auth-primary w-full">
        {loading ? "Creating account…" : "Create account"}
      </Button>
      <p className="auth-form-footer text-center text-sm text-base-300">
        Already have an account?{" "}
        <Link href="/login" className="auth-link">
          Log in
        </Link>
      </p>
    </form>
  );
}
