/**
 * Retries an async function with exponential backoff.
 *
 * @param fn - The async function to retry.
 * @param attempts - Maximum number of attempts (default: 3).
 * @param baseDelayMs - Base delay in milliseconds; doubles on each retry (default: 100ms → 200ms → 400ms).
 * @throws The last error thrown by `fn` if all attempts fail.
 */
export async function withRetry<T>(
  fn: () => Promise<T>,
  attempts = 3,
  baseDelayMs = 100,
): Promise<T> {
  let lastError: unknown;
  for (let i = 0; i < attempts; i++) {
    try {
      return await fn();
    } catch (err) {
      lastError = err;
      if (i < attempts - 1) {
        await new Promise((r) => setTimeout(r, baseDelayMs * Math.pow(2, i)));
      }
    }
  }
  throw lastError;
}
