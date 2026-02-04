import axios from 'axios'
import { SupabaseClient } from '@supabase/supabase-js'
import { BaseScraper, ScraperResult, ScrapedDataPoint } from './BaseScraper'

interface GreenGadgetsVariant {
  id: number
  title: string
  price: string
  sku: string
  option1: string 
  option2: string 
  option3: string
  compare_at_price: string | null
  available: boolean
}

interface GreenGadgetsProduct {
  id: number
  title: string
  handle: string
  vendor: string
  product_type: string
  variants: GreenGadgetsVariant[]
}

export class GreenGadgetsScraper extends BaseScraper {
  private baseUrl = 'https://shop.greengadgets.net.au'
  private productHandles: string[] = []

  constructor(supabase: SupabaseClient) {
    super('green-gadgets', supabase)
  }

  /**
   * Load product handles from existing products
   */
  private async loadProductHandles(): Promise<void> {
    try {
      // For now, we'll use a predefined list of handles
      // In the future, this could be loaded from a configuration table
      this.productHandles = [
        'iphone-15-pro-max',
        'iphone-15-pro',
        'iphone-15-plus',
        'iphone-15',
        'iphone-14-pro-max',
        'iphone-14-pro',
        'iphone-14-plus',
        'iphone-14',
        'samsung-galaxy-s24-ultra',
        'samsung-galaxy-s24-plus',
        'samsung-galaxy-s24'
      ]

      console.log(`📦 ${this.name}: Loaded ${this.productHandles.length} product handles`)
    } catch (error) {
      console.error(`❌ ${this.name}: Failed to load product handles:`, error)
      throw error
    }
  }
  /**
   * Fetch product data from Green Gadgets API
   */
  private async fetchProduct(handle: string): Promise<GreenGadgetsProduct | null> {
    try {
      const url = `${this.baseUrl}/products/${handle}.json`
      console.log(`🔍 ${this.name}: Fetching product: ${handle}`)

      const response = await axios.get(url, {
        timeout: 15000,
        headers: {
          'User-Agent': 'Mozilla/5.0 (compatible; CompetitorScraper/1.0)',
          'Accept': 'application/json',
        },
      })

      const product = response.data?.product
      if (!product || !Array.isArray(product.variants)) {
        throw new Error('Invalid product JSON structure')
      }

      console.log(`   Found ${product.variants.length} variants for ${handle}`)
      return product

    } catch (error: any) {
      console.error(`❌ ${this.name}: Failed to fetch ${handle}:`, error.message)
      if (error.response?.status === 404) {
        console.log(`   Product ${handle} not found (404)`)
        return null
      }
      throw error
    }
  }

  /**
   * Match variants to existing products/variants in database
   */
  private async matchVariantsToDatabase(
    product: GreenGadgetsProduct,
    mappings: { products: Map<number, string>, variants: Map<number, string> }
  ): Promise<ScrapedDataPoint[]> {
    const scrapedData: ScrapedDataPoint[] = []

    // Try to find matching products by title similarity
    const { data: existingProducts, error } = await this.supabase
      .from('products')
      .select('id, title, product_id')
      .ilike('title', `%${product.title.split(' ').slice(0, 3).join(' ')}%`)

    if (error) {
      console.error(`❌ ${this.name}: Failed to query products:`, error)
      return scrapedData
    }

    for (const variant of product.variants) {
      if (!variant.available) continue

      // Try to match by SKU first
      let matchedVariant = null
      if (variant.sku) {
        const { data: skuMatch } = await this.supabase
          .from('variants')
          .select('id, product_id, variant_id')
          .eq('sku', variant.sku)
          .single()

        if (skuMatch) {
          matchedVariant = skuMatch
        }
      }

      // If no SKU match, try to match by attributes
      if (!matchedVariant && existingProducts && existingProducts.length > 0) {
        const { data: attributeMatches } = await this.supabase
          .from('variants')
          .select('id, product_id, variant_id, storage, condition, color')
          .in('product_id', existingProducts.map(p => p.id))

        if (attributeMatches) {
          matchedVariant = attributeMatches.find(v => {
            const storageMatch = !variant.option1 || 
              v.storage?.toLowerCase().includes(variant.option1.toLowerCase()) ||
              variant.option1.toLowerCase().includes(v.storage?.toLowerCase() || '')
            
            const colorMatch = !variant.option2 || 
              v.color?.toLowerCase().includes(variant.option2.toLowerCase()) ||
              variant.option2.toLowerCase().includes(v.color?.toLowerCase() || '')
            
            const conditionMatch = !variant.option3 || 
              v.condition?.toLowerCase().includes(variant.option3.toLowerCase()) ||
              variant.option3.toLowerCase().includes(v.condition?.toLowerCase() || '')

            return storageMatch && colorMatch && conditionMatch
          })
        }
      }

      scrapedData.push({
        price: variant.price,
        stock: variant.available ? 1 : 0,
        raw_response: {
          product_handle: product.handle,
          product_title: product.title,
          variant,
          matched_variant_id: matchedVariant?.variant_id || null,
          matching_criteria: {
            sku: variant.sku,
            storage: variant.option1,
            color: variant.option2,
            condition: variant.option3
          }
        },
        variant_id: matchedVariant?.id || null,
        product_id: matchedVariant?.product_id || null
      })
    }

    return scrapedData
  }

  /**
   * Main scraping logic
   */
  async scrape(): Promise<ScraperResult> {
    const startTime = Date.now()
    const errors: string[] = []
    let totalProcessed = 0
    let successCount = 0
    const allScrapedData: ScrapedDataPoint[] = []

    try {
      // Load product handles and mappings
      await this.loadProductHandles()
      const mappings = await this.getProductMappings()

      if (this.productHandles.length === 0) {
        console.warn(`⚠️ ${this.name}: No product handles found to process`)
        return {
          competitor: this.name,
          execution_id: this.executionId!,
          data: [],
          errors: ['No product handles found to process'],
          total_processed: 0,
          success_count: 0
        }
      }

      console.log(`🚀 ${this.name}: Starting to scrape ${this.productHandles.length} products`)

      // Process products with rate limiting
      for (const handle of this.productHandles) {
        try {
          totalProcessed++
          
          const product = await this.fetchProduct(handle)
          if (!product) continue

          const scrapedData = await this.matchVariantsToDatabase(product, mappings)
          allScrapedData.push(...scrapedData)
          successCount++

          // Rate limiting
          await new Promise(resolve => setTimeout(resolve, 500))

        } catch (error: any) {
          const errorMsg = `Product ${handle}: ${error.message}`
          errors.push(errorMsg)
          console.error(`❌ ${this.name}: ${errorMsg}`)
        }
      }

      // Bulk insert all scraped data
      if (allScrapedData.length > 0) {
        await this.bulkInsertScrapedData(allScrapedData)
      }

      const duration = Date.now() - startTime
      console.log(`🎉 ${this.name}: Completed in ${Math.round(duration / 1000)}s`)
      console.log(`📊 ${this.name}: ${successCount}/${totalProcessed} products successful, ${allScrapedData.length} data points`)

      return {
        competitor: this.name,
        execution_id: this.executionId!,
        data: allScrapedData,
        errors,
        total_processed: totalProcessed,
        success_count: successCount
      }

    } catch (error: any) {
      console.error(`💥 ${this.name}: Fatal error:`, error.message)
      throw error
    }
  }
}