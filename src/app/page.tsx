import type { ComponentType } from "react";
import Link from "next/link";
import { redirect } from "next/navigation";
import {
  ArrowDownLeft, ArrowDownRight, ArrowRight, ArrowUpRight, BookOpenText,
  Boxes, CalendarDays, ChartNoAxesCombined, Clock3, HandCoins, House,
  IndianRupee, Plus, ReceiptText, ShoppingBasket, TrendingUp, Wallet, Users
} from "lucide-react";
import { getCurrentUser } from "@/lib/auth";
import { pool } from "@/lib/db";
import { formatINRFromPaise } from "@/lib/finance";

export const dynamic = "force-dynamic";

type MetricRow = {
  business_date: string;
  sales_paise: string;
  collections_paise: string;
  expenses_paise: string;
  cash_received_paise: string;
  cash_paid_paise: string;
  receivables_paise: string;
  payables_paise: string;
  month_sales_paise: string;
  month_expenses_paise: string;
};

type RecentRow = {
  id: string;
  transaction_type: string;
  document_no: string;
  business_date: string;
  amount_paise: string;
  notes: string | null;
  created_at: string;
  payment_methods: string;
};

const navigation = [
  { label: "Overview", href: "/", icon: House, active: true },
  { label: "Transactions", href: "/transactions", icon: ReceiptText, active: false },
  { label: "Customers & suppliers", href: null, icon: Users, active: false },
  { label: "Products & stock", href: null, icon: Boxes, active: false },
  { label: "Reports", href: null, icon: ChartNoAxesCombined, active: false }
];

function MetricCard({ label, value, footnote, icon: Icon, primary = false }: {
  label: string;
  value: number;
  footnote: string;
  icon: ComponentType<{ size?: number; strokeWidth?: number }>;
  primary?: boolean;
}) {
  return <article className={`metric-card${primary ? " primary" : ""}`}>
    <div className="metric-top"><span>{label}</span><span className="metric-icon"><Icon size={16} strokeWidth={2} /></span></div>
    <div className="metric-value">{formatINRFromPaise(value)}</div>
    <div className="metric-footnote">{footnote}</div>
  </article>;
}

function NavigationLinks({ mobile = false }: { mobile?: boolean }) {
  const items = mobile ? navigation.filter((item) => ["Overview", "Transactions", "Customers & suppliers", "Reports"].includes(item.label)) : navigation;
  return <nav className={mobile ? "bottom-nav" : "nav-list"} aria-label={mobile ? "Mobile navigation" : "Main navigation"}>
    {items.map((item) => {
      const Icon = item.icon;
      const label = mobile ? item.label === "Customers & suppliers" ? "Parties" : item.label === "Transactions" ? "Bills" : item.label : item.label;
      return item.href ? <Link href={item.href} key={item.label} className={`${mobile ? "" : "nav-link"}${item.active ? " active" : ""}`} aria-current={item.active ? "page" : undefined}>
        <Icon size={18} strokeWidth={1.8} /><span>{label}</span>
      </Link> : <span key={item.label} className={`${mobile ? "nav-coming" : "nav-link nav-disabled"}`} aria-disabled="true" title="Coming in a later release">
        <Icon size={18} strokeWidth={1.8} /><span>{label}</span>
      </span>;
    })}
  </nav>;
}

function transactionLabel(type: string): string {
  return ({
    sale: "Sale", purchase: "Stock purchase", expense: "Expense",
    customer_receipt: "Customer receipt", supplier_payment: "Supplier payment",
    sales_refund: "Sales refund", purchase_return: "Purchase return",
    other_income: "Other income", cash_adjustment: "Cash adjustment"
  } as Record<string, string>)[type] ?? type.replaceAll("_", " ");
}

function dateLabel(value: string): string {
  const date = new Date(`${value.slice(0, 10)}T12:00:00+05:30`);
  return new Intl.DateTimeFormat("en-IN", { day: "numeric", month: "short", year: "numeric", timeZone: "Asia/Kolkata" }).format(date);
}

