const axios = require('axios');
require('dotenv').config();

// MM Shopify Configuration
const MM_SHOPIFY_URL = 'https://ozmobiles-com-au.myshopify.com';
const MM_ACCESS_TOKEN = process.env.MM_ACCESS_TOKEN;
const MM_API_VERSION = '2026-01';

// Supabase Configuration
const SUPABASE_BASE_URL = process.env.SUPABASE_BASE_URL;
const SUPABASE_API_KEY = process.env.SUPABASE_API_KEY;
const SUPABASE_AUTH_TOKEN = process.env.SUPABASE_AUTH_TOKEN;

const supabaseHeaders = {
  'apiKey': SUPABASE_API_KEY,
  'Authorization': `Bearer ${SUPABASE_AUTH_TOKEN}`,
  'Content-Type': 'application/json',
  'Prefer': 'return=representation',
};

const shopifyHeaders = {
  'X-Shopify-Access-Token': MM_ACCESS_TOKEN,
  'Content-Type': 'application/json',
};

class MMSyncService {
  constructor() {
    this.stats = {
      productsCreated: 0,
      productsUpdated: 0,
      variantsCreated: 0,
      variantsUpdated: 0,
      totalProducts: 0,
      totalVariants: 0,
      errors: 0,
    };
    this.executionId = null;
  }

  /**
   * Create execution record for MM sync
   */
  async createExecution() {
    try {
      const startTime = new Date().toISOString();
      const response = await axios.post(`${SUPABASE_BASE_URL}/executions`, {
        start_time: startTime,
        executed_by: 'mm_sync',
        notes: 'Starting MM product/variant synchronization from Shopify API'
      }, { 
        headers: supabaseHeaders
      });

      this.executionId = response.data[0]?.id;
      console.log(`📝 Created MM sync execution record: ${this.executionId}`);
      return this.executionId;
    } catch (error) {
      console.error('❌ Error creating execution record:', error.message);
      throw error;
    }
  }

  /**
   * Update execution record with final stats
   */
  async completeExecution() {
    if (!this.executionId) return;

    try {
      const endTime = new Date().toISOString();
      const startTimeResponse = await axios.get(
        `${SUPABASE_BASE_URL}/executions?id=eq.${this.executionId}&select=start_time`,
        { headers: supabaseHeaders }
      );
      
      const startTime = startTimeResponse.data[0]?.start_time;
      let totalRuntime = null;
      
      if (startTime) {
        const start = new Date(startTime);
        const end = new Date(endTime);
        totalRuntime = Math.round((end - start) / 1000); // Runtime in seconds
      }

      await axios.patch(
        `${SUPABASE_BASE_URL}/executions?id=eq.${this.executionId}`,
        {
          end_time: endTime,
          total_runtime: totalRuntime,
          gg_status: 'success', // Using for MM sync status
          reebelo_status: 'success', // Using for MM sync status
          gg_error: this.stats.errors > 0 ? `${this.stats.errors} errors occurred during sync` : null,
          reebelo_error: null,
          gg_raw_response: JSON.stringify({
            type: 'mm_sync',
            productsCreated: this.stats.productsCreated,
            productsUpdated: this.stats.productsUpdated,
            variantsCreated: this.stats.variantsCreated,
            variantsUpdated: this.stats.variantsUpdated,
            totalProducts: this.stats.totalProducts,
            totalVariants: this.stats.totalVariants,
            errors: this.stats.errors
          }),
          reebelo_raw_response: JSON.stringify({
            lastFetched: endTime,
            syncType: 'full_sync',
            apiVersion: MM_API_VERSION,
            shopifyUrl: MM_SHOPIFY_URL
          }),
          notes: `MM sync completed. Products: ${this.stats.productsCreated} created, ${this.stats.productsUpdated} updated. Variants: ${this.stats.variantsCreated} created, ${this.stats.variantsUpdated} updated. Total: ${this.stats.totalProducts} products, ${this.stats.totalVariants} variants. Errors: ${this.stats.errors}. Runtime: ${totalRuntime}s`
        },
        { headers: supabaseHeaders }
      );
      console.log(`📝 Updated execution record with final stats`);
    } catch (error) {
      console.error('❌ Error updating execution record:', error.message);
    }
  }

