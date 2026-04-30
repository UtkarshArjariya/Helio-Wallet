import React, { useState } from 'react'
import { ArrowLeft, Eye, EyeOff } from 'lucide-react'
import { Card, CardContent } from '../components/ui/card'
import { Button } from '../components/ui/button'
import { Input } from '../components/ui/input'
import { useRouter } from '../contexts/RouterContext'

export function CreatePasswordScreen() {
  const { navigate } = useRouter()
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [agreed, setAgreed] = useState(false)

  const isValid = password.length >= 8 && password === confirmPassword && agreed

  return (
    <div className="space-y-6 animate-in fade-in duration-500 max-w-md mx-auto h-full flex flex-col pt-4">
      <div className="flex items-center gap-4 mb-2">
        <button onClick={() => navigate(-1 as any)} className="p-2 -ml-2 rounded-full hover:bg-surface-2 transition-colors">
          <ArrowLeft className="h-6 w-6" />
        </button>
        <h2 className="font-heading text-xl font-bold">Create Password</h2>
      </div>

      <Card className="flex-1 overflow-hidden flex flex-col">
        <CardContent className="p-6 md:p-8 flex-1 flex flex-col space-y-6">
          <div className="space-y-2">
            <h3 className="font-bold text-lg">Secure your wallet</h3>
            <p className="text-sm text-text-muted">
              This password will unlock your wallet on this device only.
            </p>
          </div>

          <div className="space-y-4">
            <div className="space-y-2">
              <label className="text-sm font-medium text-text-muted">New Password</label>
              <div className="relative">
                <Input 
                  type={showPassword ? "text" : "password"} 
                  placeholder="At least 8 characters" 
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="pr-10"
                />
                <button 
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-text-muted hover:text-text-primary transition-colors"
                  onClick={() => setShowPassword(!showPassword)}
                >
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium text-text-muted">Confirm Password</label>
              <div className="relative">
                <Input 
                  type={showPassword ? "text" : "password"} 
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                />
              </div>
            </div>
            
            <div className="flex items-start gap-3 pt-2">
              <input 
                type="checkbox" 
                id="terms" 
                className="mt-1 h-4 w-4 rounded border-border bg-surface-3 text-accent-primary focus:ring-accent-primary focus:ring-offset-background cursor-pointer"
                checked={agreed}
                onChange={(e) => setAgreed(e.target.checked)}
              />
              <label htmlFor="terms" className="text-sm text-text-muted cursor-pointer leading-relaxed">
                I agree to the <span className="text-accent-primary hover:underline">Terms of Service</span> and <span className="text-accent-primary hover:underline">Privacy Policy</span>.
              </label>
            </div>
          </div>
          
          <div className="mt-auto pt-6">
            <Button 
              className="w-full" 
              onClick={() => navigate('/')}
              disabled={!isValid}
            >
              Continue
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
