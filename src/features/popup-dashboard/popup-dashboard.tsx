import React from "react";
import { motion } from "framer-motion";
import {
  ArrowDownLeft,
  ArrowUpRight,
  ChevronRight,
  RefreshCw,
  Settings,
  ShieldCheck,
  Zap,
} from "lucide-react";
import { cn } from "../../lib/utils";
import { PremiumCard } from "../ui-system/primitives";
import type { PopupDashboardSnapshot } from "./popup-dashboard.types";

interface PopupDashboardProps {
  readonly snapshot: PopupDashboardSnapshot;
  readonly onReceive?: () => void;
  readonly onRefresh?: () => void;
  readonly onSend?: () => void;
  readonly onSettings?: () => void;
  readonly onOpenVault?: () => void;
}

export function PopupDashboard({
  snapshot,
  onReceive,
  onRefresh,
  onSend,
  onSettings,
  onOpenVault
}: PopupDashboardProps) {
  const formatCurrency = (val: number) =>
    new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
    }).format(val);
  const autoYieldProgress = Math.min(
    snapshot.autoYield.settings.deployThresholdUsd === 0
      ? 0
      : (snapshot.autoYield.reserve.totalUsdValue /
          snapshot.autoYield.settings.deployThresholdUsd) *
          100,
    100,
  );
  const autoYieldStatusCopy =
    snapshot.autoYield.status === "disabled"
      ? "Inactive"
      : snapshot.autoYield.status === "paused"
        ? "Paused"
        : snapshot.autoYield.status === "threshold-reached"
          ? "Ready to Deploy"
          : `Routing to ${snapshot.autoYield.settings.activeProtocol}`;

  return (
    <div className="flex flex-col min-h-[600px] bg-background text-text-primary overflow-x-hidden font-sans">
      {/* Premium Sticky Header */}
      <header className="sticky top-0 z-50 flex items-center justify-between p-6 bg-background/80 backdrop-blur-xl border-b border-border/50">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-2xl bg-gradient-solar flex items-center justify-center text-accent-primary-foreground shadow-glow">
            <ShieldCheck size={20} />
          </div>
          <div>
            <h1 className="text-sm font-extrabold tracking-tight">{snapshot.account.label}</h1>
            <div className="flex items-center gap-2">
              <span className="w-1.5 h-1.5 rounded-full bg-status-success animate-pulse" />
              <span className="text-[10px] font-bold text-status-success uppercase tracking-wider">
                {snapshot.network.endpointLabel}
              </span>
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            aria-label="Refresh"
            onClick={onRefresh}
            className="p-2.5 rounded-xl bg-surface-2 text-text-secondary hover:text-accent-primary transition-colors"
          >
            <RefreshCw size={18} />
          </button>
          <button
            type="button"
            aria-label="Settings"
            onClick={onSettings}
            className="p-2.5 rounded-xl bg-surface-2 text-text-secondary hover:text-accent-primary transition-colors"
          >
            <Settings size={18} />
          </button>
        </div>
      </header>

      <main className="flex-1 p-4 space-y-6 pb-24">
        {/* Main Balance Hero */}
        <PremiumCard variant="default" showPattern className="text-center pt-10 pb-8 border-none bg-surface-2/50">
          <p className="text-[10px] font-bold text-text-muted uppercase tracking-[0.2em] mb-3">Total Balance</p>
          <motion.h2 
            initial={{ scale: 0.95 }}
            animate={{ scale: 1 }}
            className="text-5xl font-black tracking-tight mb-2"
          >
            {formatCurrency(snapshot.portfolio.totalUsdValue)}
          </motion.h2>
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-status-success/10 text-status-success text-[10px] font-black uppercase tracking-wider">
            <ArrowUpRight size={12} />
            {snapshot.portfolio.dailyChangePercentage.toFixed(2)}% Today
          </div>
          
          <div className="grid grid-cols-4 gap-4 mt-10">
            <QuickAction icon={<ArrowUpRight />} label="Send" onClick={onSend} />
            <QuickAction
              icon={<ArrowDownLeft />}
              label="Recv"
              ariaLabel="Receive"
              onClick={onReceive}
            />
            <QuickAction icon={<RefreshCw />} label="Swap" />
            <QuickAction icon={<Zap />} label="Stake" />
          </div>
        </PremiumCard>

        {/* Helio Vault Highlight - THE DIFFERENTIATOR */}
        <button onClick={onOpenVault} className="w-full text-left group">
          <PremiumCard variant="solar" className="border-accent-primary/10 group-hover:brightness-110 transition-all">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 rounded-2xl bg-accent-primary/20 flex items-center justify-center text-accent-primary shadow-glow">
                  <ShieldCheck size={28} />
                </div>
                <div>
                  <h3 className="text-xs font-black uppercase tracking-[0.15em] text-accent-primary mb-1">AutoYield Reserve</h3>
                  <p className="text-sm font-bold text-text-secondary">{autoYieldStatusCopy}</p>
                </div>
              </div>
              <ChevronRight size={20} className="text-accent-primary group-hover:translate-x-1 transition-transform" />
            </div>
            
            <div className="mt-5 space-y-2">
              <div className="flex justify-between text-[10px] font-bold uppercase text-text-muted tracking-widest">
                <span>Threshold progress</span>
                <span>
                  {formatCurrency(snapshot.autoYield.reserve.totalUsdValue)} /{" "}
                  {formatCurrency(snapshot.autoYield.settings.deployThresholdUsd)}
                </span>
              </div>
              <div className="h-1.5 w-full bg-surface-3 rounded-full overflow-hidden">
                <motion.div 
                  initial={{ width: 0 }}
                  animate={{ width: `${autoYieldProgress}%` }}
                  className="h-full bg-gradient-solar" 
                />
              </div>
              <div className="flex justify-between text-[10px] font-bold uppercase text-text-muted tracking-widest">
                <span>Total swept</span>
                <span>{formatCurrency(snapshot.autoYield.reserve.totalSweptUsd)}</span>
              </div>
            </div>
          </PremiumCard>
        </button>

        {/* Token List Section */}
        <section>
          <div className="flex items-center justify-between mb-4 px-1">
            <h3 className="text-[10px] font-black text-text-muted uppercase tracking-[0.2em]">Your Assets</h3>
            <button className="text-[10px] font-black text-accent-tertiary uppercase tracking-[0.15em] hover:brightness-110 transition-all">
              View Market
            </button>
          </div>
          <div className="space-y-3">
            {snapshot.tokenRows.map((token, i) => (
              <motion.div
                key={token.mintAddress}
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: i * 0.1 }}
              >
                <PremiumCard className="p-4 bg-surface-1 hover:bg-surface-2 transition-colors cursor-pointer border-border/50">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-4">
                      <div className={cn(
                        "w-10 h-10 rounded-xl flex items-center justify-center font-black text-xs shadow-surface border border-white/5",
                        token.symbol === "SOL" ? "bg-gradient-to-br from-purple-500 to-blue-600" : "bg-surface-3"
                      )}>
                        {token.symbol.substring(0, 1)}
                      </div>
                      <div>
                        <p className="text-sm font-black tracking-tight">{token.symbol}</p>
                        <p className="text-[10px] font-bold text-text-muted uppercase tracking-wider">
                          {token.amountDisplay}
                        </p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="text-sm font-black">{formatCurrency(token.usdValue)}</p>
                      <p className={cn(
                        "text-[10px] font-bold uppercase",
                        token.dailyChangePercentage >= 0 ? "text-status-success" : "text-status-danger"
                      )}>
                        {token.dailyChangePercentage >= 0 ? "+" : ""}
                        {token.dailyChangePercentage.toFixed(2)}%
                      </p>
                    </div>
                  </div>
                </PremiumCard>
              </motion.div>
            ))}
          </div>
        </section>
      </main>

      {/* Persistent Glass Nav */}
      <footer className="fixed bottom-0 left-0 right-0 p-4 z-50">
        <div className="bg-surface-1/80 backdrop-blur-2xl border border-white/5 rounded-3xl shadow-surface h-16 flex items-center justify-around px-2">
          <NavBtn icon={<ShieldCheck />} label="Vault" active />
          <NavBtn icon={<RefreshCw />} label="Swap" />
          <NavBtn icon={<Zap />} label="DeFi" />
          <NavBtn icon={<Settings />} label="Safety" />
        </div>
      </footer>
    </div>
  );
}

