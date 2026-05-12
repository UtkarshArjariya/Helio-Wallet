import "./shared/runtime-polyfills";
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import App from "./App";
import "./styles.css";
import { hydrateSecretCache } from "./lib/secret-store";

const rootElement = document.getElementById("root");
if (!rootElement) {
  throw new Error("Helio popup root container is missing");
}

const root = createRoot(rootElement);

// Hydrate the session-secret cache from chrome.storage.session (in extension
// contexts) or window.sessionStorage (web) before the first render. This is
// what lets the router decide between /unlock and / on boot, and stops the
// popup from showing a "wallet locked" flash on every re-open.
hydrateSecretCache()
  .catch(() => { /* swallow — empty cache is the safe default */ })
  .finally(() => {
    root.render(
      <StrictMode>
        <App />
      </StrictMode>,
    );
  });
