/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_HELIO_MAINNET_RPC_PRIMARY_URL?: string;
  readonly VITE_HELIO_MAINNET_RPC_PRIMARY_WS_URL?: string;
  readonly VITE_HELIO_MAINNET_RPC_FALLBACK_URL?: string;
  readonly VITE_HELIO_DEVNET_RPC_PRIMARY_URL?: string;
  readonly VITE_HELIO_JUPITER_API_KEY?: string;
  readonly VITE_HELIO_JUPITER_API_BASE_URL?: string;
  readonly VITE_HELIO_JUPITER_API_FALLBACK_URL?: string;
  readonly VITE_HELIO_BLOWFISH_API_KEY?: string;
  readonly VITE_HELIO_BLOWFISH_API_BASE_URL?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
