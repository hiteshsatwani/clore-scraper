import { logger } from './logger';

/**
 * Validates admin token
 * Token should be provided via ADMIN_TOKEN environment variable
 */
export function validateAdminToken(token: string | undefined): boolean {
  const validToken = process.env.ADMIN_TOKEN;

  if (!validToken) {
    logger.error('ADMIN_TOKEN environment variable not set');
    return false;
  }

  if (!token) {
    logger.error('No token provided');
    return false;
  }

  if (token !== validToken) {
    logger.error('Invalid token provided');
    return false;
  }

  logger.debug('Token validated successfully');
  return true;
}

/**
 * Checks if a token is provided and valid
 * Throws an error if not valid
 */
export function requireAdminToken(token: string | undefined): void {
  if (!validateAdminToken(token)) {
    throw new Error('Unauthorized: Invalid or missing admin token');
  }
}
