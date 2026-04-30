import React, { useState } from 'react'
import { Orbit, Plus, Play, Pause, ExternalLink, Copy } from 'lucide-react'
import { Card, CardContent } from '../components/ui/card'
import { Button } from '../components/ui/button'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '../components/ui/tabs'
import { VaultRules } from '../components/vault/VaultRules'
import { StrategySelector } from '../components/vault/StrategySelector'
import { useWallet } from '../contexts/WalletContext'
import { cn } from '../lib/utils'

export function VaultScreen() {
  const { vault, updateVault } = useWallet()
  const [activeTab, setActiveTab] = useState("overview")

  const progress = Math.min((vault.balance / vault.threshold) * 100, 100)

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500 max-w-5xl mx-auto">
      <div className="flex items-center justify-between mb-2">
        <h2 className="font-heading text-2xl font-bold flex items-center gap-2">
          <Orbit className="h-7 w-7 text-accent-primary" />
          Helio Vault
        </h2>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        
        {/* Left Column - Overview */}
        <div className="lg:col-span-5 space-y-6">
          <Card className="relative overflow-hidden border border-accent-primary/20 bg-surface-1">
            <div className="absolute top-0 right-0 p-4">
              <span className={cn(
                "text-[10px] font-bold uppercase tracking-wider px-2 py-1 rounded-full",
                vault.isActive ? "bg-success/10 text-success" : "bg-warning/10 text-warning"
              )}>
                {vault.isActive ? "Accumulating" : "Paused"}
              </span>
            </div>
            <CardContent className="p-6 pt-10 text-center">
              <p className="text-sm font-medium text-text-muted mb-2 uppercase tracking-wider">Vault Balance</p>
              <h3 className="text-4xl font-heading font-bold text-accent-primary shadow-glow mb-8">
                {vault.balance.toFixed(3)} SOL
              </h3>

              <div className="mb-6">
                <div className="flex justify-between text-xs text-text-muted mb-2">
                  <span>Progress to threshold</span>
                  <span>{vault.threshold.toFixed(2)} SOL</span>
                </div>
                <div className="h-2 w-full bg-surface-3 rounded-full overflow-hidden">
                  <div 
                    className="h-full bg-accent-primary transition-all duration-1000 ease-out"
                    style={{ width: `${progress}%` }}
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4 mb-6">
                <div className="bg-surface-2 p-3 rounded-xl border border-border/50 text-left">
                  <p className="text-[10px] text-text-muted uppercase tracking-wider mb-1">Deployed</p>
                  <p className="font-bold text-sm">{vault.deployed.toFixed(2)} SOL</p>
                </div>
                <div className="bg-surface-2 p-3 rounded-xl border border-border/50 text-left">
                  <p className="text-[10px] text-text-muted uppercase tracking-wider mb-1">Rewards</p>
                  <p className="font-bold text-sm text-success">+{vault.rewards.toFixed(3)} SOL</p>
                </div>
              </div>

              <div className="space-y-3">
                <Button className="w-full gap-2">
                  <Plus className="h-4 w-4" /> Add Funds
                </Button>
                <div className="flex gap-3">
                  <Button 
                    variant="secondary" 
                    className="flex-1 gap-2 text-xs"
                    onClick={() => updateVault({ isActive: !vault.isActive })}
                  >
                    {vault.isActive ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
                    {vault.isActive ? "Pause" : "Activate"}
                  </Button>
                  <Button variant="outline" className="flex-1 text-xs">
                    Withdraw
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Right Column - Config & Details */}
        <div className="lg:col-span-7">
          <Tabs className="w-full">
            <TabsList className="mb-6 grid grid-cols-3">
              <TabsTrigger 
                value="rules" 
                active={activeTab === "rules"} 
                onClick={() => setActiveTab("rules")}
              >
                Rules
              </TabsTrigger>
              <TabsTrigger 
                value="strategy" 
                active={activeTab === "strategy"} 
                onClick={() => setActiveTab("strategy")}
              >
                Strategy
              </TabsTrigger>
              <TabsTrigger 
                value="advanced" 
                active={activeTab === "advanced"} 
                onClick={() => setActiveTab("advanced")}
              >
                Advanced
              </TabsTrigger>
            </TabsList>

            <TabsContent value="rules" active={activeTab === "rules"} className="space-y-4">
              <VaultRules />
            </TabsContent>

            <TabsContent value="strategy" active={activeTab === "strategy"} className="space-y-4">
              <StrategySelector />
            </TabsContent>

            <TabsContent value="advanced" active={activeTab === "advanced"} className="space-y-4">
              <Card>
                <CardContent className="p-6 space-y-4">
                  <h3 className="font-heading font-bold text-lg">Vault Account Details</h3>
                  <div className="space-y-3">
                    <div className="flex justify-between items-center py-2 border-b border-border/50 text-sm">
                      <span className="text-text-muted">Vault Address (PDA)</span>
                      <div className="flex items-center gap-2">
                        <span className="font-mono">HeV1...9xP</span>
                        <Copy className="h-3 w-3 text-text-muted cursor-pointer hover:text-text-primary" />
                        <ExternalLink className="h-3 w-3 text-text-muted cursor-pointer hover:text-text-primary" />
                      </div>
                    </div>
                    <div className="flex justify-between items-center py-2 border-b border-border/50 text-sm">
                      <span className="text-text-muted">Network</span>
                      <span>Solana Mainnet</span>
                    </div>
                    <div className="flex justify-between items-center py-2 border-b border-border/50 text-sm">
                      <span className="text-text-muted">Last Deployed</span>
                      <span>3 days ago</span>
                    </div>
                  </div>
                  <p className="text-xs text-text-muted mt-4">
                    The vault is a smart contract Program Derived Address (PDA) linked to your public key. Funds are automatically deployed based on your threshold settings.
                  </p>
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        </div>

      </div>
    </div>
  )
}
