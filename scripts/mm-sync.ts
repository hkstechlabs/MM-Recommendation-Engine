import { createScriptClient, createServiceClient } from '@/lib/supabase/script-client'
import { config } from 'dotenv'
import * as fs from 'fs'
import * as path from 'path'

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
}

interface LogEntry {
  timestamp: string
  level: 'INFO' | 'WARN' | 'ERROR' | 'SUCCESS'
  message: string
  data?: any
}

class Logger {
  private logFile: string
  private logStream: fs.WriteStream

  constructor() {
    const logDir = path.join(process.cwd(), 'logs')
    if (!fs.existsSync(logDir)) {
      fs.mkdirSync(logDir, { recursive: true })
    }
    
    this.logFile = path.join(logDir, `mm-sync-${new Date().toISOString().split('T')[0]}.log`)
    this.logStream = fs.createWriteStream(this.logFile, { flags: 'a' })
    
    console.log(`📝 Logging to: ${this.logFile}`)
  }

  private writeLog(level: LogEntry['level'], message: string, data?: any) {
    const entry: LogEntry = {
      timestamp: new Date().toISOString(),
      level,
      message,
      data
    }

    // Write to file
    this.logStream.write(JSON.stringify(entry) + '\n')

    // Also log to console with formatting
    const emoji = {
      INFO: '📝',
      WARN: '⚠️',
      ERROR: '❌',
      SUCCESS: '✅'
    }[level]

    const logMessage = data 
      ? `${emoji} ${message} - ${JSON.stringify(data)}`
      : `${emoji} ${message}`
    
    console.log(logMessage)
  }

  info(message: string, data?: any) {
    this.writeLog('INFO', message, data)
  }

  warn(message: string, data?: any) {
    this.writeLog('WARN', message, data)
  }

  error(message: string, data?: any) {
    this.writeLog('ERROR', message, data)
  }

  success(message: string, data?: any) {
    this.writeLog('SUCCESS', message, data)
  }

  close() {
    this.logStream.end()
  }
}

