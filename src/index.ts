import 'dotenv/config';

import { logger } from './utils/logger';
import { normalizeDomain, formatStoreName, createStoreHandle } from './services/domainNormalizer';
import { detectShopifyStore, getShopInfo } from './services/shopifyDetector';
import { scrapeShopifyProducts } from './services/shopifyScraper';
import { mapAllProducts, mapAllVariants } from './services/dataMapper';
import { authenticateWithSupabase } from './services/supabaseAuth';
import { syncScrapedStoreAndProducts, deleteStoreById } from './services/graphqlClient';
import { ScrapedStoreData } from './types';

/**
 * Main scraper function - returns scraped data without saving to file
 */
async function scrapeShopifyStore(
  domain: string,
  logoUrl?: string,
  description?: string
): Promise<{ success: boolean; data?: ScrapedStoreData; error?: string }> {
  try {
    // Step 1: Normalize domain
    logger.info(`🔍 Normalizing domain: ${domain}`);
    const normalizedDomain = normalizeDomain(domain);
    logger.success(`Domain normalized to: ${normalizedDomain}`);

    // Step 2: Detect if Shopify
    logger.info(`🔍 Checking if ${normalizedDomain} is a Shopify store...`);
    const detection = await detectShopifyStore(normalizedDomain);

    if (!detection.isShopify) {
      const error = detection.error || 'Not a Shopify store';
      logger.fail(error);
      return {
        success: false,
        error,
      };
    }

    // Step 3: Scrape products
    logger.info(`📦 Scraping products from ${normalizedDomain}...`);
    const scraperResult = await scrapeShopifyProducts(normalizedDomain);

    // Step 4: Map products to Clore schema
    logger.info(`🔄 Mapping products to Clore schema...`);
    const { products: mappedProducts, failed: failedProducts } = mapAllProducts(
      scraperResult.products
    );

    // Step 5: Map variants to Clore schema
    logger.info(`🔄 Mapping variants to Clore schema...`);
    const { variants: mappedVariants, failed: failedVariants } = mapAllVariants(
      scraperResult.variants
    );

    // Step 6: Fetch shop info from Shopify (includes currency)
    logger.info(`🏪 Fetching shop information...`);
    const shopInfo = await getShopInfo(normalizedDomain);
    logger.success(`Shop currency: ${shopInfo.currency}`);

    // Step 7: Create store object
    logger.info(`🏪 Creating store object...`);
    const storeUrl = `https://${normalizedDomain}`;
    const storeData = {
      display_name: formatStoreName(normalizedDomain),
      store_handle: createStoreHandle(normalizedDomain),
      store_url: storeUrl,
      shopify_store_url: storeUrl,
      shopify_connected: true,
      shopify_connection_status: 'scraped',
      default_currency: shopInfo.currency,
      supported_currencies: [shopInfo.currency],
      logo_url: logoUrl || shopInfo.logo_url || null,
      description: description || shopInfo.description || null,
    };

    // Step 8: Compile final output
    logger.info(`📝 Compiling scraped data...`);
    const output: ScrapedStoreData = {
      store: storeData,
      products: mappedProducts,
      product_variants: mappedVariants,
    };

    logger.success(`✅ Scraping complete!`);
    logger.success(`📊 Summary:`, {
      domain: normalizedDomain,
      productsScraped: mappedProducts.length,
      variantsScraped: mappedVariants.length,
      productsFailed: failedProducts.length + failedVariants.length,
    });

    return {
      success: true,
      data: output,
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    logger.fail(`Scraping failed: ${message}`);
    return {
      success: false,
      error: message,
    };
  }
}

/**
 * CLI entry point
 */
async function main(): Promise<void> {
  const args = process.argv.slice(2);

  if (args.length < 1) {
    printUsage();
    process.exit(1);
  }

  const command = args[0];

  // Handle delete command
  if (command === 'delete') {
    if (args.length < 4) {
      logger.fail('Usage: npm run scrape -- delete <storeid> <email> <password>');
      process.exit(1);
    }

    const storeId = args[1];
    const email = args[2];
    const password = args[3];

    // Authenticate with Supabase
    logger.info('🔐 Authenticating with Supabase...');
    const authResult = await authenticateWithSupabase(email, password);
    if (!authResult.success) {
      logger.fail(`Authentication failed: ${authResult.error}`);
      process.exit(1);
    }

    // Delete store
    logger.info('🗑️  Deleting store...');
    const deleteResult = await deleteStoreById(authResult.token!, storeId);
    if (!deleteResult.success) {
      logger.fail(`Delete failed: ${deleteResult.message}`);
      process.exit(1);
    }

    logger.success('✨ Store deleted!');
    process.exit(0);
  }

  // Handle scrape command (default)
  if (args.length < 3) {
    printUsage();
    process.exit(1);
  }

  const domain = args[0];
  const email = args[1];
  const password = args[2];
  const logoUrl = args[3] || undefined; // Optional logo URL
  const description = args[4] || undefined; // Optional description

  // Step 1: Scrape Shopify store
  logger.info('🚀 Starting Clore Shopify Scraper');
  const scrapeResult = await scrapeShopifyStore(domain, logoUrl, description);

  if (!scrapeResult.success) {
    logger.fail('Scraping failed, aborting');
    process.exit(1);
  }

  // Step 2: Authenticate with Supabase
  logger.info('🔐 Authenticating with Supabase...');
  const authResult = await authenticateWithSupabase(email, password);
  if (!authResult.success) {
    logger.fail(`Authentication failed: ${authResult.error}`);
    process.exit(1);
  }

  // Step 3: Sync to GraphQL API
  logger.info('🔄 Syncing to GraphQL API...');
  const syncResult = await syncScrapedStoreAndProducts(authResult.token!, scrapeResult.data!);
  if (!syncResult.success) {
    logger.fail(`Sync failed: ${syncResult.message}`);
    process.exit(1);
  }

  logger.success('✨ Scraping and sync complete!');
  logger.success('📊 Sync Summary:', {
    storeId: syncResult.result?.storeId,
    productsCreated: syncResult.result?.productsCreated,
    variantsCreated: syncResult.result?.variantsCreated,
    errors: syncResult.result?.errors?.length || 0,
  });

  process.exit(0);
}

/**
 * Print usage instructions
 */
function printUsage(): void {
  logger.fail('Usage:');
  logger.info('');
  logger.info('Scrape and sync Shopify store:');
  logger.info('   npm run scrape -- <domain> <email> <password> [logoUrl] [description]');
  logger.info('');
  logger.info('Delete a store by ID:');
  logger.info('   npm run scrape -- delete <storeid> <email> <password>');
  logger.info('');
  logger.info('Examples:');
  logger.info('   npm run scrape -- worstwork.com hitesh@clore.app Testing123');
  logger.info('   npm run scrape -- worstwork.com hitesh@clore.app Testing123 "https://example.com/logo.png" "My Store Description"');
  logger.info('   npm run scrape -- delete 54b5de3c-45e0-475c-8bc9-a8d6025bacfb hitesh@clore.app Testing123');
  logger.info('');
}

// Run CLI if executed directly
if (require.main === module) {
  main().catch((error) => {
    logger.error('Unexpected error', error);
    process.exit(1);
  });
}

export { scrapeShopifyStore };
