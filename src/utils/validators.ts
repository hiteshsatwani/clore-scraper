import { logger } from './logger';

/**
 * Validates domain format
 */
export function isValidDomain(domain: string): boolean {
  // Simple domain regex: must have at least domain.tld format
  const domainRegex = /^([a-z0-9]([a-z0-9-]*[a-z0-9])?\.)+[a-z]{2,}$/i;
  return domainRegex.test(domain);
}

/**
 * Validates that an object has required fields
 */
export function validateRequiredFields(
  obj: Record<string, unknown>,
  requiredFields: string[],
  name: string
): boolean {
  const missing = requiredFields.filter((field) => !obj[field]);

  if (missing.length > 0) {
    logger.warn(`${name} missing required fields: ${missing.join(', ')}`);
    return false;
  }

  return true;
}

/**
 * Validates price format (should be decimal)
 */
export function isValidPrice(price: unknown): boolean {
  if (typeof price === 'string' || typeof price === 'number') {
    const num = parseFloat(String(price));
    return !isNaN(num) && num >= 0;
  }
  return false;
}

/**
 * Validates inventory quantity is non-negative integer
 */
export function isValidInventory(quantity: unknown): boolean {
  if (typeof quantity === 'number') {
    return Number.isInteger(quantity) && quantity >= 0;
  }
  if (typeof quantity === 'string') {
    const num = parseInt(quantity, 10);
    return !isNaN(num) && num >= 0;
  }
  return false;
}
