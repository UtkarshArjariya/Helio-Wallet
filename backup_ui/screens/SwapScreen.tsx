import React, { useState } from 'react';
import { useWallet } from '../contexts/WalletContext';
import { Card, CardContent } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { ArrowDownUp, ChevronDown, Settings2 } from 'lucide-react';

export function SwapScreen() {
  const wallet = useWallet();
  const [sellAmount, setSellAmount] = useState('');

  return (
    <div className="p-4 md:p-8 space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <header className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-2xl font-extrabold tracking-tight">Swap</h1>
        </div>
        <Button variant="outline" size="icon" className="w-10 h-10 border-border">
          <Settings2 size={18} />
        </Button>
      </header>

      <div className="relative">
        {/* Sell Card */}
        <Card className="bg-surface-2 border-border mb-2 rounded-[24px]">
          <CardContent className="p-6">
            <div className="flex justify-between items-center mb-4">
              <span className="text-xs font-bold text-text-muted uppercase tracking-widest">You Pay</span>
              <span className="text-xs text-text-muted font-medium">Balance: {wallet.availableSol} SOL</span>
            </div>
            
            <div className="flex items-center gap-4">
              <button className="flex items-center gap-2 bg-surface-3 hover:bg-surface-1 px-4 py-2 rounded-full transition-colors border border-border">
                <div className="w-6 h-6 rounded-full bg-gradient-to-br from-purple-600 to-blue-500 flex items-center justify-center text-[10px] font-bold">SO</div>
                <span className="font-bold">SOL</span>
                <ChevronDown size={16} className="text-text-muted" />
              </button>
              <input 
                type="number" 
                placeholder="0.00"
                value={sellAmount}
                onChange={(e) => setSellAmount(e.target.value)}
                className="flex-1 bg-transparent text-right text-3xl font-extrabold outline-none placeholder:text-text-muted"
              />
            </div>
            
            <div className="flex justify-end gap-2 mt-4">
              {['25%', '50%', 'MAX'].map(pct => (
                <button key={pct} className="text-[10px] font-bold px-3 py-1 rounded-full bg-surface-3 text-text-muted hover:text-text-primary transition-colors">
                  {pct}
                </button>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Swap Direction Button */}
        <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 z-10">
          <button className="w-12 h-12 rounded-full bg-surface-1 border-4 border-background flex items-center justify-center text-text-muted hover:text-accent-primary hover:scale-105 transition-all shadow-surface">
            <ArrowDownUp size={20} />
          </button>
        </div>

        {/* Buy Card */}
        <Card className="bg-surface-2 border-border rounded-[24px]">
          <CardContent className="p-6">
            <div className="flex justify-between items-center mb-4">
              <span className="text-xs font-bold text-text-muted uppercase tracking-widest">You Receive</span>
              <span className="text-xs text-text-muted font-medium">Balance: 1000.00 USDC</span>
            </div>
            
            <div className="flex items-center gap-4">
              <button className="flex items-center gap-2 bg-surface-3 hover:bg-surface-1 px-4 py-2 rounded-full transition-colors border border-border">
                <div className="w-6 h-6 rounded-full bg-blue-500 flex items-center justify-center text-[10px] font-bold">US</div>
                <span className="font-bold">USDC</span>
                <ChevronDown size={16} className="text-text-muted" />
              </button>
              <input 
                type="number" 
                placeholder="0.00"
                disabled
                className="flex-1 bg-transparent text-right text-3xl font-extrabold outline-none text-text-secondary"
              />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Review Details */}
      <div className="bg-surface-1 border border-border rounded-xl p-4 text-sm">
        <div className="flex justify-between items-center mb-2">
          <span className="text-text-muted">Rate</span>
          <span className="font-medium">1 SOL ≈ 148.06 USDC</span>
        </div>
        <div className="flex justify-between items-center mb-2">
          <span className="text-text-muted">Price Impact</span>
          <span className="font-medium text-status-success">&lt; 0.1%</span>
        </div>
        <div className="flex justify-between items-center">
          <span className="text-text-muted">Network Fee</span>
          <span className="font-medium text-status-warning">0.00005 SOL</span>
        </div>
      </div>

      <Button className="w-full" size="lg" disabled={!sellAmount || parseFloat(sellAmount) <= 0}>
        Review Swap
      </Button>
    </div>
  );
}
