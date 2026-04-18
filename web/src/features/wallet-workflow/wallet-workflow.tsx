import type {
  PasswordValidationResult,
  WalletRuntimeSnapshot,
} from "@helio/types";
import { useEffect, useState } from "react";
import { validateWalletPassword } from "../../../../packages/core/src/security/password-policy";
import { verifySeedPhraseChallenge } from "../../../../packages/core/src/security/seed-phrase";

import { createExtensionClient } from "../../extension-runtime/extension-client";
import { PopupDashboard } from "../popup-dashboard/popup-dashboard";
import type {
  WalletWorkflowEntryMode,
  WalletWorkflowScreen,
  WalletWorkflowState,
} from "./wallet-workflow.types";
import {
  createInitialWalletWorkflowState,
  createSendAssetFromTokenHolding,
  createTransactionStatusModel,
  groupAddressForDisplay,
  isLikelySolanaAddress,
  validateImportInput,
} from "./wallet-workflow.utils";

const extensionClient = createExtensionClient();

function formatCurrency(value: number | null): string {
  if (value === null) {
    return "Unavailable";
  }

  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 2,
  }).format(value);
}

function getBackTarget(
  state: WalletWorkflowState,
): WalletWorkflowScreen | null {
  switch (state.activeScreen) {
    case "create-password":
    case "import-wallet":
      return "welcome";
    case "backup":
      return "create-password";
    case "verify":
      return "backup";
    case "biometrics":
      return state.entryMode === "import" ? "import-wallet" : "verify";
    case "receive":
    case "settings":
    case "send-form":
      return "dashboard";
    case "send-review":
      return "send-form";
    case "transaction-status":
      return "dashboard";
    default:
      return null;
  }
}

function getPrimaryPasswordCopy(entryMode: WalletWorkflowEntryMode) {
  return entryMode === "import"
    ? {
        title: "Secure the imported wallet",
        description:
          "Set a local password before Helio encrypts the imported vault and unlocks the extension session.",
        actionLabel: "Continue to biometrics",
      }
    : {
        title: "Set your wallet password",
        description:
          "Helio encrypts the recovery phrase with this password and keeps unlocked key material in session-only storage.",
        actionLabel: "Continue to backup",
      };
}

function createMnemonicItems(mnemonicWords: readonly string[]) {
  return mnemonicWords.map((word, index) => ({
    position: index + 1,
    word,
  }));
}

function getErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : "Something went wrong.";
}

function getNetworkOptionLabel(
  network: WalletWorkflowState["settingsSelectedNetwork"],
): string {
  if (network === "mainnet-beta") {
    return "Mainnet";
  }

  if (network === "devnet") {
    return "Devnet";
  }

  return "Custom";
}

async function copyTextToClipboard(text: string): Promise<void> {
  if (typeof navigator !== "undefined" && navigator.clipboard !== undefined) {
    await navigator.clipboard.writeText(text);
    return;
  }

  throw new Error("Clipboard access is not available in this runtime.");
}

function openExternalUrl(url: string): void {
  if (typeof window !== "undefined") {
    window.open(url, "_blank", "noopener,noreferrer");
  }
}

function getHostname(origin: string): string {
  try {
    return new URL(origin).hostname;
  } catch {
    return origin;
  }
}

function resolveRuntimeScreen(
  state: WalletWorkflowState["runtimeSnapshot"],
): WalletWorkflowScreen {
  if (state === null || !state.wallet.hasWallet) {
    return "welcome";
  }

  return state.wallet.lockState === "locked" ? "unlock" : "dashboard";
}

function FlowHeader({
  eyebrow,
  title,
  description,
  onBack,
}: {
  readonly eyebrow: string;
  readonly title: string;
  readonly description: string;
  readonly onBack?: () => void;
}) {
  return (
    <header className="flow-header">
      <div className="flow-header-row">
        {onBack ? (
          <button type="button" className="text-button" onClick={onBack}>
            Back
          </button>
        ) : (
          <span className="flow-brand-mark">◈</span>
        )}
        <span className="flow-brand">HELIO</span>
      </div>
      <p className="section-kicker">{eyebrow}</p>
      <h1 className="flow-title">{title}</h1>
      <p className="flow-description">{description}</p>
    </header>
  );
}

function StatusBanner({
  errorMessage,
  isBusy,
  noticeMessage,
}: {
  readonly errorMessage: string | null;
  readonly isBusy: boolean;
  readonly noticeMessage: string | null;
}) {
  if (errorMessage === null && noticeMessage === null && !isBusy) {
    return null;
  }

  return (
    <div className="flow-stack-compact">
      {isBusy ? <p className="form-hint">Working…</p> : null}
      {noticeMessage !== null ? (
        <p className="form-hint form-hint-success">{noticeMessage}</p>
      ) : null}
      {errorMessage !== null ? (
        <p className="form-hint form-hint-danger">{errorMessage}</p>
      ) : null}
    </div>
  );
}

function LoadingScreen() {
  return (
    <section className="flow-stack">
      <FlowHeader
        eyebrow="Runtime"
        title="Loading the secure wallet session."
        description="Helio is checking local vault state, session storage, and the active network before the popup becomes interactive."
      />
      <div className="flow-panel flow-panel-spacious">
        <div className="status-mark">⋯</div>
      </div>
    </section>
  );
}

function WelcomeScreen({
  onCreate,
  onImport,
}: {
  readonly onCreate: () => void;
  readonly onImport: () => void;
}) {
  return (
    <section className="flow-stack">
      <FlowHeader
        eyebrow="Wallet Creation"
        title="Create, import, and send with confidence."
        description="This extension now uses a real wallet runtime: encrypted vault storage, lock and unlock state, live SOL balance loading, smart review, simulation, and send."
      />
      <div className="hero-panel">
        <div className="hero-orb hero-orb-primary" />
        <div className="hero-orb hero-orb-secondary" />
        <div className="hero-panel-content">
          <p className="section-kicker">Sovereign Vault</p>
          <p className="hero-balance">Extension Backend Active</p>
          <p className="hero-support">
            Create or import a wallet, store it securely, unlock it in-session,
            then move through live review and transaction confirmation.
          </p>
        </div>
      </div>
      <div className="flow-grid">
        <button type="button" className="feature-card" onClick={onCreate}>
          <span className="feature-card-eyebrow">Create</span>
          <strong>Create New Wallet</strong>
          <span>
            Generate a recovery phrase, verify it, then encrypt the wallet for
            extension use.
          </span>
        </button>
        <button type="button" className="feature-card" onClick={onImport}>
          <span className="feature-card-eyebrow">Import</span>
          <strong>Import Existing Wallet</strong>
          <span>
            Bring in a seed phrase or base58 private key, then continue with the
            same secured dashboard and send flow.
          </span>
        </button>
      </div>
    </section>
  );
}

