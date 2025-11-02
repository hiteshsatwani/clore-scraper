// Clore Database Schema Types (matching Prisma schema)

export interface CloreStore {
  // Required fields
  display_name: string;
  store_handle: string;
  shopify_store_url: string;
  shopify_connected: boolean;
  shopify_connection_status: string;
  default_currency: string;
  supported_currencies: string[];
  followers: string[];
  status?: string;

  // Optional (populated later)
  storeid?: string;
  shopify_tokens?: Record<string, unknown> | null;
  authorized_userid?: string | null;
  store_url?: string | null;
  description?: string | null;
  logo_url?: string | null;
  banner_image?: string | null;
  last_sync_date?: string | null;
}

export interface CloreProduct {
  // Shopify-related
  shopify_id: string;

  // Required fields
  title: string;

  // Optional but important
  handle?: string | null;
  description?: string | null;
  product_type?: string | null;
  vendor?: string | null;
  images: string[];
  tags?: string[] | null;
  status: string;
  seo_title?: string | null;
  seo_description?: string | null;
  category?: Record<string, unknown> | null;
  gender?: string | null;

  // Optional (populated later)
  productid?: string;
  storeid?: string;
  video_url?: string | null;
  aesthetics?: string[];
  processing_status?: string | null;
  original_images?: string[];
}

export interface CloreProductVariant {
  // Shopify IDs
  shopify_variant_id: string;
  shopify_product_id: string;
  shopify_inventory_item_id?: string | null;

  // Required fields
  title: string;
  price: string; // Decimal as string
  inventory_quantity: number;

  // Important optional fields
  sku?: string | null;
  position?: number;
  compare_at_price?: string | null;
  cost_price?: string | null;
  inventory_tracked?: boolean;
  inventory_policy?: string;
  weight?: number | null;
  weight_unit?: string;
  requires_shipping?: boolean;
  option1?: string | null;
  option2?: string | null;
  option3?: string | null;
  available?: boolean;
  currency?: string;

  // Optional (populated later)
  variantid?: string;
  productid?: string;
  storeid?: string;
}

// GraphQL Input type - exactly matches ScrapedStoreDataInput in backend schema
export interface ScrapedStoreInput {
  display_name: string;
  store_handle: string;
  store_url?: string;
  shopify_store_url: string;
  shopify_connected?: boolean;
  shopify_connection_status?: string;
  default_currency?: string;
  supported_currencies?: string[];
  logo_url?: string | null;
  description?: string | null;
}

export interface ScrapedStoreData {
  store: ScrapedStoreInput;  // Use the GraphQL-compatible input type
  products: CloreProduct[];
  product_variants: CloreProductVariant[];
}

export interface ScrapeResult {
  success: boolean;
  file?: string;
  productCount?: number;
  variantCount?: number;
  error?: string;
  failedProducts?: Array<{ handle?: string; error: string }>;
}
