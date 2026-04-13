import { StatusBar } from "react-native";
import { theme } from "@/app/theme/theme";
import { AppNavigator } from "@/navigation/app-navigator";
import { NavigationProvider } from "@/navigation/navigation-provider";
import { OrbBackground } from "@/shared/components/orb-background";

/**
 * Helio mobile shell root with app-level providers.
 */
export function HelioMobileApp() {
  return (
    <OrbBackground>
      <StatusBar
        animated
        barStyle="light-content"
        backgroundColor={theme.colors.background}
      />
      <NavigationProvider>
        <AppNavigator />
      </NavigationProvider>
    </OrbBackground>
  );
}
