# Requirements — User Stories & Acceptance Criteria

## Project: Helio Wallet

---

## Epic 1: Wallet Creation & Onboarding

### US-1.1 — Create a New Wallet

**As a** new user,
**I want to** create a new Solana wallet with a seed phrase,
**So that** I have self-custody of my funds.

**Acceptance Criteria:**
- User taps "Create New Wallet" and is prompted to set a password (min 8 chars, 1 uppercase, 1 number).
- System generates a BIP39 12-word mnemonic and displays it one word at a time with a "copy all" option.
- User is warned to save the phrase offline and never share it.
- User must verify by selecting 3 random words from the phrase in correct order.
- On success, wallet is created and user lands on the dashboard with a 0 SOL balance.
- Seed phrase is encrypted with the user's password and stored in secure storage (Keychain on mobile, `chrome.storage.session` on extension).

### US-1.2 — Import an Existing Wallet

**As a** user migrating from another wallet,
**I want to** import my wallet via seed phrase or private key,
**So that** I can access my existing funds in Helio.

**Acceptance Criteria:**
- User taps "Import Wallet" and chooses between "Seed Phrase" (12 or 24 words) or "Private Key" (base58).
- Input is validated in real-time — invalid words are highlighted, invalid key format shows an error.
- On valid import, the wallet loads and fetches balances from mainnet.
- If the imported wallet has multiple derived accounts with balances, user is prompted to import all or select specific ones.

### US-1.3 — Biometric Authentication

**As a** returning user,
**I want to** unlock my wallet with fingerprint or face recognition,
**So that** access is fast and secure.

**Acceptance Criteria:**
- After initial password setup, user is prompted to enable biometrics.
- On subsequent opens, biometric prompt appears first; password is the fallback.
- After 3 failed biometric attempts, system falls back to password only.
- Biometric preference is stored locally and can be toggled in Settings.

---

## Epic 2: Dashboard & Portfolio

### US-2.1 — View Portfolio Balance

**As a** wallet owner,
**I want to** see my total portfolio value and token breakdown on the dashboard,
**So that** I understand my holdings at a glance.

**Acceptance Criteria:**
- Dashboard shows total USD value at the top (sum of all tokens).
- Below, a scrollable list of tokens sorted by USD value descending.
- Each token row shows: logo, name, symbol, balance (token units), balance (USD), 24h change (%).
- Prices refresh every 30 seconds via Jupiter Price API.
- A pull-to-refresh gesture triggers an immediate refresh.
- If no tokens are held, display a friendly empty state: "Your wallet is empty. Deposit SOL to get started."

### US-2.2 — View Transaction History

**As a** user,
**I want to** see a chronological list of my past transactions,
**So that** I can track my activity.

**Acceptance Criteria:**
- Transactions are listed newest-first with infinite scroll pagination.
- Each row shows: direction icon (sent/received/swapped), token, amount, counterparty (truncated address), timestamp, status badge (confirmed/pending/failed).
- Tapping a transaction opens a detail view with full addresses, signature, fees paid, and a "View on Solscan" button.
- Failed transactions show the failure reason in plain language.

---

## Epic 3: Send Tokens

### US-3.1 — Send SOL or SPL Token

**As a** user,
**I want to** send SOL or any SPL token to another address,
**So that** I can transfer value.

**Acceptance Criteria:**
- User taps "Send" → selects a token from their holdings → enters amount → enters or scans (QR) the recipient address.
- Address is validated as a valid Solana public key (base58, 32 bytes).
- Amount input shows live USD equivalent below the token amount.
- "Max" button fills the maximum sendable amount (accounting for fees and rent).
- User proceeds to the confirmation screen.

### US-3.2 — Smart Transaction Adjustment

**As a** user sending a transaction,
**I want** the wallet to automatically detect and suggest amount adjustments,
**So that** my transaction doesn't fail or leave my account in a bad state.

**Acceptance Criteria:**
- Before the confirmation screen renders, the transaction is simulated.
- If simulation reveals issues, an adjustment card appears showing:
  - Original amount
  - Adjusted amount
  - Reason (plain language): rent exemption, token account creation, insufficient for fees
  - Breakdown of costs: network fee, priority fee, rent (if applicable)
- User can tap "Accept Adjustment" (default, highlighted) or "Send Original Amount" (secondary, with warning).
- If user accepts, the adjusted transaction is built and ready to sign.
- If simulation passes with no issues, no adjustment card appears — user goes straight to confirm.
- Adjustment logic handles: SOL rent reserve, Associated Token Account creation cost, priority fee estimation based on recent network data.

### US-3.3 — Transaction Confirmation & Status

**As a** user,
**I want to** review the final transaction details and track its status after sending,
**So that** I have confidence in what I'm signing.

**Acceptance Criteria:**
- Confirmation screen shows: token, amount (adjusted if applicable), recipient address (with label if in address book), network fee, priority fee, total cost.
- "Confirm & Send" button triggers signing and submission.
- After submission, a status screen shows: pending spinner → confirmed checkmark (with confetti animation) or failed X with reason.
- Transaction is added to history immediately in "pending" state.
- A "View on Explorer" link is available as soon as the signature is obtained.

