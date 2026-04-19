## Extension Runtime

This module is the extension backend surface for the popup:

- encrypted vault persistence
- session-only unlocked key material
- popup-to-background request handling
- local dev fallback when `chrome.runtime` is unavailable

The popup should only talk to this module, never directly to RPC or storage.
