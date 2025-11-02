import { logger } from '../utils/logger';
import { ShopifyProduct, ShopifyVariant, CloreProduct, CloreProductVariant } from '../types';
import { isValidPrice, isValidInventory } from '../utils/validators';

/**
 * Maps Shopify product to Clore product format
 */
export function mapShopifyProductToClore(product: ShopifyProduct): CloreProduct {
  const errors: string[] = [];

  // Validate required fields
  if (!product.title) {
    errors.push('Missing title');
  }
  if (!product.id) {
    errors.push('Missing product ID');
  }

  if (errors.length > 0) {
    throw new Error(`Invalid product: ${errors.join(', ')}`);
  }

  // Parse tags (comma-separated string to array)
  let tags: string[] | null = null;
  if (product.tags && typeof product.tags === 'string') {
    const tagsArray = product.tags
      .split(',')
      .map((tag) => tag.trim())
      .filter((tag) => tag.length > 0);
    tags = tagsArray.length > 0 ? tagsArray : null;
  }

  // Map product type to category (JSON format)
  const category = product.product_type
    ? { name: product.product_type }
    : null;

  return {
    shopify_id: String(product.id),
    title: product.title,
    handle: product.handle || null,
    description: product.body_html || null,
    product_type: product.product_type || null,
    vendor: product.vendor || null,
    images: product.images ? product.images.map((img) => img.src) : [],
    tags,
    status: product.status || 'active',
    seo_title: product.seo?.title || null,
    seo_description: product.seo?.description || null,
    category,
    gender: null,
  };
}

/**
 * Maps Shopify variant to Clore variant format
 */
export function mapShopifyVariantToClore(
  variant: ShopifyVariant,
  shopifyProductId: number
): CloreProductVariant {
  const errors: string[] = [];

  // Validate required fields
  if (!variant.id) {
    errors.push('Missing variant ID');
  }
  if (!variant.title) {
    errors.push('Missing variant title');
  }
  if (!isValidPrice(variant.price)) {
    errors.push(`Invalid price: ${variant.price}`);
  }

  if (errors.length > 0) {
    throw new Error(`Invalid variant: ${errors.join(', ')}`);
  }

  // Note: inventory_quantity may be undefined from public API (admin-only data)
  // Use default of 0 if not available
  const inventoryQuantity = isValidInventory(variant.inventory_quantity)
    ? Number(variant.inventory_quantity)
    : 0;

  // Convert price to string (Decimal type in DB)
  const price = String(variant.price);
  const compareAtPrice = variant.compare_at_price ? String(variant.compare_at_price) : null;

  // Determine weight (Shopify uses grams, convert to kg)
  let weight: number | null = null;

  if (variant.weight && variant.weight > 0) {
    // Shopify stores weight in grams (based on weight_unit field)
    if (variant.weight_unit === 'g' || variant.weight_unit === 'grams') {
      weight = variant.weight / 1000; // Convert grams to kg
    } else if (variant.weight_unit === 'kg') {
      weight = variant.weight;
    } else if (variant.weight_unit === 'lb') {
      weight = variant.weight * 0.453592; // Convert pounds to kg
    } else if (variant.weight_unit === 'oz') {
      weight = variant.weight * 0.0283495; // Convert ounces to kg
    } else {
      // Default: assume grams
      weight = variant.weight / 1000;
    }
  }

  return {
    shopify_variant_id: String(variant.id),
    shopify_product_id: String(shopifyProductId),
    shopify_inventory_item_id: variant.inventory_item_id
      ? String(variant.inventory_item_id)
      : null,
    title: variant.title,
    sku: variant.sku || null,
    position: variant.position || 1,
    price,
    compare_at_price: compareAtPrice,
    cost_price: null, // Not available in public products.json
    inventory_quantity: inventoryQuantity,
    inventory_tracked: variant.tracked !== false,
    inventory_policy: variant.inventory_policy || 'deny',
    weight,
    weight_unit: 'kg',
    requires_shipping: variant.requires_shipping !== false,
    option1: variant.option1 || null,
    option2: variant.option2 || null,
    option3: variant.option3 || null,
    available: variant.available !== false,
    currency: 'USD', // Default currency
  };
}

/**
 * Batch map all Shopify products to Clore format
 */
export function mapAllProducts(shopifyProducts: ShopifyProduct[]): {
  products: CloreProduct[];
  failed: Array<{ title: string; error: string }>;
} {
  const products: CloreProduct[] = [];
  const failed: Array<{ title: string; error: string }> = [];

  for (const product of shopifyProducts) {
    try {
      const cloreProduct = mapShopifyProductToClore(product);
      products.push(cloreProduct);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      failed.push({
        title: product.title || 'Unknown',
        error: message,
      });
      logger.warn(`Failed to map product`, message);
    }
  }

  return { products, failed };
}

/**
 * Batch map all Shopify variants to Clore format
 */
export function mapAllVariants(shopifyVariants: ShopifyVariant[]): {
  variants: CloreProductVariant[];
  failed: Array<{ title: string; error: string }>;
} {
  const variants: CloreProductVariant[] = [];
  const failed: Array<{ title: string; error: string }> = [];

  for (const variant of shopifyVariants) {
    try {
      const cloreVariant = mapShopifyVariantToClore(variant, variant.product_id);
      variants.push(cloreVariant);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      failed.push({
        title: variant.title || String(variant.id),
        error: message,
      });
      logger.warn(`Failed to map variant`, message);
    }
  }

  return { variants, failed };
}