export default async function HomePage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const businessResult = await pool.query(
    "select id, name, timezone from public.businesses where owner_user_id = $1 limit 1",
    [user.id]
  );
  const business = businessResult.rows[0] as { id: string; name: string; timezone: string } | undefined;
  if (!business) redirect("/onboarding");

  const summaryResult = await pool.query(
    `with ctx as (
       select id, timezone, (now() at time zone timezone)::date as today,
              date_trunc('month', now() at time zone timezone)::date as month_start
       from public.businesses where id = $1 and owner_user_id = $2
     )
     select
       to_char(ctx.today, 'YYYY-MM-DD') as business_date,
       coalesce((select sum(t.amount_paise) from public.business_transactions t
         where t.business_id = ctx.id and t.status = 'posted' and t.transaction_type = 'sale'
           and t.business_date = ctx.today), 0)::text as sales_paise,
       coalesce((select sum(p.amount_paise) from public.transaction_payments p
         join public.business_transactions t on t.id = p.transaction_id and t.business_id = p.business_id
         where p.business_id = ctx.id and t.status = 'posted'
           and t.transaction_type in ('sale','customer_receipt') and p.payment_date = ctx.today), 0)::text as collections_paise,
       coalesce((select sum(t.amount_paise) from public.business_transactions t
         where t.business_id = ctx.id and t.status = 'posted' and t.transaction_type = 'expense'
           and t.business_date = ctx.today), 0)::text as expenses_paise,
       (coalesce((select sum(p.amount_paise) from public.transaction_payments p
         join public.business_transactions t on t.id = p.transaction_id and t.business_id = p.business_id
         where p.business_id = ctx.id and t.status = 'posted'
           and t.transaction_type in ('sale','customer_receipt','purchase_return','other_income')
           and p.payment_method = 'cash' and p.payment_date = ctx.today), 0)
         + coalesce((select sum(t.cash_delta_paise) from public.business_transactions t
           where t.business_id = ctx.id and t.status = 'posted' and t.transaction_type = 'cash_adjustment'
             and t.cash_delta_paise > 0 and t.business_date = ctx.today), 0))::text as cash_received_paise,
       (coalesce((select sum(p.amount_paise) from public.transaction_payments p
         join public.business_transactions t on t.id = p.transaction_id and t.business_id = p.business_id
         where p.business_id = ctx.id and t.status = 'posted'
           and t.transaction_type in ('purchase','expense','supplier_payment','sales_refund')
           and p.payment_method = 'cash' and p.payment_date = ctx.today), 0)
         + coalesce((select sum(abs(t.cash_delta_paise)) from public.business_transactions t
           where t.business_id = ctx.id and t.status = 'posted' and t.transaction_type = 'cash_adjustment'
             and t.cash_delta_paise < 0 and t.business_date = ctx.today), 0))::text as cash_paid_paise,
       greatest(0, coalesce((select sum(t.amount_paise) from public.business_transactions t
         where t.business_id = ctx.id and t.status = 'posted' and t.transaction_type = 'sale'), 0)
         - coalesce((select sum(p.amount_paise) from public.transaction_payments p
           join public.business_transactions t on t.id = p.transaction_id and t.business_id = p.business_id
           where p.business_id = ctx.id and t.status = 'posted' and t.transaction_type = 'sale'), 0)
         - coalesce((select sum(t.amount_paise) from public.business_transactions t
           where t.business_id = ctx.id and t.status = 'posted' and t.transaction_type = 'customer_receipt'), 0))::text as receivables_paise,
       greatest(0, coalesce((select sum(t.amount_paise) from public.business_transactions t
         where t.business_id = ctx.id and t.status = 'posted' and t.transaction_type = 'purchase'), 0)
         - coalesce((select sum(p.amount_paise) from public.transaction_payments p
           join public.business_transactions t on t.id = p.transaction_id and t.business_id = p.business_id
           where p.business_id = ctx.id and t.status = 'posted' and t.transaction_type = 'purchase'), 0)
         - coalesce((select sum(t.amount_paise) from public.business_transactions t
           where t.business_id = ctx.id and t.status = 'posted' and t.transaction_type = 'supplier_payment'), 0))::text as payables_paise,
       coalesce((select sum(t.amount_paise) from public.business_transactions t
         where t.business_id = ctx.id and t.status = 'posted' and t.transaction_type = 'sale'
           and t.business_date >= ctx.month_start and t.business_date <= ctx.today), 0)::text as month_sales_paise,
       coalesce((select sum(t.amount_paise) from public.business_transactions t
         where t.business_id = ctx.id and t.status = 'posted' and t.transaction_type = 'expense'
           and t.business_date >= ctx.month_start and t.business_date <= ctx.today), 0)::text as month_expenses_paise
     from ctx`,
    [business.id, user.id]
  );
  const summary = summaryResult.rows[0] as MetricRow | undefined;
  if (!summary) redirect("/onboarding");

  const recentResult = await pool.query(
    `select t.id, t.transaction_type, t.document_no, to_char(t.business_date, 'YYYY-MM-DD') as business_date,
            t.amount_paise::text, t.notes, t.created_at,
            coalesce((select string_agg(distinct p.payment_method, ', ' order by p.payment_method)
              from public.transaction_payments p
              where p.business_id = t.business_id and p.transaction_id = t.id), 'unpaid') as payment_methods
     from public.business_transactions t
     where t.business_id = $1 and t.status = 'posted'
     order by t.business_date desc, t.created_at desc limit 6`,
    [business.id]
  );
  const recent = recentResult.rows as RecentRow[];
  const today = dateLabel(summary.business_date);
  const cashNet = Number(summary.cash_received_paise) - Number(summary.cash_paid_paise);
  const currency = (value: string | number) => formatINRFromPaise(Number(value));

  return <div className="app-shell">
    <aside className="sidebar">
      <div className="brand"><div className="brand-mark">D</div><div><div className="brand-name">Dukaan Saathi</div><div className="brand-subtitle">Every rupee. One simple hisaab.</div></div></div>
      <NavigationLinks />
      <div className="sidebar-bottom"><div className="owner-card"><div className="avatar">{business.name.slice(0, 2).toUpperCase()}</div><div><div className="owner-title">{business.name}</div><div className="owner-caption">Business workspace</div></div></div></div>
    </aside>

    <main className="main">
      <header className="topbar">
        <div className="topbar-left"><div className="mobile-brand-mark">D</div><div><div className="eyebrow">BUSINESS OVERVIEW</div><div className="business-name">{business.name}</div></div></div>
        <span className="date-control"><CalendarDays size={13} style={{ verticalAlign: "middle", marginRight: 5 }} />{today}</span>
      </header>

      <section className="welcome-row"><h1>Good business starts with clear hisaab.</h1><p className="subtitle">Your business snapshot, based on saved transactions.</p></section>

      <section aria-labelledby="summary-heading">
        <div className="section-heading"><h2 id="summary-heading">Today at a glance</h2><span className="section-note">Live records · INR</span></div>
        <div className="metrics-grid">
          <MetricCard label="Total sales" value={Number(summary.sales_paise)} footnote="Posted sales dated today" icon={TrendingUp} primary />
          <MetricCard label="Collected" value={Number(summary.collections_paise)} footnote="Sale payments + customer receipts today" icon={ArrowDownLeft} />
          <MetricCard label="Expenses" value={Number(summary.expenses_paise)} footnote="Expenses dated today" icon={ArrowDownRight} />
          <MetricCard label="Net cash movement" value={cashNet} footnote="Cash received minus cash paid today; not closing cash" icon={Wallet} />
        </div>
      </section>

      <section aria-labelledby="actions-heading">
        <div className="section-heading"><h2 id="actions-heading">Quick entries</h2><span className="section-note">Shortcuts to transaction entry</span></div>
        <div className="quick-actions">
          <Link className="action-card" href="/transactions?type=sale"><span className="action-icon"><IndianRupee size={19} /></span><span><span className="action-title">Add sale</span><span className="action-subtitle">Cash or credit</span></span><Plus size={15} style={{ marginLeft: "auto", color: "var(--muted)" }} /></Link>
          <Link className="action-card" href="/transactions?type=expense"><span className="action-icon"><ArrowUpRight size={19} /></span><span><span className="action-title">Add expense</span><span className="action-subtitle">Record an outgoing</span></span><Plus size={15} style={{ marginLeft: "auto", color: "var(--muted)" }} /></Link>
          <Link className="action-card" href="/transactions?type=customer_receipt"><span className="action-icon"><HandCoins size={19} /></span><span><span className="action-title">Customer receipt</span><span className="action-subtitle">Record a collection</span></span><Plus size={15} style={{ marginLeft: "auto", color: "var(--muted)" }} /></Link>
          <Link className="action-card" href="/transactions?type=purchase"><span className="action-icon"><ShoppingBasket size={19} /></span><span><span className="action-title">Purchase</span><span className="action-subtitle">Add a supplier bill</span></span><Plus size={15} style={{ marginLeft: "auto", color: "var(--muted)" }} /></Link>
        </div>
      </section>

      <div className="content-grid">
        <section className="panel" aria-labelledby="recent-heading">
          <div className="panel-header"><h2 id="recent-heading">Recent activity</h2><Link href="/transactions" className="small-link">View all <ArrowRight size={12} style={{ verticalAlign: "middle" }} /></Link></div>
          {recent.length === 0 ? <div className="empty-state">No transactions recorded yet. Use a quick entry to record your first sale or expense.</div> : recent.map((transaction) => {
            const incoming = ["sale", "customer_receipt", "purchase_return", "other_income"].includes(transaction.transaction_type);
            return <div className="transaction-row" key={transaction.id}>
              <div className="transaction-symbol">{incoming ? <ArrowDownLeft size={17} /> : <ArrowUpRight size={17} />}</div>
              <div className="transaction-description"><div className="transaction-title">{transactionLabel(transaction.transaction_type)}</div><div className="transaction-meta">{dateLabel(transaction.business_date)} · {transaction.document_no} · {transaction.payment_methods}</div>{transaction.notes && <div className="transaction-meta">{transaction.notes}</div>}</div>
              <div className={`transaction-amount ${incoming ? "positive" : "negative"}`}>{currency(transaction.amount_paise)}</div>
            </div>;
          })}
        </section>

        <section className="panel" aria-labelledby="dues-heading">
          <div className="panel-header"><h2 id="dues-heading">Money to follow up</h2><BookOpenText size={17} color="var(--muted)" /></div>
          <div className="dues-list">
            <div className="due-row"><div><div className="due-label">Customer dues</div><div className="due-subtitle">Estimated unpaid sales, less receipts</div></div><div className="due-value">{currency(summary.receivables_paise)}</div></div>
            <div className="due-row"><div><div className="due-label">Supplier dues</div><div className="due-subtitle">Estimated unpaid purchases, less payments</div></div><div className="due-value">{currency(summary.payables_paise)}</div></div>
            <div className="due-row"><div><div className="due-label">This month</div><div className="due-subtitle">Sales · {currency(summary.month_sales_paise)}</div><div className="due-subtitle">Expenses · {currency(summary.month_expenses_paise)}</div></div><Link className="small-link" href="/transactions">Review <ArrowRight size={12} style={{ verticalAlign: "middle" }} /></Link></div>
          </div>
          <p className="transactions-footnote" style={{ padding: "0 20px 18px" }}>Balances are business-wide estimates. Receipts and payments are not yet linked to individual invoices.</p>
        </section>
      </div>

      <p className="footer-note"><Clock3 size={12} style={{ verticalAlign: "middle", marginRight: 5 }} />Live data · {user.email} · {business.timezone}</p>
    </main>
    <NavigationLinks mobile />
  </div>;
}
