import axios from 'axios';
import { logger } from '../utils/logger';
import { retryWithBackoff } from '../utils/retry';
import { ScrapedStoreData } from '../types';

const CLORE_API_URL = process.env.CLORE_API_URL || 'https://api.clore.app/dev';

interface DeleteStoreResponse {
  data?: {
    deleteStore: boolean;
  };
  errors?: Array<{ message: string }>;
}

interface SyncMutationResult {
  success: boolean;
  message: string;
  storeId?: string;
  productsCreated: number;
  variantsCreated: number;
  errors?: string[];
}

interface SyncResponse {
  data?: {
    syncScrapedStoreAndProducts: SyncMutationResult;
  };
  errors?: Array<{ message: string }>;
}

/**
 * Syncs scraped store and products via GraphQL mutation with batching
 */
export async function syncScrapedStoreAndProducts(
  token: string,
  data: ScrapedStoreData
): Promise<{ success: boolean; message: string; result?: SyncMutationResult }> {
  try {
    logger.info(`📤 Syncing scraped store to GraphQL API...`);
    logger.debug(`API URL: ${CLORE_API_URL}`);
    logger.success(`🎨 Store logo_url being sent: ${data.store.logo_url || 'none'}`);
    logger.success(`📝 Store description being sent: ${data.store.description || 'none'}`);

    const BATCH_SIZE = 20; // Process 20 products at a time to avoid 413 payload size errors
    const totalProducts = data.products.length;
    const totalVariants = data.product_variants.length;

    logger.info(`📦 Processing ${totalProducts} products and ${totalVariants} variants in batches of ${BATCH_SIZE}...`);

    let totalProductsCreated = 0;
    let totalVariantsCreated = 0;
    let allErrors: string[] = [];
    let storeId: string | undefined;

    // Process products in batches
    for (let i = 0; i < totalProducts; i += BATCH_SIZE) {
      const productBatch = data.products.slice(i, Math.min(i + BATCH_SIZE, totalProducts));
      const variantBatch = data.product_variants.filter(v =>
        productBatch.some(p => p.shopify_id === v.shopify_product_id)
      );

      const batchNum = Math.floor(i / BATCH_SIZE) + 1;
      const totalBatches = Math.ceil(totalProducts / BATCH_SIZE);

      logger.info(`  📦 Batch ${batchNum}/${totalBatches}: Syncing ${productBatch.length} products and ${variantBatch.length} variants...`);

      // Build the GraphQL query
      const query = `
        mutation SyncScrapedStore(
          $store: ScrapedStoreDataInput!
          $products: [ScrapedProductInput!]!
          $variants: [ScrapedProductVariantInput!]!
        ) {
          syncScrapedStoreAndProducts(
            store: $store
            products: $products
            variants: $variants
          ) {
            success
            message
            storeId
            productsCreated
            variantsCreated
            errors
          }
        }
      `;

      // Execute mutation with retry
      const result = await retryWithBackoff(
        async () => {
          const response = await axios.post<SyncResponse>(
            CLORE_API_URL,
            {
              query,
              variables: {
                store: data.store,
                products: productBatch,
                variants: variantBatch,
              },
            },
            {
              headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json',
              },
              timeout: 120000, // 2 minutes
            }
          );

          return response;
        },
        `GraphQL sync batch ${batchNum}`
      );

      // Handle GraphQL errors
      if (result.data.errors) {
        const errorMessages = result.data.errors.map((e) => e.message).join(', ');
        logger.error(`❌ GraphQL error in batch ${batchNum}: ${errorMessages}`);
        allErrors.push(`Batch ${batchNum}: ${errorMessages}`);
        continue;
      }

      // Handle successful response
      const mutation = result.data.data?.syncScrapedStoreAndProducts;
      if (!mutation) {
        logger.error(`❌ No mutation result in batch ${batchNum}`);
        allErrors.push(`Batch ${batchNum}: No mutation result`);
        continue;
      }

      if (!mutation.success) {
        logger.fail(`❌ Batch ${batchNum} failed: ${mutation.message}`);
        allErrors.push(`Batch ${batchNum}: ${mutation.message}`);
        continue;
      }

      // Accumulate results
      if (mutation.storeId && !storeId) {
        storeId = mutation.storeId;
      }
      totalProductsCreated += mutation.productsCreated;
      totalVariantsCreated += mutation.variantsCreated;
      if (mutation.errors?.length) {
        allErrors.push(...mutation.errors);
      }

      logger.success(`✅ Batch ${batchNum} complete: ${mutation.productsCreated} products, ${mutation.variantsCreated} variants`);
    }

    // Summary
    const overallSuccess = allErrors.length === 0;
    logger.success(`📊 Overall Summary:`, {
      storeId,
      productsCreated: totalProductsCreated,
      variantsCreated: totalVariantsCreated,
      errors: allErrors.length,
    });

    return {
      success: overallSuccess,
      message: overallSuccess ? 'All batches synced successfully' : `Sync completed with ${allErrors.length} errors`,
      result: {
        success: overallSuccess,
        message: overallSuccess ? 'Sync successful' : 'Sync completed with errors',
        storeId,
        productsCreated: totalProductsCreated,
        variantsCreated: totalVariantsCreated,
        errors: allErrors,
      },
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    logger.error(`❌ Sync error: ${message}`);
    return {
      success: false,
      message: `Sync error: ${message}`,
    };
  }
}

/**
 * Deletes a store via GraphQL mutation
 */
export async function deleteStoreById(
  token: string,
  storeId: string
): Promise<{ success: boolean; message: string }> {
  try {
    logger.info(`🗑️  Deleting store: ${storeId}`);

    // Build the GraphQL mutation
    const query = `
      mutation DeleteStore($storeid: ID!) {
        deleteStore(storeid: $storeid)
      }
    `;

    // Execute mutation with retry
    const result = await retryWithBackoff(
      async () => {
        const response = await axios.post<DeleteStoreResponse>(
          CLORE_API_URL,
          {
            query,
            variables: {
              storeid: storeId,
            },
          },
          {
            headers: {
              'Authorization': `Bearer ${token}`,
              'Content-Type': 'application/json',
            },
            timeout: 60000, // 1 minute
          }
        );

        return response;
      },
      'GraphQL delete request'
    );

    // Handle GraphQL errors
    if (result.data.errors) {
      const errorMessages = result.data.errors.map((e) => e.message).join(', ');
      logger.error(`❌ GraphQL error: ${errorMessages}`);
      return {
        success: false,
        message: `GraphQL error: ${errorMessages}`,
      };
    }

    // Handle successful response
    const deleteResult = result.data.data?.deleteStore;
    if (deleteResult === undefined || deleteResult === null) {
      logger.error('❌ No delete result in response');
      return {
        success: false,
        message: 'No delete result in response',
      };
    }

    if (!deleteResult) {
      logger.error('❌ Delete mutation returned false');
      return {
        success: false,
        message: 'Delete mutation failed',
      };
    }

    logger.success(`✅ Store deleted successfully!`);
    logger.success(`📊 Summary:`, {
      storeId: storeId,
    });

    return {
      success: true,
      message: `Store ${storeId} deleted successfully`,
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    logger.error(`❌ Delete error: ${message}`);
    return {
      success: false,
      message: `Delete error: ${message}`,
    };
  }
}
