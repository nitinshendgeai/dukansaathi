import {
  ArrowDownLeft,
  ArrowDownRight,
  ArrowRight,
  ArrowUpRight,
  Bell,
  BookOpenText,
  Boxes,
  CalendarDays,
  ChartNoAxesCombined,
  CircleHelp,
  Clock3,
  FileText,
  HandCoins,
  House,
  IndianRupee,
  Plus,
  ReceiptText,
  ShoppingBasket,
  TrendingUp,
  Wallet,
  Users
} from "lucide-react";
import { formatINRFromPaise } from "@/lib/finance";

const demo = {
  salesPaise: 856000,
  collectionsPaise: 642000,
  expensesPaise: 93500,
  cashPaise: 218500,
  receivablesPaise: 246000,
  payablesPaise: 173000
};

const transactions = [
  { title: "Counter sale", subtitle: "Today · 11:42 AM · Cash", amountPaise: 125000, direction: "in", icon: ShoppingBasket },
  { title: "Payment from Rahul", subtitle: "Today · 10:18 AM · UPI", amountPaise: 80000, direction: "in", icon: HandCoins },
  { title: "Stock purchase", subtitle: "Today · 09:35 AM · Cash", amountPaise: 42500, direction: "out", icon: Boxes },
  { title: "Shop electricity", subtitle: "Today · 09:10 AM · UPI", amountPaise: 18000, direction: "out", icon: ReceiptText }
] as const;

const navigation = [
  { label: "Overview", icon: House, active: true },
  { label: "Transactions", icon: ReceiptText, active: false },
  { label: "Customers & suppliers", icon: Users, active: false },
  { label: "Products & stock", icon: Boxes, active: false },
  { label: "Reports", icon: ChartNoAxesCombined, active: false }
];

function MetricCard({
  label,
  value,
  footnote,
  icon: Icon,
  primary = false
}: {
  label: string;
  value: number;
  footnote: string;
  icon: React.ComponentType<{ size?: number; strokeWidth?: number }>;
  primary?: boolean;
}) {
  return (
    <article className={`metric-card${primary ? " primary" : ""}`}>
      <div className="metric-top">
        <span>{label}</span>
        <span className="metric-icon"><Icon size={16} strokeWidth={2} /></span>
      </div>
      <div className="metric-value">{formatINRFromPaise(value)}</div>
      <div className="metric-footnote">{footnote}</div>
    </article>
  );
}

function NavigationLinks({ mobile = false }: { mobile?: boolean }) {
  return (
    <nav className={mobile ? "bottom-nav" : "nav-list"} aria-label={mobile ? "Mobile navigation" : "Main navigation"}>
      {(mobile ? navigation.filter((item) => ["Overview", "Transactions", "Customers & suppliers", "Reports"].includes(item.label)) : navigation).map((item) => {
        const Icon = item.icon;
        return (
          <a
            href="#"
            key={item.label}
            className={`${mobile ? "" : "nav-link"}${item.active ? " active" : ""}`}
            aria-current={item.active ? "page" : undefined}
            onClick={mobile ? undefined : (event) => event.preventDefault()}
          >
            <Icon size={18} strokeWidth={1.8} />
            <span>{mobile ? item.label === "Customers & suppliers" ? "Parties" : item.label === "Transactions" ? "Bills" : item.label : item.label}</span>
          </a>
        );
      })}
    </nav>
  );
}

function QuickAction({
  title,
  subtitle,
  icon: Icon
}: {
  title: string;
  subtitle: string;
  icon: React.ComponentType<{ size?: number; strokeWidth?: number }>;
}) {
  return (
    <button className="action-card" type="button" title="Demo preview — transaction entry will be connected in the next implementation step">
      <span className="action-icon"><Icon size={19} strokeWidth={1.8} /></span>
      <span>
        <span className="action-title" style={{ display: "block" }}>{title}</span>
        <span className="action-subtitle" style={{ display: "block" }}>{subtitle}</span>
      </span>
      <Plus size={15} style={{ marginLeft: "auto", color: "var(--muted)" }} />
    </button>
  );
}

