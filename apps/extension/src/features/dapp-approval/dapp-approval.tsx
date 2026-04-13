import type { DappApprovalRequest } from "./dapp-approval.types";

interface DappApprovalProps {
  readonly request: DappApprovalRequest;
}

function DetailList({
  title,
  items,
  muted,
}: {
  readonly title: string;
  readonly items: readonly string[];
  readonly muted?: boolean;
}) {
  return (
    <section className="card">
      <h2>{title}</h2>
      <ul className="bullet-list">
        {items.map((item) => (
          <li key={item} className={muted ? "muted" : undefined}>
            {item}
          </li>
        ))}
      </ul>
    </section>
  );
}

function ApprovalHeader({
  request,
}: {
  readonly request: DappApprovalRequest;
}) {
  const trustLabel =
    request.dapp.trustLevel === "verified"
      ? "Verified"
      : request.dapp.trustLevel === "flagged"
        ? "Flagged"
        : "Unknown";

  return (
    <header className="card hero-card">
      <p className="eyebrow">Connection request</p>
      <h1>{request.dapp.name}</h1>
      <p className="wallet-address">{request.dapp.origin}</p>
      <div className="hero-metrics">
        <div>
          <p className="metric-label">Trust</p>
          <p className="metric-value">{trustLabel}</p>
        </div>
        <div>
          <p className="metric-label">Review</p>
          <p className="metric-value">
            {request.sendReview === null
              ? "Connect only"
              : request.sendReview.review.status}
          </p>
        </div>
      </div>
    </header>
  );
}

function ApprovalActions() {
  return (
    <footer className="approval-footer">
      <button type="button" className="secondary-action">
        Reject
      </button>
      <button type="button" className="primary-action">
        Approve
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
export function DappApproval({ request }: DappApprovalProps) {
  const smartAdjustmentItems =
    request.sendReview === null
      ? ["No transaction payload attached to this permission request."]
      : request.sendReview.review.reasons.map((reason) => reason.message);

  return (
    <main className="screen-layout" aria-label="dApp approval">
      <ApprovalHeader request={request} />
      <DetailList title="Summary" items={request.summaryLines} />
      <DetailList
        title="Warnings"
        items={request.warnings.map(
          (warning) => `${warning.title}: ${warning.message}`,
        )}
        muted
      />
      <DetailList title="Smart Adjustment" items={smartAdjustmentItems} />
      <ApprovalActions />
    </main>
  );
}
