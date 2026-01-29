import { createClient } from '@supabase/supabase-js'
import { config } from 'dotenv'

// Load environment variables
config({ path: '.env.local' })

// MM Shopify Configuration
const MM_SHOPIFY_URL = 'https://ozmobiles-com-au.myshopify.com'
const MM_ACCESS_TOKEN = process.env.MM_ACCESS_TOKEN
const MM_API_VERSION = '2026-01'

// Create Supabase client
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_OR_ANON_KEY!
)

interface ShopifyProduct {
  id: number
  title: string
  vendor: string
  product_type: string
  created_at: string
  tags: string[]
  variants: ShopifyVariant[]
}

interface ShopifyVariant {
  id: number
  title: string
  price: string
  sku: string
  inventory_quantity: number
  created_at: string
}

interface SyncStats {
  productsCreated: number
  productsUpdated: number
  variantsCreated: number
  variantsUpdated: number
  totalProducts: number
  totalVariants: number
  errors: number
  retries: number
}

class MMSyncServiceWithRetry {
  private stats: SyncStats

  constructor() {
    this.stats = {
      productsCreated: 0,
      productsUpdated: 0,
      variantsCreated: 0,
      variantsUpdated: 0,
      totalProducts: 0,
      totalVariants: 0,
      errors: 0,
      retries: 0
    }
  }