export default function HomePage() {
  const today = new Intl.DateTimeFormat("en-IN", {
    weekday: "short",
    day: "numeric",
    month: "short",
    year: "numeric",
    timeZone: "Asia/Kolkata"
  }).format(new Date());

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <div className="brand">
          <div className="brand-mark">D</div>
          <div>
            <div className="brand-name">Dukaan Saathi</div>
            <div className="brand-subtitle">Every rupee. One simple hisaab.</div>
          </div>
        </div>
        <NavigationLinks />
        <div className="sidebar-bottom">
          <div className="owner-card">
            <div className="avatar">DS</div>
            <div>
              <div className="owner-title">Demo Store</div>
              <div className="owner-caption">Owner account · Preview</div>
            </div>
          </div>
        </div>
      </aside>

      <main className="main">
        <header className="topbar">
          <div className="topbar-left">
            <div className="mobile-brand-mark">D</div>
            <div>
              <div className="eyebrow">BUSINESS OVERVIEW</div>
              <div className="business-name">Demo Store</div>
            </div>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <span className="date-control"><CalendarDays size={13} style={{ verticalAlign: "middle", marginRight: 5 }} />{today}</span>
            <button type="button" aria-label="Notifications" className="date-control" title="Notifications coming later" style={{ display: "grid", placeItems: "center", padding: 9 }}>
              <Bell size={15} />
            </button>
          </div>
        </header>

        <section className="welcome-row">
          <h1>Good business starts with clear hisaab.</h1>
          <p className="subtitle">Here&apos;s your shop&apos;s daily snapshot.</p>
        </section>

        <div className="preview-banner" role="status">
          <CircleHelp size={18} style={{ flex: "0 0 auto", marginTop: 1 }} />
          <div>
            <strong>Interactive preview · Sample figures only</strong>
            <p>This screen is not connected to a database yet. No real transactions are being saved. The transaction engine and persistence are the next implementation step.</p>
          </div>
        </div>

        <section aria-labelledby="summary-heading">
          <div className="section-heading">
            <h2 id="summary-heading">Today at a glance</h2>
            <span className="section-note">Example data · INR</span>
          </div>
          <div className="metrics-grid">
            <MetricCard label="Total sales" value={demo.salesPaise} footnote="All recorded sales" icon={TrendingUp} primary />
            <MetricCard label="Collected" value={demo.collectionsPaise} footnote="Cash + digital payments" icon={ArrowDownLeft} />
            <MetricCard label="Expenses" value={demo.expensesPaise} footnote="Recorded business expenses" icon={ArrowDownRight} />
            <MetricCard label="Cash in hand" value={demo.cashPaise} footnote="Example closing position" icon={Wallet} />
          </div>
        </section>

        <section aria-labelledby="actions-heading">
          <div className="section-heading">
            <h2 id="actions-heading">Quick entries</h2>
            <span className="section-note">Designed for one-hand use</span>
          </div>
          <div className="quick-actions">
            <QuickAction title="Add sale" subtitle="Cash or credit" icon={IndianRupee} />
            <QuickAction title="Add expense" subtitle="Record an outgoing" icon={ArrowUpRight} />
            <QuickAction title="Customer receipt" subtitle="Collect outstanding" icon={HandCoins} />
            <QuickAction title="Purchase" subtitle="Add stock or bill" icon={ShoppingBasket} />
          </div>
        </section>

        <div className="content-grid">
          <section className="panel" aria-labelledby="recent-heading">
            <div className="panel-header">
              <h2 id="recent-heading">Recent activity</h2>
              <a href="#recent-heading" className="small-link">View all <ArrowRight size={12} style={{ verticalAlign: "middle" }} /></a>
            </div>
            {transactions.map((transaction) => {
              const Icon = transaction.icon;
              return (
                <div className="transaction-row" key={transaction.title}>
                  <div className="transaction-symbol"><Icon size={17} strokeWidth={1.8} /></div>
                  <div className="transaction-description">
                    <div className="transaction-title">{transaction.title}</div>
                    <div className="transaction-meta">{transaction.subtitle}</div>
                  </div>
                  <div className={`transaction-amount ${transaction.direction === "in" ? "positive" : "negative"}`}>
                    {transaction.direction === "in" ? "+" : "−"}{formatINRFromPaise(transaction.amountPaise)}
                  </div>
                </div>
              );
            })}
          </section>

          <section className="panel" aria-labelledby="dues-heading">
            <div className="panel-header">
              <h2 id="dues-heading">Money to follow up</h2>
              <BookOpenText size={17} color="var(--muted)" />
            </div>
            <div className="dues-list">
              <div className="due-row">
                <div>
                  <div className="due-label">Customer dues</div>
                  <div className="due-subtitle">Money customers owe you</div>
                </div>
                <div className="due-value">{formatINRFromPaise(demo.receivablesPaise)}</div>
              </div>
              <div className="due-row">
                <div>
                  <div className="due-label">Supplier dues</div>
                  <div className="due-subtitle">Money you need to pay</div>
                </div>
                <div className="due-value">{formatINRFromPaise(demo.payablesPaise)}</div>
              </div>
              <div className="due-row">
                <div>
                  <div className="due-label">Monthly summary</div>
                  <div className="due-subtitle">Review income and outgoings</div>
                </div>
                <a className="small-link" href="#recent-heading">Preview <ArrowRight size={12} style={{ verticalAlign: "middle" }} /></a>
              </div>
            </div>
          </section>
        </div>

        <p className="footer-note"><Clock3 size={12} style={{ verticalAlign: "middle", marginRight: 5 }} />Built for daily business use · Data is illustrative until connected to secure storage.</p>
      </main>

      <NavigationLinks mobile />
    </div>
  );
}