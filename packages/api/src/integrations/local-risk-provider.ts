import type {
  DappConnectionRiskInput,
  DappMessageRiskInput,
  DappRiskAssessment,
  DappRiskProvider,
  DappTransactionRiskInput,
} from "./integration-contracts";

function isLocalDevelopmentOrigin(origin: string): boolean {
  try {
    const parsedUrl = new URL(origin);

    return (
      parsedUrl.hostname === "localhost" || parsedUrl.hostname === "127.0.0.1"
    );
  } catch {
    return false;
  }
}

function createOriginAssessment(
  origin: string,
): Pick<DappRiskAssessment, "trustLevel" | "warnings"> {
  const parsedUrl = new URL(origin);

  if (parsedUrl.protocol === "https:") {
    return {
      trustLevel: isLocalDevelopmentOrigin(origin) ? "verified" : "unknown",
      warnings: [],
    };
  }

  if (isLocalDevelopmentOrigin(origin)) {
    return {
      trustLevel: "verified",
      warnings: [],
    };
  }

  return {
    trustLevel: "flagged",
    warnings: [
      {
        code: "insecure-origin",
        title: "This site is not using HTTPS",
        message:
          "Helio detected an insecure origin. Only approve this request if you fully trust the site and network.",
        severity: "critical",
      },
    ],
  };
}

/**
 * Creates the built-in local risk provider used when no external security vendor is configured.
 *
 * @returns Lightweight origin-based risk assessment helpers for dApp review flows.
 */
export function createLocalDappRiskProvider(): DappRiskProvider {
  return {
    async assessConnection(input: DappConnectionRiskInput) {
      return createOriginAssessment(input.origin);
    },

    async assessMessage(input: DappMessageRiskInput) {
      return createOriginAssessment(input.origin);
    },

    async assessTransaction(input: DappTransactionRiskInput) {
      return createOriginAssessment(input.origin);
    },
  };
}
