import type { WalletRuntimeSnapshot } from "@helio/types";
import { type ReactNode, useEffect, useState } from "react";
import { createExtensionClient } from "../extension-runtime/extension-client";
import { DappApproval } from "../features/dapp-approval/dapp-approval";
import type { DappApprovalRequest } from "../features/dapp-approval/dapp-approval.types";
import { createApprovalRequestFromPendingRequest } from "../features/dapp-approval/dapp-approval.utils";
import { WalletWorkflow } from "../features/wallet-workflow/wallet-workflow";
import { APPROVAL_REQUEST } from "./mock-data";
import { usePopupView } from "./use-popup-view.hooks";

const extensionClient = createExtensionClient();

function ScreenContainer({ children }: { readonly children: ReactNode }) {
  return <div className="popup-root">{children}</div>;
}

/**
 * Top-level extension shell for popup dashboard and approval mode.
 *
 * @returns App root UI.
 */
export function App() {
  const view = usePopupView();
  const [pendingApprovalRequest, setPendingApprovalRequest] =
    useState<DappApprovalRequest | null>(null);
  const [runtimeSnapshot, setRuntimeSnapshot] = useState(
    null as WalletRuntimeSnapshot | null,
  );

  useEffect(() => {
    let isCancelled = false;

    Promise.all([
      extensionClient.getPendingDappRequest(),
      extensionClient.getRuntimeSnapshot(),
    ])
      .then(([pendingRequest, nextRuntimeSnapshot]) => {
        if (isCancelled) {
          return;
        }

        setPendingApprovalRequest(
          pendingRequest === null
            ? null
            : createApprovalRequestFromPendingRequest(pendingRequest),
        );
        setRuntimeSnapshot(nextRuntimeSnapshot);
      })
      .catch(() => {
        if (!isCancelled) {
          setPendingApprovalRequest(null);
          setRuntimeSnapshot(null);
        }
      });

    return () => {
      isCancelled = true;
    };
  }, []);

  const closeApprovalView = () => {
    window.history.replaceState({}, "", "/index.html");
    window.dispatchEvent(new PopStateEvent("popstate"));
    setPendingApprovalRequest(null);
  };

  const approvePendingRequest = async () => {
    if (pendingApprovalRequest === null) {
      return;
    }

    await extensionClient.approveDappRequest({
      requestId: pendingApprovalRequest.requestId,
    });
    closeApprovalView();
  };

  const rejectPendingRequest = async () => {
    if (pendingApprovalRequest === null) {
      return;
    }

    await extensionClient.rejectDappRequest({
      requestId: pendingApprovalRequest.requestId,
    });
    closeApprovalView();
  };

  const shouldShowPendingApproval =
    pendingApprovalRequest !== null &&
    (pendingApprovalRequest.kind === "connect" ||
      runtimeSnapshot?.wallet.lockState === "unlocked");

  if (shouldShowPendingApproval && pendingApprovalRequest !== null) {
    return (
      <ScreenContainer>
        <DappApproval
          request={pendingApprovalRequest}
          onApprove={() => void approvePendingRequest()}
          onReject={() => void rejectPendingRequest()}
        />
      </ScreenContainer>
    );
  }

  if (view === "approval") {
    return (
      <ScreenContainer>
        <DappApproval request={APPROVAL_REQUEST} />
      </ScreenContainer>
    );
  }

  return (
    <ScreenContainer>
      <WalletWorkflow onRuntimeSnapshotChange={setRuntimeSnapshot} />
    </ScreenContainer>
  );
}
