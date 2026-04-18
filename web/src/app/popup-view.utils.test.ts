import { describe, expect, it } from "vitest";
import { resolvePopupView } from "./popup-view.utils";

describe("resolvePopupView", () => {
  it("returns dashboard when no mode is provided", () => {
    expect(resolvePopupView("chrome-extension://id/index.html")).toBe(
      "dashboard",
    );
  });

  it("returns approval for query mode", () => {
    expect(
      resolvePopupView("chrome-extension://id/index.html?view=approval"),
    ).toBe("approval");
  });

  it("returns approval for hash mode", () => {
    expect(resolvePopupView("chrome-extension://id/index.html#approval")).toBe(
      "approval",
    );
  });
});
