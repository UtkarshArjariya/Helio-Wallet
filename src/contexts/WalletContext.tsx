import React, { createContext, useContext, useState } from "react"

export interface Token {
  id: string
  symbol: string
  name: string
  balance: number
  price: number
  change24h: number
}

export interface VaultState {
  isActive: boolean
  balance: number
  threshold: number
  deployed: number
  rewards: number
  strategy: "Helio Validator" | "Liquid Staking" | "Stable Yield"
  rules: {
    roundUpTransfers: number | null
    roundUpSwaps: number | null
    percentageIncoming: number | null
  }
}

interface WalletContextType {
  address: string
  name: string
  tokens: Token[]
  totalBalanceUsd: number
  vault: VaultState
  updateVault: (updates: Partial<VaultState>) => void
  updateVaultRule: (key: keyof VaultState["rules"], value: number | null) => void
}

const mockTokens: Token[] = [
  { id: "sol", symbol: "SOL", name: "Solana", balance: 2.84, price: 145.20, change24h: 5.2 },
  { id: "usdc", symbol: "USDC", name: "USD Coin", balance: 150.00, price: 1.00, change24h: 0.01 },
  { id: "jup", symbol: "JUP", name: "Jupiter", balance: 450.00, price: 1.12, change24h: -2.4 },
]

const initialVaultState: VaultState = {
  isActive: true,
  balance: 0.073,
  threshold: 0.10,
  deployed: 0.50,
  rewards: 0.012,
  strategy: "Helio Validator",
  rules: {
    roundUpTransfers: 1,
    roundUpSwaps: null,
    percentageIncoming: null,
  }
}

const WalletContext = createContext<WalletContextType | undefined>(undefined)

export function WalletProvider({ children }: { children: React.ReactNode }) {
  const [vault, setVault] = useState<VaultState>(initialVaultState)

  const totalBalanceUsd = mockTokens.reduce((acc, t) => acc + (t.balance * t.price), 0)

  const updateVault = (updates: Partial<VaultState>) => {
    setVault(prev => ({ ...prev, ...updates }))
  }

  const updateVaultRule = (key: keyof VaultState["rules"], value: number | null) => {
    setVault(prev => ({
      ...prev,
      rules: { ...prev.rules, [key]: value }
    }))
  }

  const value: WalletContextType = {
    address: "He1io...29rx",
    name: "Main Wallet",
    tokens: mockTokens,
    totalBalanceUsd,
    vault,
    updateVault,
    updateVaultRule,
  }

  return <WalletContext.Provider value={value}>{children}</WalletContext.Provider>
}

export function useWallet() {
  const context = useContext(WalletContext)
  if (context === undefined) {
    throw new Error("useWallet must be used within a WalletProvider")
  }
  return context
}
