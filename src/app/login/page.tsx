"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setBusy(true);
    try {
      const response = await fetch(mode === "signin" ? "/api/auth/login" : "/api/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "same-origin",
        body: JSON.stringify({ email: email.trim(), password })
      });
      const payload = await response.json();
      if (!response.ok) {
        setError(payload.error ?? "Could not authenticate.");
        return;
      }
      router.push("/onboarding");
      router.refresh();
    } catch {
      setError("Could not reach the server. Please try again.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="auth-page">
      <section className="auth-card">
        <Link href="/" className="brand-mark">DS</Link>
        <p className="eyebrow">DUKAAN SAATHI</p>
        <h1>{mode === "signin" ? "Welcome back" : "Create your account"}</h1>
        <p className="auth-copy">Your daily hisaab, organised in one place.</p>
        <form onSubmit={handleSubmit} className="auth-form">
          <label htmlFor="email">Email address</label>
          <input id="email" type="email" autoComplete="email" required maxLength={254} value={email} onChange={(event) => setEmail(event.target.value)} />
          <label htmlFor="password">Password</label>
          <input id="password" type="password" autoComplete={mode === "signin" ? "current-password" : "new-password"} minLength={mode === "signin" ? 1 : 10} maxLength={128} required value={password} onChange={(event) => setPassword(event.target.value)} />
          {mode === "signup" && <p className="field-hint">Use at least 10 characters.</p>}
          {error && <p className="form-error" role="alert">{error}</p>}
          <button className="primary-button" type="submit" disabled={busy}>{busy ? "Please wait…" : mode === "signin" ? "Sign in" : "Create account"}</button>
        </form>
        <p className="auth-switch">
          {mode === "signin" ? "New to Dukaan Saathi?" : "Already have an account?"}{" "}
          <button type="button" onClick={() => { setMode(mode === "signin" ? "signup" : "signin"); setError(""); }}>
            {mode === "signin" ? "Create account" : "Sign in"}
          </button>
        </p>
      </section>
    </main>
  );
}
