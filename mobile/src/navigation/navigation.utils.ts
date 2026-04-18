import type {
  AppRoute,
  AppRouteName,
  AppRouteParamsMap,
  SendReviewRouteParams,
} from "@/navigation/navigation.types";

/**
 * Creates the app's initial route.
 */
export function getInitialRoute(): AppRoute<"onboarding"> {
  return { name: "onboarding", params: undefined };
}

/**
 * Guards route params before pushing them into navigation state.
 */
export function validateRouteParams<TName extends AppRouteName>(
  name: TName,
  params: AppRouteParamsMap[TName],
): void {
  if (name === "sendReview") {
    const typedParams = params as SendReviewRouteParams | undefined;
    if (!typedParams?.draft) {
      throw new Error(
        "Cannot navigate to send review without a transaction draft.",
      );
    }
  }
}

/**
 * Builds route object after validation for predictable state updates.
 */
export function createRoute<TName extends AppRouteName>(
  name: TName,
  params: AppRouteParamsMap[TName],
): AppRoute<TName> {
  validateRouteParams(name, params);
  return { name, params };
}