function QuickAction({
  icon,
  label,
  onClick,
  ariaLabel,
}: {
  readonly icon: React.ReactNode;
  readonly label: string;
  readonly onClick?: () => void;
  readonly ariaLabel?: string;
}) {
  return (
    <button
      type="button"
      aria-label={ariaLabel}
      onClick={onClick}
      className="flex flex-col items-center gap-2 group"
    >
      <div className="w-14 h-14 rounded-2xl bg-surface-3 border border-border flex items-center justify-center text-text-secondary group-hover:bg-text-primary group-hover:text-background group-hover:border-transparent transition-all shadow-sm">
        {React.cloneElement(icon as React.ReactElement<any>, { size: 20 })}
      </div>
      <span className="text-[9px] font-black uppercase tracking-[0.15em] text-text-muted group-hover:text-text-primary transition-colors">{label}</span>
    </button>
  );
}

function NavBtn({
  icon,
  label,
  active = false,
}: {
  readonly icon: React.ReactNode;
  readonly label: string;
  readonly active?: boolean;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      className={cn(
        "flex flex-col items-center justify-center p-2 rounded-2xl transition-all",
        active
          ? "text-accent-primary scale-110"
          : "text-text-muted hover:text-text-primary",
      )}
    >
      {React.cloneElement(icon as React.ReactElement<any>, { size: 22 })}
      <span className="text-[8px] font-black uppercase tracking-[0.2em] mt-1">{label}</span>
    </button>
  );
}
