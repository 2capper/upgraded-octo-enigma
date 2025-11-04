/**
 * Database retry helper for handling Neon serverless connection terminations
 */

const MAX_RETRIES = 3;
const RETRY_DELAY_MS = 100;

/**
 * Retry a database operation if it fails due to connection termination
 */
export async function withRetry<T>(
  operation: () => Promise<T>,
  retries = MAX_RETRIES
): Promise<T> {
  try {
    return await operation();
  } catch (error: any) {
    const isConnectionError = 
      error?.code === '57P01' || // terminating connection due to administrator command
      error?.code === '08006' || // connection failure
      error?.code === '08003' || // connection does not exist
      error?.message?.includes('Connection terminated') ||
      error?.message?.includes('terminating connection');

    if (isConnectionError && retries > 0) {
      console.log(`Database connection error, retrying... (${MAX_RETRIES - retries + 1}/${MAX_RETRIES})`);
      await new Promise(resolve => setTimeout(resolve, RETRY_DELAY_MS));
      return withRetry(operation, retries - 1);
    }

    throw error;
  }
}
