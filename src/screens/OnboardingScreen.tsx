import React, { useState } from 'react'
import { Orbit } from 'lucide-react'
import { Button } from '../components/ui/button'
import { useRouter } from '../contexts/RouterContext'

export function OnboardingScreen() {
  const { navigate } = useRouter()
  
  return (
    <div className="flex flex-col min-h-[80vh] animate-in fade-in duration-700 max-w-md mx-auto text-center justify-center">
      <div className="flex-1 flex flex-col items-center justify-center">
        <div className="relative w-32 h-32 mb-8 flex items-center justify-center">
          <div className="absolute inset-0 bg-accent-primary opacity-20 blur-3xl rounded-full"></div>
          <Orbit className="w-24 h-24 text-accent-primary relative z-10" />
        </div>
        
        <h1 className="font-heading text-4xl font-bold tracking-tight mb-4">
          Your wallet.<br/>In orbit.
        </h1>
        <p className="text-text-muted mb-12 max-w-[280px] mx-auto text-lg leading-relaxed">
          Own your assets. Automate your growth with Helio Vault.
        </p>
      </div>

      <div className="space-y-4 w-full pb-8">
        <Button 
          className="w-full text-lg h-14" 
          onClick={() => navigate('/')}
        >
          Create new wallet
        </Button>
        <Button 
          variant="ghost" 
          className="w-full text-lg h-14 text-text-secondary" 
          onClick={() => navigate('/')}
        >
          I already have a wallet
        </Button>
      </div>
    </div>
  )
}
