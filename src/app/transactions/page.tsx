"use client";

import { FormEvent, useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, CheckCircle2, CircleAlert, LoaderCircle, Plus } from "lucide-react";
import { formatINRFromPaise } from "@/lib/finance";

type TransactionType = "sale" | "expense" | "purchase" | "customer_receipt" | "supplier_payment";
type TransactionRow = {
  id: string;
  transaction_type: string;
  status: string;
  document_no: string;
  business_date: string;
  amount_paise: number;
  notes: string | null;
  created_at: string;
  transaction_payments?: { amount_paise: number; payment_method: string }[];
};
type Business = { id: string; name: string };

function makeIdempotencyKey() {
  return `web-${Date.now()}-${Math.random().toString(36).slice(2, 14)}`;
}

function localDateString(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function parseRupeesToPaise(raw: string, allowZero = false): number {
  const value = raw.trim();
  if (!/^\d+(?:\.\d{1,2})?$/.test(value)) {
    throw new Error("Enter an amount with no more than two decimal places.");
  }
  const [rupees, fraction = ""] = value.split(".");
  const paise = Number(rupees) * 100 + Number(fraction.padEnd(2, "0"));
  if (!Number.isSafeInteger(paise) || (allowZero ? paise < 0 : paise <= 0)) {
    throw new Error(allowZero ? "Enter a valid non-negative amount." : "Enter an amount greater than ₹0.00.");
  }
  return paise;
}

export default function TransactionsPage() {
  const router = useRouter();
  const [business, setBusiness] = useState<Business | null>(null);
  const [transactions, setTransactions] = useState<TransactionRow[]>([]);
  const [type, setType] = useState<TransactionType>("sale");
  const [amount, setAmount] = useState("");
  const [paid, setPaid] = useState("");
  const [method, setMethod] = useState<"cash" | "upi" | "bank" | "card" | "other">("cash");
  const [notes, setNotes] = useState("");
  const [date, setDate] = useState(() => localDateString(new Date()));
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const loadTransactions = useCallback(async (businessId: string) => {
    const response = await fetch(`/api/transactions?businessId=${encodeURIComponent(businessId)}`);
    const payload = await response.json();
    if (response.status === 401) {
      router.replace("/login");
      return;
    }
    if (!response.ok) throw new Error(payload.error ?? "Could not load transactions.");
    setTransactions(payload.transactions ?? []);
  }, [router]);

  useEffect(() => {
    let active = true;
    async function initialise() {
      const response = await fetch("/api/business");
      const payload = await response.json();
      if (response.status === 401) {
        router.replace("/login");
        return;
      }
      if (!response.ok) {
        if (active) setError(payload.error ?? "Could not load business.");
        setLoading(false);
        return;
      }
      if (!payload.business) {
        router.replace("/onboarding");
        return;
      }
      if (active) {
        setBusiness(payload.business);
        try {
          await loadTransactions(payload.business.id);
        } catch (caught) {
          setError(caught instanceof Error ? caught.message : "Could not load transactions.");
        } finally {
          if (active) setLoading(false);
        }
      }
    }
    void initialise();
    return () => { active = false; };
  }, [loadTransactions, router]);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!business) return;
    setError("");
    setSuccess("");

    let amountPaise: number;
    let paidPaise: number;
    try {
      amountPaise = parseRupeesToPaise(amount);
      paidPaise = paid.trim() === "" ? 0 : parseRupeesToPaise(paid, true);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Enter valid amounts.");
      return;
    }
    if (paidPaise > amountPaise) {
      setError("Amount paid must be between ₹0.00 and the transaction total.");
      return;
    }
    if (["customer_receipt", "supplier_payment"].includes(type) && paidPaise !== amountPaise) {
      setError("Receipts and supplier payments must have a payment amount equal to the total.");
      return;
    }

    setSaving(true);
    const response = await fetch("/api/transactions", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        businessId: business.id,
        transactionType: type,
        businessDate: date,
        amountPaise,
        idempotencyKey: makeIdempotencyKey(),
        notes: notes.trim() || undefined,
        payments: paidPaise > 0 ? [{ amountPaise: paidPaise, method }] : []
      })
    });
    const payload = await response.json();
    setSaving(false);
    if (!response.ok) {
      setError(payload.error ?? "Transaction could not be saved.");
      return;
    }

    setSuccess(`${payload.transaction?.document_no ?? "Transaction"} saved successfully.`);
    setAmount("");
    setPaid("");
    setNotes("");
    try {
      await loadTransactions(business.id);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Saved, but the list could not refresh.");
    }
  }

  return (
    <main className="transactions-page">
      <header className="transactions-header">
        <Link href="/" className="back-link"><ArrowLeft size={18} /> Dashboard preview</Link>
        <div><p className="eyebrow">DUKAAN SAATHI</p><h1>Transactions</h1><p className="muted-copy">{business?.name ?? "Your business"}</p></div>
      </header>

      {!loading && error && !business && (
        <div className="notice notice-error"><CircleAlert size={18} />{error}</div>
      )}

      <div className="transactions-grid">
        <section className="panel">
          <div className="panel-heading"><div><p className="eyebrow">NEW ENTRY</p><h2>Record a transaction</h2></div><Plus size={20} /></div>
          <form className="transaction-form" onSubmit={handleSubmit}>
            <label htmlFor="transaction-type">Transaction type</label>
            <select id="transaction-type" value={type} onChange={(event) => setType(event.target.value as TransactionType)}>
              <option value="sale">Sale</option>
              <option value="expense">Expense</option>
              <option value="purchase">Stock purchase</option>
              <option value="customer_receipt">Customer receipt</option>
              <option value="supplier_payment">Supplier payment</option>
            </select>

            <label htmlFor="transaction-date">Date</label>
            <input id="transaction-date" type="date" required value={date} onChange={(event) => setDate(event.target.value)} />

            <label htmlFor="transaction-amount">Total amount (₹)</label>
            <input id="transaction-amount" type="number" min="0.01" step="0.01" inputMode="decimal" required value={amount} onChange={(event) => { setAmount(event.target.value); if (paid === "") setPaid(event.target.value); }} placeholder="0.00" />

            <label htmlFor="transaction-paid">Paid now (₹)</label>
            <input id="transaction-paid" type="number" min="0" step="0.01" inputMode="decimal" value={paid} onChange={(event) => setPaid(event.target.value)} placeholder="0.00" />
            <p className="field-hint">For a credit sale or purchase, enter ₹0.00 paid now. Receipts and supplier payments must be fully allocated.</p>

            {Number(paid) > 0 && (
              <>
                <label htmlFor="payment-method">Payment method</label>
                <select id="payment-method" value={method} onChange={(event) => setMethod(event.target.value as typeof method)}>
                  <option value="cash">Cash</option><option value="upi">UPI</option><option value="bank">Bank transfer</option><option value="card">Card</option><option value="other">Other</option>
                </select>
              </>
            )}

            <label htmlFor="transaction-notes">Notes (optional)</label>
            <textarea id="transaction-notes" rows={3} maxLength={2000} value={notes} onChange={(event) => setNotes(event.target.value)} placeholder="Customer, item or reference notes" />

            {error && <div className="notice notice-error" role="alert"><CircleAlert size={18} />{error}</div>}
            {success && <div className="notice notice-success" role="status"><CheckCircle2 size={18} />{success}</div>}
            <button className="primary-button" type="submit" disabled={saving || loading || !business}>
              {saving ? <><LoaderCircle size={16} className="spin" /> Saving…</> : "Save transaction"}
            </button>
          </form>
        </section>

        <section className="panel transaction-list-panel">
          <div className="panel-heading"><div><p className="eyebrow">LATEST ACTIVITY</p><h2>Recent transactions</h2></div><span className="count-pill">{transactions.length}</span></div>
          {loading ? <p className="empty-state">Loading transactions…</p> : transactions.length === 0 ? (
            <p className="empty-state">No transactions yet. Your saved entries will appear here.</p>
          ) : (
            <div className="transaction-list">
              {transactions.map((transaction) => (
                <article className="transaction-row" key={transaction.id}>
                  <div className="transaction-row-main">
                    <strong>{transaction.transaction_type.replaceAll("_", " ")}</strong>
                    <span>{transaction.document_no} · {transaction.business_date}</span>
                    {transaction.notes && <span>{transaction.notes}</span>}
                    <small>{(transaction.transaction_payments ?? []).map((payment) => `${payment.payment_method.toUpperCase()} ${formatINRFromPaise(Number(payment.amount_paise))}`).join(" · ") || "Unpaid / credit"}</small>
                  </div>
                  <div className="transaction-row-amount">{formatINRFromPaise(Number(transaction.amount_paise))}<small>{transaction.status}</small></div>
                </article>
              ))}
            </div>
          )}
        </section>
      </div>
      <p className="transactions-footnote">Financial entries are stored in your business workspace. Posted entries are not editable from this screen; reversal and correction tools are a later phase.</p>
    </main>
  );
}
