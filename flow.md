# User Flows

## Project: Helio Wallet

---

## Flow 1: Wallet Creation

```
[Launch App] 
    → "Create New Wallet" button
    → Set Password (8+ chars, show strength meter)
    → Confirm Password
    → Generate & Display 12-word Seed Phrase
        → "I've saved it" checkbox
        → "Continue" (disabled until checkbox is ticked)
    → Verify Seed Phrase (select 3 random words in order)
        → ✅ Correct → Wallet Created → Dashboard (0 SOL)
        → ❌ Incorrect → "Try again" with words reshuffled
    → Optional: Enable Biometrics prompt
    → Dashboard
```

---

## Flow 2: Wallet Import

```
[Launch App]
    → "Import Existing Wallet" button
    → Choose method:
        ├── [Seed Phrase]
        │     → Enter 12 or 24 words (auto-suggest from BIP39 wordlist)
        │     → Validate words in real-time (green ✓ / red ✗)
        │     → Set Password → Confirm Password
        │     → Detect derived accounts with balances
        │         ├── Single account → Import & go to Dashboard
        │         └── Multiple accounts → "Select accounts to import" → Dashboard
        │
        └── [Private Key]
              → Paste base58-encoded private key
              → Validate format
              → Set Password → Confirm Password
              → Dashboard
```

---

## Flow 3: Send Token

```
[Dashboard]
    → Tap "Send" button
    → Select Token (scrollable list of holdings, search bar at top)
    → Enter Amount
        → Numeric keypad with "." support
        → Live USD conversion shown below
        → "MAX" button (calculates max sendable amount minus fees + rent reserve)
    → Enter Recipient Address
        ├── Paste address manually
        ├── Scan QR code (camera opens)
        └── Select from Address Book / Recent Recipients
    → Address validated (green checkmark or red error)
    → Tap "Review"
    → [SMART ADJUSTMENT ENGINE RUNS]
        ├── No issues detected:
        │     → Confirmation Screen
        │         → Token, Amount, Recipient, Network Fee, Priority Fee, Total
        │         → "Confirm & Send" button
        │
        └── Adjustment needed:
              → Adjustment Card appears:
              │   ┌──────────────────────────────────────┐
              │   │ ⚡ Smart Adjustment                   │
              │   │                                        │
              │   │ Original:  5.000 SOL                   │
              │   │ Adjusted:  4.991 SOL                   │
              │   │                                        │
              │   │ Reason: Reserves 0.009 SOL for:        │
              │   │  • Rent exemption (0.00089 SOL)        │
              │   │  • Network fee   (0.00005 SOL)         │
              │   │  • Priority fee  (0.00806 SOL)         │
              │   │                                        │
              │   │ [Accept Adjustment]  [Send Original]   │
              │   └──────────────────────────────────────┘
              → User chooses → Confirmation Screen
    → "Confirm & Send"
    → Sign transaction (biometric/password if locked)
    → Submit to network
    → Status Screen:
        ├── ⏳ Pending... (spinner + "Confirming on Solana...")
        ├── ✅ Confirmed (checkmark + confetti + "View on Solscan")
        └── ❌ Failed (error message in plain language + "Try Again")
    → Return to Dashboard (balance updated)
```

---

## Flow 4: Receive Token

```
[Dashboard]
    → Tap "Receive" button
    → Receive Screen:
        → QR Code (encoding wallet address)
        → Wallet address in monospace text (grouped in 4-char chunks)
        → [Copy Address] button → Toast: "Address copied!"
        → [Share] button → System share sheet (mobile) / Clipboard (extension)
    → Back to Dashboard
```

---

## Flow 5: Stake SOL

```
[Dashboard]
    → Tap "Stake" tab (bottom nav)
    → Staking Overview:
        ├── Active Stake total
        ├── Rewards earned
        └── "Stake More" button
    → Tap "Stake More"
    → Validator Selection Screen:
        → Sorted by Helio recommended ranking
        → Each card: Name, Logo, APY %, Commission %, Uptime %, Stake amount
        → Search/filter bar
        → Tap a validator to select
    → Enter Stake Amount
        → Minimum enforced (shown clearly)
        → "MAX" button (leaves rent + fee reserve)
    → Review Screen:
        → Validator name, amount, estimated APY, epoch info
        → "Confirm Stake"
    → Sign & submit → Success/failure status
    → Return to Staking Overview (stake now visible)
```

