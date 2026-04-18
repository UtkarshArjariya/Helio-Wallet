import { createContext, type ReactNode, useContext, useState } from "react";
import type {
  AppRoute,
  AppRouteName,
  AppRouteParamsMap,
  NavigationContextValue,
} from "@/navigation/navigation.types";
import { createRoute, getInitialRoute } from "@/navigation/navigation.utils";

const NavigationContext = createContext<NavigationContextValue | undefined>(
  undefined,
);

interface NavigationProviderProps {
  readonly children: ReactNode;
}

/**
 * Own lightweight typed navigator to keep flow logic explicit and reusable.
 */
export function NavigationProvider({ children }: NavigationProviderProps) {
  const [history, setHistory] = useState<AppRoute[]>([getInitialRoute()]);

  const navigate = <TName extends AppRouteName>(
    name: TName,
    params: AppRouteParamsMap[TName],
  ) => {
    const nextRoute = createRoute(name, params);
    setHistory((currentHistory) => [...currentHistory, nextRoute]);
  };

  const goBack = () => {
    setHistory((currentHistory) =>
      currentHistory.length > 1
        ? currentHistory.slice(0, currentHistory.length - 1)
        : currentHistory,
    );
  };

  const currentRoute = history[history.length - 1];

  return (
    <NavigationContext.Provider
      value={{
        currentRoute,
        canGoBack: history.length > 1,
        navigate,
        goBack,
      }}
    >
      {children}
    </NavigationContext.Provider>
  );
}

/**
 * Returns typed app navigation state and actions.
 */
export function useAppNavigation() {
  const context = useContext(NavigationContext);
  if (!context) {
    throw new Error("useAppNavigation must be used inside NavigationProvider.");
  }
  return context;
}
