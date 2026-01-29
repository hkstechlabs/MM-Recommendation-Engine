# MM Sync Scripts

This directory contains the modernized MM sync functionality that replaces the legacy code.

## Files

- `mm-sync.ts` - Main TypeScript sync service using Supabase client
- `mm-sync-with-retry.ts` - Enhanced version with retry logic for Supabase issues
- `test-connection.ts` - Connection testing utility
- `check-env.ts` - Environment variable checker
- `debug-supabase.ts` - Detailed Supabase debugging tool
- `run-mm-sync.js` - Simple Node.js runner script

## Setup

1. **CRITICAL**: You need the Supabase Service Role Key for this script to work properly. The publishable/anon key has limited permissions.

   Add to `.env.local`:
   ```
   NEXT_PUBLIC_SUPABASE_URL=your_supabase_url
   NEXT_PUBLIC_SUPABASE_PUBLISHABLE_OR_ANON_KEY=your_anon_key
   SUPABASE_SERVICE_ROLE_KEY=your_service_role_key  # REQUIRED for sync operations
   MM_ACCESS_TOKEN=your_shopify_access_token
   ```

   **Where to find your Service Role Key:**
   - Go to your Supabase project dashboard
   - Navigate to Settings > API
   - Copy the "service_role" key (NOT the "anon" key)
   - This key bypasses RLS and has full database access

2. Install dependencies:
   ```bash
   npm install
   ```

## Usage

### Testing the connection first (recommended)
```bash
npm run test-connection
```

### Check environment variables
```bash
npm run check-env
```

### Running the sync

**Option 1: Standard sync**
```bash
npm run mm-sync
```

**Option 2: Sync with retry logic (recommended for Supabase issues)**
```bash
npm run mm-sync-retry
```

### Option 3: Using the runner script
```bash
node scripts/run-mm-sync.js
```

### Option 4: Direct execution
```bash
npx tsx scripts/mm-sync.ts
# or
npx tsx scripts/mm-sync-with-retry.ts
```

## What it does

The sync script:

1. **Fetches products** from MM Shopify store using the Shopify Admin API
2. **Creates/updates products** in the Supabase `products` table
3. **Creates/updates variants** in the Supabase `variants` table
4. **Tracks execution** in the `executions` table (if schema allows)
5. **Extracts metadata** like storage, condition, and color from product titles/SKUs
6. **Provides detailed logging** and statistics

## Key Improvements over Legacy Code

- ✅ Uses Supabase client instead of direct API calls
- ✅ TypeScript for better type safety
- ✅ Modern async/await patterns
- ✅ Better error handling
- ✅ Cleaner code structure
- ✅ Proper environment variable handling

## Schema Mapping

### Products Table
- `title` ← Shopify product title
- `vendor` ← Shopify vendor
- `product_type` ← Shopify product_type
- `product_created_at` ← Shopify created_at
- `product_id` ← Shopify product ID
- `status` ← Set to 'active'

### Variants Table
- `product_id` ← Shopify product ID
- `variant_id` ← Shopify variant ID
- `title` ← Shopify variant title
- `price` ← Shopify variant price
- `sku` ← Shopify variant SKU
- `storage` ← Extracted from title/SKU (e.g., "128GB")
- `condition` ← Extracted from title/SKU (e.g., "New", "Very Good")
- `color` ← Extracted from title/SKU (e.g., "Black", "Silver")
- `inventory_quantity` ← Shopify inventory quantity

## Troubleshooting

### Supabase Schema Cache Issues
**Error symptoms:**
- "Could not query the database for the schema cache. Retrying."
- "PGRST002" error codes

**This is a known Supabase infrastructure issue that can occur intermittently.**

**Solutions:**
1. **Use the retry version**: `npm run mm-sync-retry` (recommended)
2. **Wait and retry**: The issue often resolves itself after a few minutes
3. **Check Supabase status**: Visit https://status.supabase.com/
4. **Use smaller batches**: The retry version processes smaller batches to reduce load

### Missing Service Role Key
**This is the most common issue.** The script requires the Supabase Service Role Key, not the publishable/anon key.

**Error symptoms:**
- "Could not query the database for the schema cache"
- "RLS policies" errors
- Permission denied errors

**Solution:**
1. Go to your Supabase project dashboard
2. Navigate to Settings > API  
3. Copy the "service_role" key (NOT the "anon" key)
4. Add it to your `.env.local` file as `SUPABASE_SERVICE_ROLE_KEY=your_service_role_key`

**Why this is needed:**
- The service role key bypasses Row Level Security (RLS) policies
- It has full database access needed for bulk operations
- The anon key is restricted and meant for client-side use only

### Rate Limiting
The script includes small delays between API calls to avoid Shopify rate limits. If you encounter rate limiting, the delays can be increased in the `fetchAllProducts` method.