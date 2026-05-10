import React, { createContext, useContext, useState } from 'react'

export const WALLET_ADDRESS_KEY = 'helio:address'

type RouterContextType = {
  location: string
  navigate: (path: string) => void
}

const RouterContext = createContext<RouterContextType | undefined>(undefined)

export function RouterProvider({ children }: { children: React.ReactNode }) {
  const [location, setLocation] = useState<string>(() => {
    // Start at onboarding if no wallet address has been saved yet
    const saved = localStorage.getItem(WALLET_ADDRESS_KEY)
    return saved ? '/' : '/welcome'
  })

  const navigate = (path: string) => {
    setLocation(path)
    window.history.pushState({}, '', path)
  }

  return (
    <RouterContext.Provider value={{ location, navigate }}>
      {children}
    </RouterContext.Provider>
  )
}

export function useRouter() {
  const ctx = useContext(RouterContext)
  if (!ctx) throw new Error('useRouter must be used within RouterProvider')
  return ctx
}