  /**
   * Fetch all products from MM Shopify with pagination
   */
  async fetchAllProducts() {
    console.log('🔍 Fetching all products from MM Shopify...');
    const allProducts = [];
    let nextUrl = `${MM_SHOPIFY_URL}/admin/api/${MM_API_VERSION}/products.json?limit=250`;

    while (nextUrl) {
      try {
        console.log(`📥 Fetching: ${nextUrl}`);
        const response = await axios.get(nextUrl, { headers: shopifyHeaders });
        
        const products = response.data.products || [];
        allProducts.push(...products);
        console.log(`   Retrieved ${products.length} products (total: ${allProducts.length})`);

        // Check for next page in Link header
        const linkHeader = response.headers.link;
        nextUrl = this.parseNextUrl(linkHeader);
        
        if (nextUrl) {
          console.log(`   Next page found, continuing...`);
          // Add small delay to avoid rate limiting
          await new Promise(resolve => setTimeout(resolve, 100));
        }

      } catch (error) {
        console.error('❌ Error fetching products:', error.message);
        if (error.response) {
          console.error('   Status:', error.response.status);
          console.error('   Data:', JSON.stringify(error.response.data, null, 2));
        }
        throw error;
      }
    }

    console.log(`✅ Fetched ${allProducts.length} total products from MM`);
    this.stats.totalProducts = allProducts.length;
    this.stats.totalVariants = allProducts.reduce((sum, product) => sum + (product.variants?.length || 0), 0);
    console.log(`📊 Total variants: ${this.stats.totalVariants}`);
    
    return allProducts;
  }

  /**
   * Parse next URL from Link header
   */
  parseNextUrl(linkHeader) {
    if (!linkHeader) return null;
    
    const links = linkHeader.split(',');
    for (const link of links) {
      if (link.includes('rel="next"')) {
        const match = link.match(/<([^>]+)>/);
        return match ? match[1] : null;
      }
    }
    return null;
  }

  /**
   * Helper functions for intelligent data extraction and mapping
   */
  extractStorageFromText(text) {
    if (!text) return null;
    const storageMatch = text.match(/(\d+(?:GB|TB|MB))/i);
    return storageMatch ? storageMatch[1] : null;
  }

  extractConditionFromText(text) {
    if (!text) return null;
    const conditionKeywords = ['New', 'Very Good', 'Good', 'Fair', 'Excellent', 'Ex-Demo', 'Brand New', 'Refurbished'];
    for (const condition of conditionKeywords) {
      if (text.includes(condition)) {
        return condition;
      }
    }
    return null;
  }

  extractColourFromText(text) {
    if (!text) return null;
    const colourKeywords = [
      'Black', 'White', 'Silver', 'Gold', 'Rose Gold', 'Space Gray', 'Blue', 'Red', 'Green', 
      'Purple', 'Pink', 'Yellow', 'Orange', 'Gray', 'Grey', 'Phantom Black', 'Lavender', 
      'Cream', 'Graphite', 'Bora Purple', 'Pink Gold', 'Jet Black', 'Product Red', 
      'Cosmic Orange', 'Midnight', 'Starlight', 'Alpine Green'
    ];
    
    for (const colour of colourKeywords) {
      if (text.includes(colour)) {
        return colour;
      }
    }
    return null;
  }

