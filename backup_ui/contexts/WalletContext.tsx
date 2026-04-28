import React, { createContext, useContext, useState, ReactNode } from 'react';

export type TokenHolding = {
  symbol: string;
  name: string;
  balance: number;
  usdValue: number;
  priceChange24h: number;
};

export type ActivityItem = {
  id: string;
  type: 'send' | 'receive' | 'swap' | 'vault_deposit' | 'vault_deploy';
  title: string;
  subtitle: string;
  amount: string;
  date: string;
  status: 'confirmed' | 'pending' | 'failed';
};

interface WalletState {
  walletName: string;
  address: string;
  shortAddress: string;
  totalBalanceUsd: number;
  availableSol: number;
  tokens: TokenHolding[];
  activity: ActivityItem[];
}

interface WalletContextType extends WalletState {
  // Add setter methods later if needed for interaction
}

const defaultState: WalletState = {
  walletName: "Main Wallet",
  address: "He1io8s7q...29rx",
  shortAddress: "He1i...29rx",
  totalBalanceUsd: 1420.50,
  availableSol: 2.84,
  tokens: [
    { symbol: "SOL", name: "Solana", balance: 2.84, usdValue: 420.50, priceChange24h: 5.2 },
    { symbol: "USDC", name: "USD Coin", balance: 1000.00, usdValue: 1000.00, priceChange24h: 0.01 },
  ],
  activity: [
    { id: "1", type: "vault_deposit", title: "Vault Auto-Save", subtitle: "Round-up from Send", amount: "+0.006 SOL", date: "Today", status: "confirmed" },
    { id: "2", type: "send", title: "Sent SOL", subtitle: "To 9xQa...3b1p", amount: "-1.5 SOL", date: "Yesterday", status: "confirmed" },
  ]
};

const WalletContext = createContext<WalletContextType | undefined>(undefined);

export function WalletProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<WalletState>(defaultState);

  return (
    <WalletContext.Provider value={{ ...state }}>
      {children}
    </WalletContext.Provider>
  );
}

export function useWallet() {
  const context = useContext(WalletContext);
  if (context === undefined) {
    throw new Error('useWallet must be used within a WalletProvider');
  }
  return context;
}
