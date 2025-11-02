import axios, { AxiosError } from 'axios';
import { logger } from '../utils/logger';
import { retryWithBackoff } from '../utils/retry';
import { ShopifyProductsResponse } from '../types';

const REQUEST_TIMEOUT = parseInt(process.env.REQUEST_TIMEOUT_MS || '30000', 10);

interface DetectionResult {
  isShopify: boolean;
  error?: string;
}

interface ShopInfo {
  currency: string;
  name?: string;
  shop_owner?: string;
  logo_url?: string | null;
  description?: string | null;
}

/**
 * Detects if a domain is a Shopify store by attempting to fetch /products.json
 */
export async function detectShopifyStore(domain: string): Promise<DetectionResult> {
  logger.info(`Detecting Shopify store: ${domain}`);

  const url = `https://${domain}/products.json`;

  try {
    await retryWithBackoff(
      async () => {
        const response = await axios.get<ShopifyProductsResponse>(url, {
          timeout: REQUEST_TIMEOUT,
          headers: {
            'User-Agent': 'CloreShopifyScraper/1.0',
          },
        });

        // Verify response has products array
        if (!response.data.products || !Array.isArray(response.data.products)) {
          throw new Error('Response missing products array');
        }

        return response;
      },
      `Detection of ${domain}`
    );

    logger.success(`${domain} is a Shopify store`);
    return { isShopify: true };
  } catch (error) {
    const axiosError = error as AxiosError;
    const statusCode = axiosError?.response?.status;
    const message = axiosError?.message || String(error);

    if (statusCode === 404) {
      logger.info(`${domain} is not a Shopify store (404 on /products.json)`);
      return {
        isShopify: false,
        error: `No products.json endpoint found at ${domain}`,
      };
    }

    logger.warn(`Detection failed for ${domain}`, message);
    return {
      isShopify: false,
      error: `Detection failed: ${message}`,
    };
  }
}

/**
 * Fetches shop branding information from Storefront GraphQL API
 */
async function getShopBranding(domain: string): Promise<{ logo_url?: string | null; description?: string | null }> {
  const url = `https://${domain}/api/graphql.json`;

  const query = `
    query {
      shop {
        name
        description
        brand {
          logo {
            image {
              url
            }
          }
          shortDescription
        }
      }
    }
  `;

  try {
    const response = await retryWithBackoff(
      async () => {
        return await axios.post<any>(url, { query }, {
          timeout: REQUEST_TIMEOUT,
          headers: {
            'User-Agent': 'CloreShopifyScraper/1.0',
            'Content-Type': 'application/json',
          },
        });
      },
      `Storefront GraphQL fetch for ${domain}`
    );

    const data = response.data.data?.shop;
    if (!data) {
      logger.debug(`No branding data from Storefront GraphQL for ${domain}`);
      return {};
    }

    const logoUrl = data.brand?.logo?.image?.url || null;
    const description = data.brand?.shortDescription || data.description || null;

    if (logoUrl) logger.debug(`Shop logo from GraphQL: ${logoUrl}`);
    if (description) logger.debug(`Shop description from GraphQL: ${description.substring(0, 100)}...`);

    return {
      logo_url: logoUrl,
      description: description,
    };
  } catch (error) {
    logger.debug(`Failed to fetch branding from Storefront GraphQL:`, error instanceof Error ? error.message : String(error));
    return {};
  }
}

/**
 * Fetches shop information including currency from Shopify /shop.json endpoint
 * and branding from Storefront GraphQL API
 */
export async function getShopInfo(domain: string): Promise<ShopInfo> {
  const url = `https://${domain}/shop.json`;

  try {
    // Fetch currency and basic info from /shop.json
    const response = await retryWithBackoff(
      async () => {
        return await axios.get<any>(url, {
          timeout: REQUEST_TIMEOUT,
          headers: {
            'User-Agent': 'CloreShopifyScraper/1.0',
          },
        });
      },
      `Shop info fetch for ${domain}`
    );

    const shop = response.data.shop;
    if (!shop) {
      logger.warn(`No shop data in response from ${domain}`);
      return { currency: 'USD' }; // Default fallback
    }

    const currency = shop.currency || 'USD';
    logger.debug(`Shop currency: ${currency}`);

    // Try to fetch branding from Storefront GraphQL API
    const branding = await getShopBranding(domain);

    return {
      currency,
      name: shop.name,
      shop_owner: shop.shop_owner,
      logo_url: branding.logo_url || null,
      description: branding.description || null,
    };
  } catch (error) {
    logger.warn(`Failed to fetch shop info from ${domain}:`, error instanceof Error ? error.message : String(error));
    return { currency: 'USD' }; // Default fallback
  }
}