  generateSlugFromText(text) {
    if (!text) return null;
    return text.toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '');
  }

  /**
   * Map Shopify vendor to brand ID (basic mapping - can be enhanced)
   */
  mapVendorToBrand(vendor) {
    if (!vendor) return null;
    
    const brandMapping = {
  'Apple': 1,
  'Samsung': 2,
  'Google': 3,
  'Motorola': 4,
  'Huawei': 5,
  'HTC': 6,
  'LG': 7,
  'OnePlus': 8,
  'Oppo': 9,
  'Sony': 10,
  'Asus': 11,
  'BlackBerry': 12,
  'Microsoft': 13,
  'Nokia': 14,
  'Nintendo': 15,
  'Nothing': 16,
  'Xiaomi': 17,
  'Segway Electric Scooter': 18
};

    // Try exact match first
    if (brandMapping[vendor]) {
      return brandMapping[vendor];
    }

    // Try partial match
    for (const [brandName, brandId] of Object.entries(brandMapping)) {
      if (vendor.toLowerCase().includes(brandName.toLowerCase())) {
        return brandId;
      }
    }

    return null;
  }

  /**
   * Map Shopify product type to type ID (basic mapping - can be enhanced)
   */
  mapProductTypeToTypeId(productType) {
    if (!productType) return null;
    
    const typeMapping = {
  'AirPod': 1,
  'Electric Scooter': 2,
  'Headset': 3,
  'Keyboard': 4,
  'Laptop': 5,
  'Nintendo': 6,
  'Pencil': 7,
  'Phone': 8,
  'PlayStation': 9,
  'Smart Watch': 10,
  'Tablet': 11,
  'Xbox': 12
};

    // Try exact match first
    if (typeMapping[productType]) {
      return typeMapping[productType];
    }

    // Try partial match
    for (const [typeName, typeId] of Object.entries(typeMapping)) {
      if (productType.toLowerCase().includes(typeName.toLowerCase())) {
        return typeId;
      }
    }

    return 8; // Default to accessory type
  }

  /**
   * Generate mapping ID for variants (placeholder logic - can be enhanced)
   */
  generateMappingId(variant, product) {
    // This is a placeholder - in a real scenario, you'd have logic to:
    // 1. Check if this variant exists in competitor systems
    // 2. Create mapping records for price comparison
    // 3. Return the mapping ID for tracking
    
    // For now, we'll use a simple hash-based approach
    const hashString = `${product.id}-${variant.sku || variant.id}`;
    let hash = 0;
    for (let i = 0; i < hashString.length; i++) {
      const char = hashString.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32-bit integer
    }
    return Math.abs(hash) % 10000; // Return a number between 0-9999
  }

  /**
   * Check if product exists in Supabase
   */
  async getExistingProduct(shopifyProductId) {
    try {
      const response = await axios.get(
        `${SUPABASE_BASE_URL}/products?shopify_product_id=eq.${shopifyProductId}`,
        { headers: supabaseHeaders }
      );
      return response.data[0] || null;
    } catch (error) {
      console.error(`❌ Error checking existing product ${shopifyProductId}:`, error.message);
      return null;
    }
  }

  /**
   * Create new product in Supabase with full column population
   */
  async createProduct(shopifyProduct) {
    try {
      const productData = {
        shopify_product_id: shopifyProduct.id,
        shopify_id: shopifyProduct.id,
        name: shopifyProduct.title,
        product_id: shopifyProduct.id.toString(),
        created_at_shopify: shopifyProduct.created_at,
        raw_shopify: shopifyProduct,
        // Map brand from vendor
        brand: this.mapVendorToBrand(shopifyProduct.vendor),
        // Map type from product_type
        type: this.mapProductTypeToTypeId(shopifyProduct.product_type)
      };

      const response = await axios.post(
        `${SUPABASE_BASE_URL}/products`,
        productData,
        { headers: supabaseHeaders }
      );

      this.stats.productsCreated++;
      console.log(`✅ Created product: ${shopifyProduct.title} (ID: ${shopifyProduct.id})`);
      return response.data[0];
    } catch (error) {
      console.error(`❌ Error creating product ${shopifyProduct.id}:`, error.message);
      if (error.response) {
        console.error('   Data:', JSON.stringify(error.response.data, null, 2));
      }
      this.stats.errors++;
      return null;
    }
  }

  /**
   * Update existing product in Supabase with full column population
   */
  async updateProduct(existingProduct, shopifyProduct) {
    try {
      const updateData = {
        name: shopifyProduct.title,
        shopify_id: shopifyProduct.id,
        shopify_product_id: shopifyProduct.id,
        created_at_shopify: shopifyProduct.created_at,
        raw_shopify: shopifyProduct
      };

      // Fill product_id if missing
      if (!existingProduct.product_id) {
        updateData.product_id = shopifyProduct.id.toString();
      }

      // Fill brand if missing or update if different
      const mappedBrand = this.mapVendorToBrand(shopifyProduct.vendor);
      if (mappedBrand && (!existingProduct.brand || existingProduct.brand !== mappedBrand)) {
        updateData.brand = mappedBrand;
      }

      // Fill type if missing or update if different
      const mappedType = this.mapProductTypeToTypeId(shopifyProduct.product_type);
      if (mappedType && (!existingProduct.type || existingProduct.type !== mappedType)) {
        updateData.type = mappedType;
      }

      // Check if update is needed
      const needsUpdate = 
        existingProduct.name !== shopifyProduct.title ||
        existingProduct.shopify_id !== shopifyProduct.id ||
        existingProduct.shopify_product_id !== shopifyProduct.id ||
        existingProduct.created_at_shopify !== shopifyProduct.created_at ||
        !existingProduct.product_id ||
        (mappedBrand && existingProduct.brand !== mappedBrand) ||
        (mappedType && existingProduct.type !== mappedType) ||
        JSON.stringify(existingProduct.raw_shopify) !== JSON.stringify(shopifyProduct);

      if (!needsUpdate) {
        return existingProduct;
      }

      await axios.patch(
        `${SUPABASE_BASE_URL}/products?id=eq.${existingProduct.id}`,
        updateData,
        { headers: supabaseHeaders }
      );

      this.stats.productsUpdated++;
      console.log(`🔄 Updated product: ${shopifyProduct.title} (ID: ${shopifyProduct.id})`);
      return { ...existingProduct, ...updateData };
    } catch (error) {
      console.error(`❌ Error updating product ${shopifyProduct.id}:`, error.message);
      this.stats.errors++;
      return existingProduct;
    }
  }

  /**
   * Get existing variants for a product
   */
  async getExistingVariants(productId) {
    try {
      const response = await axios.get(
        `${SUPABASE_BASE_URL}/variants?product=eq.${productId}`,
        { headers: supabaseHeaders }
      );
      return response.data || [];
    } catch (error) {
      console.error(`❌ Error fetching variants for product ${productId}:`, error.message);
      return [];
    }
  }

  /**
   * Create new variant in Supabase with full column population
   */
  async createVariant(shopifyVariant, supabaseProductId, shopifyProduct) {
    try {
      const variantData = {
        shopify_variant_id: shopifyVariant.id,
        product: supabaseProductId,
        product_id: supabaseProductId.toString(),
        title: shopifyVariant.title,
        price: shopifyVariant.price ? parseFloat(shopifyVariant.price) : null,
        sku: shopifyVariant.sku,
        status: 'active',
        quantity: shopifyVariant.inventory_quantity ? shopifyVariant.inventory_quantity.toString() : '0',
        created_at_shopify: shopifyVariant.created_at,
        raw_shopify: shopifyVariant
      };

      // Intelligent data extraction from title and other fields
      const titleText = shopifyVariant.title || '';
      const skuText = shopifyVariant.sku || '';
      const combinedText = `${titleText} ${skuText}`;

      // Extract storage
      variantData.storage = this.extractStorageFromText(combinedText);

      // Extract condition
      variantData.condition = this.extractConditionFromText(combinedText);

      // Extract colour
      variantData.colour = this.extractColourFromText(combinedText);

      // Generate slug
      variantData.slug = this.generateSlugFromText(shopifyVariant.title || shopifyVariant.sku || `variant-${shopifyVariant.id}`);

      // Generate mapping ID for competitor tracking
      variantData.mapping = this.generateMappingId(shopifyVariant, shopifyProduct);

      const response = await axios.post(
        `${SUPABASE_BASE_URL}/variants`,
        variantData,
        { headers: supabaseHeaders }
      );

      this.stats.variantsCreated++;
      console.log(`   ✅ Created variant: ${shopifyVariant.title || shopifyVariant.sku} (ID: ${shopifyVariant.id})`);
      return response.data[0];
    } catch (error) {
      console.error(`   ❌ Error creating variant ${shopifyVariant.id}:`, error.message);
      if (error.response) {
        console.error('      Data:', JSON.stringify(error.response.data, null, 2));
      }
      this.stats.errors++;
      return null;
    }
  }

  /**
   * Update existing variant in Supabase with full column population
   */
  async updateVariant(existingVariant, shopifyVariant, shopifyProduct) {
    try {
      const updateData = {
        title: shopifyVariant.title,
        price: shopifyVariant.price ? parseFloat(shopifyVariant.price) : null,
        sku: shopifyVariant.sku,
        quantity: shopifyVariant.inventory_quantity ? shopifyVariant.inventory_quantity.toString() : '0',
        created_at_shopify: shopifyVariant.created_at,
        raw_shopify: shopifyVariant
      };

      // Fill product_id if missing
      if (!existingVariant.product_id && existingVariant.product) {
        updateData.product_id = existingVariant.product.toString();
      }

      // Fill status if missing
      if (!existingVariant.status) {
        updateData.status = 'active';
      }

      // Intelligent data extraction for missing fields
      const titleText = shopifyVariant.title || '';
      const skuText = shopifyVariant.sku || '';
      const combinedText = `${titleText} ${skuText}`;

      // Extract storage if missing
      if (!existingVariant.storage) {
        const storage = this.extractStorageFromText(combinedText);
        if (storage) updateData.storage = storage;
      }

      // Extract condition if missing
      if (!existingVariant.condition) {
        const condition = this.extractConditionFromText(combinedText);
        if (condition) updateData.condition = condition;
      }

      // Extract colour if missing
      if (!existingVariant.colour) {
        const colour = this.extractColourFromText(combinedText);
        if (colour) updateData.colour = colour;
      }

      // Generate slug if missing
      if (!existingVariant.slug) {
        updateData.slug = this.generateSlugFromText(shopifyVariant.title || shopifyVariant.sku || `variant-${shopifyVariant.id}`);
      }

      // Generate mapping if missing
      if (!existingVariant.mapping) {
        updateData.mapping = this.generateMappingId(shopifyVariant, shopifyProduct);
      }

      // Check if update is needed (compare key fields)
      const needsUpdate = 
        existingVariant.title !== shopifyVariant.title ||
        parseFloat(existingVariant.price || 0) !== parseFloat(shopifyVariant.price || 0) ||
        existingVariant.sku !== shopifyVariant.sku ||
        existingVariant.quantity !== (shopifyVariant.inventory_quantity ? shopifyVariant.inventory_quantity.toString() : '0') ||
        existingVariant.created_at_shopify !== shopifyVariant.created_at ||
        !existingVariant.product_id ||
        !existingVariant.status ||
        !existingVariant.storage ||
        !existingVariant.condition ||
        !existingVariant.colour ||
        !existingVariant.slug ||
        !existingVariant.mapping ||
        JSON.stringify(existingVariant.raw_shopify) !== JSON.stringify(shopifyVariant);

      if (!needsUpdate) {
        return existingVariant;
      }

      await axios.patch(
        `${SUPABASE_BASE_URL}/variants?id=eq.${existingVariant.id}`,
        updateData,
        { headers: supabaseHeaders }
      );

      this.stats.variantsUpdated++;
      console.log(`   🔄 Updated variant: ${shopifyVariant.title || shopifyVariant.sku} (ID: ${shopifyVariant.id})`);
      return { ...existingVariant, ...updateData };
    } catch (error) {
      console.error(`   ❌ Error updating variant ${shopifyVariant.id}:`, error.message);
      this.stats.errors++;
      return existingVariant;
    }
  }

  /**
   * Sync a single product and its variants
   */
  async syncProduct(shopifyProduct) {
    console.log(`\n🔄 Syncing product: ${shopifyProduct.title} (${shopifyProduct.variants?.length || 0} variants)`);

    // Check if product exists
    let supabaseProduct = await this.getExistingProduct(shopifyProduct.id);
    
    if (supabaseProduct) {
      // Update existing product
      supabaseProduct = await this.updateProduct(supabaseProduct, shopifyProduct);
    } else {
      // Create new product
      supabaseProduct = await this.createProduct(shopifyProduct);
    }

    if (!supabaseProduct) {
      console.error(`❌ Failed to sync product ${shopifyProduct.id}, skipping variants`);
      return;
    }

    // Get existing variants
    const existingVariants = await this.getExistingVariants(supabaseProduct.id);
    const existingVariantMap = new Map();
    existingVariants.forEach(variant => {
      existingVariantMap.set(variant.shopify_variant_id, variant);
    });

    // Sync variants
    for (const shopifyVariant of shopifyProduct.variants || []) {
      const existingVariant = existingVariantMap.get(shopifyVariant.id);
      
      if (existingVariant) {
        // Update existing variant
        await this.updateVariant(existingVariant, shopifyVariant, shopifyProduct);
      } else {
        // Create new variant
        await this.createVariant(shopifyVariant, supabaseProduct.id, shopifyProduct);
      }
    }
  }

  /**
   * Backfill existing products and variants from raw_shopify JSON
   */
  async backfillFromRawData() {
    console.log('🔄 Starting backfill of existing products and variants from raw_shopify data...');
    
    let backfillStats = {
      productsBackfilled: 0,
      variantsBackfilled: 0,
      errors: 0
    };

    try {
      // Backfill products
      console.log('📋 Backfilling products...');
      const productsResponse = await axios.get(
        `${SUPABASE_BASE_URL}/products?select=*&raw_shopify=not.is.null`,
        { headers: supabaseHeaders }
      );

      for (const product of productsResponse.data) {
        if (product.raw_shopify) {
          try {
            const shopifyData = product.raw_shopify;
            const updateData = {};
            let needsUpdate = false;

            // Fill missing fields from raw_shopify
            if (!product.shopify_id && shopifyData.id) {
              updateData.shopify_id = shopifyData.id;
              needsUpdate = true;
            }
            if (!product.created_at_shopify && shopifyData.created_at) {
              updateData.created_at_shopify = shopifyData.created_at;
              needsUpdate = true;
            }
            if (!product.name && shopifyData.title) {
              updateData.name = shopifyData.title;
              needsUpdate = true;
            }

            if (needsUpdate) {
              await axios.patch(
                `${SUPABASE_BASE_URL}/products?id=eq.${product.id}`,
                updateData,
                { headers: supabaseHeaders }
              );
              backfillStats.productsBackfilled++;
              console.log(`   ✅ Backfilled product: ${shopifyData.title} (ID: ${product.id})`);
            }
          } catch (error) {
            console.error(`   ❌ Error backfilling product ${product.id}:`, error.message);
            backfillStats.errors++;
          }
        }
      }

      // Backfill variants
      console.log('📋 Backfilling variants...');
      const variantsResponse = await axios.get(
        `${SUPABASE_BASE_URL}/variants?select=*&raw_shopify=not.is.null`,
        { headers: supabaseHeaders }
      );

      for (const variant of variantsResponse.data) {
        if (variant.raw_shopify) {
          try {
            const shopifyData = variant.raw_shopify;
            const updateData = {};
            let needsUpdate = false;

            // Fill missing fields from raw_shopify
            if (!variant.shopify_variant_id && shopifyData.id) {
              updateData.shopify_variant_id = shopifyData.id;
              needsUpdate = true;
            }
            if (!variant.created_at_shopify && shopifyData.created_at) {
              updateData.created_at_shopify = shopifyData.created_at;
              needsUpdate = true;
            }
            if (!variant.title && shopifyData.title) {
              updateData.title = shopifyData.title;
              needsUpdate = true;
            }
            if (!variant.price && shopifyData.price) {
              updateData.price = parseFloat(shopifyData.price);
              needsUpdate = true;
            }
            if (!variant.sku && shopifyData.sku) {
              updateData.sku = shopifyData.sku;
              needsUpdate = true;
            }
            if (!variant.quantity && shopifyData.inventory_quantity !== undefined) {
              updateData.quantity = shopifyData.inventory_quantity.toString();
              needsUpdate = true;
            }

            if (needsUpdate) {
              await axios.patch(
                `${SUPABASE_BASE_URL}/variants?id=eq.${variant.id}`,
                updateData,
                { headers: supabaseHeaders }
              );
              backfillStats.variantsBackfilled++;
              console.log(`   ✅ Backfilled variant: ${shopifyData.title || shopifyData.sku} (ID: ${variant.id})`);
            }
          } catch (error) {
            console.error(`   ❌ Error backfilling variant ${variant.id}:`, error.message);
            backfillStats.errors++;
          }
        }
      }

      console.log(`\n🎉 Backfill completed!`);
      console.log(`   📊 Products backfilled: ${backfillStats.productsBackfilled}`);
      console.log(`   📊 Variants backfilled: ${backfillStats.variantsBackfilled}`);
      console.log(`   ❌ Errors: ${backfillStats.errors}`);

      return backfillStats;

    } catch (error) {
      console.error('🔥 Fatal error during backfill:', error.message);
      throw error;
    }
  }
  async sync(options = {}) {
    const { backfillOnly = false, includeBackfill = true } = options;
    const startTime = new Date();
    console.log(`🚀 Starting MM sync at ${startTime.toISOString()}`);

    try {
      // Create execution record
      await this.createExecution();

      // Run backfill if requested
      if (backfillOnly) {
        console.log('� Running backfill only...');
        await this.backfillFromRawData();
        await this.completeExecution();
        return;
      }

      // Fetch all products from MM
      const products = await this.fetchAllProducts();

      // Sync each product
      console.log(`\n📊 Starting sync of ${products.length} products...`);
      for (let i = 0; i < products.length; i++) {
        const product = products[i];
        console.log(`\n[${i + 1}/${products.length}] Processing: ${product.title}`);
        
        try {
          await this.syncProduct(product);
        } catch (error) {
          console.error(`❌ Error syncing product ${product.id}:`, error.message);
          this.stats.errors++;
        }

        // Progress update every 10 products
        if ((i + 1) % 10 === 0) {
          console.log(`\n📊 Progress: ${i + 1}/${products.length} products processed`);
          console.log(`   Products: ${this.stats.productsCreated} created, ${this.stats.productsUpdated} updated`);
          console.log(`   Variants: ${this.stats.variantsCreated} created, ${this.stats.variantsUpdated} updated`);
          console.log(`   Errors: ${this.stats.errors}`);
        }
      }

      // Run backfill after sync if requested
      if (includeBackfill) {
        console.log('\n🔄 Running backfill for existing records...');
        await this.backfillFromRawData();
      }

      // Complete execution
      await this.completeExecution();

      const endTime = new Date();
      const duration = endTime - startTime;

      console.log(`\n🎉 MM sync completed!`);
      console.log(`   ⏱️ Duration: ${Math.round(duration / 1000)}s`);
      console.log(`   📊 Products: ${this.stats.productsCreated} created, ${this.stats.productsUpdated} updated`);
      console.log(`   📊 Variants: ${this.stats.variantsCreated} created, ${this.stats.variantsUpdated} updated`);
      console.log(`   ❌ Errors: ${this.stats.errors}`);

    } catch (error) {
      console.error('🔥 Fatal error during MM sync:', error.message);
      await this.completeExecution();
      throw error;
    }
  }
}

// Run the sync if this file is executed directly
if (require.main === module) {
  const syncService = new MMSyncService();
  syncService.sync().catch(error => {
    console.error('🔥 MM sync failed:', error);
    process.exit(1);
  });
}

module.exports = MMSyncService;