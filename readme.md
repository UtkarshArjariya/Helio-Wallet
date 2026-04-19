<h1 align="center">
  <br>
  <img src="https://img.shields.io/badge/☀️-HELIO_WALLET-7C3AED?style=for-the-badge&labelColor=0A0E1A" alt="Helio Wallet" height="60"/>
  <br><br>
  Helio Wallet
  <br>
</h1>

<p align="center">
  <strong>The Solana wallet that thinks before it sends — and earns while you sleep.</strong>
</p>

<p align="center">
  <img src="https://img.shields.io/badge/Solana-Native-9945FF?style=flat-square&logo=solana&logoColor=white"/>
  <img src="https://img.shields.io/badge/Chrome-Extension-4285F4?style=flat-square&logo=googlechrome&logoColor=white"/>
  <img src="https://img.shields.io/badge/License-MIT-10B981?style=flat-square"/>
</p>

<p align="center">
  <img src="https://img.shields.io/badge/TypeScript-Strict-3178C6?style=flat-square&logo=typescript&logoColor=white"/>
  <img src="https://img.shields.io/badge/React-18-61DAFB?style=flat-square&logo=react&logoColor=black"/>
  <img src="https://img.shields.io/badge/Turborepo-Monorepo-EF4444?style=flat-square&logo=turborepo&logoColor=white"/>
</p>

---

<br>

## What is Helio?

Helio is a non-custodial Solana wallet available as a **Chrome Extension**. It does everything you'd expect from a modern wallet — send, receive, swap, stake — but with two major differences:

> **Smart Transaction Adjustment** — Helio simulates every transaction before you send it, detects potential issues (insufficient rent, missing token accounts, fee miscalculations), and suggests an adjusted amount so your transaction _just works_.

> **AutoYield** — Every time you transact, Helio silently sweeps a micro-amount into a reserve, auto-converts it to your preferred stablecoin, and deploys it into leading Solana DeFi protocols via a user-owned PDA — completely non-custodial.

No more failed transactions. No more idle stablecoins sitting still. No more mystery fees.

<br>

---

## ☀️ Why Helio?

<table>
<tr>
<td width="25%" align="center">

### 🧠 Smart Adjust

Every transaction is simulated first. If something could go wrong — rent, fees, slippage — Helio catches it and suggests a fix **before** you send.

</td>
<td width="25%" align="center">

### 📈 AutoYield

Every send quietly sets aside a micro-amount that compounds in DeFi. Your wallet earns yield in the background — automatically, non-custodially.

</td>
<td width="25%" align="center">

### ⚡ Solana Native

Built exclusively for Solana. Native staking, Jupiter-powered swaps, SPL token management, dApp connections — all optimized for Solana's speed.

</td>
<td width="25%" align="center">

### 🛡️ Security First

Non-custodial. Biometric lock. Ledger support. Transaction previews with phishing detection. Your keys never leave your device.

</td>
</tr>
</table>

<br>

---

## Using Helio

### 🏠 Dashboard

When you open Helio, the dashboard is your home base. At the top you'll see your **total portfolio value in USD**, followed by a list of all your tokens sorted by value. Each token shows its balance, USD equivalent, and 24-hour price change. The four action buttons — **Send**, **Receive**, **Swap**, **Stake** — sit right below the balance for quick access.

If AutoYield is enabled, an **AutoYield card** appears above your token list showing your total saved, current APY, and accrued yield — all at a glance.

Prices refresh automatically every 30 seconds. Pull down to force a refresh.

<br>

### 📤 Sending Tokens

Tap **Send** on the dashboard. You'll walk through four simple steps:

1. **Pick a token** — scroll or search your holdings.
2. **Enter the amount** — type the amount or tap **MAX** to send everything (Helio automatically reserves enough for fees and rent). A live USD conversion appears below.
3. **Enter the recipient** — paste an address, scan a QR code, or pick from your address book.
4. **Review** — this is where the magic happens.

If Helio's simulation detects any issue, a **Smart Adjustment card** slides up:

```
  ⚡ Smart Adjustment
  ─────────────────────────────
  Original:   5.000 SOL
  Adjusted:   4.991 SOL

  Reason: Reserves 0.009 SOL for:
    • Rent exemption   0.00089 SOL
    • Network fee      0.00005 SOL
    • Priority fee     0.00806 SOL

  [ Accept Adjustment ]  [ Send Original ]
```

