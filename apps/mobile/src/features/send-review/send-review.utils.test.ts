import { describe, expect, it } from "vitest";
import type { SendReviewDraft } from "@/features/send-review/send-review.types";
import {
  buildSendReviewSections,
  createMockSendReviewDraft,
  deriveSendWarnings,
  formatSol,
  validateSendReviewDraft,
} from "@/features/send-review/send-review.utils";

describe("send-review.utils", () => {
  it("formats SOL values with fixed precision", () => {
    expect(formatSol(0.1)).toBe("0.100000 SOL");
  });

  it("throws for invalid SOL formatting values", () => {
    expect(() => formatSol(-1)).toThrow();
    expect(() => formatSol(Number.NaN)).toThrow();
  });

  it("builds sections for a valid draft", () => {
    const draft = createMockSendReviewDraft();
    const sections = buildSendReviewSections(draft);
    expect(sections.length).toBe(3);
    expect(sections[0].title).toBe("Transfer");
  });

  it("derives blocking warning when simulation fails", () => {
    const originalDraft = createMockSendReviewDraft();
    const draft: SendReviewDraft = {
      ...originalDraft,
      reviewModel: {
        ...originalDraft.reviewModel,
        review: {
          ...originalDraft.reviewModel.review,
          status: "blocked",
          reasons: [
            {
              code: "simulation-warning",
              title: "Simulation warning",
              message: "The transaction is expected to fail.",
              amountLamports: 0,
              severity: "critical",
            },
          ],
        },
      },
    };
    const warnings = deriveSendWarnings(draft);
    expect(warnings.some((warning) => warning.blocking)).toBe(true);
  });

  it("validates required draft values", () => {
    const draft = createMockSendReviewDraft();
    expect(() => validateSendReviewDraft(draft)).not.toThrow();
    expect(() =>
      validateSendReviewDraft({
        ...draft,
        reviewModel: {
          ...draft.reviewModel,
          recipient: {
            ...draft.reviewModel.recipient,
            address: "",
          },
        },
      }),
    ).toThrow();
  });
});
