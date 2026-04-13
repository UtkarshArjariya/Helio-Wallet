import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { App } from "./app";

afterEach(() => {
  cleanup();
  window.history.pushState({}, "", "/index.html");
});

describe("App", () => {
  it("renders dashboard by default", () => {
    render(<App />);
    expect(
      screen.getByRole("heading", { name: "Primary Vault" }),
    ).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Assets" })).toBeInTheDocument();
  });

  it("renders approval surface when approval mode is active", () => {
    window.history.pushState({}, "", "/index.html?view=approval");
    render(<App />);
    expect(
      screen.getByRole("heading", { name: "Summary" }),
    ).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Approve" })).toBeInTheDocument();
  });
});
