# User Stories — Index

First-pass scope draft for the **Helio Wallet** Solana Chrome extension (Manifest V3, non-custodial).

> **Note:** This file is a concise one-line-per-story index. The full epics, narratives, and acceptance criteria live in [`requirements.md`](../requirements.md). Story IDs (`US-x.y`) map 1:1 to that document.

> 📱 Mobile app: developed as a separate repo — see `/mobile`. These stories are **extension-only**.

**Vision:** the Solana wallet that thinks before it sends, and earns while you sleep — anchored by two headline differentiators, **Smart Transaction Adjustment** and **AutoYield**. Both are on the roadmap; the Status labels below show where each story actually stands today.

## Status legend

| Token | Meaning |
|---|---|
| ✅ Built | Implemented AND wired into the shipping extension |
| ⚠️ Partial | Partly implemented, has real gaps |
| 🟠 Scaffolded | Code/UI exists but is NOT wired into the live app (dead/mock), or is a placeholder stub |
| ❌ Planned | Not implemented yet |

---

## Epic 1 — Wallet Creation & Onboarding

- **US-1.1 — Create a New Wallet** — generate a BIP39 mnemonic, set a password, verify the phrase, land on the dashboard. — Status: ✅ Built
- **US-1.2 — Import an Existing Wallet** — import via seed phrase or base58 private key with real-time validation. — Status: ✅ Built _(runs on Devnet by default, not mainnet as the original AC implies)_
- **US-1.3 — Biometric Authentication** — unlock fast via password; encrypted vault unlock/lock. — Status: ⚠️ Partial _(password unlock + auto-lock built; biometrics are a mobile concern, not in the extension)_

## Epic 2 — Dashboard & Portfolio

- **US-2.1 — View Portfolio Balance** — total value + token list, 30s refresh, Jupiter price/metadata. — Status: ✅ Built
- **US-2.2 — View Transaction History** — chronological activity list with per-transaction detail. — Status: ✅ Built

## Epic 3 — Send Tokens

- **US-3.1 — Send SOL or SPL Token** — pick token, enter amount + recipient, validated send (with on-chain personal-vault sweep via the Anchor program on Devnet). — Status: ✅ Built
- **US-3.2 — Smart Transaction Adjustment** — simulate, detect rent/ATA/fee issues, suggest an adjusted amount. — Status: 🟠 Scaffolded _(engine real + unit-tested in `@helio/solana`, but the live send never calls it — no adjustment card ships)_
- **US-3.3 — Transaction Confirmation & Status** — review final details, sign, track pending → confirmed/failed. — Status: ⚠️ Partial _(confirm + submit + history built; mandatory pre-send simulation is not in the live path)_

## Epic 4 — Receive Tokens

- **US-4.1 — Display Receive Address** — show address as QR + copyable text, share/copy. — Status: ⚠️ Partial _(copy/share works; the QR code is decorative and encodes nothing; buy/transfer buttons are non-functional)_

## Epic 5 — Staking

- **US-5.1 — Stake SOL with Validator Selection** — compare validators and stake. — Status: 🟠 Scaffolded _("Coming soon" placeholder)_
- **US-5.2 — Unstake SOL** — deactivate, cooldown, withdraw. — Status: 🟠 Scaffolded _("Coming soon" placeholder)_

## Epic 6 — Token Swap

- **US-6.1 — Swap Tokens In-App** — Jupiter-routed swap with price impact + slippage controls. — Status: 🟠 Scaffolded _(`SwapScreen` computes output from cached price ratios; the button has no handler; no real Jupiter quote/execution)_

## Epic 7 — dApp Connection

- **US-7.1 — Connect to a dApp** — Wallet Standard connect with domain/phishing check and approval UI. — Status: 🟠 Scaffolded _(Wallet-Standard backend exists, but the approval UI lives in the orphaned tree, so requests hang to the 120s timeout — approval UI must be wired)_
- **US-7.2 — Sign Transaction from dApp** — human-readable transaction preview before signing. — Status: 🟠 Scaffolded _(transaction review engine exists; same unwired approval-UI gap; phishing detection is a local HTTPS/localhost stub, Blowfish not integrated)_

## Epic 8 — Settings & Security

- **US-8.1 — Configure Network & RPC** — switch Mainnet/Devnet, set a custom RPC. — Status: ⚠️ Partial _(network switch built; custom RPC URLs are not scheme-validated; a known UI bug mislabels Devnet as "Mainnet")_
- **US-8.2 — Export Seed Phrase** — re-auth gated recovery-phrase and private-key export. — Status: ✅ Built
- **US-8.3 — Auto-Lock Timer** — lock after inactivity, configurable interval. — Status: ✅ Built

---

## Headline differentiators (cross-epic)

- **Smart Transaction Adjustment** (see US-3.2 / US-7.2) — Status: 🟠 Scaffolded.
- **AutoYield — on-chain vault** — init/pause/resume/config/sweep/withdraw on the Anchor program. — Status: ⚠️ Partial _(Devnet only; `deployed` and `rewards` are always 0; APY is hardcoded)_
- **AutoYield — DeFi deploy + Jupiter auto-convert** — CPI into Kamino/Meteora/MarginFi plus auto-swap. — Status: ❌ Planned _(no DeFi CPI or swap instruction; `SwapQuoteClient` interface has no implementation)_

> These differentiators do not yet ship as user-facing features. Any "99%+ success", ">99.2% tx success", "8.3% APY (Kamino)", or "50k MAU" figures are **targets/goals**, not current facts.

---

For full acceptance criteria, edge cases, and epic narratives, see [`requirements.md`](../requirements.md).
