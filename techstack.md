# Tech Stack

## Project: Helio Wallet

---

## Chrome Extension

| Layer | Technology | Version |
|---|---|---|
| **Language** | TypeScript | 5.5+ |
| **UI Framework** | React | 18.3+ |
| **State Management** | Zustand | 5.x |
| **Styling** | Tailwind CSS | 3.4+ |
| **Build Tool** | Vite | 6.x |
| **Extension Tooling** | CRXJS Vite Plugin | 2.x (Manifest V3) |
| **Solana SDK** | @solana/web3.js | 2.x (tree-shakeable) |
| **Token Operations** | @solana/spl-token | 0.4+ |
| **Wallet Standard** | @solana/wallet-standard | latest |
| **Jupiter Integration** | @jup-ag/api | latest |
| **QR Code** | qrcode.react | 4.x |
| **Address Validation** | @solana/addresses | latest |
| **Linting & Formatting** | Biome | 1.9+ |
| **Unit Testing** | Vitest | 2.x |
| **E2E Testing** | Playwright | 1.48+ |
| **Animation** | Framer Motion | 11.x |
| **HTTP Client** | ky | 1.x |
| **Secure Storage** | chrome.storage.session API | Manifest V3 native |
| **Icons** | Lucide React | 0.400+ |

---

## Mobile Application

| Layer | Technology | Version |
|---|---|---|
| **Language** | TypeScript | 5.5+ |
| **Framework** | React Native (New Architecture) | 0.76+ |
| **Navigation** | React Navigation | 7.x |
| **State Management** | Zustand | 5.x |
| **Styling** | NativeWind | 4.x |
| **Solana SDK** | @solana/web3.js | 2.x |
| **Token Operations** | @solana/spl-token | 0.4+ |
| **Jupiter Integration** | @jup-ag/api | latest |
| **Secure Storage** | react-native-keychain | 9.x |
| **Crypto Polyfill** | react-native-get-random-values | 1.x |
| **Biometrics** | react-native-biometrics | 3.x |
| **QR Scanner** | react-native-camera-kit | 14.x |
| **QR Generator** | react-native-qrcode-svg | 6.x |
| **Animation** | react-native-reanimated | 3.x |
| **Gesture Handling** | react-native-gesture-handler | 2.x |
| **Linting & Formatting** | Biome | 1.9+ |
| **Unit Testing** | Jest | 29.x |
| **E2E Testing** | Detox | 20.x |
| **Icons** | Lucide React Native | 0.400+ |
| **Deep Linking** | React Navigation deep links | native |
| **Push (v2)** | Firebase Cloud Messaging | latest |

---

## Shared / Monorepo

| Layer | Technology | Version |
|---|---|---|
| **Monorepo Tool** | Turborepo | 2.x |
| **Package Manager** | pnpm | 9.x |
| **Shared Types** | Custom `@helio/types` package | — |
| **Shared Crypto Logic** | Custom `@helio/core` package | — |
| **Shared Solana Utils** | Custom `@helio/solana` package | — |
| **API Layer** | Custom `@helio/api` package (Jupiter, RPC wrappers) | — |

---

## Infrastructure & DevOps

| Concern | Technology |
|---|---|
| **CI/CD** | GitHub Actions |
| **Extension Distribution** | Chrome Web Store |
| **Mobile Distribution** | Apple App Store + Google Play Store |
| **RPC Provider (Primary)** | Helius |
| **RPC Provider (Fallback)** | Triton / QuickNode |
| **Price Data** | Jupiter Price API v2 |
| **Token Metadata** | Solana Token List + Metaplex |
| **Validator Data** | Solana Beach API / validators.app API |
| **Analytics** | PostHog (self-hosted, privacy-first) |
| **Error Tracking** | Sentry |
| **Phishing DB** | Blowfish API (transaction simulation & threat detection) |

---

## Monorepo Structure

```
helio-wallet/
├── apps/
│   ├── extension/         # Chrome Extension (Vite + CRXJS)
│   └── mobile/            # React Native app
├── packages/
│   ├── core/              # Key management, encryption, signing
│   ├── solana/            # RPC wrappers, transaction builders, smart adjustment
│   ├── types/             # Shared TypeScript interfaces & enums
│   ├── api/               # Jupiter, price feeds, validator data
│   └── ui/                # Shared component primitives (if applicable)
├── turbo.json
├── pnpm-workspace.yaml
└── tsconfig.base.json
```
