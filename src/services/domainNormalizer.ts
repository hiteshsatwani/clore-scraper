import { logger } from '../utils/logger';
import { isValidDomain } from '../utils/validators';

/**
 * Normalizes domain input to clean format
 * Examples:
 *   - "https://www.storename.com" → "storename.com"
 *   - "www.storename.com" → "storename.com"
 *   - "storename.com" → "storename.com"
 *   - "storename.myshopify.com" → "storename.myshopify.com"
 */
export function normalizeDomain(input: string): string {
  logger.debug(`Normalizing domain: ${input}`);

  // Remove protocol (http://, https://)
  let normalized = input.replace(/^(https?:\/\/)/, '');

  // Remove leading slashes
  normalized = normalized.replace(/^\/+/, '');

  // Remove trailing slashes and paths
  normalized = normalized.split('/')[0];

  // Remove port numbers
  normalized = normalized.split(':')[0];

  // Remove www prefix
  normalized = normalized.replace(/^www\./, '');

  // Convert to lowercase
  normalized = normalized.toLowerCase();

  // Trim whitespace
  normalized = normalized.trim();

  logger.debug(`Normalized to: ${normalized}`);

  // Validate format
  if (!isValidDomain(normalized)) {
    throw new Error(`Invalid domain format: ${normalized}`);
  }

  return normalized;
}

/**
 * Creates a store name from domain
 * Example: "storename.com" → "Store Name"
 */
export function formatStoreName(domain: string): string {
  // Get subdomain (first part before first dot)
  const storeName = domain.split('.')[0];

  // Convert hyphens to spaces and capitalize each word
  return storeName
    .split('-')
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join(' ');
}

/**
 * Creates store handle from domain
 * Example: "storename.com" → "storename"
 */
export function createStoreHandle(domain: string): string {
  // Get subdomain (first part before first dot)
  return domain.split('.')[0].toLowerCase();
}
