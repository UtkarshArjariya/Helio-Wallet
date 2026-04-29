import type { DappApprovalRequest } from "./dapp-approval.types";

interface DappApprovalProps {
  readonly request: DappApprovalRequest;
  readonly onApprove?: () => void;
  readonly onReject?: () => void;
}

function getHostname(origin: string): string {
  try {
    return new URL(origin).hostname;
  } catch {
    return origin;
  }
}

function formatLamportsAsSol(lamports: number): string {
  return `${(lamports / 1_000_000_000).toFixed(6)} SOL`;
}

function ApprovalTopBar({ title }: { readonly title: string }) {
  return (
    <header className="approval-top-bar">
      <div className="approval-title-row">
        <div className="approval-badge">◈</div>
        <h1>{title}</h1>
      </div>
      <span className="approval-verified" aria-hidden="true">
        ⌾
      </span>
    </header>
  );
}

function DappIdentity({ request }: { readonly request: DappApprovalRequest }) {
  const trustLabel =
    request.dapp.trustLevel === "verified"
      ? "Verified"
      : request.dapp.trustLevel === "flagged"
        ? "Flagged"
        : "Unknown";

  return (
    <section className="approval-identity">
      <div className="approval-logo">{request.dapp.name.slice(0, 1)}</div>
      <h2>{request.dapp.name}</h2>
      <p>{getHostname(request.dapp.origin)}</p>
      <div className="trust-chip">{trustLabel}</div>
    </section>
  );
}

function WarningAlert({
  title,
  message,
}: {
  readonly title: string;
  readonly message: string;
}) {
  return (
    <section className="approval-alert">
      <span className="approval-alert-icon" aria-hidden="true">
        !
      </span>
      <div>
        <p className="approval-alert-title">{title}</p>
        <p className="approval-alert-text">{message}</p>
      </div>
    </section>
  );
}

function ChangeRow({
  label,
  value,
  tone = "default",
}: {
  readonly label: string;
  readonly value: string;
  readonly tone?: "default" | "accent";
}) {
  return (
    <div className="approval-change-row">
      <div>
        <p className="approval-change-label">{label}</p>
        <p
          className={
            tone === "accent"
              ? "approval-change-value-accent"
              : "approval-change-value"
          }
        >
          {value}
        </p>
      </div>
    </div>
  );
}

function EstimatedChanges({
  request,
  sectionLabel,
}: {
  readonly request: DappApprovalRequest;
  readonly sectionLabel: string;
}) {
  if (request.kind !== "sign-transaction") {
    return (
      <section className="approval-section">
        <p className="section-kicker">{sectionLabel}</p>
        <div className="approval-surface">
          {request.summaryLines.map((summaryLine) => (
            <ChangeRow key={summaryLine} label="Request" value={summaryLine} />
          ))}
        </div>
      </section>
    );
  }

  const reviewModel = request.sendReview;

  if (reviewModel === null) {
    return (
      <section className="approval-section">
        <p className="section-kicker">{sectionLabel}</p>
        <div className="approval-surface">
          {request.summaryLines.map((summaryLine) => (
            <ChangeRow key={summaryLine} label="Request" value={summaryLine} />
          ))}
        </div>
      </section>
    );
  }

  return (
    <section className="approval-section">
      <p className="section-kicker">{sectionLabel}</p>
      <div className="approval-surface">
        <ChangeRow
          label="You send"
          value={reviewModel.review.originalAmount.amountDisplay}
        />
        <ChangeRow
          label="To"
          value={
            reviewModel.recipient.label ?? reviewModel.recipient.shortAddress
          }
          tone="accent"
        />
      </div>
    </section>
  );
}

function NetworkFees({ request }: { readonly request: DappApprovalRequest }) {
  if (request.kind !== "sign-transaction" || request.sendReview === null) {
    return null;
  }

  return (
    <section className="approval-fee-row">
      <span>Network Fee</span>
      <span>
        {formatLamportsAsSol(
          request.sendReview.review.feeBreakdown.networkFeeLamports,
        )}
      </span>
    </section>
  );
}

function SmartAdjustment({
  request,
}: {
  readonly request: DappApprovalRequest;
}) {
  const adjustmentReason =
    request.sendReview?.review.reasons[0]?.message ??
    "Helio is reviewing rent reserve, fees, and transaction safety before signature.";

  return (
    <section className="smart-adjust-card">
      <div className="smart-adjust-header">
        <div>
          <p className="smart-adjust-title">Smart Adjustment</p>
          <p className="smart-adjust-copy">{adjustmentReason}</p>
        </div>
        <div className="smart-adjust-toggle" aria-hidden="true">
          <div className="smart-adjust-thumb" />
        </div>
      </div>
      <ul className="approval-summary-list">
        {request.summaryLines.map((summaryLine) => (
          <li key={summaryLine}>{summaryLine}</li>
        ))}
      </ul>
    </section>
  );
}

function MessagePreview({
  request,
}: {
  readonly request: DappApprovalRequest;
}) {
  if (request.kind !== "sign-message" || request.messagePreview === null) {
    return null;
  }

  return (
    <section className="approval-section">
      <p className="section-kicker">Message Preview</p>
      <div className="approval-surface">
        <ChangeRow label="Message" value={request.messagePreview} />
      </div>
    </section>
  );
}

function ApprovalActions({
  approveLabel,
  rejectLabel,
  onApprove,
  onReject,
}: {
  readonly approveLabel: string;
  readonly rejectLabel: string;
  readonly onApprove?: () => void;
  readonly onReject?: () => void;
}) {
  return (
    <footer className="approval-actions">
      <button
        type="button"
        className="approval-button approval-button-secondary"
        onClick={onReject}
      >
        {rejectLabel}
      </button>
      <button
        type="button"
        className="approval-button approval-button-primary"
        onClick={onApprove}
      >
        {approveLabel}
      </button>
    </footer>
  );
}

/**
 * dApp approval view used for high-clarity permission review before signing.
 *
 * @param request - Structured request content shown to the user.
 * @returns dApp approval surface for popup flows.
 */
export function DappApproval({
  request,
  onApprove,
  onReject,
}: DappApprovalProps) {
  const highestWarning = request.warnings[0] ?? null;
  const sectionLabel =
    request.kind === "connect" ? "Permissions" : "Estimated Changes";
  const title =
    request.kind === "connect"
      ? "Connection Request"
      : request.kind === "sign-message"
        ? "Message Signature Request"
        : "Transaction Signature Request";
  const approveLabel =
    request.kind === "connect"
      ? "Connect"
      : request.kind === "sign-message"
        ? "Sign Message"
        : "Sign Transaction";
  const rejectLabel = request.kind === "connect" ? "Reject" : "Cancel";

  return (
    <main className="screen-layout approval-screen" aria-label="dApp approval">
      <ApprovalTopBar title={title} />
      <DappIdentity request={request} />
      {highestWarning ? (
        <WarningAlert
          title={highestWarning.title}
          message={highestWarning.message}
        />
      ) : null}
      <EstimatedChanges request={request} sectionLabel={sectionLabel} />
      <MessagePreview request={request} />
      <NetworkFees request={request} />
      {request.kind === "sign-transaction" ? (
        <SmartAdjustment request={request} />
      ) : null}
      <ApprovalActions
        approveLabel={approveLabel}
        rejectLabel={rejectLabel}
        onApprove={onApprove}
        onReject={onReject}
      />
    </main>
  );
}
