## RPC Client

This module is the extension-facing Solana access layer.

It owns:

- RPC endpoint resolution
- network health checks
- dashboard balance loading
- native SOL transaction review
- mandatory pre-send simulation

UI code should not call `@solana/web3.js` directly.
