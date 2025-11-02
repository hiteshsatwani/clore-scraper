# Clore Shopify Scraper

A Node.js TypeScript scraper that extracts product data from any Shopify store and outputs it in Clore database format.

## Phase 1: Data Extraction & Formatting

This phase focuses on scraping Shopify stores and formatting the data exactly as it needs to be inserted into the Clore database.

**What it does:**
- Takes a domain name (e.g., `storename.com`)
- Auto-detects if it's a Shopify store
- Scrapes all products and variants from `/products.json` endpoint
- Maps data to exact Clore database schema
- Outputs a JSON document ready for database insertion (no UUIDs - generated later)

## Installation

```bash
npm install
```

## Usage

```bash
npm run scrape -- storename.com
```

### Examples

```bash
# Scrape a store
npm run scrape -- shopname.com

# Works with various domain formats
npm run scrape -- www.shopname.com
npm run scrape -- https://shopname.com
npm run scrape -- shopname.myshopify.com
```

## Output

Generates a JSON file: `output/{domain}_scraped_data.json`

```json
{
  "store": {
    "display_name": "Store Name",
    "store_handle": "store-name",
    "shopify_store_url": "https://storename.com",
    "shopify_connected": true,
    "shopify_connection_status": "scraped",
    "default_currency": "USD",
    "supported_currencies": ["USD"],
    "followers": [],
    "status": "active"
  },
  "products": [
    {
      "shopify_id": "123456789",
      "title": "Product Title",
      "handle": "product-handle",
      "description": "Full description...",
      "product_type": "Category",
      "vendor": "Brand Name",
      "images": ["https://...", "https://..."],
      "tags": ["tag1", "tag2"],
      "status": "active",
      "seo_title": "SEO Title",
      "seo_description": "SEO Description",
      "category": { "name": "Category" },
      "gender": null
    }
  ],
  "product_variants": [
    {
      "shopify_variant_id": "variant-id",
      "shopify_product_id": "product-id",
      "shopify_inventory_item_id": "inventory-item-id",
      "title": "Red / Small",
      "sku": "SKU-001",
      "position": 1,
      "price": "29.99",
      "compare_at_price": "49.99",
      "cost_price": null,
      "inventory_quantity": 100,
      "inventory_tracked": true,
      "inventory_policy": "deny",
      "weight": 0.5,
      "weight_unit": "kg",
      "requires_shipping": true,
      "option1": "Red",
      "option2": "Small",
      "option3": null,
      "available": true,
      "currency": "USD"
    }
  ]
}
```

## Configuration

Create a `.env` file:

```env
LOG_LEVEL=info
RATE_LIMIT_DELAY_MS=2000
MAX_RETRIES=3
REQUEST_TIMEOUT_MS=30000
OUTPUT_DIR=./output
```

### Environment Variables

- `LOG_LEVEL` - Log verbosity: `debug`, `info`, `warn`, `error` (default: `info`)
- `RATE_LIMIT_DELAY_MS` - Delay between page requests in ms (default: `2000`)
- `MAX_RETRIES` - Number of retries with exponential backoff (default: `3`)
- `REQUEST_TIMEOUT_MS` - HTTP request timeout in ms (default: `30000`)
- `OUTPUT_DIR` - Output directory for JSON files (default: `./output`)

## Development

```bash
# Build TypeScript
npm run build

# Run in development mode
npm run dev -- storename.com

# Clean build artifacts
npm run clean
```

## How It Works

### 1. Domain Normalization
Converts any domain format to clean standard format:
- Removes protocol (http://, https://)
- Removes www prefix
- Validates domain format

### 2. Shopify Detection
Attempts to fetch `/products.json` endpoint:
- If successful → It's a Shopify store
- If 404 → Not a Shopify store
- Retries with exponential backoff on network errors

### 3. Product Scraping
Fetches `/products.json` with pagination:
- Extracts all product fields
- Handles variant data
- Respects rate limiting (2+ second delays)
- Continues on partial failures
- Logs all errors for debugging

### 4. Data Mapping
Converts Shopify JSON to Clore schema:
- Maps field names to Clore database columns
- Handles type conversions (prices as strings, weights in kg)
- Parses tags (comma-separated to array)
- Validates all required fields
- Fills in defaults (currency: USD, weight_unit: kg)

### 5. Output
Generates single JSON file with three top-level arrays:
- `store` - Store configuration
- `products` - Product data
- `product_variants` - Variant data

No UUIDs are generated (done during Phase 2 API insertion).

## Data Schema Mapping

### Store Fields
| Shopify | Clore | Notes |
|---------|-------|-------|
| - | display_name | Derived from domain |
| - | store_handle | Derived from domain |
| - | shopify_store_url | Built from domain |
| - | shopify_connected | true |
| - | shopify_connection_status | "scraped" |
| - | default_currency | "USD" |
| - | supported_currencies | ["USD"] |

### Product Fields
| Shopify | Clore | Notes |
|---------|-------|-------|
| id | shopify_id | String |
| title | title | Required |
| handle | handle | Product URL slug |
| body_html | description | May be null |
| product_type | product_type | Maps to category |
| vendor | vendor | Brand name |
| images[].src | images[] | Array of URLs |
| tags | tags | Parsed from comma-separated string |
| status | status | active/draft |
| seo.title | seo_title | SEO metadata |
| seo.description | seo_description | SEO metadata |

### Variant Fields
| Shopify | Clore | Notes |
|---------|-------|-------|
| id | shopify_variant_id | String |
| product_id | shopify_product_id | String |
| inventory_item_id | shopify_inventory_item_id | String or null |
| title | title | e.g., "Red / Small" |
| sku | sku | May be null |
| position | position | Variant order |
| price | price | String (Decimal type) |
| compare_at_price | compare_at_price | Original price |
| weight | weight | Converted to kg |
| weight_unit | weight_unit | Always "kg" |
| requires_shipping | requires_shipping | Boolean |
| option1/2/3 | option1/2/3 | Variant options |
| inventory_quantity | inventory_quantity | Stock level |
| inventory_policy | inventory_policy | deny/continue |
| tracked | inventory_tracked | Boolean |
| available | available | Boolean |

## Error Handling

- **Invalid domain** - Stops with clear error message
- **Not Shopify store** - Returns polite error, stops
- **Network timeouts** - Retries with exponential backoff (3x by default)
- **Bad product data** - Skips individual products, continues scraping
- **Missing variant fields** - Skips variant, logs error

All errors are logged and reported in final summary.

## Next Phases

- **Phase 2** - GraphQL mutation to sync JSON into Clore database
- **Phase 3** - AWS Lambda wrapper for serverless deployment
- **Phase 4** - Admin API endpoint to trigger scraping

## Troubleshooting

### Domain not detected as Shopify
- Verify the domain uses Shopify (not another platform)
- Check if `/products.json` endpoint is accessible
- Try: `curl https://domain.com/products.json`

### Scraper hangs or times out
- Increase `REQUEST_TIMEOUT_MS` in `.env`
- Check network connectivity
- Reduce `RATE_LIMIT_DELAY_MS` if intentionally slow

### Missing product data
- Check `output/{domain}_scraped_data.json` file
- Review logs for specific field warnings
- Some stores may have incomplete product data

## License

MIT
