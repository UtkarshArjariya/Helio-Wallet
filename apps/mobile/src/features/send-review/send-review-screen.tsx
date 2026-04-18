import { useState } from "react";
import { Alert, Pressable, StyleSheet, Text, View } from "react-native";
import { theme } from "@/app/theme/theme";
import { ReviewSectionCard } from "@/features/send-review/components/review-section-card";
import { WarningBanner } from "@/features/send-review/components/warning-banner";
import type { SendReviewDraft } from "@/features/send-review/send-review.types";
import { buildSendReviewSections } from "@/features/send-review/send-review.utils";
import { PrimaryButton } from "@/shared/components/primary-button";
import { SafeScreen } from "@/shared/components/safe-screen";

interface SendReviewScreenProps {
  readonly draft: SendReviewDraft;
  readonly onBack: () => void;
}

function formatUsdValue(value: number | null): string {
  if (value === null) {
    return "Unavailable";
  }

  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 2,
  }).format(value);
}

function buildDisplayedSections(
  draft: SendReviewDraft,
  useAdjustedAmount: boolean,
) {
  const sections = buildSendReviewSections(draft);
  const activeAmount = useAdjustedAmount
    ? draft.reviewModel.review.adjustedAmount
    : draft.reviewModel.review.originalAmount;

  return sections.map((section) => {
    if (section.title !== "Transfer") {
      return section;
    }

    return {
      ...section,
      items: section.items.map((item) => {
        if (item.label === "Asset") {
          return { ...item, value: activeAmount.amountDisplay };
        }

        if (item.label === "Est. value") {
          return {
            ...item,
            value:
              activeAmount.usdEquivalent === null
                ? "Unavailable"
                : formatUsdValue(activeAmount.usdEquivalent),
          };
        }

        return item;
      }),
    };
  });
}

function RecipientCard({ draft }: { readonly draft: SendReviewDraft }) {
  const { recipient } = draft.reviewModel;

  return (
    <View style={styles.cardSection}>
      <Text style={styles.sectionLabel}>Recipient</Text>
      <View style={styles.recipientCard}>
        <View style={styles.recipientRow}>
          <View style={styles.recipientAvatar}>
            <Text style={styles.recipientAvatarText}>
              {(recipient.label ?? recipient.shortAddress).slice(0, 1)}
            </Text>
            {recipient.isSavedContact ? (
              <View style={styles.recipientBadge}>
                <Text style={styles.recipientBadgeText}>✓</Text>
              </View>
            ) : null}
          </View>
          <View style={styles.recipientCopy}>
            <Text style={styles.recipientTitle}>
              {recipient.label ?? "New recipient"}
            </Text>
            <Text style={styles.recipientAddress}>
              {recipient.shortAddress}
            </Text>
          </View>
        </View>
        <Text style={styles.recipientMeta}>Address book review</Text>
      </View>
    </View>
  );
}

function AmountHero({
  draft,
  useAdjustedAmount,
}: {
  readonly draft: SendReviewDraft;
  readonly useAdjustedAmount: boolean;
}) {
  const activeAmount = useAdjustedAmount
    ? draft.reviewModel.review.adjustedAmount
    : draft.reviewModel.review.originalAmount;

  return (
    <View style={styles.amountHero}>
      <View style={styles.amountHeroToken}>
        <Text style={styles.amountHeroIcon}>◉</Text>
        <Text style={styles.amountHeroMeta}>
          Sending {draft.reviewModel.asset.symbol}
        </Text>
      </View>
      <Text style={styles.amountHeroValue}>
        {activeAmount.amountDisplay.replace(
          ` ${draft.reviewModel.asset.symbol}`,
          "",
        )}
      </Text>
      <Text style={styles.amountHeroUsd}>
        ≈ {formatUsdValue(activeAmount.usdEquivalent)}
      </Text>
    </View>
  );
}