function UnlockScreen({
  password,
  accountLabel,
  onPasswordChange,
  onUnlock,
}: {
  readonly password: string;
  readonly accountLabel: string;
  readonly onPasswordChange: (password: string) => void;
  readonly onUnlock: () => void;
}) {
  return (
    <section className="flow-stack">
      <FlowHeader
        eyebrow="Unlock"
        title="Unlock the wallet"
        description={`Re-enter the local password to unlock ${accountLabel} in the current extension session.`}
      />
      <div className="flow-panel">
        <label className="field-block">
          <span>Password</span>
          <input
            type="password"
            value={password}
            onChange={(event) => onPasswordChange(event.target.value)}
            placeholder="Enter your wallet password"
          />
        </label>
      </div>
      <button
        type="button"
        className="primary-cta"
        disabled={password.length === 0}
        onClick={onUnlock}
      >
        Unlock wallet
      </button>
    </section>
  );
}

function PasswordRequirements({
  validation,
}: {
  readonly validation: PasswordValidationResult;
}) {
  return (
    <ul className="requirement-list">
      {validation.issues.map((issue) => (
        <li
          key={issue.code}
          className={
            issue.satisfied
              ? "requirement-item requirement-pass"
              : "requirement-item"
          }
        >
          <span aria-hidden="true">{issue.satisfied ? "✓" : "•"}</span>
          <span>{issue.label}</span>
        </li>
      ))}
    </ul>
  );
}

function PasswordScreen({
  state,
  validation,
  onBack,
  onPasswordChange,
  onConfirmPasswordChange,
  onContinue,
}: {
  readonly state: WalletWorkflowState;
  readonly validation: PasswordValidationResult;
  readonly onBack: () => void;
  readonly onPasswordChange: (password: string) => void;
  readonly onConfirmPasswordChange: (password: string) => void;
  readonly onContinue: () => void;
}) {
  const copy = getPrimaryPasswordCopy(state.entryMode);
  const passwordsMatch =
    state.password.length > 0 && state.password === state.confirmPassword;

  return (
    <section className="flow-stack">
      <FlowHeader
        eyebrow="Password"
        title={copy.title}
        description={copy.description}
        onBack={onBack}
      />
      <div className="flow-panel">
        <label className="field-block">
          <span>Password</span>
          <input
            type="password"
            value={state.password}
            onChange={(event) => onPasswordChange(event.target.value)}
            placeholder="Create a strong password"
          />
        </label>
        <label className="field-block">
          <span>Confirm password</span>
          <input
            type="password"
            value={state.confirmPassword}
            onChange={(event) => onConfirmPasswordChange(event.target.value)}
            placeholder="Confirm password"
          />
        </label>
        <PasswordRequirements validation={validation} />
        <p
          className={
            passwordsMatch ? "form-hint form-hint-success" : "form-hint"
          }
        >
          {passwordsMatch
            ? "Passwords match."
            : "Passwords must match before you continue."}
        </p>
      </div>
      <button
        type="button"
        className="primary-cta"
        disabled={!validation.isValid || !passwordsMatch}
        onClick={onContinue}
      >
        {copy.actionLabel}
      </button>
    </section>
  );
}

function BackupScreen({
  state,
  onBack,
  onAcceptBackup,
  onContinue,
}: {
  readonly state: WalletWorkflowState;
  readonly onBack: () => void;
  readonly onAcceptBackup: (accepted: boolean) => void;
  readonly onContinue: () => void;
}) {
  return (
    <section className="flow-stack">
      <FlowHeader
        eyebrow="Backup"
        title="Save the 12-word recovery phrase."
        description="Keep this offline. Helio does not persist the wallet until the onboarding phrase has been shown and verified."
        onBack={onBack}
      />
      <div className="flow-panel">
        <div className="seed-grid">
          {createMnemonicItems(state.mnemonicWords).map((item) => (
            <div key={item.position} className="seed-pill">
              <span>{item.position}</span>
              <strong>{item.word}</strong>
            </div>
          ))}
        </div>
        <label className="checkbox-row">
          <input
            type="checkbox"
            checked={state.hasAcceptedBackupWarning}
            onChange={(event) => onAcceptBackup(event.target.checked)}
          />
          <span>I saved this recovery phrase offline.</span>
        </label>
      </div>
      <button
        type="button"
        className="primary-cta"
        disabled={!state.hasAcceptedBackupWarning}
        onClick={onContinue}
      >
        Continue to verification
      </button>
    </section>
  );
}

function VerifyScreen({
  state,
  onBack,
  onInputChange,
  onContinue,
}: {
  readonly state: WalletWorkflowState;
  readonly onBack: () => void;
  readonly onInputChange: (position: number, word: string) => void;
  readonly onContinue: () => void;
}) {
  return (
    <section className="flow-stack">
      <FlowHeader
        eyebrow="Verify"
        title="Confirm the recovery phrase."
        description="Enter the requested words in order before the extension encrypts the wallet and completes setup."
        onBack={onBack}
      />
      <div className="flow-panel">
        <div className="flow-stack-compact">
          {state.verificationChallenge?.items.map((item) => (
            <label key={item.position} className="field-block">
              <span>{`Word #${item.position}`}</span>
              <input
                type="text"
                value={state.verificationInputs[item.position] ?? ""}
                onChange={(event) =>
                  onInputChange(item.position, event.target.value)
                }
                placeholder={`Enter word ${item.position}`}
              />
            </label>
          ))}
        </div>
        {state.verificationError ? (
          <p className="form-hint form-hint-danger">
            {state.verificationError}
          </p>
        ) : null}
      </div>
      <button type="button" className="primary-cta" onClick={onContinue}>
        Verify recovery phrase
      </button>
    </section>
  );
}

