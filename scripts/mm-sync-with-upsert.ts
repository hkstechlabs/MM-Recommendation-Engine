import { createServiceClient } from '@/lib/supabase/script-client'
import { config } from 'dotenv'

// Load environment variables
config({ path: '.env.local' })

// MM Shopify Configuration
const MM_SHOPIFY_URL = 'https://ozmobiles-com-au.myshopify.com'
const MM_ACCESS_TOKEN = process.env.MM_ACCESS_TOKEN
const MM_API_VERSION = '2026-01'

// Use the service client for Node.js environment with admin privileges
const supabase = createServiceClient()

interface ShopifyProduct {
  id: number
  title: string
  vendor: string
  product_type: string
  created_at: string
  tags: string | string[]
  variants: ShopifyVariant[]
  image?: {
    id: number
    src: string
    alt?: string
    position: number
  }
}

interface ShopifyVariant {
  id: number
  title: string
  price: string
  sku: string
  position: number
  compare_at_price: string | null
  inventory_quantity: number
  old_inventory_quantity: number
  created_at: string
  updated_at: string
  taxable: boolean
  fulfillment_service: string
  requires_shipping: boolean
  weight: number
  weight_unit: string
  inventory_item_id: number
  image_id: number | null
}

interface SyncStats {
  productsCreated: number
  productsUpdated: number
  variantsCreated: number
  variantsUpdated: number
  totalProducts: number
  totalVariants: number
  errors: number
}

