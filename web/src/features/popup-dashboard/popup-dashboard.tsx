import type { ActivityItem, TokenHolding } from "@helio/types";

import type { PopupDashboardSnapshot } from "./popup-dashboard.types";

interface PopupDashboardProps {
  readonly snapshot: PopupDashboardSnapshot;
  readonly onAssetSelect?: (token: TokenHolding) => void;
  readonly onOpenStaking?: () => void;
  readonly onOpenSwap?: () => void;
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

function formatSolAmount(value: string): string {
  const numericValue = Number(value.replaceAll(",", ""));

  if (!Number.isFinite(numericValue)) {
    return "0.00 SOL";
  }

  return `${numericValue.toFixed(2)} SOL`;
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

/**
 * Main extension popup dashboard with Stitch-aligned visual structure.
 *
 * @param snapshot - Dashboard state to render.
 * @returns Popup dashboard UI.
 */
export function PopupDashboard({
  onAssetSelect,
  onOpenStaking,
  onOpenSwap,
  snapshot,
  onReceive,
  onRefresh,
  onSend,
  onSettings,
}: PopupDashboardProps) {
  const solHolding = snapshot.tokenRows.find(
    (tokenRow) =>
      tokenRow.assetKind === "native-sol" || tokenRow.symbol === "SOL",
  );
  const solAmountLabel = formatSolAmount(solHolding?.amountDisplay ?? "0");

  return (
    <main className="stitch-dashboard" aria-label="Helio dashboard">
      <header className="stitch-dashboard-topbar">
        <div className="stitch-dashboard-brand">
          <img
            src="/stitch/helio-wallet-logo.png"
            alt="Helio Wallet"
            className="stitch-dashboard-logo"
          />
          <div>
            <p className="stitch-dashboard-label">Helio Wallet</p>
            <h1>{snapshot.account.label}</h1>
          </div>
        </div>
        <div className="stitch-dashboard-topbar-actions">
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

      <section className="stitch-dashboard-hero">
        <p className="stitch-dashboard-kicker">Total Portfolio Value</p>
        <p className="stitch-dashboard-balance">
          {formatUsdValue(snapshot.portfolio.totalUsdValue)}
        </p>
        <div className="stitch-dashboard-meta-row">
          <span>{solAmountLabel}</span>
          <span>{snapshot.network.endpointLabel}</span>
        </div>
      </section>

      <section className="stitch-dashboard-actions" aria-label="Quick actions">
        <ActionButton icon="↗" label="Send" onClick={onSend} />
        <ActionButton icon="↙" label="Receive" onClick={onReceive} />
        <ActionButton icon="⇄" label="Swap" onClick={onOpenSwap} />
        <ActionButton icon="◎" label="Stake" onClick={onOpenStaking} />
      </section>

      <section className="stitch-dashboard-section">
        <div className="section-header">
          <h2>Your Assets</h2>
          <button type="button" className="section-action">
            View All
          </button>
        </div>
        <ul className="stack-list">
          {snapshot.tokenRows.map((tokenRow) => {
            const tokenTone = getTokenTone(tokenRow.symbol);

            return (
              <li key={tokenRow.mintAddress}>
                <button
                  type="button"
                  className="stitch-dashboard-asset-row"
                  onClick={() => onAssetSelect?.(tokenRow)}
                >
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
                    <p className="token-value">
                      {formatUsdValue(tokenRow.usdValue)}
                    </p>
                    <p className="token-usd">{tokenRow.name}</p>
                  </div>
                  <div className="token-trend">
                    <SignedPercentage value={tokenRow.dailyChangePercentage} />
                  </div>
                </button>
              </li>
            );
          })}
        </ul>
      </section>

      <section className="stitch-dashboard-section">
        <div className="section-header">
          <h2>Recent Activity</h2>
          <button type="button" className="section-action">
            History
          </button>
        </div>
        <ul className="stack-list">
          {snapshot.activity.map((item: ActivityItem) => (
            <li key={item.id} className="activity-card">
              <div className="activity-icon">
                {item.kind === "receive" ? "↙" : "⇄"}
              </div>
              <div className="activity-main">
                <p className="activity-title">{item.title}</p>
                <p className="activity-time">
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
    </main>
  );
}
