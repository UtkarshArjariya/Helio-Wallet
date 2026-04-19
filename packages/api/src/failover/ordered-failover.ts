/**
 * Executes an async operation against an ordered set of providers until one succeeds.
 *
 * @param candidates - Ordered providers to try, from primary to fallback.
 * @param operation - Async operation to run against each provider.
 * @returns First successful operation result.
 * @throws {Error} If no candidates are provided or every candidate fails.
 */
export async function executeWithOrderedFailover<TCandidate, TResult>(
  candidates: readonly TCandidate[],
  operation: (candidate: TCandidate) => Promise<TResult>,
): Promise<TResult> {
  if (candidates.length === 0) {
    throw new Error("At least one provider candidate is required.");
  }

  let lastError: unknown;

  for (const candidate of candidates) {
    try {
      return await operation(candidate);
    } catch (error) {
      lastError = error;
    }
  }

  throw lastError instanceof Error
    ? lastError
    : new Error("All configured providers failed.", { cause: lastError });
}
