import type { SendReviewDraft } from "@/features/send-review/send-review.types";

export interface SendReviewRouteParams {
  readonly draft: SendReviewDraft;
}

export interface AppRouteParamsMap {
  readonly onboarding: undefined;
  readonly home: undefined;
  readonly sendReview: SendReviewRouteParams;
}

export type AppRouteName = keyof AppRouteParamsMap;

export interface AppRoute<TName extends AppRouteName = AppRouteName> {
  readonly name: TName;
  readonly params: AppRouteParamsMap[TName];
}

export interface NavigationContextValue {
  readonly currentRoute: AppRoute;
  readonly canGoBack: boolean;
  navigate: <TName extends AppRouteName>(
    name: TName,
    params: AppRouteParamsMap[TName],
  ) => void;
  goBack: () => void;
}