function ImportScreen({
  state,
  validation,
  passwordValidation,
  onBack,
  onMethodChange,
  onImportValueChange,
  onPasswordChange,
  onConfirmPasswordChange,
  onContinue,
}: {
  readonly state: WalletWorkflowState;
  readonly validation: boolean;
  readonly passwordValidation: PasswordValidationResult;
  readonly onBack: () => void;
  readonly onMethodChange: (
    method: WalletWorkflowState["importMethod"],
  ) => void;
  readonly onImportValueChange: (value: string) => void;
  readonly onPasswordChange: (password: string) => void;
  readonly onConfirmPasswordChange: (password: string) => void;
  readonly onContinue: () => void;
}) {
  const passwordsMatch =
    state.password.length > 0 && state.password === state.confirmPassword;

  return (
    <section className="flow-stack">
      <FlowHeader
        eyebrow="Import"
        title="Import an existing wallet."
        description="Helio supports seed phrase and private key imports, then encrypts the chosen vault with your local password."
        onBack={onBack}
      />
      <div className="flow-panel">
        <div className="pill-switch">
          <button
            type="button"
            className={
              state.importMethod === "seed-phrase"
                ? "pill-switch-item pill-switch-item-active"
                : "pill-switch-item"
            }
            onClick={() => onMethodChange("seed-phrase")}
          >
            Seed Phrase
          </button>
          <button
            type="button"
            className={
              state.importMethod === "private-key"
                ? "pill-switch-item pill-switch-item-active"
                : "pill-switch-item"
            }
            onClick={() => onMethodChange("private-key")}
          >
            Private Key
          </button>
        </div>
        <label className="field-block">
          <span>
            {state.importMethod === "seed-phrase"
              ? "12 or 24 words"
              : "Base58 private key"}
          </span>
          <textarea
            value={state.importValue}
            onChange={(event) => onImportValueChange(event.target.value)}
            placeholder={
              state.importMethod === "seed-phrase"
                ? "glow anchor velvet ..."
                : "Paste a base58 private key"
            }
            rows={state.importMethod === "seed-phrase" ? 4 : 3}
          />
        </label>
        <p className={validation ? "form-hint form-hint-success" : "form-hint"}>
          {validation
            ? "Import input looks valid enough to continue."
            : "Enter a 12/24-word phrase or a base58 private key."}
        </p>
        <label className="field-block">
          <span>Password</span>
          <input
            type="password"
            value={state.password}
            onChange={(event) => onPasswordChange(event.target.value)}
            placeholder="Create a local password"
          />
        </label>
        <label className="field-block">
          <span>Confirm password</span>
          <input
            type="password"
            value={state.confirmPassword}
            onChange={(event) => onConfirmPasswordChange(event.target.value)}
            placeholder="Confirm password"
          />
        </label>
        <PasswordRequirements validation={passwordValidation} />
      </div>
      <button
        type="button"
        className="primary-cta"
        disabled={!validation || !passwordValidation.isValid || !passwordsMatch}
        onClick={onContinue}
      >
        Continue to biometrics
      </button>
    </section>
  );
}

function BiometricsScreen({
  state,
  onBack,
  onToggle,
  onContinue,
}: {
  readonly state: WalletWorkflowState;
  readonly onBack: () => void;
  readonly onToggle: () => void;
  readonly onContinue: () => void;
}) {
  return (
    <section className="flow-stack">
      <FlowHeader
        eyebrow="Biometrics"
        title="Choose the unlock preference."
        description="This preference is stored with the extension wallet settings and applied to future unlock prompts."
        onBack={onBack}
      />
      <div className="flow-panel flow-panel-spacious">
        <div className="toggle-card">
          <div>
            <strong>Biometric unlock</strong>
            <p>Use a fast unlock step before transaction review surfaces.</p>
          </div>
          <button
            type="button"
            className={
              state.biometricsEnabled
                ? "toggle-pill toggle-pill-active"
                : "toggle-pill"
            }
            onClick={onToggle}
          >
            <span>{state.biometricsEnabled ? "On" : "Off"}</span>
          </button>
        </div>
      </div>
      <button type="button" className="primary-cta" onClick={onContinue}>
        Open wallet dashboard
      </button>
    </section>
  );
}

function ReceiveScreen({
  address,
  onBack,
  onCopyAddress,
}: {
  readonly address: string;
  readonly onBack: () => void;
  readonly onCopyAddress: () => void;
}) {
  return (
    <section className="flow-stack">
      <FlowHeader
        eyebrow="Receive"
        title="Receive funds into this wallet."
        description="Copy the primary address and share it with the sender. This is the active extension account on the selected network."
        onBack={onBack}
      />
      <div className="flow-panel flow-panel-spacious">
        <div className="receive-orb">◈</div>
        <div className="flow-stack-compact centered-copy">
          <p className="section-kicker">Wallet Address</p>
          <h2 className="flow-subtitle receive-address">
            {groupAddressForDisplay(address)}
          </h2>
          <p className="form-hint">
            Copy the address exactly as shown or use the button below.
          </p>
        </div>
        <button
          type="button"
          className="secondary-cta secondary-cta-full"
          onClick={onCopyAddress}
        >
          Copy Address
        </button>
      </div>
    </section>
  );
}

