import type { ReactNode } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { theme } from "@/app/theme/theme";

interface PrimaryButtonProps {
  readonly label: string;
  readonly onPress: () => void;
  readonly disabled?: boolean;
  readonly icon?: ReactNode;
}

/**
 * Shared button used across key wallet flows for consistency.
 */
export function PrimaryButton({
  label,
  onPress,
  disabled = false,
  icon,
}: PrimaryButtonProps) {
  return (
    <Pressable
      accessibilityRole="button"
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [
        styles.button,
        disabled ? styles.buttonDisabled : undefined,
        pressed && !disabled ? styles.buttonPressed : undefined,
      ]}
    >
      {icon ? <View style={styles.icon}>{icon}</View> : null}
      <Text style={styles.label}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: {
    backgroundColor: theme.colors.accent,
    borderRadius: theme.radius.md,
    paddingVertical: theme.spacing.sm,
    paddingHorizontal: theme.spacing.md,
    minHeight: 52,
    justifyContent: "center",
    alignItems: "center",
    flexDirection: "row",
    gap: theme.spacing.xs,
  },
  buttonDisabled: {
    opacity: 0.45,
  },
  buttonPressed: {
    transform: [{ scale: 0.99 }],
  },
  icon: {
    alignItems: "center",
    justifyContent: "center",
  },
  label: {
    color: "#0c1e2c",
    fontSize: 16,
    fontWeight: "700",
  },
});
