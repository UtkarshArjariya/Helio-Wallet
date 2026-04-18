import type { PopupView } from "./popup-view.types";

const APPROVAL_VIEW = "approval";
const VIEW_QUERY_KEY = "view";

/**
 * Resolves popup mode from URL query params or hash.
 *
 * @param locationHref - Full URL string to parse.
 * @returns Popup view for the extension shell.
 */
export function resolvePopupView(locationHref: string): PopupView {
  const currentUrl = new URL(locationHref);
  const queryMode = currentUrl.searchParams.get(VIEW_QUERY_KEY);
  const hashMode = currentUrl.hash.replace("#", "").trim();

  if (queryMode === APPROVAL_VIEW || hashMode === APPROVAL_VIEW) {
    return "approval";
  }

  return "dashboard";
}
