import { logger } from './logger';

const MAX_RETRIES = parseInt(process.env.MAX_RETRIES || '3', 10);
const RATE_LIMIT_DELAY = parseInt(process.env.RATE_LIMIT_DELAY_MS || '2000', 10);

export async function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export async function retryWithBackoff<T>(
  fn: () => Promise<T>,
  name: string,
  maxRetries: number = MAX_RETRIES
): Promise<T> {
  let lastError: Error = new Error('Unknown error');

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      logger.debug(`Attempt ${attempt}/${maxRetries} for ${name}`);
      return await fn();
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));

      if (attempt < maxRetries) {
        const delay = Math.pow(2, attempt - 1) * 1000; // Exponential backoff
        logger.warn(
          `${name} failed (attempt ${attempt}/${maxRetries}), retrying in ${delay}ms`,
          lastError.message
        );
        await sleep(delay);
      } else {
        logger.error(`${name} failed after ${maxRetries} attempts`, lastError.message);
      }
    }
  }

  throw lastError;
}

export async function delay(ms: number): Promise<void> {
  return sleep(ms);
}

export function getRateLimitDelay(): number {
  return RATE_LIMIT_DELAY;
}
