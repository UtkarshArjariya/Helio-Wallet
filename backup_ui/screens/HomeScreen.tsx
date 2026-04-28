import React from 'react';
import { useWallet } from '../contexts/WalletContext';
import { useVault } from '../contexts/VaultContext';
import { Card, CardContent } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { ArrowDownLeft, ArrowRightLeft, ArrowUpRight, Copy, ShieldCheck, Zap } from 'lucide-react';
import { useLocation } from 'wouter';

export function HomeScreen() {
  const wallet = useWallet();
  const vault = useVault();
  const [, setLocation] = useLocation();

  const handleCopy = () => {
    navigator.clipboard.writeText(wallet.address);
  };

  return (
    <div className="p-4 md:p-8 space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <header className="flex justify-between items-center mb-2">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-surface-3 flex items-center justify-center border border-border">
            <span className="text-sm font-extrabold">{wallet.walletName.charAt(0)}</span>
          </div>
          <div>
            <h2 className="font-bold text-sm">{wallet.walletName}</h2>
            <button onClick={handleCopy} className="flex items-center gap-1.5 text-xs text-text-muted hover:text-accent-primary transition-colors">
              {wallet.shortAddress} <Copy size={12} />
            </button>
          </div>
        </div>
      </header>

      {/* Main Balance Hero */}
      <div className="relative rounded-[24px] p-6 md:p-8 overflow-hidden bg-surface-1 border border-border shadow-surface group">
        <div className="absolute -top-24 -right-24 w-64 h-64 bg-accent-primary opacity-10 rounded-full blur-[64px] group-hover:opacity-20 transition-opacity duration-700" />
        <div className="absolute -bottom-24 -left-24 w-64 h-64 bg-accent-tertiary opacity-10 rounded-full blur-[64px] group-hover:opacity-20 transition-opacity duration-700" />
        
        <div className="relative z-10 flex flex-col items-center text-center">
          <p className="text-sm font-bold text-text-muted uppercase tracking-widest mb-2">Total Balance</p>
          <h1 className="text-5xl md:text-6xl font-extrabold tracking-tight mb-8">
            ${wallet.totalBalanceUsd.toLocaleString(undefined, { minimumFractionDigits: 2 })}
          </h1>
          
          <div className="grid grid-cols-4 w-full max-w-sm gap-2 md:gap-4">
            <ActionBtn icon={<ArrowDownLeft />} label="Receive" />
            <ActionBtn icon={<ArrowUpRight />} label="Send" />
            <ActionBtn icon={<ArrowRightLeft />} label="Swap" onClick={() => setLocation('/swap')} />
            <ActionBtn icon={<Zap />} label="Stake" />
          </div>
        </div>
      </div>

      {/* Vault Summary Widget */}
      <Card className="bg-gradient-solar text-accent-primary-foreground border-none shadow-glow cursor-pointer hover:brightness-105 transition-all" onClick={() => setLocation('/vault')}>
        <CardContent className="p-5 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-full bg-accent-primary-foreground/10 flex items-center justify-center backdrop-blur-md">
              <ShieldCheck size={24} className="text-accent-primary-foreground" />
            </div>
            <div>
              <h3 className="font-extrabold text-sm uppercase tracking-wider mb-0.5">Helio Vault</h3>
              <p className="text-xs font-medium opacity-80">
                {vault.status === 'accumulating' ? 'Accumulating yield...' : 'Vault Active'}
              </p>
            </div>
          </div>
          <div className="text-right">
            <p className="font-extrabold text-lg">{vault.balanceSol} SOL</p>
            <p className="text-xs font-medium opacity-80">Est. APY {vault.strategy.estApy}%</p>
          </div>
        </CardContent>
      </Card>

      {/* Token List */}
      <div>
        <h3 className="text-sm font-bold text-text-muted uppercase tracking-widest mb-4 ml-1">Your Tokens</h3>
        <div className="space-y-3">
          {wallet.tokens.map((token) => (
            <Card key={token.symbol} className="bg-surface-2 hover:bg-surface-3 transition-colors cursor-pointer">
              <CardContent className="p-4 flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <div className="w-10 h-10 rounded-full bg-surface-3 flex items-center justify-center font-bold text-xs border border-border">
                    {token.symbol.substring(0, 2)}
                  </div>
                  <div>
                    <p className="font-bold text-sm">{token.name}</p>
                    <p className="text-xs text-text-muted">{token.balance} {token.symbol}</p>
                  </div>
                </div>
                <div className="text-right">
                  <p className="font-bold text-sm">${token.usdValue.toFixed(2)}</p>
                  <p className="text-xs text-status-success">+{token.priceChange24h}%</p>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    </div>
  );
}

function ActionBtn({ icon, label, onClick }: { icon: React.ReactNode; label: string; onClick?: () => void }) {
  return (
    <button onClick={onClick} className="flex flex-col items-center gap-2 group">
      <div className="w-14 h-14 rounded-full bg-surface-3 border border-border flex items-center justify-center text-text-primary group-hover:bg-accent-primary group-hover:text-accent-primary-foreground group-hover:border-transparent transition-all shadow-sm group-hover:shadow-glow">
        {icon}
      </div>
      <span className="text-[11px] font-bold uppercase tracking-wider text-text-muted group-hover:text-text-primary transition-colors">{label}</span>
    </button>
  );
}
