import type { ReactNode } from "react";
import { DappApproval } from "../features/dapp-approval/dapp-approval";
import { PopupDashboard } from "../features/popup-dashboard/popup-dashboard";
import { APPROVAL_REQUEST, DASHBOARD_SNAPSHOT } from "./mock-data";
import { usePopupView } from "./use-popup-view.hooks";

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

  if (view === "approval") {
    return (
      <ScreenContainer>
        <DappApproval request={APPROVAL_REQUEST} />
      </ScreenContainer>
    );
  }

  return (
    <ScreenContainer>
      <PopupDashboard snapshot={DASHBOARD_SNAPSHOT} />
    </ScreenContainer>
  );
}
