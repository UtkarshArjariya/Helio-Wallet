import React, { createContext, useContext, useState, ReactNode } from 'react';

type RouterContextType = {
  location: string;
  navigate: (path: string) => void;
};

const RouterContext = createContext<RouterContextType | undefined>(undefined);

export function RouterProvider({ children }: { children: ReactNode }) {
  const [location, setLocation] = useState<string>('/');

  const navigate = (path: string) => {
    setLocation(path);
    // Push state so browser history works partially if needed
    window.history.pushState({}, '', path);
  };

  return (
    <RouterContext.Provider value={{ location, navigate }}>
      {children}
    </RouterContext.Provider>
  );
}

export function useRouter() {
  const context = useContext(RouterContext);
  if (context === undefined) {
    throw new Error('useRouter must be used within a RouterProvider');
  }
  return context;
}
