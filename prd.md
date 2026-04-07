# Product Requirements Document (PRD)

## Helio Wallet

> A next-generation Solana wallet with intelligent transaction management, built as a Chrome Extension and mobile app.

---

## 1. Vision

Helio Wallet is a non-custodial Solana wallet that goes beyond basic send/receive. Its core differentiator is **Smart Transaction Adjustment** — an intelligent layer that automatically optimizes transaction amounts for rent exemption, priority fees, and account creation costs, then transparently asks the user for confirmation before proceeding.

Think Solflare's depth of Solana-native features, combined with the UX polish of Phantom, plus an AI-aware transaction engine that protects users from failed transactions and unexpected fee surprises.

---

## 2. Target Users

| Persona | Description | Primary Need |
|---|---|---|
| **Casual Holder** | Bought SOL on an exchange, wants a safe self-custody wallet | Simple setup, clear balances, easy staking |
| **Active Trader** | Swaps tokens daily on Jupiter/Raydium, speed matters | Fast transactions, token management, fee control |
| **DeFi Power User** | Interacts with multiple protocols, manages LP positions | dApp browser, transaction preview, batch operations |
| **Newcomer** | First crypto wallet ever, intimidated by jargon | Guided onboarding, plain-language explanations, guardrails |

---

## 3. Core Features

### 3.1 Wallet Management

- **Create Wallet** — Generate a new 12 or 24-word seed phrase with BIP39 standard.
- **Import Wallet** — Import via seed phrase or private key.
- **Multiple Accounts** — Derive multiple accounts from a single seed (BIP44 derivation path `m/44'/501'/n'/0'`).
- **Biometric Lock** — Fingerprint/FaceID on mobile, PIN on extension.
- **Hardware Wallet Support** — Ledger integration via USB (extension) and Bluetooth (mobile).

### 3.2 Smart Transaction Adjustment (Differentiator)

This is Helio's flagship feature. Before any transaction is submitted:

1. **Simulation** — The transaction is simulated via `simulateTransaction` to predict outcomes.
2. **Analysis** — Helio analyzes the simulation result for:
   - Will the sender's remaining SOL balance fall below rent exemption (0.00089088 SOL)?
   - Does the transaction require creating a new token account (rent cost)?
   - What priority fee is needed given current network congestion?
   - Will the transaction likely fail due to slippage or insufficient funds?
3. **Adjustment** — If issues are detected, Helio proposes an adjusted amount:
   - "You're sending 5.0 SOL, but this will leave your account below rent exemption. **Adjusted to 4.99 SOL** to keep your account active."
   - "This token transfer requires creating a new account for the recipient. **Additional 0.002 SOL** will be used for rent. Proceed?"
4. **Confirmation** — The user sees the original amount, the adjusted amount, the reason, and chooses to accept or override.

### 3.3 Token Management

- View all SPL tokens with live USD prices (via Jupiter Price API).
- Token search and add custom token by mint address.
- Hide/show tokens, auto-hide spam/dust tokens.
- Token metadata display (name, symbol, logo, decimals).

### 3.4 Send & Receive

- **Send Flow**: Select token → Enter amount → Enter/scan receiver address → Review (with Smart Adjustment) → Confirm → Status tracking.
- **Receive**: Display wallet address as text + QR code, share via system share sheet.
- Address book with labels and recent recipients.
- **Transaction History**: Full history with status, timestamp, amount, counterparty, and explorer link.

### 3.5 Staking

- Native SOL staking with validator selection.
- Validator metrics: APY, commission, uptime, total stake, decentralization score.
- Liquid staking integration (mSOL via Marinade, bSOL via BlazeStake).
- Stake/unstake/withdraw with clear epoch timing display.

### 3.6 Swap

- In-app token swaps powered by Jupiter Aggregator API.
- Route visualization showing which DEXs are used.
- Slippage tolerance configuration.
- Price impact warnings.

### 3.7 dApp Browser & Connection

- WalletAdapter-compatible connection for any Solana dApp.
- Transaction preview before signing — human-readable breakdown of what the transaction will do.
- Domain verification and phishing warnings.
- Session management — see and revoke active dApp connections.

### 3.8 Settings & Security

- Network selection (Mainnet, Devnet, custom RPC).
- Custom RPC endpoint configuration.
- Auto-lock timeout.
- Export seed phrase (with re-authentication).
- Trusted apps allowlist.

---

## 4. UI/UX Principles

1. **Clarity over cleverness** — Every screen answers "what can I do here?" within 2 seconds.
2. **Progressive disclosure** — Newcomers see simple views; power users can expand details.
3. **Transparent fees** — Never hide costs. Show network fee, priority fee, and rent in every confirmation.
4. **Error prevention over error messages** — Disable the send button if balance is insufficient instead of letting the user submit and fail.
5. **Dark mode first** — Solana ecosystem leans dark. Light mode available as an option.

### Design System

- **Colors**: Deep navy base (#0A0E1A), electric violet accent (#7C3AED), success green (#10B981), warning amber (#F59E0B), error red (#EF4444).
- **Typography**: Inter for UI text, JetBrains Mono for addresses and amounts.
- **Border radius**: 12px for cards, 8px for buttons, 20px for bottom sheets.
- **Motion**: Spring-based animations (60fps), 200ms transitions for state changes.
- **Icons**: Lucide icon set for consistency.

---

## 5. Non-Functional Requirements

| Requirement | Target |
|---|---|
| Extension popup load time | < 300ms |
| Mobile cold start | < 1.5s |
| Transaction signing | < 500ms (local) |
| Uptime (RPC fallback) | 99.9% with multi-RPC failover |
| Accessibility | WCAG 2.1 AA compliant |
| Localization | English (v1), Spanish, Hindi, Japanese (v2) |
| Platforms | Chrome (Manifest V3), iOS 16+, Android 10+ |

---

## 6. Out of Scope (v1)

- NFT gallery and management (v2).
- Multi-chain support beyond Solana (v2).
- Fiat on/off-ramp (v2).
- Social recovery / MPC key sharding (v2).
- Push notifications for transactions (v2).

---

## 7. Success Metrics

| Metric | Target (6 months post-launch) |
|---|---|
| Monthly active wallets | 50,000 |
| Transaction success rate (with Smart Adjust) | > 99.2% |
| Average transaction confirmation time | < 2s |
| User retention (30-day) | > 40% |
| Chrome Web Store rating | > 4.5 stars |
| Smart Adjust acceptance rate | > 75% of suggestions accepted |
