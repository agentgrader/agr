/**
 * Fetches data from a url using a mockFetcher, with retries on failure.
 *
 * BUG: Currently, this function does not implement any retries. It just
 * calls mockFetcher directly and propagates any errors.
 *
 * TASK: Modify this function to retry up to 3 times (total of 4 attempts:
 * 1 initial + 3 retries) with a delay/backoff of 50ms between attempts,
 * before throwing the final error.
 */
export async function fetchWithRetry(
  url: string,
  mockFetcher: () => Promise<string>
): Promise<string> {
  // TODO: Implement retry logic here
  return mockFetcher();
}
