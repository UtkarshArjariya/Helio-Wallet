import { useEffect, useState } from "react";
import type { PopupView } from "./popup-view.types";
import { resolvePopupView } from "./popup-view.utils";

/**
 * Returns the popup view and keeps it synced with browser history updates.
 *
 * @returns Active popup view.
 */
export function usePopupView(): PopupView {
  const [activeView, setActiveView] = useState<PopupView>(() =>
    resolvePopupView(window.location.href),
  );

  useEffect(() => {
    const syncView = () => {
      setActiveView(resolvePopupView(window.location.href));
    };

    window.addEventListener("popstate", syncView);

    return () => {
      window.removeEventListener("popstate", syncView);
    };
  }, []);

  return activeView;
}
