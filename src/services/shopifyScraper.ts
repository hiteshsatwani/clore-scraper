import axios from 'axios';
import { logger } from '../utils/logger';
import { retryWithBackoff, delay, getRateLimitDelay } from '../utils/retry';
import { ShopifyProductsResponse, ShopifyProduct, ShopifyVariant } from '../types';

const REQUEST_TIMEOUT = parseInt(process.env.REQUEST_TIMEOUT_MS || '30000', 10);

export interface ScraperResult {
  products: ShopifyProduct[];
  variants: ShopifyVariant[];
  failedProducts: Array<{ title: string; error: string }>;
  totalPages: number;
}

/**
 * Scrapes all products from a Shopify store using /products.json pagination
 */
export async function scrapeShopifyProducts(domain: string): Promise<ScraperResult> {
  logger.info(`Scraping products from ${domain}`);

  const baseUrl = `https://${domain}/products.json`;
  const allProducts: ShopifyProduct[] = [];
  const allVariants: ShopifyVariant[] = [];
  const failedProducts: Array<{ title: string; error: string }> = [];

  let page = 1;
  let hasMore = true;
  const rateLimitDelay = getRateLimitDelay();

  while (hasMore) {
    try {
      logger.debug(`Fetching page ${page} from ${domain}`);

      const result = await retryWithBackoff(
        async () => {
          const response = await axios.get<ShopifyProductsResponse>(baseUrl, {
            params: { page },
            timeout: REQUEST_TIMEOUT,
            headers: {
              'User-Agent': 'CloreShopifyScraper/1.0',
            },
          });

          return response;
        },
        `Page ${page} of ${domain}`
      );

      const { products } = result.data;

      if (!products || products.length === 0) {
        logger.debug(`No more products on page ${page}, stopping pagination`);
        hasMore = false;
        break;
      }

      logger.info(`Page ${page}: Found ${products.length} products`);

      // Process each product
      for (const product of products) {
        try {
          // Validate required fields
          if (!product.title) {
            throw new Error('Product missing title');
          }

          allProducts.push(product);

          // Extract variants
          if (product.variants && Array.isArray(product.variants)) {
            for (const variant of product.variants) {
              try {
                // Validate variant
                if (!variant.id || !variant.title) {
                  logger.warn(
                    `Skipping variant for product ${product.title}: missing id or title`
                  );
                  continue;
                }

                allVariants.push(variant);
              } catch (error) {
                const message = error instanceof Error ? error.message : String(error);
                failedProducts.push({
                  title: `${product.title} - variant ${variant.title || variant.id}`,
                  error: message,
                });
              }
            }
          }
        } catch (error) {
          const message = error instanceof Error ? error.message : String(error);
          failedProducts.push({
            title: product.title || 'Unknown',
            error: message,
          });
        }
      }

      page++;

      // Rate limiting between page requests
      if (hasMore && products.length > 0) {
        logger.debug(`Waiting ${rateLimitDelay}ms before next page`);
        await delay(rateLimitDelay);
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      logger.error(`Failed to scrape page ${page} from ${domain}`, message);

      // Don't stop on pagination failure, but don't continue
      hasMore = false;
    }
  }

  logger.success(
    `Scraped ${allProducts.length} products from ${page - 1} pages`,
    `(${allVariants.length} variants)`
  );

  if (failedProducts.length > 0) {
    logger.warn(`${failedProducts.length} products/variants had errors:`, failedProducts);
  }

  return {
    products: allProducts,
    variants: allVariants,
    failedProducts,
    totalPages: page - 1,
  };
}
