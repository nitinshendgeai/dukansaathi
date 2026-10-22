"use client";

import { FormEvent, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";

export default function OnboardingPage() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [businessType, setBusinessType] = useState("retail");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let active = true;
    async function checkSession() {
      const supabase = createSupabaseBrowserClient();
      if (!supabase) return;
      const { data } = await supabase.auth.getUser();
      if (!data.user && active) router.replace("/login");
      if (data.user && active) {
        const response = await fetch("/api/business");
        const payload = await response.json();
        if (active && response.ok && payload.business) router.replace("/transactions");
      }
    }
    void checkSession();
    return () => { active = false; };
  }, [router]);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setBusy(true);
    const response = await fetch("/api/business", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, businessType })
    });
    const payload = await response.json();
    setBusy(false);
    if (!response.ok) {
      setError(payload.error ?? "Could not save business details.");
      return;
    }
    router.push("/transactions");
    router.refresh();
  }

  return (
    <main className="auth-page">
      <section className="auth-card">
        <p className="eyebrow">SET UP YOUR SHOP</p>
        <h1>What is your business called?</h1>
        <p className="auth-copy">This creates your private business workspace. You can add products and customers later.</p>
        <form className="auth-form" onSubmit={handleSubmit}>
          <label htmlFor="business-name">Business name</label>
          <input id="business-name" required maxLength={120} value={name} onChange={(event) => setName(event.target.value)} placeholder="e.g. Shree General Store" />
          <label htmlFor="business-type">Business type</label>
          <select id="business-type" value={businessType} onChange={(event) => setBusinessType(event.target.value)}>
            <option value="retail">Retail shop</option>
            <option value="grocery">Grocery / kirana</option>
            <option value="food">Food & beverage</option>
            <option value="services">Services</option>
            <option value="wholesale">Wholesale / distribution</option>
            <option value="general">Other</option>
          </select>
          {error && <p className="form-error" role="alert">{error}</p>}
          <button className="primary-button" type="submit" disabled={busy}>{busy ? "Saving…" : "Create business"}</button>
        </form>
      </section>
    </main>
  );
}
