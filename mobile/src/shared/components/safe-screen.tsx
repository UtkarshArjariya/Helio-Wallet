import type { ReactNode } from "react";
import type { StyleProp, ViewStyle } from "react-native";
import { SafeAreaView, ScrollView, StyleSheet, View } from "react-native";
import { theme } from "@/app/theme/theme";

interface SafeScreenProps {
  readonly children: ReactNode;
  readonly contentStyle?: StyleProp<ViewStyle>;
  readonly scrollContentStyle?: StyleProp<ViewStyle>;
  readonly showsVerticalScrollIndicator?: boolean;
}

/**
 * Shared safe-area screen wrapper with consistent padding and background.
 */
export function SafeScreen({
  children,
  contentStyle,
  scrollContentStyle,
  showsVerticalScrollIndicator = false,
}: SafeScreenProps) {
  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView
        contentContainerStyle={[styles.scrollContent, scrollContentStyle]}
        showsVerticalScrollIndicator={showsVerticalScrollIndicator}
      >
        <View style={[styles.content, contentStyle]}>{children}</View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: theme.colors.backgroundCanvas,
  },
  scrollContent: {
    flexGrow: 1,
  },
  content: {
    flex: 1,
    paddingHorizontal: theme.spacing.lg,
    paddingVertical: theme.spacing.lg,
    gap: theme.spacing.lg,
  },
});
