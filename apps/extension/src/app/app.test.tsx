import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it } from "vitest";
import { resetExtensionMemoryStorage } from "../extension-runtime/extension-storage";
import { sendLocalExtensionMessage } from "../extension-runtime/local-extension-client";
import { resetMockRpcClientState } from "../extension-runtime/mock-rpc-client";
import { App } from "./app";

afterEach(() => {
  cleanup();
  resetExtensionMemoryStorage();
  resetMockRpcClientState();
  window.history.pushState({}, "", "/index.html");
});

async function createWalletAndOpenDashboard(
  user: ReturnType<typeof userEvent.setup>,
  container: HTMLElement,
) {
  await user.click(
    await screen.findByRole("button", { name: /Create New Wallet/ }),
  );
  await user.type(
    screen.getByPlaceholderText("Create a strong password"),
    "StrongPass1",
  );
  await user.type(
    screen.getByPlaceholderText("Confirm password"),
    "StrongPass1",
  );
  await user.click(screen.getByRole("button", { name: "Continue to backup" }));

  await user.click(screen.getByRole("checkbox"));
  const mnemonicWords = Array.from(
    container.querySelectorAll(".seed-pill strong"),
  ).map((element) => element.textContent ?? "");

  await user.click(
    screen.getByRole("button", { name: "Continue to verification" }),
  );

  await user.type(
    screen.getByPlaceholderText("Enter word 2"),
    mnemonicWords[1] ?? "",
  );
  await user.type(
    screen.getByPlaceholderText("Enter word 6"),
    mnemonicWords[5] ?? "",
  );
  await user.type(
    screen.getByPlaceholderText("Enter word 12"),
    mnemonicWords[11] ?? "",
  );
  await user.click(
    screen.getByRole("button", { name: "Verify recovery phrase" }),
  );
  await user.click(
    screen.getByRole("button", { name: "Open wallet dashboard" }),
  );
  await screen.findByRole("button", { name: "Receive" });
}

async function seedPendingDappConnection() {
  const walletCreation = await sendLocalExtensionMessage(
    "helio/begin-wallet-creation",
    undefined,
  );

  await sendLocalExtensionMessage("helio/create-wallet", {
    biometricsEnabled: false,
    mnemonicWords: walletCreation.mnemonicWords,
    password: "StrongPass1",
  });

  await sendLocalExtensionMessage("helio/connect-dapp", {
    origin: "https://app.jupiter.exchange",
    name: "Jupiter",
    iconUrl: null,
  }).catch(() => undefined);
}

async function approveTrustedOrigin(origin: string, name: string) {
  await sendLocalExtensionMessage("helio/connect-dapp", {
    origin,
    name,
    iconUrl: null,
  }).catch(() => undefined);

  const pendingRequest = await sendLocalExtensionMessage(
    "helio/get-pending-dapp-request",
    undefined,
  );

  await sendLocalExtensionMessage("helio/approve-dapp-request", {
    requestId: pendingRequest?.id ?? "",
  });
}

describe("App", () => {
  it("renders the onboarding welcome flow by default", async () => {
    render(<App />);
    expect(
      await screen.findByRole("heading", {
        name: "Create, import, and send with confidence.",
      }),
    ).toBeInTheDocument();
    expect(
      await screen.findByRole("button", { name: /Create New Wallet/ }),
    ).toBeInTheDocument();
  });

  it("moves through wallet creation into transaction status", async () => {
    const user = userEvent.setup();

    const { container } = render(<App />);

    await createWalletAndOpenDashboard(user, container);
    await user.click(await screen.findByRole("button", { name: "Send" }));
    await user.selectOptions(screen.getByRole("combobox"), "SOL");
    await user.type(screen.getByPlaceholderText("0.00"), "402.11");
    await user.type(
      screen.getByPlaceholderText("Enter a Solana address"),
      "67sN4CYjR1a3vK5WpfRppGhN3VnWui6cKVXfQePk9n5G",
    );
    await user.click(
      screen.getByRole("button", { name: "Review transaction" }),
    );
    await user.click(screen.getByRole("button", { name: "Confirm and send" }));

    expect(
      screen.getByRole("heading", { name: "Transaction confirmed." }),
    ).toBeInTheDocument();
  });

  it("opens receive and settings flows from the dashboard", async () => {
    const user = userEvent.setup();
    const { container } = render(<App />);

    await createWalletAndOpenDashboard(user, container);

    await user.click(screen.getByRole("button", { name: "Receive" }));
    expect(
      screen.getByRole("heading", { name: "Receive funds into this wallet." }),
    ).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Back" }));
    await user.click(screen.getByRole("button", { name: "Settings" }));
    await user.click(screen.getByRole("button", { name: "Devnet" }));
    await user.click(
      screen.getByRole("button", { name: "Save network preference" }),
    );

    expect(
      await screen.findByText("Network switched to Devnet."),
    ).toBeInTheDocument();
  });

  it("renders approval surface when approval mode is active", () => {
    window.history.pushState({}, "", "/index.html?view=approval");
    render(<App />);
    expect(
      screen.getByRole("heading", { name: "Transaction Signature Request" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Sign Transaction" }),
    ).toBeInTheDocument();
  });

  it("renders and approves a live dapp connection request", async () => {
    const user = userEvent.setup();

    await seedPendingDappConnection();

    render(<App />);

    expect(
      await screen.findByRole("heading", { name: "Connection Request" }),
    ).toBeInTheDocument();
    expect(
      screen.getByText("Share the active wallet address with this site."),
    ).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Connect" }));

    expect(
      await screen.findByRole("button", { name: "Receive" }),
    ).toBeInTheDocument();
  });

  it("shows and revokes trusted origins from settings", async () => {
    const user = userEvent.setup();
    const { container } = render(<App />);

    await createWalletAndOpenDashboard(user, container);
    await approveTrustedOrigin("https://app.drift.trade", "Drift");

    await user.click(screen.getByRole("button", { name: "Settings" }));

    expect(screen.getByText("Trusted origins")).toBeInTheDocument();
    expect(screen.getByText("app.drift.trade")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Disconnect" }));

    expect(
      await screen.findByText("app.drift.trade disconnected."),
    ).toBeInTheDocument();
  });
});
