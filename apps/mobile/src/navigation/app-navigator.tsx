import { HomeScreen } from "@/features/home/home-screen";
import { OnboardingScreen } from "@/features/onboarding/onboarding-screen";
import { createMockSendReviewDraft } from "@/features/send-review/send-review.utils";
import { SendReviewScreen } from "@/features/send-review/send-review-screen";
import { useAppNavigation } from "@/navigation/navigation-provider";

/**
 * Route switchboard for the mobile shell.
 */
export function AppNavigator() {
  const { canGoBack, currentRoute, goBack, navigate } = useAppNavigation();

  if (currentRoute.name === "onboarding") {
    return (
      <OnboardingScreen
        onComplete={() => navigate("home", undefined)}
        onPreviewSend={() =>
          navigate("sendReview", { draft: createMockSendReviewDraft() })
        }
      />
    );
  }

  if (currentRoute.name === "home") {
    return (
      <HomeScreen
        onOpenSendReview={() =>
          navigate("sendReview", { draft: createMockSendReviewDraft() })
        }
      />
    );
  }

  if (currentRoute.name === "sendReview") {
    const draft = currentRoute.params?.draft ?? createMockSendReviewDraft();

    return (
      <SendReviewScreen
        draft={draft}
        onBack={canGoBack ? goBack : () => navigate("home", undefined)}
      />
    );
  }

  return (
    <HomeScreen
      onOpenSendReview={() =>
        navigate("sendReview", { draft: createMockSendReviewDraft() })
      }
    />
  );
}