Tap **Accept** (recommended) and confirm. That's it — your transaction goes through cleanly.

If AutoYield is enabled, a small sweep indicator confirms the micro-amount queued for your reserve — this never affects the primary transaction amount.

After sending, a live status screen shows pending → confirmed (with a satisfying animation) or failed with a clear explanation.

<br>

### 📥 Receiving Tokens

Tap **Receive** to see your wallet address as a large QR code. Below it, your address is displayed in readable 4-character groups. Tap to copy, or hit **Share** to send it via any app.

<br>

### 🔄 Swapping Tokens

Tap the **Swap** tab in the bottom navigation.

1. Select the token you're swapping **from** and the token you want **to**.
2. Enter the amount — the output is calculated instantly via Jupiter's aggregator.
3. Below the amounts, you'll see the **route** (which DEXs are used for best price) and the **price impact**.
4. Tap the ⚙️ gear to adjust slippage tolerance (default is 0.5%).
5. Review and confirm.

Price impact is color-coded: **green** (< 1%) means you're good, **yellow** (1-5%) means proceed with caution, **red** (> 5%) means reconsider.

<br>

### 💰 Staking SOL

Tap the **Stake** tab to see your staking overview — total staked, rewards earned, and a list of your active stake accounts.

Tap **Stake More** to choose a validator. Helio ranks validators by a balanced score of APY, uptime, commission, and decentralization contribution. Each card shows all the numbers you need. Select one, enter an amount, review, and confirm.

To unstake, tap any active stake → **Unstake**. Helio explains the ~2-3 day cooldown, and after it completes, a **Withdraw** button appears to move your SOL back.

<br>

### 📈 AutoYield — Passive DeFi, Built In

AutoYield is Helio's passive savings and investment layer. Enable it once from **Settings → AutoYield**, and your wallet starts compounding in the background on every transaction you make.

**How it works:**

1. **Sweep** — On every outgoing send or swap, a configurable micro-amount is swept into your personal AutoYield reserve. Choose between a **percentage mode** (e.g. 1–5% of each transaction) or a **fixed amount** (e.g. 0.5 USDC equivalent per send).

2. **Auto-Convert** — If the swept asset is SOL or any non-stable token, Helio uses its built-in Jupiter integration to instantly convert it to your preferred stablecoin — **USDC**, **USDT**, or **USDG** — at the moment of sweep.

3. **Accumulate** — Swept amounts land in your **AutoYield reserve**, a PDA scoped to your own wallet keypair. Nothing leaves your custody.

4. **Deploy** — Once your reserve crosses your configured threshold (you set this), Helio automatically deposits the accumulated amount into a whitelisted yield protocol. Current supported protocols:
   - **Kamino Finance** (primary — single-asset USDC vaults)
   - **Meteora** (dynamic liquidity vaults)
   - **MarginFi** (lending markets)

5. **Earn** — Your position grows. APY is displayed live on the AutoYield dashboard card. Withdraw anytime with a single tap — no lockups, no exit fees.

> Every sweep is pre-simulated by Helio's Smart Adjust engine, so AutoYield **never causes a failed primary transaction**. If a sweep would interfere, it skips silently and retries on your next transaction.

**AutoYield Reserve card (on Dashboard):**

```
  📈 AutoYield
  ─────────────────────────────
  Total Saved:     $24.81 USDC
  Current APY:     8.3%  (Kamino)
  Accrued Yield:   $0.42
  Last Deposit:    2 hours ago

  [ Withdraw ]  [ Settings ]
```

**AutoYield is:**

- ✅ Fully non-custodial (PDA owned by your keypair)
- ✅ Configurable (percentage or fixed sweep, threshold, stablecoin, protocol)
- ✅ Withdrawable at any time
- ✅ Available in the Chrome Extension

<br>

### 🌐 Connecting to dApps (Chrome Extension)

When you visit a Solana dApp and it requests a wallet connection, Helio's popup appears showing the dApp's name, domain, and a trust indicator:

- 🟢 **Known safe** — verified domain
- ⚪ **Unknown** — proceed with normal caution
- 🔴 **Flagged** — reported phishing site, strong warning displayed

