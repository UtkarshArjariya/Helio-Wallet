import React, { createContext, useContext, useState, ReactNode } from 'react';

export type VaultStatus = 'inactive' | 'accumulating' | 'threshold_reached' | 'deploying' | 'deployed' | 'paused';

interface VaultState {
  status: VaultStatus;
  balanceSol: number;
  thresholdSol: number;
  deployedSol: number;
  rewardsEarnedSol: number;
  strategy: {
    id: string;
    name: string;
    type: 'native_staking' | 'liquid_staking' | 'yield_vault';
    estApy: number;
    risk: 'Low' | 'Medium' | 'High';
  };
  rules: {
    roundUpTransfers: boolean;
    roundUpSwaps: boolean;
    fixedPercentage: boolean;
    percentageValue: number;
  };
}

interface VaultContextType extends VaultState {
  activateVault: () => void;
  pauseVault: () => void;
  updateThreshold: (val: number) => void;
}

const defaultState: VaultState = {
  status: 'accumulating',
  balanceSol: 0.073,
  thresholdSol: 0.10,
  deployedSol: 0.50,
  rewardsEarnedSol: 0.012,
  strategy: {
    id: "helio_val",
    name: "Helio Validator",
    type: "native_staking",
    estApy: 7.1,
    risk: "Low"
  },
  rules: {
    roundUpTransfers: true,
    roundUpSwaps: true,
    fixedPercentage: false,
    percentageValue: 1,
  }
};

const VaultContext = createContext<VaultContextType | undefined>(undefined);

export function VaultProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<VaultState>(defaultState);

  const activateVault = () => setState(s => ({ ...s, status: 'accumulating' }));
  const pauseVault = () => setState(s => ({ ...s, status: 'paused' }));
  const updateThreshold = (val: number) => setState(s => ({ ...s, thresholdSol: val }));

  return (
    <VaultContext.Provider value={{ ...state, activateVault, pauseVault, updateThreshold }}>
      {children}
    </VaultContext.Provider>
  );
}

export function useVault() {
  const context = useContext(VaultContext);
  if (context === undefined) {
    throw new Error('useVault must be used within a VaultProvider');
  }
  return context;
}