function SmartAdjustmentCard({
  draft,
  useAdjustedAmount,
  onUseAdjustedAmount,
  onUseOriginalAmount,
}: {
  readonly draft: SendReviewDraft;
  readonly useAdjustedAmount: boolean;
  readonly onUseAdjustedAmount: () => void;
  readonly onUseOriginalAmount: () => void;
}) {
  const review = draft.reviewModel.review;
  const hasAdjustment =
    review.status === "adjusted" ||
    review.originalAmount.amountAtomic !== review.adjustedAmount.amountAtomic;

  if (!hasAdjustment) {
    return null;
  }

  return (
    <View style={styles.adjustmentCard}>
      <View style={styles.adjustmentHeader}>
        <Text style={styles.adjustmentIcon}>✦</Text>
        <Text style={styles.adjustmentTitle}>Smart Adjustment Applied</Text>
      </View>

      <View style={styles.adjustmentAmounts}>
        <View>
          <Text style={styles.adjustmentLabel}>Original</Text>
          <Text style={styles.adjustmentOriginal}>
            {review.originalAmount.amountDisplay}
          </Text>
        </View>

        <Text style={styles.adjustmentArrow}>→</Text>

        <View style={styles.adjustmentTarget}>
          <Text style={styles.adjustmentLabelAccent}>Adjusted</Text>
          <Text style={styles.adjustmentValue}>
            {review.adjustedAmount.amountDisplay}
          </Text>
        </View>
      </View>

      {review.reasons.map((reason) => (
        <Text key={reason.code} style={styles.adjustmentReason}>
          {reason.message}
        </Text>
      ))}

      <View style={styles.adjustmentActions}>
        <PrimaryButton
          label="Accept Adjustment"
          onPress={onUseAdjustedAmount}
          tone={useAdjustedAmount ? "secondary" : "ghost"}
        />
        <PrimaryButton
          label="Send Original"
          onPress={onUseOriginalAmount}
          tone={!useAdjustedAmount ? "secondary" : "ghost"}
        />
      </View>
    </View>
  );
}

function BottomTabs() {
  return (
    <View style={styles.bottomTabs}>
      <Text style={styles.bottomTab}>Vault</Text>
      <Text style={[styles.bottomTab, styles.bottomTabActive]}>Activity</Text>
      <Text style={styles.bottomTab}>Swap</Text>
      <Text style={styles.bottomTab}>Settings</Text>
    </View>
  );
}

/**
 * Simulation-first send review flow that surfaces risk before signing.
 */
export function SendReviewScreen({ draft, onBack }: SendReviewScreenProps) {
  const review = draft.reviewModel.review;
  const hasBlockingWarning = draft.warnings.some((warning) => warning.blocking);
  const hasAdjustment =
    review.status === "adjusted" ||
    review.originalAmount.amountAtomic !== review.adjustedAmount.amountAtomic;
  const [useAdjustedAmount, setUseAdjustedAmount] = useState(hasAdjustment);
  const sections = buildDisplayedSections(draft, useAdjustedAmount);

  const handleConfirm = () => {
    if (hasBlockingWarning) {
      Alert.alert(
        "Review required",
        "This transaction has blocking warnings. Edit and re-simulate before signing.",
      );
      return;
    }

    Alert.alert(
      "Shell action",
      useAdjustedAmount
        ? "Helio would sign the adjusted transaction in the production flow."
        : "Helio would sign the original transaction in the production flow.",
    );
  };

  return (
    <SafeScreen
      contentStyle={styles.screen}
      scrollContentStyle={styles.scrollContent}
    >
      <View style={styles.topBar}>
        <Pressable accessibilityRole="button" onPress={onBack}>
          <Text style={styles.backLabel}>Back</Text>
        </Pressable>
        <Text style={styles.brand}>HELIO</Text>
      </View>

      <RecipientCard draft={draft} />
      <AmountHero draft={draft} useAdjustedAmount={useAdjustedAmount} />

      {draft.warnings.map((warning) => (
        <WarningBanner key={warning.code} warning={warning} />
      ))}

      <SmartAdjustmentCard
        draft={draft}
        useAdjustedAmount={useAdjustedAmount}
        onUseAdjustedAmount={() => setUseAdjustedAmount(true)}
        onUseOriginalAmount={() => setUseAdjustedAmount(false)}
      />

      {sections.map((section) => (
        <ReviewSectionCard key={section.title} section={section} />
      ))}

      <View style={styles.primaryActionWrap}>
        <PrimaryButton
          disabled={hasBlockingWarning}
          label={hasBlockingWarning ? "Blocked Until Fixed" : "Confirm & Send"}
          onPress={handleConfirm}
        />
      </View>

      <BottomTabs />
    </SafeScreen>
  );
}

