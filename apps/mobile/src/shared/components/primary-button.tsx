import type { ReactNode } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { theme } from "@/app/theme/theme";

interface PrimaryButtonProps {
  readonly label: string;
  readonly onPress: () => void;
  readonly disabled?: boolean;
  readonly icon?: ReactNode;
  readonly tone?: "primary" | "secondary" | "ghost";
}

/**
 * Shared button used across key wallet flows for consistency.
 */
export function PrimaryButton({
  label,
  onPress,
  disabled = false,
  icon,
  tone = "primary",
}: PrimaryButtonProps) {
  return (
    <Pressable
      accessibilityRole="button"
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [
        styles.button,
        tone === "primary" ? styles.buttonPrimary : undefined,
        tone === "secondary" ? styles.buttonSecondary : undefined,
        tone === "ghost" ? styles.buttonGhost : undefined,
        disabled ? styles.buttonDisabled : undefined,
        pressed && !disabled ? styles.buttonPressed : undefined,
      ]}
    >
      {icon ? <View style={styles.icon}>{icon}</View> : null}
      <Text
        style={[
          styles.label,
          tone === "primary" ? styles.labelPrimary : undefined,
          tone !== "primary" ? styles.labelSecondary : undefined,
        ]}
      >
        {label}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: {
    borderRadius: theme.radius.xl,
    paddingVertical: theme.spacing.md,
    paddingHorizontal: theme.spacing.md,
    minHeight: 60,
    justifyContent: "center",
    alignItems: "center",
    flexDirection: "row",
    gap: theme.spacing.xs,
    shadowColor: theme.colors.accent,
    shadowOffset: {
      width: 0,
      height: 12,
    },
    shadowOpacity: 0.18,
    shadowRadius: 28,
  },
  buttonPrimary: {
    backgroundColor: theme.colors.accent,
  },
  buttonSecondary: {
    backgroundColor: theme.colors.surfaceHighest,
    borderWidth: 1,
    borderColor: theme.colors.ghostStroke,
  },
  buttonGhost: {
    backgroundColor: "rgba(49, 53, 63, 0.28)",
    borderWidth: 1,
    borderColor: theme.colors.ghostStroke,
    shadowOpacity: 0,
  },
  buttonDisabled: {
    opacity: 0.45,
  },
  buttonPressed: {
    transform: [{ scale: 0.98 }],
  },
  icon: {
    alignItems: "center",
    justifyContent: "center",
  },
  label: {
    fontSize: 16,
    fontWeight: "700",
    letterSpacing: 0.2,
  },
  labelPrimary: {
    color: "#FFFFFF",
  },
  labelSecondary: {
    color: theme.colors.textPrimary,
  },
});