When a dApp asks you to sign a transaction, Helio shows a **human-readable preview** of what the transaction actually does — not just raw hex data. Smart Adjustment applies here too.

Manage all connected apps in **Settings → Connected Apps** with one-tap disconnect.

<br>

### ⚙️ Settings

- **Theme** — Dark (default), Light, or match your system.
- **Network** — Switch between Mainnet, Devnet, or enter a custom RPC URL.
- **Security** — Change password, toggle biometrics, set auto-lock timer (1 min to 30 min), export your seed phrase.
- **Address Book** — Save frequently used addresses with labels.
- **Currency** — Display portfolio value in USD, EUR, INR, JPY, and more.
- **AutoYield** — Toggle on/off, set sweep mode (% or fixed), pick your preferred stablecoin, set deployment threshold, and choose your yield protocol.

<br>

---

## Architecture at a Glance

```
┌──────────────────────────────────────────────────────────────┐
│                          apps/                                │
│  ┌─────────────────┐                                      │
│  │    extension/    │                                      │
│  │  React + Vite    │                                      │
│  │  CRXJS (MV3)     │                                      │
│  └────────┬─────────┘                                      │
│           │                                                │
│                    packages/                                   │
│  ┌──────────┐ ┌────────┐ ┌──────────┐ ┌────────┐ ┌────────┐  │
│  │   core   │ │ solana │ │   api    │ │  types │ │  auto  │  │
│  │   keys   │ │   rpc  │ │ jupiter  │ │ shared │ │ yield  │  │
│  │  crypto  │ │ adjust │ │  price   │ │  enums │ │ sweep  │  │
│  └──────────┘ └────────┘ └──────────┘ └────────┘ └────────┘  │
└──────────────────────────────────────────────────────────────┘
                              │
           ┌──────────────────┼──────────────────┐
           ▼                  ▼                   ▼
       Helius RPC          Jupiter            Blowfish
       (Solana)            (Swaps +          (Security)
                           AutoYield
                           Conversions)
                                │
               ┌────────────────┼──────────────┐
               ▼                ▼              ▼
           Kamino           Meteora         MarginFi
           Finance          Vaults         (Lending)
          (Primary)
```

<br>

---

## Key Differentiator: Smart Transaction Adjustment

Most wallets let you type an amount and hit send. If something goes wrong — you didn't leave enough for rent, a token account needs creation, fees are higher than expected — you find out _after_ it fails.

**Helio flips this.** Every transaction is simulated before submission. The Smart Adjust engine:

1. **Simulates** the transaction against the current network state.
2. **Analyzes** the result for rent exemption violations, missing accounts, fee shortfalls.
3. **Proposes** a corrected amount with a transparent breakdown.
4. **Asks** for your confirmation — you're always in control.

The result: a **99%+ transaction success rate** instead of the typical frustration of failed sends.

<br>

---

## Key Differentiator: AutoYield

Most wallets let your stablecoins sit idle. Getting into DeFi yield — Kamino, Meteora, MarginFi — requires manual steps, protocol research, and understanding of liquidity mechanics. The friction stops most people from ever starting.

**Helio removes that friction entirely.** AutoYield builds on the same Smart Adjust simulation infrastructure to make passive yield invisible and safe:

1. **Every transaction triggers a sweep** — a tiny configurable amount accumulates silently.
2. **Auto-conversion via Jupiter** — non-stablecoins are swapped to USDC/USDT/USDG on the spot.
3. **Threshold-based deployment** — capital only enters DeFi once your reserve is meaningful, reducing gas overhead.
4. **PDA-based ownership** — your yield position is held through a Program Derived Address scoped to your keypair. You own it. No protocol holds custody.
5. **One-tap withdraw** — exit your position directly from the Helio UI at any time.

The result: a wallet that grows your DeFi exposure automatically, with **zero extra steps** after initial setup.

<br>

---

<p align="center">
  <img src="https://img.shields.io/badge/Built_with-☀️_Helio-7C3AED?style=for-the-badge&labelColor=0A0E1A"/>
  <br><br>
  <strong>Helio Wallet</strong> — Smart sends. Passive yield. Solana native.
  <br>
  <sub>Non-custodial · Open Source · Solana Native</sub>
</p>