---

## Flow 6: Unstake SOL

```
[Staking Overview]
    → Tap an active stake account
    → Stake Detail Screen:
        → Validator, amount, rewards earned, status
        → "Unstake" button
    → Tap "Unstake"
    → Info Modal:
        → "Unstaking takes ~2-3 days (1 epoch). During this time your SOL will not earn rewards."
        → "Continue" / "Cancel"
    → Sign & submit deactivation
    → Stake status changes to "Deactivating" with countdown
    → [After cooldown completes]
    → "Withdraw" button appears
    → Tap "Withdraw" → SOL returns to main balance
```

---

## Flow 7: Swap Tokens

```
[Dashboard]
    → Tap "Swap" tab (bottom nav)
    → Swap Screen:
        → "From" token selector (tap to open token list)
        → Amount input with USD equivalent
        → 🔄 Flip button (swaps From/To)
        → "To" token selector
        → Auto-calculated output amount
    → Route Display:
        → "SOL → USDC via Raydium" (best route)
        → Price impact: 0.12% (green if <1%, yellow 1-5%, red >5%)
    → Slippage Settings (gear icon):
        → 0.1% | 0.5% (default) | 1.0% | Custom
    → Tap "Review Swap"
    → Confirmation Screen:
        → Input amount, output amount (min received), rate, fees, price impact
        → "Confirm Swap"
    → Sign & submit → Status → Dashboard (balances updated)
```

---

## Flow 8: dApp Connection (Extension)

```
[User visits a Solana dApp in browser]
    → dApp calls `window.helio.connect()`
    → Helio Extension popup opens:
        → Shows: dApp name, domain URL, favicon
        → Domain check:
            ├── ✅ Known safe → Green badge
            ├── ⚠️ Unknown → Neutral (no badge)
            └── 🚨 Known phishing → Red warning banner: "This site has been reported as malicious"
        → "Connect" / "Reject" buttons
    → User taps "Connect"
    → dApp receives public key
    → Connection saved in Settings → Connected Apps

[dApp requests transaction signature]
    → Helio popup opens with Transaction Preview:
        → Human-readable breakdown:
            "This transaction will:"
            • Send 2.5 SOL to GhJ7...xK9m
            • Interact with Jupiter Aggregator program
        → Fee breakdown
        → Smart Adjustment (if applicable)
        → ⚠️ Warnings for authority changes or unusual operations
    → "Approve" / "Reject"
    → Signed transaction returned to dApp
```

---

## Flow 9: Settings

```
[Dashboard]
    → Tap ⚙️ Settings (top-right)
    → Settings Menu:
        ├── General
        │     ├── Currency Display (USD, EUR, INR, JPY...)
        │     ├── Language
        │     └── Theme (Dark / Light / System)
        │
        ├── Network
        │     ├── Mainnet-Beta ● (selected)
        │     ├── Devnet
        │     └── Custom RPC (enter URL, validate with getHealth)
        │
        ├── Security
        │     ├── Change Password
        │     ├── Biometric Lock (toggle)
        │     ├── Auto-Lock Timer (1m / 5m / 15m / 30m / Never)
        │     └── Export Seed Phrase (requires password re-entry)
        │
        ├── Connected Apps
        │     → List of connected dApps with "Disconnect" button each
        │
        ├── Address Book
        │     → List of saved addresses with labels
        │     → "Add New" → Label + Address → Save
        │
        └── About
              → Version, Open Source Licenses, Support link
```

---

## Flow 10: Onboarding Tooltips (First-Time User)

```
[First launch after wallet creation]
    → Dashboard loads with overlay tooltips:
        → Tooltip 1: Points to balance → "This is your total portfolio value in USD"
        → Tooltip 2: Points to Send → "Tap here to send SOL or tokens to anyone"
        → Tooltip 3: Points to Receive → "Share your address to receive funds"
        → Tooltip 4: Points to Stake → "Earn rewards by staking your SOL"
    → "Got it!" button dismisses all tooltips
    → Tooltips never shown again (flag stored locally)
```
