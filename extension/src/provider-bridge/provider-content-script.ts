const HELIO_PROVIDER_SOURCE = "helio-provider";
const HELIO_PROVIDER_REQUEST = "helio:provider-request";
const HELIO_PROVIDER_RESPONSE = "helio:provider-response";
const INJECTED_PROVIDER_SCRIPT_ID = "helio-injected-provider";

type ProviderBridgeMethod =
  | "connect"
  | "disconnect"
  | "getConnectionState"
  | "signMessage"
  | "signTransaction";

interface ProviderBridgeRequestMessage {
  readonly id: string;
  readonly method: ProviderBridgeMethod;
  readonly params?: {
    readonly messageBase64?: string;
    readonly serializedTransactionBase64?: string;
  };
  readonly source: typeof HELIO_PROVIDER_SOURCE;
  readonly type: typeof HELIO_PROVIDER_REQUEST;
}

interface ProviderBridgeResponseSuccess {
  readonly id: string;
  readonly ok: true;
  readonly result:
    | {
        readonly accountLabel: string | null;
        readonly isConnected: boolean;
        readonly publicKey: string | null;
      }
    | {
        readonly publicKey: string;
        readonly signature: string | null;
        readonly signedTransactionBase64: string;
      }
    | {
        readonly publicKey: string;
        readonly signatureBase64: string;
        readonly signedMessageBase64: string;
      };
  readonly source: typeof HELIO_PROVIDER_SOURCE;
  readonly type: typeof HELIO_PROVIDER_RESPONSE;
}

interface ProviderBridgeResponseFailure {
  readonly error: {
    readonly code: string;
    readonly message: string;
  };
  readonly id: string;
  readonly ok: false;
  readonly source: typeof HELIO_PROVIDER_SOURCE;
  readonly type: typeof HELIO_PROVIDER_RESPONSE;
}

function injectProviderScript(): void {
  if (document.getElementById(INJECTED_PROVIDER_SCRIPT_ID) !== null) {
    return;
  }

  const providerScript = document.createElement("script");

  providerScript.id = INJECTED_PROVIDER_SCRIPT_ID;
  providerScript.type = "module";
  providerScript.src = chrome.runtime.getURL("injected-provider.js");
  providerScript.async = false;
  (document.head ?? document.documentElement).append(providerScript);
}

function isProviderBridgeRequestMessage(
  value: unknown,
): value is ProviderBridgeRequestMessage {
  if (typeof value !== "object" || value === null) {
    return false;
  }

  return (
    "source" in value &&
    value.source === HELIO_PROVIDER_SOURCE &&
    "type" in value &&
    value.type === HELIO_PROVIDER_REQUEST &&
    "id" in value &&
    typeof value.id === "string" &&
    "method" in value &&
    typeof value.method === "string"
  );
}

function getPageTitle(): string {
  return document.title.trim() || window.location.hostname;
}

function getPageIconUrl(): string | null {
  const iconElement = document.querySelector<HTMLLinkElement>(
    "link[rel~='icon'], link[rel='shortcut icon']",
  );
  const iconHref = iconElement?.href ?? null;

  return typeof iconHref === "string" && iconHref.length > 0 ? iconHref : null;
}

function createResponseSuccess(
  id: string,
  result: ProviderBridgeResponseSuccess["result"],
): ProviderBridgeResponseSuccess {
  return {
    id,
    ok: true,
    result,
    source: HELIO_PROVIDER_SOURCE,
    type: HELIO_PROVIDER_RESPONSE,
  };
}

function createResponseFailure(
  id: string,
  error: { readonly code: string; readonly message: string },
): ProviderBridgeResponseFailure {
  return {
    error,
    id,
    ok: false,
    source: HELIO_PROVIDER_SOURCE,
    type: HELIO_PROVIDER_RESPONSE,
  };
}

async function forwardProviderRequest(
  message: ProviderBridgeRequestMessage,
): Promise<
  | ProviderBridgeResponseSuccess["result"]
  | ProviderBridgeResponseFailure["error"]
> {
  const extensionRequest =
    message.method === "connect"
      ? {
          type: "helio/connect-dapp" as const,
          payload: {
            origin: window.location.origin,
            name: getPageTitle(),
            iconUrl: getPageIconUrl(),
          },
        }
      : message.method === "disconnect"
        ? {
            type: "helio/disconnect-dapp" as const,
            payload: {
              origin: window.location.origin,
            },
          }
        : message.method === "signMessage"
          ? {
              type: "helio/sign-dapp-message" as const,
              payload: {
                iconUrl: getPageIconUrl(),
                messageBase64: message.params?.messageBase64 ?? "",
                name: getPageTitle(),
                origin: window.location.origin,
              },
            }
          : message.method === "signTransaction"
            ? {
                type: "helio/sign-dapp-transaction" as const,
                payload: {
                  iconUrl: getPageIconUrl(),
                  name: getPageTitle(),
                  origin: window.location.origin,
                  serializedTransactionBase64:
                    message.params?.serializedTransactionBase64 ?? "",
                },
              }
            : {
                type: "helio/get-dapp-connection-state" as const,
                payload: {
                  origin: window.location.origin,
                },
              };
  const response = await chrome.runtime.sendMessage(extensionRequest);

  if (!response.ok) {
    return {
      code: response.error.code,
      message: response.error.message,
    };
  }

  if ("signedTransactionBase64" in response.data) {
    return response.data;
  }

  if ("signatureBase64" in response.data) {
    return response.data;
  }

  return {
    accountLabel: response.data.account?.label ?? null,
    isConnected: response.data.isConnected,
    publicKey: response.data.account?.address ?? null,
  };
}

function postBridgeResponse(
  response: ProviderBridgeResponseSuccess | ProviderBridgeResponseFailure,
): void {
  window.postMessage(response, window.location.origin);
}

function registerProviderBridge(): void {
  window.addEventListener("message", async (event: MessageEvent) => {
    if (
      event.source !== window ||
      !isProviderBridgeRequestMessage(event.data)
    ) {
      return;
    }

    try {
      const result = await forwardProviderRequest(event.data);

      if ("code" in result) {
        postBridgeResponse(createResponseFailure(event.data.id, result));
        return;
      }

      postBridgeResponse(createResponseSuccess(event.data.id, result));
    } catch (error) {
      postBridgeResponse(
        createResponseFailure(event.data.id, {
          code: "UNKNOWN_ERROR",
          message:
            error instanceof Error
              ? error.message
              : "The Helio provider request failed.",
        }),
      );
    }
  });
}

injectProviderScript();
registerProviderBridge();

export {};
