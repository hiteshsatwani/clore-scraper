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
 * Syncs scraped store and products via GraphQL mutation
 */
export async function syncScrapedStoreAndProducts(
  token: string,
  data: ScrapedStoreData
): Promise<{ success: boolean; message: string; result?: SyncMutationResult }> {
  try {
    logger.info(`📤 Syncing scraped store to GraphQL API...`);
    logger.debug(`API URL: ${CLORE_API_URL}`);

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
              products: data.products,
              variants: data.product_variants,
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
      'GraphQL sync request'
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
    const mutation = result.data.data?.syncScrapedStoreAndProducts;
    if (!mutation) {
      logger.error('❌ No mutation result in response');
      return {
        success: false,
        message: 'No mutation result in response',
      };
    }

    if (!mutation.success) {
      logger.fail(`❌ Mutation failed: ${mutation.message}`);
      return {
        success: false,
        message: mutation.message,
        result: mutation,
      };
    }

    logger.success(`✅ Sync successful!`);
    logger.success(`📊 Summary:`, {
      storeId: mutation.storeId,
      productsCreated: mutation.productsCreated,
      variantsCreated: mutation.variantsCreated,
      errors: mutation.errors?.length || 0,
    });

    return {
      success: true,
      message: mutation.message,
      result: mutation,
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