function SettingsScreen({
  customRpcUrl,
  exportPassword,
  exportedMnemonicWords,
  isImportedWallet,
  networkLabel,
  connectedOrigins,
  onBack,
  onCustomRpcUrlChange,
  onDisconnectOrigin,
  onExportPasswordChange,
  onHideMnemonic,
  onNetworkChange,
  onRefresh,
  onRevealMnemonic,
  onSaveNetwork,
  selectedNetwork,
}: {
  readonly customRpcUrl: string;
  readonly connectedOrigins: readonly string[];
  readonly exportPassword: string;
  readonly exportedMnemonicWords: readonly string[];
  readonly isImportedWallet: boolean;
  readonly networkLabel: string;
  readonly onBack: () => void;
  readonly onCustomRpcUrlChange: (value: string) => void;
  readonly onDisconnectOrigin: (origin: string) => void;
  readonly onExportPasswordChange: (password: string) => void;
  readonly onHideMnemonic: () => void;
  readonly onNetworkChange: (
    network: WalletWorkflowState["settingsSelectedNetwork"],
  ) => void;
  readonly onRefresh: () => void;
  readonly onRevealMnemonic: () => void;
  readonly onSaveNetwork: () => void;
  readonly selectedNetwork: WalletWorkflowState["settingsSelectedNetwork"];
}) {
  return (
    <section className="flow-stack">
      <FlowHeader
        eyebrow="Settings"
        title="Wallet network and security."
        description="Switch RPC environments, refresh the dashboard, and re-authenticate to reveal the recovery phrase when this wallet was created from a mnemonic."
        onBack={onBack}
      />
      <div className="flow-panel">
        <div className="settings-header-row">
          <div>
            <p className="section-kicker">Active Network</p>
            <p className="settings-value">{networkLabel}</p>
          </div>
          <button
            type="button"
            className="secondary-cta secondary-cta-compact"
            onClick={onRefresh}
          >
            Refresh
          </button>
        </div>
        <div className="pill-switch settings-network-switch">
          {(["mainnet-beta", "devnet", "custom"] as const).map((network) => (
            <button
              key={network}
              type="button"
              className={
                selectedNetwork === network
                  ? "pill-switch-item pill-switch-item-active"
                  : "pill-switch-item"
              }
              onClick={() => onNetworkChange(network)}
            >
              {getNetworkOptionLabel(network)}
            </button>
          ))}
        </div>
        {selectedNetwork === "custom" ? (
          <label className="field-block">
            <span>Custom RPC URL</span>
            <input
              type="url"
              value={customRpcUrl}
              onChange={(event) => onCustomRpcUrlChange(event.target.value)}
              placeholder="https://your-rpc.example.com"
            />
          </label>
        ) : null}
        <button type="button" className="primary-cta" onClick={onSaveNetwork}>
          Save network preference
        </button>
      </div>
      <div className="flow-panel">
        <div className="flow-stack-compact">
          <p className="section-kicker">Connected Apps</p>
          <h2 className="flow-subtitle">Trusted origins</h2>
          <p className="form-hint">
            Approved sites can read the active wallet address until you revoke
            them here.
          </p>
        </div>
        {connectedOrigins.length === 0 ? (
          <p className="form-hint">No connected apps have been approved yet.</p>
        ) : (
          <div className="flow-stack-compact">
            {connectedOrigins.map((origin) => (
              <div key={origin} className="settings-connected-app">
                <div>
                  <p className="settings-connected-app-title">
                    {getHostname(origin)}
                  </p>
                  <p className="form-hint">{origin}</p>
                </div>
                <button
                  type="button"
                  className="secondary-cta secondary-cta-compact"
                  onClick={() => onDisconnectOrigin(origin)}
                >
                  Disconnect
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
      <div className="flow-panel">
        <div className="flow-stack-compact">
          <p className="section-kicker">Security</p>
          <h2 className="flow-subtitle">Export recovery phrase</h2>
          <p className="form-hint">
            This requires the local wallet password and is only available for
            mnemonic-backed wallets.
          </p>
        </div>
        {isImportedWallet ? (
          <p className="form-hint">
            Imported private-key vaults do not have a recovery phrase to reveal.
          </p>
        ) : (
          <>
            <label className="field-block">
              <span>Password</span>
              <input
                type="password"
                value={exportPassword}
                onChange={(event) => onExportPasswordChange(event.target.value)}
                placeholder="Re-enter the local wallet password"
              />
            </label>
            <div className="inline-actions">
              <button
                type="button"
                className="secondary-cta secondary-cta-full"
                onClick={onRevealMnemonic}
              >
                Reveal recovery phrase
              </button>
              {exportedMnemonicWords.length > 0 ? (
                <button
                  type="button"
                  className="secondary-cta secondary-cta-full"
                  onClick={onHideMnemonic}
                >
                  Hide
                </button>
              ) : null}
            </div>
            {exportedMnemonicWords.length > 0 ? (
              <div className="seed-grid">
                {createMnemonicItems(exportedMnemonicWords).map((item) => (
                  <div key={item.position} className="seed-pill">
                    <span>{item.position}</span>
                    <strong>{item.word}</strong>
                  </div>
                ))}
              </div>
            ) : null}
          </>
        )}
      </div>
    </section>
  );
}

function SendFormScreen({
  state,
  onBack,
  onAssetChange,
  onAmountChange,
  onFillMax,
  onRecipientChange,
  onUrgencyChange,
  onReview,
}: {
  readonly state: WalletWorkflowState;
  readonly onBack: () => void;
  readonly onAssetChange: (mintAddress: string) => void;
  readonly onAmountChange: (amount: string) => void;
  readonly onFillMax: () => void;
  readonly onRecipientChange: (address: string) => void;
  readonly onUrgencyChange: (
    urgency: WalletWorkflowState["sendDraft"]["urgency"],
  ) => void;
  readonly onReview: () => void;
}) {
  const selectedHolding =
    state.dashboardSnapshot?.tokenRows.find(
      (tokenRow) =>
        tokenRow.symbol === state.sendDraft.asset.symbol &&
        tokenRow.assetKind === state.sendDraft.asset.kind,
    ) ?? state.dashboardSnapshot?.tokenRows[0];
  const amountValue = Number(state.sendDraft.amountInput);
  const canReview =
    Number.isFinite(amountValue) &&
    amountValue > 0 &&
    isLikelySolanaAddress(state.sendDraft.recipientAddress);

  return (
    <section className="flow-stack">
      <FlowHeader
        eyebrow="Send"
        title="Enter the transaction details."
        description="Choose an asset, amount, recipient, and urgency before Helio runs smart review and simulation."
        onBack={onBack}
      />
      <div className="flow-panel">
        <label className="field-block">
          <span>Asset</span>
          <select
            value={selectedHolding?.mintAddress ?? ""}
            onChange={(event) => onAssetChange(event.target.value)}
          >
            {state.dashboardSnapshot?.tokenRows.map((tokenRow) => (
              <option key={tokenRow.mintAddress} value={tokenRow.mintAddress}>
                {tokenRow.symbol}
              </option>
            )) ?? null}
          </select>
        </label>
        <label className="field-block">
          <span>Amount</span>
          <div className="inline-field">
            <input
              type="number"
              min="0"
              step="any"
              value={state.sendDraft.amountInput}
              onChange={(event) => onAmountChange(event.target.value)}
              placeholder="0.00"
            />
            <button type="button" className="ghost-chip" onClick={onFillMax}>
              MAX
            </button>
          </div>
        </label>
        <p className="form-hint">
          {selectedHolding
            ? `Available ${selectedHolding.symbol}: ${selectedHolding.amountDisplay}`
            : "No loaded asset balance is available."}
        </p>
        <label className="field-block">
          <span>Recipient address</span>
          <input
            type="text"
            value={state.sendDraft.recipientAddress}
            onChange={(event) => onRecipientChange(event.target.value)}
            placeholder="Enter a Solana address"
          />
        </label>
        <p
          className={
            isLikelySolanaAddress(state.sendDraft.recipientAddress)
              ? "form-hint form-hint-success"
              : "form-hint"
          }
        >
          {isLikelySolanaAddress(state.sendDraft.recipientAddress)
            ? "Recipient format looks valid."
            : "Recipient must look like a valid Solana address."}
        </p>
        <div className="pill-switch">
          {(["low", "medium", "high"] as const).map((urgency) => (
            <button
              key={urgency}
              type="button"
              className={
                state.sendDraft.urgency === urgency
                  ? "pill-switch-item pill-switch-item-active"
                  : "pill-switch-item"
              }
              onClick={() => onUrgencyChange(urgency)}
            >
              {urgency}
            </button>
          ))}
        </div>
      </div>
      <button
        type="button"
        className="primary-cta"
        disabled={!canReview}
        onClick={onReview}
      >
        Review transaction
      </button>
    </section>
  );
}

function SendReviewScreen({
  state,
  onBack,
  onUseAdjusted,
  onUseOriginal,
  onConfirm,
}: {
  readonly state: WalletWorkflowState;
  readonly onBack: () => void;
  readonly onUseAdjusted: () => void;
  readonly onUseOriginal: () => void;
  readonly onConfirm: () => void;
}) {
  if (state.sendReview === null) {
    return null;
  }

  const activeAmount = state.useAdjustedAmount
    ? state.sendReview.review.adjustedAmount
    : state.sendReview.review.originalAmount;
  const isBlocked = state.sendReview.review.status === "blocked";

  return (
    <section className="flow-stack">
      <FlowHeader
        eyebrow="Transaction Review"
        title="Review the final transaction."
        description="This page uses the shared smart adjustment engine together with live RPC simulation before submission."
        onBack={onBack}
      />
      <div className="flow-panel">
        <div className="review-hero">
          <p className="section-kicker">You are sending</p>
          <h2>{activeAmount.amountDisplay}</h2>
          <p>{formatCurrency(activeAmount.usdEquivalent)}</p>
        </div>
        <div className="summary-list">
          <div className="summary-row">
            <span>Recipient</span>
            <strong>{state.sendReview.recipient.shortAddress}</strong>
          </div>
          <div className="summary-row">
            <span>Network fee</span>
            <strong>
              {(
                state.sendReview.review.feeBreakdown.networkFeeLamports /
                1_000_000_000
              ).toFixed(6)}{" "}
              SOL
            </strong>
          </div>
          <div className="summary-row">
            <span>Priority fee</span>
            <strong>
              {(
                state.sendReview.review.feeBreakdown.priorityFeeLamports /
                1_000_000_000
              ).toFixed(6)}{" "}
              SOL
            </strong>
          </div>
        </div>
        {state.sendReview.review.reasons.length > 0 ? (
          <div className="smart-adjust-card local-smart-adjust">
            <div className="smart-adjust-header">
              <div>
                <p className="smart-adjust-title">Smart Adjustment</p>
                <p className="smart-adjust-copy">
                  {state.sendReview.review.reasons[0]?.message}
                </p>
              </div>
            </div>
            <div className="summary-row">
              <span>Original</span>
              <strong>
                {state.sendReview.review.originalAmount.amountDisplay}
              </strong>
            </div>
            <div className="summary-row">
              <span>Adjusted</span>
              <strong>
                {state.sendReview.review.adjustedAmount.amountDisplay}
              </strong>
            </div>
            <div className="inline-actions">
              <button
                type="button"
                className={
                  state.useAdjustedAmount
                    ? "secondary-cta secondary-cta-active"
                    : "secondary-cta"
                }
                onClick={onUseAdjusted}
              >
                Accept Adjustment
              </button>
              {state.sendReview.review.canSendOriginalAmount ? (
                <button
                  type="button"
                  className={
                    !state.useAdjustedAmount
                      ? "secondary-cta secondary-cta-active"
                      : "secondary-cta"
                  }
                  onClick={onUseOriginal}
                >
                  Send Original
                </button>
              ) : null}
            </div>
          </div>
        ) : null}
        {isBlocked ? (
          <p className="form-hint form-hint-danger">
            This transaction is blocked by Helio review and cannot be submitted
            until the send details are changed.
          </p>
        ) : null}
      </div>
      <button
        type="button"
        className="primary-cta"
        disabled={isBlocked}
        onClick={onConfirm}
      >
        Confirm and send
      </button>
    </section>
  );
}

function TransactionStatusScreen({
  onOpenExplorer,
  state,
  onOpenDashboard,
  onSendAnother,
}: {
  readonly onOpenExplorer: () => void;
  readonly state: WalletWorkflowState;
  readonly onOpenDashboard: () => void;
  readonly onSendAnother: () => void;
}) {
  if (state.lastTransaction === null) {
    return null;
  }

  return (
    <section className="flow-stack">
      <FlowHeader
        eyebrow="Transaction Status"
        title="Transaction confirmed."
        description="Helio simulated and submitted the transaction through the extension backend, then refreshed the live wallet snapshot."
      />
      <div className="flow-panel flow-panel-spacious">
        <div className="status-mark">✓</div>
        <div className="flow-stack-compact centered-copy">
          <h2 className="flow-subtitle">
            {state.lastTransaction.sentAmountDisplay}
          </h2>
          <p>{`Sent to ${state.lastTransaction.recipientShortAddress}`}</p>
          <p className="form-hint">{state.lastTransaction.signature}</p>
        </div>
        <button
          type="button"
          className="secondary-cta secondary-cta-full"
          disabled={state.lastTransaction.explorerUrl === null}
          onClick={onOpenExplorer}
        >
          {state.lastTransaction.explorerLabel}
        </button>
      </div>
      <div className="flow-grid">
        <button type="button" className="primary-cta" onClick={onOpenDashboard}>
          Return to dashboard
        </button>
        <button
          type="button"
          className="secondary-cta secondary-cta-full"
          onClick={onSendAnother}
        >
          Send another transaction
        </button>
      </div>
    </section>
  );
}

function DashboardScreen({
  onOpenReceive,
  onOpenSettings,
  onRefreshDashboard,
  state,
  onLockWallet,
  onSend,
}: {
  readonly onOpenReceive: () => void;
  readonly onOpenSettings: () => void;
  readonly onRefreshDashboard: () => void;
  readonly state: WalletWorkflowState;
  readonly onLockWallet: () => void;
  readonly onSend: () => void;
}) {
  if (state.dashboardSnapshot === null) {
    return <LoadingScreen />;
  }

  return (
    <section className="flow-stack">
      <div className="dashboard-toolbar">
        <div>
          <p className="section-kicker">Wallet Ready</p>
          <h1 className="flow-title flow-title-compact">
            {state.dashboardSnapshot.account.label}
          </h1>
        </div>
        <button type="button" className="secondary-cta" onClick={onLockWallet}>
          Lock Wallet
        </button>
      </div>
      <PopupDashboard
        snapshot={state.dashboardSnapshot}
        onReceive={onOpenReceive}
        onRefresh={onRefreshDashboard}
        onSend={onSend}
        onSettings={onOpenSettings}
      />
    </section>
  );
}

/**
 * Extension-first wallet workflow from creation and import through live send review.
 *
 * @returns The popup workflow UI backed by the extension runtime.
 */
export function WalletWorkflow({
  onRuntimeSnapshotChange,
}: {
  readonly onRuntimeSnapshotChange?: (
    runtimeSnapshot: WalletRuntimeSnapshot,
  ) => void;
}) {
  const [state, setState] = useState<WalletWorkflowState>(() =>
    createInitialWalletWorkflowState(),
  );
  const passwordValidation = validateWalletPassword(state.password);
  const importValidation = validateImportInput(
    state.importMethod,
    state.importValue,
  );

  useEffect(() => {
    void (async () => {
      try {
        const runtimeSnapshot = await extensionClient.getRuntimeSnapshot();

        setState((currentState) => ({
          ...currentState,
          activeScreen: resolveRuntimeScreen(runtimeSnapshot),
          actionNotice: null,
          dashboardSnapshot: runtimeSnapshot.dashboard,
          settingsCustomRpcUrl:
            runtimeSnapshot.wallet.networkPreference.customRpcUrl ?? "",
          settingsSelectedNetwork:
            runtimeSnapshot.wallet.networkPreference.selectedNetwork,
          runtimeSnapshot,
          isBusy: false,
        }));
        onRuntimeSnapshotChange?.(runtimeSnapshot);
      } catch (error) {
        setState((currentState) => ({
          ...currentState,
          actionError: getErrorMessage(error),
          activeScreen: "welcome",
          isBusy: false,
        }));
      }
    })();
  }, [onRuntimeSnapshotChange]);

  const navigateTo = (activeScreen: WalletWorkflowScreen) => {
    setState((currentState) => ({
      ...currentState,
      activeScreen,
      actionError: null,
      actionNotice: null,
    }));
  };

  const applyRuntimeSnapshot = (
    runtimeSnapshot: NonNullable<WalletWorkflowState["runtimeSnapshot"]>,
    activeScreen: WalletWorkflowScreen = resolveRuntimeScreen(runtimeSnapshot),
  ) => {
    onRuntimeSnapshotChange?.(runtimeSnapshot);
    setState((currentState) => ({
      ...currentState,
      activeScreen,
      actionError: null,
      actionNotice: null,
      confirmPassword: "",
      dashboardSnapshot: runtimeSnapshot.dashboard,
      exportPassword: "",
      exportedMnemonicWords: [],
      hasAcceptedBackupWarning: false,
      importValue: "",
      isBusy: false,
      mnemonicWords: [],
      password: "",
      runtimeSnapshot,
      settingsCustomRpcUrl:
        runtimeSnapshot.wallet.networkPreference.customRpcUrl ?? "",
      settingsSelectedNetwork:
        runtimeSnapshot.wallet.networkPreference.selectedNetwork,
      sendDraft: {
        ...currentState.sendDraft,
        amountInput: "",
        asset: createSendAssetFromTokenHolding(
          runtimeSnapshot.dashboard?.tokenRows[0],
        ),
        recipientAddress: "",
      },
      sendReview: null,
      unlockPassword: "",
      useAdjustedAmount: true,
      verificationChallenge: null,
      verificationError: null,
      verificationInputs: {},
    }));
  };

  const openSettingsScreen = () => {
    setState((currentState) => ({
      ...currentState,
      actionError: null,
      actionNotice: null,
      activeScreen: "settings",
      exportPassword: "",
      exportedMnemonicWords: [],
      settingsCustomRpcUrl:
        currentState.runtimeSnapshot?.wallet.networkPreference.customRpcUrl ??
        "",
      settingsSelectedNetwork:
        currentState.runtimeSnapshot?.wallet.networkPreference
          .selectedNetwork ?? "mainnet-beta",
    }));

    void extensionClient
      .getRuntimeSnapshot()
      .then((runtimeSnapshot) => {
        applyRuntimeSnapshot(runtimeSnapshot, "settings");
      })
      .catch(() => undefined);
  };

  const handleBack = () => {
    const backTarget = getBackTarget(state);

    if (backTarget !== null) {
      navigateTo(backTarget);
    }
  };

  const resetForEntryMode = (entryMode: WalletWorkflowEntryMode) => {
    setState((currentState) => ({
      ...createInitialWalletWorkflowState(),
      activeScreen:
        entryMode === "create" ? "create-password" : "import-wallet",
      entryMode,
      isBusy: false,
      runtimeSnapshot: currentState.runtimeSnapshot,
    }));
  };

  const handlePasswordContinue = async () => {
    setState((currentState) => ({
      ...currentState,
      actionError: null,
      isBusy: true,
    }));

    try {
      if (state.entryMode === "import") {
        setState((currentState) => ({
          ...currentState,
          activeScreen: "biometrics",
          isBusy: false,
        }));
        return;
      }

      const walletCreationPreview = await extensionClient.beginWalletCreation();

      setState((currentState) => ({
        ...currentState,
        activeScreen: "backup",
        isBusy: false,
        mnemonicWords: [...walletCreationPreview.mnemonicWords],
        verificationChallenge: walletCreationPreview.verificationChallenge,
      }));
    } catch (error) {
      setState((currentState) => ({
        ...currentState,
        actionError: getErrorMessage(error),
        isBusy: false,
      }));
    }
  };

  const handleVerifyContinue = () => {
    const verificationChallenge = state.verificationChallenge;

    if (
      verificationChallenge === null ||
      !verifySeedPhraseChallenge(verificationChallenge, {
        wordsByPosition: state.verificationInputs,
      })
    ) {
      setState((currentState) => ({
        ...currentState,
        verificationError:
          "The entered words do not match the recovery phrase.",
      }));
      return;
    }

    navigateTo("biometrics");
  };

  const handleCompleteOnboarding = async () => {
    setState((currentState) => ({
      ...currentState,
      actionError: null,
      isBusy: true,
    }));

    try {
      const runtimeSnapshot =
        state.entryMode === "create"
          ? await extensionClient.createWallet({
              biometricsEnabled: state.biometricsEnabled,
              mnemonicWords: state.mnemonicWords,
              password: state.password,
            })
          : await extensionClient.importWallet({
              biometricsEnabled: state.biometricsEnabled,
              importMethod: state.importMethod,
              importValue: state.importValue,
              password: state.password,
            });

      applyRuntimeSnapshot(runtimeSnapshot, "dashboard");
    } catch (error) {
      setState((currentState) => ({
        ...currentState,
        actionError: getErrorMessage(error),
        isBusy: false,
      }));
    }
  };

  const handleUnlockWallet = async () => {
    setState((currentState) => ({
      ...currentState,
      actionError: null,
      isBusy: true,
    }));

    try {
      const runtimeSnapshot = await extensionClient.unlockWallet({
        password: state.unlockPassword,
      });

      applyRuntimeSnapshot(runtimeSnapshot, "dashboard");
    } catch (error) {
      setState((currentState) => ({
        ...currentState,
        actionError: getErrorMessage(error),
        isBusy: false,
      }));
    }
  };

  const handleLockWallet = async () => {
    setState((currentState) => ({
      ...currentState,
      actionError: null,
      isBusy: true,
    }));

    try {
      const runtimeSnapshot = await extensionClient.lockWallet();

      applyRuntimeSnapshot(runtimeSnapshot, "unlock");
    } catch (error) {
      setState((currentState) => ({
        ...currentState,
        actionError: getErrorMessage(error),
        isBusy: false,
      }));
    }
  };

  const handleRefreshDashboard = async () => {
    setState((currentState) => ({
      ...currentState,
      actionError: null,
      actionNotice: null,
      isBusy: true,
    }));

    try {
      const dashboardSnapshot = await extensionClient.refreshDashboard();

      setState((currentState) => ({
        ...currentState,
        actionNotice: "Dashboard refreshed.",
        dashboardSnapshot,
        isBusy: false,
        runtimeSnapshot:
          currentState.runtimeSnapshot === null
            ? null
            : {
                ...currentState.runtimeSnapshot,
                dashboard: dashboardSnapshot,
              },
      }));
    } catch (error) {
      setState((currentState) => ({
        ...currentState,
        actionError: getErrorMessage(error),
        isBusy: false,
      }));
    }
  };

  const handleCopyWalletAddress = async () => {
    const address = state.runtimeSnapshot?.wallet.account?.address;

    if (address === undefined) {
      return;
    }

    try {
      await copyTextToClipboard(address);
      setState((currentState) => ({
        ...currentState,
        actionError: null,
        actionNotice: "Wallet address copied.",
      }));
    } catch (error) {
      setState((currentState) => ({
        ...currentState,
        actionError: getErrorMessage(error),
      }));
    }
  };

  const handleReviewSend = async () => {
    setState((currentState) => ({
      ...currentState,
      actionError: null,
      isBusy: true,
    }));

    try {
      const sendReview = await extensionClient.reviewSend(state.sendDraft);

      setState((currentState) => ({
        ...currentState,
        activeScreen: "send-review",
        isBusy: false,
        sendReview,
        useAdjustedAmount:
          sendReview.review.status === "adjusted" ||
          sendReview.review.originalAmount.amountAtomic !==
            sendReview.review.adjustedAmount.amountAtomic,
      }));
    } catch (error) {
      setState((currentState) => ({
        ...currentState,
        actionError: getErrorMessage(error),
        isBusy: false,
      }));
    }
  };

  const handleConfirmTransaction = async () => {
    setState((currentState) => ({
      ...currentState,
      actionError: null,
      isBusy: true,
    }));

    try {
      const transactionResult = await extensionClient.submitSend({
        draft: state.sendDraft,
        useAdjustedAmount: state.useAdjustedAmount,
      });
      const runtimeSnapshot = await extensionClient.getRuntimeSnapshot();

      setState((currentState) => ({
        ...currentState,
        activeScreen: "transaction-status",
        actionError: null,
        dashboardSnapshot: runtimeSnapshot.dashboard,
        isBusy: false,
        lastTransaction: createTransactionStatusModel(transactionResult),
        runtimeSnapshot,
      }));
    } catch (error) {
      setState((currentState) => ({
        ...currentState,
        actionError: getErrorMessage(error),
        isBusy: false,
      }));
    }
  };

  const handleSaveNetworkPreference = async () => {
    setState((currentState) => ({
      ...currentState,
      actionError: null,
      actionNotice: null,
      isBusy: true,
    }));

    try {
      const runtimeSnapshot = await extensionClient.updateNetworkPreference({
        customRpcUrl:
          state.settingsSelectedNetwork === "custom"
            ? state.settingsCustomRpcUrl.trim()
            : null,
        selectedNetwork: state.settingsSelectedNetwork,
      });

      applyRuntimeSnapshot(runtimeSnapshot, "settings");
      setState((currentState) => ({
        ...currentState,
        actionNotice: `Network switched to ${getNetworkOptionLabel(
          currentState.settingsSelectedNetwork,
        )}.`,
      }));
    } catch (error) {
      setState((currentState) => ({
        ...currentState,
        actionError: getErrorMessage(error),
        isBusy: false,
      }));
    }
  };

  const handleExportMnemonic = async () => {
    setState((currentState) => ({
      ...currentState,
      actionError: null,
      actionNotice: null,
      isBusy: true,
    }));

    try {
      const exportedMnemonicWords = await extensionClient.exportMnemonic({
        password: state.exportPassword,
      });

      setState((currentState) => ({
        ...currentState,
        actionNotice: "Recovery phrase revealed for this session.",
        exportedMnemonicWords,
        isBusy: false,
      }));
    } catch (error) {
      setState((currentState) => ({
        ...currentState,
        actionError: getErrorMessage(error),
        isBusy: false,
      }));
    }
  };

  const handleDisconnectTrustedOrigin = async (origin: string) => {
    setState((currentState) => ({
      ...currentState,
      actionError: null,
      actionNotice: null,
      isBusy: true,
    }));

    try {
      await extensionClient.disconnectDapp({ origin });
      const runtimeSnapshot = await extensionClient.getRuntimeSnapshot();

      applyRuntimeSnapshot(runtimeSnapshot, "settings");
      setState((currentState) => ({
        ...currentState,
        actionNotice: `${getHostname(origin)} disconnected.`,
      }));
    } catch (error) {
      setState((currentState) => ({
        ...currentState,
        actionError: getErrorMessage(error),
        isBusy: false,
      }));
    }
  };

  const renderWithStatus = (screen: React.ReactNode) => (
    <>
      {screen}
      <StatusBanner
        errorMessage={state.actionError}
        isBusy={state.isBusy}
        noticeMessage={state.actionNotice}
      />
    </>
  );

  if (state.activeScreen === "loading") {
    return <LoadingScreen />;
  }

  if (state.activeScreen === "welcome") {
    return renderWithStatus(
      <WelcomeScreen
        onCreate={() => resetForEntryMode("create")}
        onImport={() => resetForEntryMode("import")}
      />,
    );
  }

  if (state.activeScreen === "unlock") {
    return renderWithStatus(
      <UnlockScreen
        accountLabel={state.runtimeSnapshot?.wallet.account?.label ?? "wallet"}
        password={state.unlockPassword}
        onPasswordChange={(unlockPassword) =>
          setState((currentState) => ({ ...currentState, unlockPassword }))
        }
        onUnlock={() => {
          void handleUnlockWallet();
        }}
      />,
    );
  }

  if (state.activeScreen === "create-password") {
    return renderWithStatus(
      <PasswordScreen
        state={state}
        validation={passwordValidation}
        onBack={handleBack}
        onPasswordChange={(password) =>
          setState((currentState) => ({ ...currentState, password }))
        }
        onConfirmPasswordChange={(confirmPassword) =>
          setState((currentState) => ({ ...currentState, confirmPassword }))
        }
        onContinue={() => {
          void handlePasswordContinue();
        }}
      />,
    );
  }

  if (state.activeScreen === "backup") {
    return renderWithStatus(
      <BackupScreen
        state={state}
        onBack={handleBack}
        onAcceptBackup={(hasAcceptedBackupWarning) =>
          setState((currentState) => ({
            ...currentState,
            hasAcceptedBackupWarning,
          }))
        }
        onContinue={() => navigateTo("verify")}
      />,
    );
  }

  if (state.activeScreen === "verify") {
    return renderWithStatus(
      <VerifyScreen
        state={state}
        onBack={handleBack}
        onInputChange={(position, word) =>
          setState((currentState) => ({
            ...currentState,
            verificationError: null,
            verificationInputs: {
              ...currentState.verificationInputs,
              [position]: word,
            },
          }))
        }
        onContinue={handleVerifyContinue}
      />,
    );
  }

  if (state.activeScreen === "import-wallet") {
    return renderWithStatus(
      <ImportScreen
        state={state}
        validation={importValidation}
        passwordValidation={passwordValidation}
        onBack={handleBack}
        onMethodChange={(importMethod) =>
          setState((currentState) => ({
            ...currentState,
            importMethod,
            importValue: "",
          }))
        }
        onImportValueChange={(importValue) =>
          setState((currentState) => ({ ...currentState, importValue }))
        }
        onPasswordChange={(password) =>
          setState((currentState) => ({ ...currentState, password }))
        }
        onConfirmPasswordChange={(confirmPassword) =>
          setState((currentState) => ({ ...currentState, confirmPassword }))
        }
        onContinue={() => {
          navigateTo("biometrics");
        }}
      />,
    );
  }

  if (state.activeScreen === "biometrics") {
    return renderWithStatus(
      <BiometricsScreen
        state={state}
        onBack={handleBack}
        onToggle={() =>
          setState((currentState) => ({
            ...currentState,
            biometricsEnabled: !currentState.biometricsEnabled,
          }))
        }
        onContinue={() => {
          void handleCompleteOnboarding();
        }}
      />,
    );
  }

  if (state.activeScreen === "dashboard") {
    return renderWithStatus(
      <DashboardScreen
        onOpenReceive={() => navigateTo("receive")}
        onOpenSettings={openSettingsScreen}
        onRefreshDashboard={() => {
          void handleRefreshDashboard();
        }}
        state={state}
        onLockWallet={() => {
          void handleLockWallet();
        }}
        onSend={() => navigateTo("send-form")}
      />,
    );
  }

  if (state.activeScreen === "receive") {
    return renderWithStatus(
      <ReceiveScreen
        address={state.runtimeSnapshot?.wallet.account?.address ?? ""}
        onBack={handleBack}
        onCopyAddress={() => {
          void handleCopyWalletAddress();
        }}
      />,
    );
  }

  if (state.activeScreen === "settings") {
    return renderWithStatus(
      <SettingsScreen
        connectedOrigins={
          state.runtimeSnapshot?.wallet.securityPreferences.trustedOrigins ?? []
        }
        customRpcUrl={state.settingsCustomRpcUrl}
        exportPassword={state.exportPassword}
        exportedMnemonicWords={state.exportedMnemonicWords}
        isImportedWallet={
          state.runtimeSnapshot?.wallet.account?.kind === "imported"
        }
        networkLabel={
          state.dashboardSnapshot?.network.endpointLabel ??
          getNetworkOptionLabel(state.settingsSelectedNetwork)
        }
        onBack={handleBack}
        onCustomRpcUrlChange={(settingsCustomRpcUrl) =>
          setState((currentState) => ({
            ...currentState,
            settingsCustomRpcUrl,
          }))
        }
        onDisconnectOrigin={(origin) => {
          void handleDisconnectTrustedOrigin(origin);
        }}
        onExportPasswordChange={(exportPassword) =>
          setState((currentState) => ({
            ...currentState,
            exportPassword,
          }))
        }
        onHideMnemonic={() =>
          setState((currentState) => ({
            ...currentState,
            actionNotice: "Recovery phrase hidden.",
            exportedMnemonicWords: [],
          }))
        }
        onNetworkChange={(settingsSelectedNetwork) =>
          setState((currentState) => ({
            ...currentState,
            settingsSelectedNetwork,
          }))
        }
        onRefresh={() => {
          void handleRefreshDashboard();
        }}
        onRevealMnemonic={() => {
          void handleExportMnemonic();
        }}
        onSaveNetwork={() => {
          void handleSaveNetworkPreference();
        }}
        selectedNetwork={state.settingsSelectedNetwork}
      />,
    );
  }

  if (state.activeScreen === "send-form") {
    return renderWithStatus(
      <SendFormScreen
        state={state}
        onBack={handleBack}
        onAssetChange={(mintAddress) =>
          setState((currentState) => ({
            ...currentState,
            sendDraft: {
              ...currentState.sendDraft,
              amountInput: "",
              asset: createSendAssetFromTokenHolding(
                currentState.dashboardSnapshot?.tokenRows.find(
                  (tokenRow) => tokenRow.mintAddress === mintAddress,
                ),
              ),
            },
          }))
        }
        onAmountChange={(amountInput) =>
          setState((currentState) => ({
            ...currentState,
            sendDraft: {
              ...currentState.sendDraft,
              amountInput,
            },
          }))
        }
        onFillMax={() =>
          setState((currentState) => {
            const holding =
              currentState.dashboardSnapshot?.tokenRows.find(
                (tokenRow) =>
                  tokenRow.symbol === currentState.sendDraft.asset.symbol &&
                  tokenRow.assetKind === currentState.sendDraft.asset.kind,
              ) ?? currentState.dashboardSnapshot?.tokenRows[0];

            return {
              ...currentState,
              sendDraft: {
                ...currentState.sendDraft,
                amountInput: holding?.amountDisplay.replaceAll(",", "") ?? "",
              },
            };
          })
        }
        onRecipientChange={(recipientAddress) =>
          setState((currentState) => ({
            ...currentState,
            sendDraft: {
              ...currentState.sendDraft,
              recipientAddress,
            },
          }))
        }
        onUrgencyChange={(urgency) =>
          setState((currentState) => ({
            ...currentState,
            sendDraft: {
              ...currentState.sendDraft,
              urgency,
            },
          }))
        }
        onReview={() => {
          void handleReviewSend();
        }}
      />,
    );
  }

  if (state.activeScreen === "send-review") {
    return renderWithStatus(
      <SendReviewScreen
        state={state}
        onBack={handleBack}
        onUseAdjusted={() =>
          setState((currentState) => ({
            ...currentState,
            useAdjustedAmount: true,
          }))
        }
        onUseOriginal={() =>
          setState((currentState) => ({
            ...currentState,
            useAdjustedAmount: false,
          }))
        }
        onConfirm={() => {
          void handleConfirmTransaction();
        }}
      />,
    );
  }

  return renderWithStatus(
    <TransactionStatusScreen
      onOpenExplorer={() => {
        const explorerUrl = state.lastTransaction?.explorerUrl;

        if (explorerUrl !== null && explorerUrl !== undefined) {
          openExternalUrl(explorerUrl);
        }
      }}
      state={state}
      onOpenDashboard={() => navigateTo("dashboard")}
      onSendAnother={() => navigateTo("send-form")}
    />,
  );
}