---

## Epic 4: Receive Tokens

### US-4.1 — Display Receive Address

**As a** user,
**I want to** share my wallet address so others can send me tokens,
**So that** I can receive funds.

**Acceptance Criteria:**
- "Receive" screen shows the wallet address as a QR code and as copyable text.
- Tapping the address copies it to clipboard with a toast confirmation.
- A "Share" button invokes the system share sheet (mobile) or copies to clipboard (extension).
- Address is displayed in a monospace font with clear grouping (4-char chunks).

---

## Epic 5: Staking

### US-5.1 — Stake SOL with Validator Selection

**As a** SOL holder,
**I want to** stake my SOL to earn rewards,
**So that** my holdings grow passively.

**Acceptance Criteria:**
- Staking screen lists validators sorted by Helio's recommended ranking (balancing APY, uptime, commission, decentralization).
- Each validator shows: name, logo, APY, commission %, uptime %, total stake.
- User selects a validator → enters stake amount → confirms.
- Minimum stake amount is enforced (display minimum clearly).
- After staking, user sees their active stake, earned rewards, and epoch countdown to next reward.

### US-5.2 — Unstake SOL

**As a** staker,
**I want to** unstake my SOL when I need liquidity,
**So that** I can access my funds.

**Acceptance Criteria:**
- User taps "Unstake" on an active stake account.
- A message explains the cooldown period (~2-3 days / 1 epoch).
- User confirms, and the deactivation is submitted.
- Stake account status changes to "Deactivating" with an estimated completion time.
- Once cooldown completes, a "Withdraw" button appears to move SOL back to the main balance.

---

## Epic 6: Token Swap

### US-6.1 — Swap Tokens In-App

**As a** trader,
**I want to** swap between tokens without leaving the wallet,
**So that** I can manage my portfolio efficiently.

**Acceptance Criteria:**
- Swap screen has "From" and "To" token selectors with a flip button.
- Entering an amount in "From" auto-calculates the "To" amount via Jupiter quote.
- Route is displayed: e.g., "SOL → USDC via Raydium (best rate)".
- Price impact is shown; if > 1%, a yellow warning appears; if > 5%, a red warning.
- Slippage is configurable (default 0.5%, options: 0.1%, 0.5%, 1%, custom).
- On confirm, transaction is built, simulated, and submitted.
- Swap history is tracked separately for easy reference.

---

## Epic 7: dApp Connection

### US-7.1 — Connect to a dApp

**As a** DeFi user,
**I want to** connect Helio to Solana dApps in my browser,
**So that** I can interact with protocols.

**Acceptance Criteria:**
- When a dApp requests a wallet connection, Helio's popup opens showing: dApp name, domain, requested permissions.
- Domain is checked against a known-phishing list; if flagged, a red warning is shown.
- User can "Approve" or "Reject" the connection.
- Connected dApps appear in Settings → Connected Apps with a "Disconnect" option.

### US-7.2 — Sign Transaction from dApp

**As a** user interacting with a dApp,
**I want to** review what a transaction will do before signing,
**So that** I don't sign malicious transactions.

**Acceptance Criteria:**
- When a dApp requests a signature, Helio displays a human-readable preview: token transfers, program interactions, authority changes.
- If the transaction involves a token approval or authority change, a prominent warning is shown.
- Smart Adjustment runs on dApp transactions too — if fees will drain the account, user is warned.
- User can "Approve" or "Reject".
- Response is sent back to the dApp via the wallet standard protocol.

---

## Epic 8: Settings & Security

### US-8.1 — Configure Network & RPC

**As a** power user,
**I want to** switch between Mainnet and Devnet and set a custom RPC,
**So that** I can test or use a preferred endpoint.

**Acceptance Criteria:**
- Settings → Network shows: Mainnet-Beta (default), Devnet, Custom.
- Custom allows entering an RPC URL; the URL is validated (must respond to `getHealth`).
- Changing network refreshes all balances and transaction history.
- Current network is visible as a badge in the header at all times.

### US-8.2 — Export Seed Phrase

**As a** user,
**I want to** view my seed phrase again if I need to back it up,
**So that** I can recover my wallet elsewhere.

**Acceptance Criteria:**
- Settings → Security → Export Seed Phrase requires re-entering the wallet password.
- After authentication, the phrase is displayed with a warning banner.
- The phrase is shown for a maximum of 60 seconds, then auto-hidden.
- A "Copy" button is available with a toast confirmation.
- Screen prevents screenshots (mobile) by setting the secure flag.

### US-8.3 — Auto-Lock Timer

**As a** security-conscious user,
**I want** my wallet to auto-lock after inactivity,
**So that** no one can access it if I walk away.

**Acceptance Criteria:**
- Settings → Security → Auto-Lock offers: 1 min, 5 min (default), 15 min, 30 min, Never.
- After the chosen period of inactivity, the wallet locks and requires password/biometric to re-enter.
- Lock is immediate when the browser/app is closed.