  /**
   * Retry wrapper for Supabase operations
   */
  async withRetry<T>(
    operation: () => Promise<T>,
    operationName: string,
    maxRetries: number = 3,
    baseDelay: number = 1000
  ): Promise<T> {
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        const result = await operation()
        if (attempt > 1) {
          console.log(`   ✅ ${operationName} succeeded on attempt ${attempt}`)
        }
        return result
      } catch (error: any) {
        const isSchemaError = error.message?.includes('schema cache') || error.code === 'PGRST002'
        
        if (isSchemaError && attempt < maxRetries) {
          const delay = baseDelay * Math.pow(2, attempt - 1) // Exponential backoff
          console.log(`   ⏳ ${operationName} failed (attempt ${attempt}/${maxRetries}), retrying in ${delay}ms...`)
          this.stats.retries++
          await new Promise(resolve => setTimeout(resolve, delay))
          continue
        }
        
        // If it's not a schema error or we've exhausted retries, throw the error
        throw error
      }
    }
    
    throw new Error(`${operationName} failed after ${maxRetries} attempts`)
  }

  /**
   * Fetch all products from MM Shopify with pagination
   */
  async fetchAllProducts(): Promise<ShopifyProduct[]> {
    console.log('🔍 Fetching all products from MM Shopify...')
    const allProducts: ShopifyProduct[] = []
    let nextUrl: string | null = `${MM_SHOPIFY_URL}/admin/api/${MM_API_VERSION}/products.json?limit=250`

    const headers = {
      'X-Shopify-Access-Token': MM_ACCESS_TOKEN!,
      'Content-Type': 'application/json',
    }

    while (nextUrl) {
      try {
        console.log(`📥 Fetching: ${nextUrl}`)
        const response = await fetch(nextUrl, { headers })
        
        if (!response.ok) {
          throw new Error(`HTTP ${response.status}: ${response.statusText}`)
        }

        const data = await response.json()
        const products = data.products || []
        allProducts.push(...products)
        console.log(`   Retrieved ${products.length} products (total: ${allProducts.length})`)

        // Check for next page in Link header
        const linkHeader = response.headers.get('link')
        nextUrl = this.parseNextUrl(linkHeader)
        
        if (nextUrl) {
          console.log('   Next page found, continuing...')
          // Add small delay to avoid rate limiting
          await new Promise(resolve => setTimeout(resolve, 100))
        }

      } catch (error) {
        console.error('❌ Error fetching products:', error)
        throw error
      }
    }

    console.log(`✅ Fetched ${allProducts.length} total products from MM`)
    this.stats.totalProducts = allProducts.length
    this.stats.totalVariants = allProducts.reduce((sum, product) => sum + (product.variants?.length || 0), 0)
    console.log(`📊 Total variants: ${this.stats.totalVariants}`)
    
    return allProducts
  }

  /**
   * Parse next URL from Link header
   */
  private parseNextUrl(linkHeader: string | null): string | null {
    if (!linkHeader) return null
    
    const links = linkHeader.split(',')
    for (const link of links) {
      if (link.includes('rel="next"')) {
        const match = link.match(/<([^>]+)>/)
        return match ? match[1] : null
      }
    }
    return null
  }

  /**
   * Helper functions for intelligent data extraction
   */
  private extractStorageFromText(text: string): string | null {
    if (!text) return null
    const storageMatch = text.match(/(\d+(?:GB|TB|MB))/i)
    return storageMatch ? storageMatch[1] : null
  }

  private extractConditionFromText(text: string): string | null {
    if (!text) return null
    const conditionKeywords = ['New', 'Very Good', 'Good', 'Fair', 'Excellent', 'Ex-Demo', 'Brand New', 'Refurbished']
    for (const condition of conditionKeywords) {
      if (text.includes(condition)) {
        return condition
      }
    }
    return null
  }

  private extractColourFromText(text: string): string | null {
    if (!text) return null
    const colourKeywords = [
      'Black', 'White', 'Silver', 'Gold', 'Rose Gold', 'Space Gray', 'Blue', 'Red', 'Green', 
      'Purple', 'Pink', 'Yellow', 'Orange', 'Gray', 'Grey', 'Phantom Black', 'Lavender', 
      'Cream', 'Graphite', 'Bora Purple', 'Pink Gold', 'Jet Black', 'Product Red', 
      'Cosmic Orange', 'Midnight', 'Starlight', 'Alpine Green'
    ]
    
    for (const colour of colourKeywords) {
      if (text.includes(colour)) {
        return colour
      }
    }
    return null
  }

  /**
   * Check if product exists in Supabase with retry
   */
  async getExistingProduct(shopifyProductId: number): Promise<any> {
    return this.withRetry(async () => {
      const { data, error } = await supabase
        .from('products')
        .select('*')
        .eq('product_id', shopifyProductId)
        .maybeSingle()

      if (error) {
        throw error
      }

      return data
    }, `Check existing product ${shopifyProductId}`)
  }

  /**
   * Create new product in Supabase with retry
   */
  async createProduct(shopifyProduct: ShopifyProduct): Promise<any> {
    return this.withRetry(async () => {
      const productData = {
        title: shopifyProduct.title,
        vendor: shopifyProduct.vendor,
        product_type: shopifyProduct.product_type,
        product_created_at: shopifyProduct.created_at,
        product_id: shopifyProduct.id,
        status: 'active',
        tags: shopifyProduct.tags || []
      }

      const { data, error } = await supabase
        .from('products')
        .insert(productData)
        .select()
        .single()

      if (error) {
        throw error
      }

      this.stats.productsCreated++
      console.log(`✅ Created product: ${shopifyProduct.title} (ID: ${shopifyProduct.id})`)
      return data
    }, `Create product ${shopifyProduct.id}`)
  }

  /**
   * Update existing product in Supabase with retry
   */
  async updateProduct(existingProduct: any, shopifyProduct: ShopifyProduct): Promise<any> {
    const updateData = {
      title: shopifyProduct.title,
      vendor: shopifyProduct.vendor,
      product_type: shopifyProduct.product_type,
      product_created_at: shopifyProduct.created_at,
      product_id: shopifyProduct.id,
      tags: shopifyProduct.tags || []
    }

    // Check if update is needed
    const needsUpdate = 
      existingProduct.title !== shopifyProduct.title ||
      existingProduct.vendor !== shopifyProduct.vendor ||
      existingProduct.product_type !== shopifyProduct.product_type ||
      existingProduct.product_created_at !== shopifyProduct.created_at ||
      existingProduct.product_id !== shopifyProduct.id ||
      JSON.stringify(existingProduct.tags || []) !== JSON.stringify(shopifyProduct.tags || [])

    if (!needsUpdate) {
      return existingProduct
    }

    return this.withRetry(async () => {
      const { data, error } = await supabase
        .from('products')
        .update(updateData)
        .eq('id', existingProduct.id)
        .select()
        .single()

      if (error) {
        throw error
      }

      this.stats.productsUpdated++
      console.log(`🔄 Updated product: ${shopifyProduct.title} (ID: ${shopifyProduct.id})`)
      return data
    }, `Update product ${shopifyProduct.id}`)
  }

  /**
   * Get existing variants for a product with retry
   */
  async getExistingVariants(shopifyProductId: number): Promise<any[]> {
    return this.withRetry(async () => {
      const { data, error } = await supabase
        .from('variants')
        .select('*')
        .eq('product_id', shopifyProductId)

      if (error) {
        throw error
      }

      return data || []
    }, `Get variants for product ${shopifyProductId}`)
  }

  /**
   * Create new variant in Supabase with retry
   */
  async createVariant(shopifyVariant: ShopifyVariant, shopifyProduct: ShopifyProduct): Promise<any> {
    return this.withRetry(async () => {
      const titleText = shopifyVariant.title || ''
      const skuText = shopifyVariant.sku || ''
      const combinedText = `${titleText} ${skuText}`

      const variantData = {
        product_id: shopifyProduct.id,
        variant_id: shopifyVariant.id,
        title: shopifyVariant.title,
        price: shopifyVariant.price,
        sku: shopifyVariant.sku,
        storage: this.extractStorageFromText(combinedText),
        condition: this.extractConditionFromText(combinedText),
        color: this.extractColourFromText(combinedText),
        inventory_quantity: shopifyVariant.inventory_quantity,
        position: 1,
        taxable: true,
        requires_shipping: true
      }

      const { data, error } = await supabase
        .from('variants')
        .insert(variantData)
        .select()
        .single()

      if (error) {
        throw error
      }

      this.stats.variantsCreated++
      console.log(`   ✅ Created variant: ${shopifyVariant.title || shopifyVariant.sku} (ID: ${shopifyVariant.id})`)
      return data
    }, `Create variant ${shopifyVariant.id}`)
  }

  /**
   * Update existing variant in Supabase with retry
   */
  async updateVariant(existingVariant: any, shopifyVariant: ShopifyVariant, shopifyProduct: ShopifyProduct): Promise<any> {
    const titleText = shopifyVariant.title || ''
    const skuText = shopifyVariant.sku || ''
    const combinedText = `${titleText} ${skuText}`

    const updateData = {
      title: shopifyVariant.title,
      price: shopifyVariant.price,
      sku: shopifyVariant.sku,
      inventory_quantity: shopifyVariant.inventory_quantity,
      storage: existingVariant.storage || this.extractStorageFromText(combinedText),
      condition: existingVariant.condition || this.extractConditionFromText(combinedText),
      color: existingVariant.color || this.extractColourFromText(combinedText)
    }

    // Check if update is needed
    const needsUpdate = 
      existingVariant.title !== shopifyVariant.title ||
      existingVariant.price !== shopifyVariant.price ||
      existingVariant.sku !== shopifyVariant.sku ||
      existingVariant.inventory_quantity !== shopifyVariant.inventory_quantity ||
      (!existingVariant.storage && updateData.storage) ||
      (!existingVariant.condition && updateData.condition) ||
      (!existingVariant.color && updateData.color)

    if (!needsUpdate) {
      return existingVariant
    }

    return this.withRetry(async () => {
      const { data, error } = await supabase
        .from('variants')
        .update(updateData)
        .eq('id', existingVariant.id)
        .select()
        .single()

      if (error) {
        throw error
      }

      this.stats.variantsUpdated++
      console.log(`   🔄 Updated variant: ${shopifyVariant.title || shopifyVariant.sku} (ID: ${shopifyVariant.id})`)
      return data
    }, `Update variant ${shopifyVariant.id}`)
  }

  /**
   * Sync a single product and its variants
   */
  async syncProduct(shopifyProduct: ShopifyProduct): Promise<void> {
    console.log(`\n🔄 Syncing product: ${shopifyProduct.title} (${shopifyProduct.variants?.length || 0} variants)`)

    try {
      // Check if product exists
      let supabaseProduct = await this.getExistingProduct(shopifyProduct.id)
      
      if (supabaseProduct) {
        // Update existing product
        supabaseProduct = await this.updateProduct(supabaseProduct, shopifyProduct)
      } else {
        // Create new product
        supabaseProduct = await this.createProduct(shopifyProduct)
      }

      if (!supabaseProduct) {
        console.error(`❌ Failed to sync product ${shopifyProduct.id}, skipping variants`)
        return
      }

      // Get existing variants
      const existingVariants = await this.getExistingVariants(shopifyProduct.id)
      const existingVariantMap = new Map()
      existingVariants.forEach(variant => {
        existingVariantMap.set(variant.variant_id, variant)
      })

      // Sync variants
      for (const shopifyVariant of shopifyProduct.variants || []) {
        try {
          const existingVariant = existingVariantMap.get(shopifyVariant.id)
          
          if (existingVariant) {
            // Update existing variant
            await this.updateVariant(existingVariant, shopifyVariant, shopifyProduct)
          } else {
            // Create new variant
            await this.createVariant(shopifyVariant, shopifyProduct)
          }
        } catch (error) {
          console.error(`   ❌ Error syncing variant ${shopifyVariant.id}:`, error)
          this.stats.errors++
        }
      }
    } catch (error) {
      console.error(`❌ Error syncing product ${shopifyProduct.id}:`, error)
      this.stats.errors++
    }
  }

  /**
   * Main sync function with improved error handling and retry logic
   */
  async sync(): Promise<void> {
    const startTime = new Date()
    console.log(`🚀 Starting MM sync with retry logic at ${startTime.toISOString()}`)
    console.log(`⚠️ Note: This version includes retry logic for Supabase schema cache issues`)

    try {
      // Fetch all products from MM
      const products = await this.fetchAllProducts()

      // Sync each product with batch processing
      console.log(`\n📊 Starting sync of ${products.length} products...`)
      
      // Process in smaller batches to avoid overwhelming the database
      const batchSize = 25 // Smaller batches for better reliability
      for (let i = 0; i < products.length; i += batchSize) {
        const batch = products.slice(i, i + batchSize)
        console.log(`\n📦 Processing batch ${Math.floor(i / batchSize) + 1}/${Math.ceil(products.length / batchSize)} (${batch.length} products)`)
        
        for (let j = 0; j < batch.length; j++) {
          const product = batch[j]
          const overallIndex = i + j
          console.log(`\n[${overallIndex + 1}/${products.length}] Processing: ${product.title}`)
          
          await this.syncProduct(product)
        }

        // Progress update after each batch
        console.log(`\n📊 Batch ${Math.floor(i / batchSize) + 1} completed. Overall progress: ${Math.min(i + batchSize, products.length)}/${products.length}`)
        console.log(`   Products: ${this.stats.productsCreated} created, ${this.stats.productsUpdated} updated`)
        console.log(`   Variants: ${this.stats.variantsCreated} created, ${this.stats.variantsUpdated} updated`)
        console.log(`   Errors: ${this.stats.errors}, Retries: ${this.stats.retries}`)

        // Longer delay between batches to give Supabase time to recover
        if (i + batchSize < products.length) {
          console.log(`   ⏳ Waiting 3 seconds before next batch...`)
          await new Promise(resolve => setTimeout(resolve, 3000))
        }
      }

      const endTime = new Date()
      const duration = endTime.getTime() - startTime.getTime()

      console.log(`\n🎉 MM sync completed!`)
      console.log(`   ⏱️ Duration: ${Math.round(duration / 1000)}s`)
      console.log(`   📊 Products: ${this.stats.productsCreated} created, ${this.stats.productsUpdated} updated`)
      console.log(`   📊 Variants: ${this.stats.variantsCreated} created, ${this.stats.variantsUpdated} updated`)
      console.log(`   🔄 Total retries: ${this.stats.retries}`)
      console.log(`   ❌ Errors: ${this.stats.errors}`)

    } catch (error) {
      console.error('🔥 Fatal error during MM sync:', error)
      throw error
    }
  }
}

// Export for use as module
export default MMSyncServiceWithRetry

// Run the sync if this file is executed directly
if (require.main === module) {
  const syncService = new MMSyncServiceWithRetry()
  syncService.sync().catch(error => {
    console.error('🔥 MM sync failed:', error)
    process.exit(1)
  })
}