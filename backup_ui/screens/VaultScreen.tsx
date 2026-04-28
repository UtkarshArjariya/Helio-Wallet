import React from 'react';
import { useVault } from '../contexts/VaultContext';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { ShieldCheck, Plus, Settings2, Play, Pause, ChevronRight } from 'lucide-react';
import { useLocation } from 'wouter';

export function VaultScreen() {
  const vault = useVault();
  const [, setLocation] = useLocation();

  const progress = Math.min((vault.balanceSol / vault.thresholdSol) * 100, 100);

  return (
    <div className="p-4 md:p-8 space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <header className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-2xl font-extrabold tracking-tight">Helio Vault</h1>
          <p className="text-sm text-text-muted">Automate your growth</p>
        </div>
        <Button variant="outline" size="icon" className="w-10 h-10 border-border">
          <Settings2 size={18} />
        </Button>
      </header>

      {/* Main Overview Card */}
      <Card className="bg-surface-1 border-border shadow-surface overflow-hidden relative">
        <div className="absolute top-0 left-0 right-0 h-1 bg-surface-3">
          <div 
            className="h-full bg-gradient-solar transition-all duration-1000" 
            style={{ width: `${progress}%` }}
          />
        </div>
        <CardContent className="p-6 md:p-8 flex flex-col items-center text-center">
          <div className="w-16 h-16 rounded-2xl bg-surface-3 border border-border flex items-center justify-center text-accent-primary shadow-glow mb-6">
            <ShieldCheck size={32} />
          </div>
          
          <p className="text-sm font-bold text-text-muted uppercase tracking-widest mb-2">Vault Balance</p>
          <div className="flex items-baseline gap-2 mb-2">
            <h2 className="text-5xl font-extrabold tracking-tight">{vault.balanceSol}</h2>
            <span className="text-xl font-bold text-text-muted">SOL</span>
          </div>
          
          <div className="flex items-center gap-2 mb-8 bg-surface-3 px-4 py-1.5 rounded-full border border-border">
            <span className="w-2 h-2 rounded-full bg-status-success animate-pulse" />
            <span className="text-xs font-bold text-text-secondary">
              {progress.toFixed(0)}% to deployment ({vault.thresholdSol} SOL)
            </span>
          </div>

          <div className="grid grid-cols-2 w-full max-w-sm gap-4">
            <Button variant="secondary" className="w-full">
              <Plus size={16} className="mr-2" /> Top Up
            </Button>
            <Button className="w-full">
              {vault.status === 'paused' ? <><Play size={16} className="mr-2"/> Resume</> : <><Pause size={16} className="mr-2"/> Pause</>}
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Stats Row */}
      <div className="grid grid-cols-2 gap-4">
        <Card className="bg-surface-2">
          <CardContent className="p-4">
            <p className="text-xs font-bold text-text-muted uppercase tracking-widest mb-1">Deployed</p>
            <p className="text-xl font-extrabold">{vault.deployedSol} SOL</p>
          </CardContent>
        </Card>
        <Card className="bg-surface-2">
          <CardContent className="p-4">
            <p className="text-xs font-bold text-text-muted uppercase tracking-widest mb-1">Earned</p>
            <p className="text-xl font-extrabold text-status-success">+{vault.rewardsEarnedSol} SOL</p>
          </CardContent>
        </Card>
      </div>

      {/* Current Strategy */}
      <div>
        <h3 className="text-sm font-bold text-text-muted uppercase tracking-widest mb-4 ml-1">Current Strategy</h3>
        <Card className="bg-surface-2 hover:bg-surface-3 transition-colors cursor-pointer border border-border group">
          <CardContent className="p-4 flex items-center justify-between">
            <div>
              <p className="font-bold text-sm mb-0.5">{vault.strategy.name}</p>
              <p className="text-xs text-text-muted">{vault.strategy.risk} Risk • Native Staking</p>
            </div>
            <div className="text-right flex items-center gap-3">
              <div>
                <p className="font-bold text-sm text-status-success">{vault.strategy.estApy}% APY</p>
                <p className="text-xs text-text-muted">Estimated</p>
              </div>
              <ChevronRight size={16} className="text-text-muted group-hover:text-text-primary transition-colors" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Auto-Save Rules Preview */}
      <div>
        <h3 className="text-sm font-bold text-text-muted uppercase tracking-widest mb-4 ml-1">Auto-Save Rules</h3>
        <div className="space-y-3">
          <RuleRow label="Round up transfers" enabled={vault.rules.roundUpTransfers} />
          <RuleRow label="Round up swaps" enabled={vault.rules.roundUpSwaps} />
        </div>
      </div>
      
    </div>
  );
}

function RuleRow({ label, enabled }: { label: string; enabled: boolean }) {
  return (
    <Card className="bg-surface-2 border-border">
      <CardContent className="p-4 flex items-center justify-between">
        <p className="font-bold text-sm">{label}</p>
        <div className={`w-10 h-6 rounded-full flex items-center p-1 transition-colors ${enabled ? 'bg-accent-primary' : 'bg-surface-3'}`}>
          <div className={`w-4 h-4 bg-background rounded-full shadow-sm transition-transform ${enabled ? 'translate-x-4' : 'translate-x-0'}`} />
        </div>
      </CardContent>
    </Card>
  );
}