const styles = StyleSheet.create({
  screen: {
    paddingTop: theme.spacing.md,
    paddingBottom: theme.spacing.xxl,
  },
  scrollContent: {
    paddingBottom: theme.spacing.xxl,
  },
  topBar: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  backLabel: {
    color: theme.colors.accentSoft,
    fontSize: 15,
    fontWeight: "700",
  },
  brand: {
    color: theme.colors.accent,
    fontSize: 20,
    fontWeight: "900",
    letterSpacing: 1.6,
  },
  cardSection: {
    gap: theme.spacing.sm,
  },
  sectionLabel: {
    color: theme.colors.textMuted,
    fontSize: 12,
    fontWeight: "700",
    textTransform: "uppercase",
    letterSpacing: 1.4,
  },
  recipientCard: {
    backgroundColor: "rgba(49, 53, 63, 0.42)",
    borderWidth: 1,
    borderColor: theme.colors.ghostStroke,
    borderRadius: theme.radius.lg,
    padding: theme.spacing.md,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: theme.spacing.md,
  },
  recipientRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: theme.spacing.md,
    flex: 1,
  },
  recipientAvatar: {
    width: 48,
    height: 48,
    borderRadius: theme.radius.pill,
    backgroundColor: theme.colors.surfaceHigh,
    justifyContent: "center",
    alignItems: "center",
  },
  recipientAvatarText: {
    color: theme.colors.accentSoft,
    fontSize: 18,
    fontWeight: "800",
  },
  recipientBadge: {
    position: "absolute",
    right: -2,
    bottom: -2,
    width: 18,
    height: 18,
    borderRadius: theme.radius.pill,
    backgroundColor: theme.colors.accentMuted,
    alignItems: "center",
    justifyContent: "center",
  },
  recipientBadgeText: {
    color: theme.colors.backgroundCanvas,
    fontSize: 10,
    fontWeight: "800",
  },
  recipientCopy: {
    flex: 1,
    gap: theme.spacing.xxs,
  },
  recipientTitle: {
    color: theme.colors.textPrimary,
    fontSize: 20,
    fontWeight: "700",
  },
  recipientAddress: {
    color: theme.colors.textMuted,
    fontSize: 14,
  },
  recipientMeta: {
    color: theme.colors.textMuted,
    fontSize: 12,
  },
  amountHero: {
    alignItems: "center",
    gap: theme.spacing.xs,
    paddingVertical: theme.spacing.sm,
  },
  amountHeroToken: {
    flexDirection: "row",
    alignItems: "center",
    gap: theme.spacing.sm,
  },
  amountHeroIcon: {
    color: theme.colors.accentMuted,
    fontSize: 28,
  },
  amountHeroMeta: {
    color: theme.colors.textMuted,
    fontSize: 15,
    fontWeight: "600",
  },
  amountHeroValue: {
    color: theme.colors.accentSecondarySoft,
    fontSize: 54,
    lineHeight: 58,
    fontWeight: "900",
    letterSpacing: -2,
  },
  amountHeroUsd: {
    color: theme.colors.textMuted,
    fontSize: 18,
    fontWeight: "600",
  },
  adjustmentCard: {
    backgroundColor: "rgba(49, 53, 63, 0.42)",
    borderRadius: theme.radius.lg,
    borderLeftWidth: 4,
    borderLeftColor: theme.colors.accentMuted,
    padding: theme.spacing.lg,
    gap: theme.spacing.md,
  },
  adjustmentHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: theme.spacing.sm,
  },
  adjustmentIcon: {
    color: theme.colors.accentMuted,
    fontSize: 18,
  },
  adjustmentTitle: {
    color: theme.colors.accentMuted,
    fontSize: 13,
    fontWeight: "800",
    textTransform: "uppercase",
    letterSpacing: 1.2,
  },
  adjustmentAmounts: {
    flexDirection: "row",
    alignItems: "flex-end",
    justifyContent: "space-between",
    gap: theme.spacing.md,
  },
  adjustmentLabel: {
    color: theme.colors.textMuted,
    fontSize: 11,
    textTransform: "uppercase",
    letterSpacing: 1,
  },
  adjustmentOriginal: {
    color: theme.colors.textSecondary,
    fontSize: 14,
    textDecorationLine: "line-through",
  },
  adjustmentArrow: {
    color: theme.colors.textMuted,
    fontSize: 22,
    marginBottom: 3,
  },
  adjustmentTarget: {
    alignItems: "flex-end",
  },
  adjustmentLabelAccent: {
    color: theme.colors.accentMuted,
    fontSize: 11,
    textTransform: "uppercase",
    letterSpacing: 1,
  },
  adjustmentValue: {
    color: theme.colors.accentSecondarySoft,
    fontSize: 24,
    fontWeight: "800",
  },
  adjustmentReason: {
    color: theme.colors.textSecondary,
    fontSize: 14,
    lineHeight: 22,
  },
  adjustmentActions: {
    gap: theme.spacing.sm,
  },
  primaryActionWrap: {
    marginTop: theme.spacing.sm,
  },
  bottomTabs: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingTop: theme.spacing.md,
  },
  bottomTab: {
    color: theme.colors.textMuted,
    fontSize: 12,
    fontWeight: "600",
  },
  bottomTabActive: {
    color: theme.colors.accentMuted,
  },
});
