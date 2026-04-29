import React, { useState } from 'react'
import { Card, CardContent } from '../ui/card'
import { Button } from '../ui/button'

export function VaultWizard({ onComplete }: { onComplete: () => void }) {
  const [step, setStep] = useState(1)

  return (
    <Card className="max-w-md mx-auto">
      <CardContent className="p-8 text-center space-y-6">
        <h3 className="font-heading font-bold text-2xl">
          {step === 1 && "Choose Auto-Save Rule"}
          {step === 2 && "Set Threshold"}
          {step === 3 && "Choose Strategy"}
        </h3>
        
        <p className="text-text-muted text-sm">
          {step === 1 && "How do you want to accumulate spare change?"}
          {step === 2 && "When should we deploy your funds?"}
          {step === 3 && "Where should your funds go to earn yield?"}
        </p>

        {/* Placeholder for Wizard Content */}
        <div className="h-40 bg-surface-2 rounded-xl flex items-center justify-center border border-border border-dashed">
           <span className="text-text-muted text-sm">Step {step} Configuration</span>
        </div>

        <div className="flex gap-3 pt-4">
          {step > 1 && (
            <Button variant="outline" className="flex-1" onClick={() => setStep(step - 1)}>
              Back
            </Button>
          )}
          <Button 
            className="flex-1" 
            onClick={() => {
              if (step < 3) setStep(step + 1)
              else onComplete()
            }}
          >
            {step < 3 ? "Next" : "Activate Vault"}
          </Button>
        </div>
      </CardContent>
    </Card>
  )
}
