import React from 'react'
import { SidebarNav } from './SidebarNav'
import { BottomNav } from './BottomNav'
import { WalletProvider } from '../../contexts/WalletContext'
import { RouterProvider } from '../../contexts/RouterContext'
import { Wallet, Settings, Bell } from 'lucide-react'
import { useWallet } from '../../contexts/WalletContext'

function TopHeader() {
  const { name, address } = useWallet()
  
  return (
    <header className="sticky top-0 z-40 flex items-center justify-between px-4 py-4 md:px-8 bg-background/80 backdrop-blur-md border-b border-border md:border-b-0 md:bg-transparent">
      <div className="flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-full bg-accent-primary text-accent-primary-foreground shadow-glow">
          <Wallet className="h-5 w-5" />
        </div>
        <div>
          <h1 className="font-heading text-sm font-bold">{name}</h1>
          <p className="text-xs text-text-muted font-mono">{address}</p>
        </div>
      </div>
      <div className="flex items-center gap-2">
        <button className="p-2 text-text-muted hover:text-text-primary transition-colors">
          <Bell className="h-5 w-5" />
        </button>
        <button className="p-2 text-text-muted hover:text-text-primary transition-colors md:hidden">
          <Settings className="h-5 w-5" />
        </button>
      </div>
    </header>
  )
}

export function AppShell({ children }: { children: React.ReactNode }) {
  return (
    <RouterProvider>
      <WalletProvider>
        {/* The main container limits max width on large screens to act like a centered app, but for actual extension it will be 100% */}
        <div className="flex h-screen w-full bg-background text-text-primary overflow-hidden font-sans mx-auto max-w-[1440px]">
          <SidebarNav />
          <main className="flex-1 flex flex-col relative overflow-hidden">
            <TopHeader />
            <div className="flex-1 overflow-y-auto pb-24 md:pb-0 px-4 md:px-8">
              <div className="max-w-4xl mx-auto py-6">
                {children}
              </div>
            </div>
            <BottomNav />
          </main>
        </div>
      </WalletProvider>
    </RouterProvider>
  )
}