class MMSyncServiceWithUpsert {
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
    }
  }

  /**
   * Test if unique constraints exist
   */
  async testUniqueConstraints(): Promise<boolean> {
    try {
      console.log('🔍 Testing unique constraints...')
      
      // Test products constraint by trying a simple upsert
      const testProduct = {
        title: 'Test Product - Constraint Check',
        vendor: 'Test Vendor',
        product_type: 'Test Type',
        product_created_at: new Date().toISOString(),
        product_id: 999999998,
        status: 'test',
        tags: ['test'],
        image_id: null
      }

      const { error: productError } = await supabase
        .from('products')
        .upsert([testProduct], { 
          onConflict: 'product_id',
          ignoreDuplicates: false 
        })

      if (productError) {
        if (productError.message.includes('no unique or exclusion constraint')) {
          console.log('❌ Products table missing unique constraint on product_id')
          return false
        }
        throw productError
      }

      // Clean up test product
      await supabase.from('products').delete().eq('product_id', 999999998)

      console.log('✅ Unique constraints are working!')
      return true
    } catch (error) {
      console.error('❌ Constraint test failed:', (error as Error).message)
      return false
    }
  }

  /**
   * Fetch all products from MM Shopify
   */
  async fetchAllProducts(): Promise<ShopifyProduct[]> {
    console.log('📦 Fetching products from MM Shopify...')
    const allProducts: ShopifyProduct[] = []
    let nextUrl: string | null = `${MM_SHOPIFY_URL}/admin/api/${MM_API_VERSION}/products.json?limit=250`
    let pageCount = 0

    const headers = {
      'X-Shopify-Access-Token': MM_ACCESS_TOKEN!,
      'Content-Type': 'application/json',
    }

    while (nextUrl) {
      try {
        pageCount++
        console.log(`📄 Fetching page ${pageCount}...`)
        const response = await fetch(nextUrl, { headers })
        
        if (!response.ok) {
          throw new Error(`HTTP ${response.status}: ${response.statusText}`)
        }

        const data = await response.json()
        const products = data.products || []
        allProducts.push(...products)
        
        console.log(`✅ Retrieved ${products.length} products (Total: ${allProducts.length})`)

        // Check for next page
        const linkHeader = response.headers.get('link')
        nextUrl = this.parseNextUrl(linkHeader)
        
        if (nextUrl) {
          await new Promise(resolve => setTimeout(resolve, 100))
        }

      } catch (error) {
        console.error(`❌ Error fetching page ${pageCount}:`, (error as Error).message)
        throw error
      }
    }

    this.stats.totalProducts = allProducts.length
    this.stats.totalVariants = allProducts.reduce((sum, product) => sum + (product.variants?.length || 0), 0)
    
    console.log(`🎉 Fetched ${allProducts.length} products with ${this.stats.totalVariants} variants`)
    return allProducts
  }

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
   * Prepare product data
   */
  private prepareProductData(shopifyProduct: ShopifyProduct) {
    let tagsArray: string[] = []
    if (shopifyProduct.tags) {
      if (Array.isArray(shopifyProduct.tags)) {
        tagsArray = shopifyProduct.tags
      } else if (typeof shopifyProduct.tags === 'string') {
        tagsArray = shopifyProduct.tags.split(',').map(tag => tag.trim())
      }
    }

    return {
      title: shopifyProduct.title,
      vendor: shopifyProduct.vendor,
      product_type: shopifyProduct.product_type,
      product_created_at: shopifyProduct.created_at,
      product_id: shopifyProduct.id,
      status: 'active',
      tags: tagsArray,
      image_id: shopifyProduct.image?.id || null
    }
  }

  /**
   * Prepare variant data
   */
  private prepareVariantData(shopifyVariant: ShopifyVariant, productUuid: string) {
    const titleText = shopifyVariant.title || ''
    const skuText = shopifyVariant.sku || ''
    const combinedText = `${titleText} ${skuText}`

    return {
      product_id: productUuid,
      variant_id: shopifyVariant.id,
      title: shopifyVariant.title,
      price: shopifyVariant.price,
      sku: shopifyVariant.sku,
      position: shopifyVariant.position,
      compare_at_price: shopifyVariant.compare_at_price,
      storage: this.extractStorageFromText(combinedText),
      condition: this.extractConditionFromText(combinedText),
      color: this.extractColourFromText(combinedText),
      inventory_quantity: shopifyVariant.inventory_quantity,
      old_inventory_quantity: shopifyVariant.old_inventory_quantity,
      taxable: shopifyVariant.taxable,
      fulfillment_service: shopifyVariant.fulfillment_service,
      requires_shipping: shopifyVariant.requires_shipping,
      weight: shopifyVariant.weight,
      weight_unit: shopifyVariant.weight_unit,
      inventory_item_id: shopifyVariant.inventory_item_id,
      image_id: shopifyVariant.image_id
    }
  }

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
   * True bulk upsert with unique constraints
   */
  async bulkUpsertProducts(shopifyProducts: ShopifyProduct[]): Promise<void> {
    console.log(`⚡ Starting ultra-fast bulk upsert of ${shopifyProducts.length} products...`)

    try {
      // Prepare all product data
      const productData = shopifyProducts.map(product => this.prepareProductData(product))

      console.log('🚀 Bulk upserting products...')
      
      // True bulk upsert - fastest possible method
      const { data: upsertedProducts, error: productError } = await supabase
        .from('products')
        .upsert(productData, { 
          onConflict: 'product_id',
          ignoreDuplicates: false 
        })
        .select('id, product_id')

      if (productError) {
        console.error('❌ Bulk product upsert failed:', productError.message)
        throw productError
      }

      console.log(`✅ Successfully upserted ${upsertedProducts?.length || 0} products`)

      // Create product ID mapping
      const productIdMap = new Map<number, string>()
      upsertedProducts?.forEach(product => {
        productIdMap.set(product.product_id, product.id)
      })

      // Prepare all variant data
      const allVariantData: any[] = []
      for (const shopifyProduct of shopifyProducts) {
        const productUuid = productIdMap.get(shopifyProduct.id)
        if (!productUuid) {
          console.warn(`⚠️ No UUID found for product ${shopifyProduct.id}`)
          continue
        }

        for (const variant of shopifyProduct.variants || []) {
          allVariantData.push(this.prepareVariantData(variant, productUuid))
        }
      }

      if (allVariantData.length > 0) {
        console.log(`🚀 Bulk upserting ${allVariantData.length} variants...`)
        
        // True bulk upsert for variants
        const { data: upsertedVariants, error: variantError } = await supabase
          .from('variants')
          .upsert(allVariantData, { 
            onConflict: 'variant_id',
            ignoreDuplicates: false 
          })
          .select('id')

        if (variantError) {
          console.error('❌ Bulk variant upsert failed:', variantError.message)
          throw variantError
        }

        console.log(`✅ Successfully upserted ${upsertedVariants?.length || 0} variants`)
        
        this.stats.productsCreated = upsertedProducts?.length || 0
        this.stats.variantsCreated = upsertedVariants?.length || 0
      }

    } catch (error) {
      console.error('❌ Bulk upsert failed:', (error as Error).message)
      this.stats.errors++
      throw error
    }
  }

  /**
   * Main sync function
   */
  async sync(): Promise<void> {
    const startTime = new Date()
    console.log(`🚀 Starting MM sync with true bulk upserts at ${startTime.toISOString()}`)

    try {
      // Test constraints first
      const hasConstraints = await this.testUniqueConstraints()
      if (!hasConstraints) {
        console.log('❌ Unique constraints not found!')
        console.log('📋 Please run this SQL in your Supabase dashboard:')
        console.log('   ALTER TABLE public.products ADD CONSTRAINT products_product_id_unique UNIQUE (product_id);')
        console.log('   ALTER TABLE public.variants ADD CONSTRAINT variants_variant_id_unique UNIQUE (variant_id);')
        return
      }

      // Fetch products
      const products = await this.fetchAllProducts()
      if (products.length === 0) {
        console.warn('⚠️ No products fetched')
        return
      }

      // Process in batches
      const batchSize = 100
      const totalBatches = Math.ceil(products.length / batchSize)
      
      console.log(`⚡ Processing ${products.length} products in ${totalBatches} batches`)

      for (let i = 0; i < products.length; i += batchSize) {
        const batch = products.slice(i, i + batchSize)
        const batchNumber = Math.floor(i / batchSize) + 1
        
        console.log(`📦 Batch ${batchNumber}/${totalBatches} (${batch.length} products)`)
        
        try {
          await this.bulkUpsertProducts(batch)
          console.log(`✅ Batch ${batchNumber} completed`)
        } catch (error) {
          console.error(`❌ Batch ${batchNumber} failed:`, (error as Error).message)
          this.stats.errors++
        }

        // Small delay between batches
        if (i + batchSize < products.length) {
          await new Promise(resolve => setTimeout(resolve, 200))
        }
      }

      const endTime = new Date()
      const duration = endTime.getTime() - startTime.getTime()

      console.log('🎉 MM sync completed!')
      console.log(`📊 Stats: ${this.stats.productsCreated} products, ${this.stats.variantsCreated} variants in ${Math.round(duration / 1000)}s`)
      console.log(`⚡ Performance: ${Math.round(products.length / (duration / 1000))} products/sec`)

    } catch (error) {
      console.error('💥 Fatal error:', (error as Error).message)
      throw error
    }
  }
}

// Export for use as module
export default MMSyncServiceWithUpsert

// Run if executed directly
if (require.main === module) {
  const syncService = new MMSyncServiceWithUpsert()
  syncService.sync().catch(error => {
    console.error('🔥 MM sync failed:', error)
    process.exit(1)
  })
}