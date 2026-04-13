import type { ActivityItem, TokenHolding } from "@helio/types";

import type { PopupDashboardSnapshot } from "./popup-dashboard.types";

interface PopupDashboardProps {
  readonly snapshot: PopupDashboardSnapshot;
}

function SignedPercentage({ value }: { readonly value: number }) {
  const toneClass = value >= 0 ? "tone-positive" : "tone-negative";
  const prefix = value >= 0 ? "+" : "";

  return <span className={toneClass}>{`${prefix}${value.toFixed(2)}%`}</span>;
}

function formatUsdValue(value: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 2,
  }).format(value);
}

function formatTimestampLabel(timestampIso: string): string {
  const timestamp = new Date(timestampIso);
  return timestamp.toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
  });
}

function TokenRowCard({ tokenRow }: { readonly tokenRow: TokenHolding }) {
  return (
    <li className="card token-row">
      <div className="token-main">
        <p className="token-symbol">{tokenRow.symbol}</p>
        <p className="token-name">{tokenRow.name}</p>
      </div>
      <div className="token-balance">
        <p className="token-value">{tokenRow.amountDisplay}</p>
        <p className="token-usd">{formatUsdValue(tokenRow.usdValue)}</p>
      </div>
      <SignedPercentage value={tokenRow.dailyChangePercentage} />
    </li>
  );
}

function DashboardHeader({
  snapshot,
}: {
  readonly snapshot: PopupDashboardSnapshot;
}) {
  return (
    <header className="card hero-card">
      <p className="eyebrow">Helio Vault</p>
      <h1>{snapshot.account.label}</h1>
      <p className="wallet-address">{snapshot.account.shortAddress}</p>
      <div className="hero-metrics">
        <div>
          <p className="metric-label">Portfolio</p>
          <p className="metric-value">
            {formatUsdValue(snapshot.portfolio.totalUsdValue)}
          </p>
        </div>
        <div>
          <p className="metric-label">24h</p>
          <p className="metric-value">
            <SignedPercentage
              value={snapshot.portfolio.dailyChangePercentage}
            />
          </p>
        </div>
      </div>
    </header>
  );
}

function QuickActionsCard() {
  return (
    <section className="card quick-actions" aria-label="Quick actions">
      <button type="button">Send</button>
      <button type="button">Receive</button>
      <button type="button">Swap</button>
      <button type="button">Stake</button>
    </section>
  );
}

function SessionStatusCard({
  snapshot,
}: {
  readonly snapshot: PopupDashboardSnapshot;
}) {
  return (
    <section className="card status-row" aria-label="Session details">
      <p>{snapshot.network.endpointLabel}</p>
      <p>
        {snapshot.network.isHealthy ? "Healthy" : "Degraded"}
        {snapshot.network.averageLatencyMs === null
          ? ""
          : ` • ${snapshot.network.averageLatencyMs}ms`}
      </p>
    </section>
  );
}

function AssetSection({
  tokenRows,
}: {
  readonly tokenRows: readonly TokenHolding[];
}) {
  return (
    <section className="asset-section">
      <div className="section-header">
        <h2>Assets</h2>
        <button type="button" className="ghost-button">
          Manage
        </button>
      </div>
      <ul className="token-list">
        {tokenRows.map((tokenRow) => (
          <TokenRowCard key={tokenRow.mintAddress} tokenRow={tokenRow} />
        ))}
      </ul>
    </section>
  );
}

function ActivitySection({
  items,
}: {
  readonly items: readonly ActivityItem[];
}) {
  return (
    <section className="asset-section">
      <div className="section-header">
        <h2>Recent Activity</h2>
        <button type="button" className="ghost-button">
          History
        </button>
      </div>
      <ul className="token-list">
        {items.map((item) => (
          <li key={item.id} className="card activity-row">
            <div className="token-main">
              <p className="token-symbol">{item.title}</p>
              <p className="token-name">{item.subtitle}</p>
            </div>
            <div className="token-balance">
              <p className="token-value">{item.amountDisplay}</p>
              <p className="token-usd">
                {formatTimestampLabel(item.timestampIso)}
              </p>
            </div>
            <span
              className={
                item.status === "failed" ? "tone-negative" : "tone-positive"
              }
            >
              {item.status}
            </span>
          </li>
        ))}
      </ul>
    </section>
  );
}

/**
 * Main extension popup dashboard with wallet overview and token rows.
 *
 * @param snapshot - Dashboard state to render.
 * @returns Popup dashboard UI.
 */
export function PopupDashboard({ snapshot }: PopupDashboardProps) {
  return (
    <main className="screen-layout" aria-label="Helio dashboard">
      <DashboardHeader snapshot={snapshot} />
      <QuickActionsCard />
      <SessionStatusCard snapshot={snapshot} />
      <AssetSection tokenRows={snapshot.tokenRows} />
      <ActivitySection items={snapshot.activity} />
    </main>
  );
}