class MMSyncService {
  private stats: SyncStats
  private logger: Logger

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
    this.logger = new Logger()
  }

  /**
   * Test database connection and insert test data
   */
  async testDatabaseConnection(): Promise<boolean> {
    try {
      this.logger.info('Testing database connection and schema...')

      // Test connection with a simple query
      const { error: testError } = await supabase
        .from('products')
        .select('count')
        .limit(1)

      if (testError) {
        this.logger.error('Database connection test failed', { error: testError.message })
        return false
      }

      this.logger.success('Database connection successful')

      // Insert test data to verify schema
      const testProduct = {
        title: 'Test Product - MM Sync',
        vendor: 'Test Vendor',
        product_type: 'Test Type',
        product_created_at: new Date().toISOString(),
        product_id: 999999999, // Use a high number to avoid conflicts
        status: 'test',
        tags: ['test', 'mm-sync']
      }

      this.logger.info('Inserting test product data...')
      const { data: insertedProduct, error: insertError } = await supabase
        .from('products')
        .insert(testProduct)
        .select()
        .single()

      if (insertError) {
        this.logger.error('Test product insertion failed', { error: insertError.message })
        return false
      }

      this.logger.success('Test product inserted successfully', { productId: insertedProduct.id })

      // Insert test variant
      const testVariant = {
        product_id: testProduct.product_id,
        variant_id: 999999999,
        title: 'Test Variant',
        price: '99.99',
        sku: 'TEST-SKU-001',
        storage: '128GB',
        condition: 'New',
        color: 'Black',
        inventory_quantity: 10,
        position: 1,
        taxable: true,
        requires_shipping: true
      }

      this.logger.info('Inserting test variant data...')
      const { data: insertedVariant, error: variantError } = await supabase
        .from('variants')
        .insert(testVariant)
        .select()
        .single()

      if (variantError) {
        this.logger.error('Test variant insertion failed', { error: variantError.message })
        // Clean up test product
        await supabase.from('products').delete().eq('id', insertedProduct.id)
        return false
      }

      this.logger.success('Test variant inserted successfully', { variantId: insertedVariant.id })

      // Clean up test data
      this.logger.info('Cleaning up test data...')
      await supabase.from('variants').delete().eq('id', insertedVariant.id)
      await supabase.from('products').delete().eq('id', insertedProduct.id)
      this.logger.success('Test data cleaned up successfully')

      return true
    } catch (error) {
      this.logger.error('Database test failed with exception', { error: (error as Error).message })
      return false
    }
  }
  /**
   * Create execution record for MM sync - Skip due to schema constraints
   */
  async createExecution(): Promise<void> {
    try {
      this.logger.info('Starting MM sync execution...')
      // Skip execution tracking due to schema constraints
      // The executions table has a foreign key constraint to competitors table
      // which doesn't make sense for MM sync operations
      this.logger.warn('Skipping execution tracking due to schema constraints')
    } catch (error) {
      this.logger.error('Failed to create execution record', { error: (error as Error).message })
    }
  }

  /**
   * Update execution record - Skip due to schema constraints
   */
  async completeExecution(): Promise<void> {
    try {
      // Skip execution completion
      this.logger.info('Sync completed (execution tracking skipped)')
    } catch (error) {
      this.logger.error('Failed to complete execution record', { error: (error as Error).message })
    }
  }

  /**
   * Fetch all products from MM Shopify with pagination
   */
  async fetchAllProducts(): Promise<ShopifyProduct[]> {
    this.logger.info('Starting to fetch all products from MM Shopify...')
    const allProducts: ShopifyProduct[] = []
    let nextUrl: string | null = `${MM_SHOPIFY_URL}/admin/api/${MM_API_VERSION}/products.json?limit=250&product_type=phone&vendor=apple&status=active`
    let pageCount = 0

    const headers = {
      'X-Shopify-Access-Token': MM_ACCESS_TOKEN!,
      'Content-Type': 'application/json',
    }

    while (nextUrl) {
      try {
        pageCount++
        this.logger.info(`Fetching page ${pageCount}`, { url: nextUrl })
        const response = await fetch(nextUrl, { headers })
        
        if (!response.ok) {
          const errorMsg = `HTTP ${response.status}: ${response.statusText}`
          this.logger.error('HTTP request failed', { 
            status: response.status, 
            statusText: response.statusText,
            url: nextUrl 
          })
          throw new Error(errorMsg)
        }

        const data = await response.json()
        const products = data.products || []
        allProducts.push(...products)
        
        this.logger.info(`Retrieved ${products.length} products from page ${pageCount}`, {
          pageProducts: products.length,
          totalProducts: allProducts.length
        })

        // Check for next page in Link header
        const linkHeader = response.headers.get('link')
        nextUrl = this.parseNextUrl(linkHeader)
        
        if (nextUrl) {
          this.logger.info('Next page found, continuing...')
          // Add small delay to avoid rate limiting
          await new Promise(resolve => setTimeout(resolve, 100))
        }

      } catch (error) {
        this.logger.error('Error fetching products page', { 
          page: pageCount, 
          error: (error as Error).message,
          url: nextUrl 
        })
        throw error
      }
    }

    this.logger.success(`Fetched ${allProducts.length} total products from MM`, {
      totalProducts: allProducts.length,
      totalPages: pageCount
    })
    
    this.stats.totalProducts = allProducts.length
    this.stats.totalVariants = allProducts.reduce((sum, product) => sum + (product.variants?.length || 0), 0)
    
    this.logger.info('Product fetch summary', {
      totalProducts: this.stats.totalProducts,
      totalVariants: this.stats.totalVariants
    })
    
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
   * Helper functions for intelligent data extraction and mapping
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
   * Check if product exists in Supabase
   */
  async getExistingProduct(shopifyProductId: number): Promise<any> {
    try {
      const { data, error } = await supabase
        .from('products')
        .select('*')
        .eq('product_id', shopifyProductId)
        .maybeSingle()

      if (error) {
        this.logger.error(`Error checking existing product ${shopifyProductId}`, { error: error.message })
        return null
      }

      if (data) {
        this.logger.info(`Found existing product ${shopifyProductId}`, { productId: data.id })
      }

      return data
    } catch (error) {
      this.logger.error(`Exception checking existing product ${shopifyProductId}`, { error: (error as Error).message })
      return null
    }
  }

  /**
   * Create new product in Supabase - optimized for schema
   */
  async createProduct(shopifyProduct: ShopifyProduct): Promise<any> {
    try {
      // Ensure tags is properly formatted as an array
      let tagsArray: string[] = []
      if (shopifyProduct.tags) {
        if (Array.isArray(shopifyProduct.tags)) {
          tagsArray = shopifyProduct.tags
        } else if (typeof shopifyProduct.tags === 'string') {
          // Handle case where tags might be a comma-separated string
          tagsArray = shopifyProduct.tags.split(',').map(tag => tag.trim())
        }
      }

      const productData = {
        title: shopifyProduct.title,
        vendor: shopifyProduct.vendor,
        product_type: shopifyProduct.product_type,
        product_created_at: shopifyProduct.created_at,
        product_id: shopifyProduct.id, // bigint field for Shopify product ID
        status: 'active',
        tags: tagsArray
      }

      this.logger.info(`Creating new product: ${shopifyProduct.title}`, { 
        shopifyId: shopifyProduct.id,
        vendor: shopifyProduct.vendor 
      })

      const { data, error } = await supabase
        .from('products')
        .insert(productData)
        .select()
        .single()

      if (error) {
        this.logger.error(`Failed to create product ${shopifyProduct.id}`, { 
          error: error.message,
          productTitle: shopifyProduct.title 
        })
        this.stats.errors++
        return null
      }

      this.stats.productsCreated++
      this.logger.success(`Created product: ${shopifyProduct.title}`, { 
        shopifyId: shopifyProduct.id,
        supabaseId: data.id 
      })
      return data
    } catch (error) {
      this.logger.error(`Exception creating product ${shopifyProduct.id}`, { 
        error: (error as Error).message,
        productTitle: shopifyProduct.title 
      })
      this.stats.errors++
      return null
    }
  }

  /**
   * Update existing product in Supabase - optimized for schema
   */
  async updateProduct(existingProduct: any, shopifyProduct: ShopifyProduct): Promise<any> {
    try {
      // Ensure tags is properly formatted as an array
      let tagsArray: string[] = []
      if (shopifyProduct.tags) {
        if (Array.isArray(shopifyProduct.tags)) {
          tagsArray = shopifyProduct.tags
        } else if (typeof shopifyProduct.tags === 'string') {
          // Handle case where tags might be a comma-separated string
          tagsArray = shopifyProduct.tags.split(',').map(tag => tag.trim())
        }
      }

      const updateData = {
        title: shopifyProduct.title,
        vendor: shopifyProduct.vendor,
        product_type: shopifyProduct.product_type,
        product_created_at: shopifyProduct.created_at,
        product_id: shopifyProduct.id,
        tags: tagsArray
      }

      // Check if update is needed
      const needsUpdate = 
        existingProduct.title !== shopifyProduct.title ||
        existingProduct.vendor !== shopifyProduct.vendor ||
        existingProduct.product_type !== shopifyProduct.product_type ||
        existingProduct.product_created_at !== shopifyProduct.created_at ||
        existingProduct.product_id !== shopifyProduct.id ||
        JSON.stringify(existingProduct.tags || []) !== JSON.stringify(tagsArray)

      if (!needsUpdate) {
        this.logger.info(`No update needed for product: ${shopifyProduct.title}`, { 
          shopifyId: shopifyProduct.id 
        })
        return existingProduct
      }

      this.logger.info(`Updating product: ${shopifyProduct.title}`, { 
        shopifyId: shopifyProduct.id,
        changes: this.getProductChanges(existingProduct, shopifyProduct)
      })

      const { data, error } = await supabase
        .from('products')
        .update(updateData)
        .eq('id', existingProduct.id)
        .select()
        .single()

      if (error) {
        this.logger.error(`Failed to update product ${shopifyProduct.id}`, { 
          error: error.message,
          productTitle: shopifyProduct.title 
        })
        this.stats.errors++
        return existingProduct
      }

      this.stats.productsUpdated++
      this.logger.success(`Updated product: ${shopifyProduct.title}`, { 
        shopifyId: shopifyProduct.id,
        supabaseId: data.id 
      })
      return data
    } catch (error) {
      this.logger.error(`Exception updating product ${shopifyProduct.id}`, { 
        error: (error as Error).message,
        productTitle: shopifyProduct.title 
      })
      this.stats.errors++
      return existingProduct
    }
  }

  private getProductChanges(existing: any, shopify: ShopifyProduct): string[] {
    const changes: string[] = []
    if (existing.title !== shopify.title) changes.push('title')
    if (existing.vendor !== shopify.vendor) changes.push('vendor')
    if (existing.product_type !== shopify.product_type) changes.push('product_type')
    if (existing.product_created_at !== shopify.created_at) changes.push('product_created_at')
    if (existing.product_id !== shopify.id) changes.push('product_id')
    if (JSON.stringify(existing.tags || []) !== JSON.stringify(shopify.tags || [])) changes.push('tags')
    return changes
  }

  /**
   * Get existing variants for a product - using product_id (bigint)
   */
  async getExistingVariants(shopifyProductId: number): Promise<any[]> {
    try {
      const { data, error } = await supabase
        .from('variants')
        .select('*')
        .eq('product_id', shopifyProductId)

      if (error) {
        this.logger.error(`Error fetching variants for product ${shopifyProductId}`, { error: error.message })
        return []
      }

      this.logger.info(`Found ${data?.length || 0} existing variants for product ${shopifyProductId}`)
      return data || []
    } catch (error) {
      this.logger.error(`Exception fetching variants for product ${shopifyProductId}`, { error: (error as Error).message })
      return []
    }
  }

  /**
   * Create new variant in Supabase - optimized for schema
   */
  async createVariant(shopifyVariant: ShopifyVariant, shopifyProduct: ShopifyProduct): Promise<any> {
    try {
      const titleText = shopifyVariant.title || ''
      const skuText = shopifyVariant.sku || ''
      const combinedText = `${titleText} ${skuText}`

      const variantData = {
        product_id: shopifyProduct.id, // bigint - Shopify product ID
        variant_id: shopifyVariant.id, // bigint - Shopify variant ID
        title: shopifyVariant.title,
        price: shopifyVariant.price,
        sku: shopifyVariant.sku,
        storage: this.extractStorageFromText(combinedText),
        condition: this.extractConditionFromText(combinedText),
        color: this.extractColourFromText(combinedText),
        inventory_quantity: shopifyVariant.inventory_quantity,
        position: 1, // Default position
        taxable: true, // Default taxable
        requires_shipping: true // Default requires shipping
      }

      this.logger.info(`Creating variant: ${shopifyVariant.title || shopifyVariant.sku}`, { 
        shopifyVariantId: shopifyVariant.id,
        shopifyProductId: shopifyProduct.id,
        extractedData: {
          storage: variantData.storage,
          condition: variantData.condition,
          color: variantData.color
        }
      })

      const { data, error } = await supabase
        .from('variants')
        .insert(variantData)
        .select()
        .single()

      if (error) {
        this.logger.error(`Failed to create variant ${shopifyVariant.id}`, { 
          error: error.message,
          variantTitle: shopifyVariant.title,
          sku: shopifyVariant.sku 
        })
        this.stats.errors++
        return null
      }

      this.stats.variantsCreated++
      this.logger.success(`Created variant: ${shopifyVariant.title || shopifyVariant.sku}`, { 
        shopifyVariantId: shopifyVariant.id,
        supabaseId: data.id 
      })
      return data
    } catch (error) {
      this.logger.error(`Exception creating variant ${shopifyVariant.id}`, { 
        error: (error as Error).message,
        variantTitle: shopifyVariant.title 
      })
      this.stats.errors++
      return null
    }
  }

  /**
   * Update existing variant in Supabase - optimized for schema
   */
  async updateVariant(existingVariant: any, shopifyVariant: ShopifyVariant): Promise<any> {
    try {
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
        this.logger.info(`No update needed for variant: ${shopifyVariant.title || shopifyVariant.sku}`, { 
          shopifyVariantId: shopifyVariant.id 
        })
        return existingVariant
      }

      this.logger.info(`Updating variant: ${shopifyVariant.title || shopifyVariant.sku}`, { 
        shopifyVariantId: shopifyVariant.id,
        changes: this.getVariantChanges(existingVariant, shopifyVariant, updateData)
      })

      const { data, error } = await supabase
        .from('variants')
        .update(updateData)
        .eq('id', existingVariant.id)
        .select()
        .single()

      if (error) {
        this.logger.error(`Failed to update variant ${shopifyVariant.id}`, { 
          error: error.message,
          variantTitle: shopifyVariant.title 
        })
        this.stats.errors++
        return existingVariant
      }

      this.stats.variantsUpdated++
      this.logger.success(`Updated variant: ${shopifyVariant.title || shopifyVariant.sku}`, { 
        shopifyVariantId: shopifyVariant.id,
        supabaseId: data.id 
      })
      return data
    } catch (error) {
      this.logger.error(`Exception updating variant ${shopifyVariant.id}`, { 
        error: (error as Error).message,
        variantTitle: shopifyVariant.title 
      })
      this.stats.errors++
      return existingVariant
    }
  }

  private getVariantChanges(existing: any, shopify: ShopifyVariant, updateData: any): string[] {
    const changes: string[] = []
    if (existing.title !== shopify.title) changes.push('title')
    if (existing.price !== shopify.price) changes.push('price')
    if (existing.sku !== shopify.sku) changes.push('sku')
    if (existing.inventory_quantity !== shopify.inventory_quantity) changes.push('inventory_quantity')
    if (!existing.storage && updateData.storage) changes.push('storage')
    if (!existing.condition && updateData.condition) changes.push('condition')
    if (!existing.color && updateData.color) changes.push('color')
    return changes
  }

  /**
   * Sync a single product and its variants - optimized for schema
   */
  async syncProduct(shopifyProduct: ShopifyProduct): Promise<void> {
    this.logger.info(`Syncing product: ${shopifyProduct.title}`, {
      shopifyId: shopifyProduct.id,
      variantCount: shopifyProduct.variants?.length || 0,
      vendor: shopifyProduct.vendor
    })

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
      this.logger.error(`Failed to sync product ${shopifyProduct.id}, skipping variants`, {
        productTitle: shopifyProduct.title
      })
      return
    }

    // Get existing variants using Shopify product ID
    const existingVariants = await this.getExistingVariants(shopifyProduct.id)
    const existingVariantMap = new Map()
    existingVariants.forEach(variant => {
      existingVariantMap.set(variant.variant_id, variant)
    })

    // Sync variants
    for (const shopifyVariant of shopifyProduct.variants || []) {
      const existingVariant = existingVariantMap.get(shopifyVariant.id)
      
      if (existingVariant) {
        // Update existing variant
        await this.updateVariant(existingVariant, shopifyVariant)
      } else {
        // Create new variant
        await this.createVariant(shopifyVariant, shopifyProduct)
      }
    }

    this.logger.success(`Completed syncing product: ${shopifyProduct.title}`, {
      shopifyId: shopifyProduct.id,
      variantCount: shopifyProduct.variants?.length || 0
    })
  }

  /**
   * Main sync function with improved error handling
   */
  async sync(): Promise<void> {
    const startTime = new Date()
    this.logger.info(`Starting MM sync at ${startTime.toISOString()}`)

    try {
      // Test database connection first
      const dbTestPassed = await this.testDatabaseConnection()
      if (!dbTestPassed) {
        throw new Error('Database connection test failed')
      }

      // Skip execution tracking due to schema constraints
      await this.createExecution()

      // Fetch all products from MM
      const products = await this.fetchAllProducts()

      // Sync each product with batch processing
      this.logger.info(`Starting sync of ${products.length} products...`)
      
      // Process in smaller batches to avoid overwhelming the database
      const batchSize = 50
      for (let i = 0; i < products.length; i += batchSize) {
        const batch = products.slice(i, i + batchSize)
        const batchNumber = Math.floor(i / batchSize) + 1
        const totalBatches = Math.ceil(products.length / batchSize)
        
        this.logger.info(`Processing batch ${batchNumber}/${totalBatches}`, {
          batchSize: batch.length,
          startIndex: i,
          endIndex: Math.min(i + batchSize - 1, products.length - 1)
        })
        
        for (let j = 0; j < batch.length; j++) {
          const product = batch[j]
          const overallIndex = i + j
          
          this.logger.info(`[${overallIndex + 1}/${products.length}] Processing: ${product.title}`, {
            shopifyId: product.id,
            progress: `${Math.round(((overallIndex + 1) / products.length) * 100)}%`
          })
          
          try {
            await this.syncProduct(product)
          } catch (error) {
            this.logger.error(`Error syncing product ${product.id}`, { 
              error: (error as Error).message,
              productTitle: product.title 
            })
            this.stats.errors++
          }
        }

        // Progress update after each batch
        this.logger.info(`Batch ${batchNumber} completed`, {
          overallProgress: `${Math.min(i + batchSize, products.length)}/${products.length}`,
          productsCreated: this.stats.productsCreated,
          productsUpdated: this.stats.productsUpdated,
          variantsCreated: this.stats.variantsCreated,
          variantsUpdated: this.stats.variantsUpdated,
          errors: this.stats.errors
        })

        // Small delay between batches to avoid overwhelming the database
        if (i + batchSize < products.length) {
          await new Promise(resolve => setTimeout(resolve, 1000))
        }
      }

      // Complete execution
      await this.completeExecution()

      const endTime = new Date()
      const duration = endTime.getTime() - startTime.getTime()

      this.logger.success('MM sync completed successfully!', {
        duration: `${Math.round(duration / 1000)}s`,
        productsCreated: this.stats.productsCreated,
        productsUpdated: this.stats.productsUpdated,
        variantsCreated: this.stats.variantsCreated,
        variantsUpdated: this.stats.variantsUpdated,
        totalErrors: this.stats.errors,
        totalProcessed: products.length
      })

    } catch (error) {
      this.logger.error('Fatal error during MM sync', { error: (error as Error).message })
      await this.completeExecution()
      throw error
    } finally {
      this.logger.close()
    }
  }
}

// Export for use as module
export default MMSyncService

// Run the sync if this file is executed directly
if (require.main === module) {
  const syncService = new MMSyncService()
  syncService.sync().catch(error => {
    console.error('🔥 MM sync failed:', error)
    process.exit(1)
  })
}