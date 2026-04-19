import type { ActivityItem, TokenHolding } from "@helio/types";

import type { PopupDashboardSnapshot } from "./popup-dashboard.types";

interface PopupDashboardProps {
  readonly snapshot: PopupDashboardSnapshot;
  readonly onReceive?: () => void;
  readonly onRefresh?: () => void;
  readonly onSend?: () => void;
  readonly onSettings?: () => void;
}

function formatUsdValue(value: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 2,
  }).format(value);
}

function formatChangeLabel(value: number): string {
  const prefix = value >= 0 ? "+" : "";
  return `${prefix}${value.toFixed(2)}%`;
}

function formatTimestampLabel(timestampIso: string): string {
  const timestamp = new Date(timestampIso);
  return timestamp.toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
  });
}

function getTokenTone(symbol: string): "violet" | "cyan" | "amber" {
  if (symbol === "SOL") {
    return "violet";
  }
  if (symbol === "USDC") {
    return "cyan";
  }
  return "amber";
}

function SignedPercentage({ value }: { readonly value: number }) {
  return (
    <span className={value >= 0 ? "tone-positive" : "tone-negative"}>
      {formatChangeLabel(value)}
    </span>
  );
}

function ActionButton({
  icon,
  label,
  isDisabled = false,
  onClick,
}: {
  readonly icon: string;
  readonly isDisabled?: boolean;
  readonly label: string;
  readonly onClick?: () => void;
}) {
  return (
    <button
      type="button"
      className="action-button"
      disabled={isDisabled}
      onClick={onClick}
    >
      <span className="action-icon" aria-hidden="true">
        {icon}
      </span>
      <span className="action-label">{label}</span>
    </button>
  );
}

function DashboardTopBar({
  onRefresh,
  onSettings,
  snapshot,
}: {
  readonly onRefresh?: () => void;
  readonly onSettings?: () => void;
  readonly snapshot: PopupDashboardSnapshot;
}) {
  return (
    <header className="top-bar">
      <div className="top-bar-identity">
        <div className="avatar-orb">◈</div>
        <div>
          <h1>{snapshot.account.label}</h1>
          <div className="network-pill">
            <span className="network-dot" aria-hidden="true" />
            <span>{snapshot.network.endpointLabel}</span>
          </div>
        </div>
      </div>
      <div className="top-bar-actions">
        <button
          type="button"
          className="icon-button"
          aria-label="Refresh dashboard"
          onClick={onRefresh}
        >
          ↻
        </button>
        <button
          type="button"
          className="icon-button"
          aria-label="Settings"
          onClick={onSettings}
        >
          ✦
        </button>
      </div>
    </header>
  );
}

function BalancePanel({
  portfolio,
}: {
  readonly portfolio: PopupDashboardSnapshot["portfolio"];
}) {
  return (
    <section className="balance-panel">
      <div className="balance-halo balance-halo-primary" />
      <div className="balance-halo balance-halo-secondary" />
      <div className="balance-panel-content">
        <p className="section-kicker">Total Balance</p>
        <p className="balance-value">
          {formatUsdValue(portfolio.totalUsdValue)}
        </p>
        <div className="metric-chip">
          <span className="metric-chip-icon" aria-hidden="true">
            ↗
          </span>
          <span>{formatChangeLabel(portfolio.dailyChangePercentage)}</span>
        </div>
      </div>
    </section>
  );
}

function SectionHeader({
  title,
  actionLabel,
}: {
  readonly title: string;
  readonly actionLabel: string;
}) {
  return (
    <div className="section-header">
      <h2>{title}</h2>
      <button type="button" className="section-action">
        {actionLabel}
      </button>
    </div>
  );
}

function TokenRowCard({ tokenRow }: { readonly tokenRow: TokenHolding }) {
  const tokenTone = getTokenTone(tokenRow.symbol);

  return (
    <li className="tonal-row asset-row">
      <div className="row-leading">
        <div className={`token-badge token-badge-${tokenTone}`}>
          <span>{tokenRow.symbol.slice(0, 1)}</span>
        </div>
        <div className="token-main">
          <p className="token-symbol">{tokenRow.symbol}</p>
          <p className="token-name">{tokenRow.amountDisplay}</p>
        </div>
      </div>
      <div className="token-balance">
        <p className="token-value">{formatUsdValue(tokenRow.usdValue)}</p>
        <p className="token-usd">{tokenRow.name}</p>
      </div>
      <div className="token-trend">
        <SignedPercentage value={tokenRow.dailyChangePercentage} />
      </div>
    </li>
  );
}

function AssetSection({
  tokenRows,
}: {
  readonly tokenRows: readonly TokenHolding[];
}) {
  return (
    <section className="content-section">
      <SectionHeader title="Your Assets" actionLabel="View All" />
      <ul className="stack-list">
        {tokenRows.map((tokenRow) => (
          <TokenRowCard key={tokenRow.mintAddress} tokenRow={tokenRow} />
        ))}
      </ul>
    </section>
  );
}

function ActivityRow({ item }: { readonly item: ActivityItem }) {
  return (
    <li className="activity-card">
      <div className="activity-icon">{item.kind === "receive" ? "↙" : "⇄"}</div>
      <div className="activity-main">
        <p className="activity-title">{item.title}</p>
        <p className="activity-time">
          {formatTimestampLabel(item.timestampIso)}
        </p>
      </div>
      <span
        className={item.status === "failed" ? "tone-negative" : "tone-positive"}
      >
        {item.status}
      </span>
    </li>
  );
}

function ActivitySection({
  items,
}: {
  readonly items: readonly ActivityItem[];
}) {
  return (
    <section className="content-section">
      <SectionHeader title="Recent Activity" actionLabel="History" />
      <ul className="stack-list">
        {items.map((item) => (
          <ActivityRow key={item.id} item={item} />
        ))}
      </ul>
    </section>
  );
}

function BottomNav() {
  return (
    <nav className="bottom-nav" aria-label="Primary navigation">
      <button type="button" className="nav-item nav-item-active">
        <span aria-hidden="true">◉</span>
        <span className="sr-only">Vault</span>
      </button>
      <button type="button" className="nav-item">
        <span aria-hidden="true">⇄</span>
        <span className="sr-only">Swap</span>
      </button>
      <button type="button" className="nav-item">
        <span aria-hidden="true">◷</span>
        <span className="sr-only">History</span>
      </button>
      <button type="button" className="nav-item">
        <span aria-hidden="true">◎</span>
        <span className="sr-only">Profile</span>
      </button>
    </nav>
  );
}

/**
 * Main extension popup dashboard with wallet overview and token rows.
 *
 * @param snapshot - Dashboard state to render.
 * @returns Popup dashboard UI.
 */
export function PopupDashboard({
  snapshot,
  onReceive,
  onRefresh,
  onSend,
  onSettings,
}: PopupDashboardProps) {
  return (
    <main
      className="screen-layout dashboard-screen"
      aria-label="Helio dashboard"
    >
      <DashboardTopBar
        snapshot={snapshot}
        onRefresh={onRefresh}
        onSettings={onSettings}
      />
      <BalancePanel portfolio={snapshot.portfolio} />
      <section className="action-row" aria-label="Quick actions">
        <ActionButton icon="↗" label="Send" onClick={onSend} />
        <ActionButton icon="↙" label="Receive" onClick={onReceive} />
        <ActionButton icon="⇄" label="Swap" isDisabled />
        <ActionButton icon="◎" label="Stake" isDisabled />
      </section>
      <AssetSection tokenRows={snapshot.tokenRows} />
      <ActivitySection items={snapshot.activity} />
      <BottomNav />
    </main>
  );
}
