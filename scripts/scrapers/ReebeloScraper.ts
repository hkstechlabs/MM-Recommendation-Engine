import axios from 'axios'
import { SupabaseClient } from '@supabase/supabase-js'
import { BaseScraper, ScraperResult, ScrapedDataPoint } from './BaseScraper'

interface ReebeloOffer {
  price: number
  reebeloOffer: {
    attributes: {
      condition: string
      storage: string
      color: string
      isBest: boolean
      isCheapest: boolean
    }
    stock: number
    url: string
  }
}

interface ReebeloApiResponse {
  publishedOffers: ReebeloOffer[]
  hasNextPage: boolean
}

export class ReebeloScraper extends BaseScraper {
  private apiUrl = 'https://a.reebelo.com/sockets/offers'
  private apiKey: string
  private currency = 'AUD'
  private skus: string[] = []

  constructor(supabase: SupabaseClient) {
    super('reebelo', supabase)
    
    this.apiKey = process.env.REEBELO_API_KEY || 'aCkLJ6izdU67cduknwGtfkzjj'
    if (!this.apiKey) {
      throw new Error('REEBELO_API_KEY environment variable is required')
    }
  }

  /**
   * Load SKUs from variants table
   */
  private async loadSkus(): Promise<void> {
    try {
      const { data: variants, error } = await this.supabase
        .from('variants')
        .select('sku')
        .not('sku', 'is', null)
        .neq('sku', '')

      if (error) throw error

      this.skus = [...new Set(variants?.map(v => v.sku).filter(Boolean) || [])]
      console.log(`📦 ${this.name}: Loaded ${this.skus.length} unique SKUs`)
    } catch (error) {
      console.error(`❌ ${this.name}: Failed to load SKUs:`, error)
      throw error
    }
  }

  /**
   * Fetch all paginated offers for a single SKU
   */
  private async fetchOffersBySku(sku: string): Promise<ReebeloOffer[]> {
    let page = 1
    let hasNextPage = true
    const allOffers: ReebeloOffer[] = []

    while (hasNextPage) {
      try {
        const response = await axios.get<ReebeloApiResponse>(this.apiUrl, {
          headers: {
            'content-type': 'application/json',
            'x-api-key': this.apiKey,
          },
          params: {
            search: sku,
            page,
          },
          timeout: 15000
        })

        const data = response.data

        if (Array.isArray(data?.publishedOffers)) {
          allOffers.push(...data.publishedOffers)
        }

        hasNextPage = data?.hasNextPage === true
        page += 1

        // Rate limiting
        if (hasNextPage) {
          await new Promise(resolve => setTimeout(resolve, 100))
        }

      } catch (error: any) {
        console.error(`❌ ${this.name}: API error for SKU ${sku} (page ${page}):`)
        console.error(`   Status: ${error.response?.status || 'No response'}`)
        console.error(`   Message: ${error.message}`)
        
        if (error.response?.status === 429) {
          // Rate limited, wait longer and retry
          console.log(`⏳ ${this.name}: Rate limited, waiting 5 seconds...`)
          await new Promise(resolve => setTimeout(resolve, 5000))
          continue
        }
        
        throw error
      }
    }

    return allOffers
  }

  /**
   * Match offers to variants based on attributes
   */
  private async matchOffersToVariants(
    offers: ReebeloOffer[], 
    sku: string,
    mappings: { products: Map<number, string>, variants: Map<number, string> }
  ): Promise<ScrapedDataPoint[]> {
    const scrapedData: ScrapedDataPoint[] = []

    // Get variants for this SKU
    const { data: variants, error } = await this.supabase
      .from('variants')
      .select('id, variant_id, product_id, storage, condition, color')
      .eq('sku', sku)

    if (error) {
      console.error(`❌ ${this.name}: Failed to get variants for SKU ${sku}:`, error)
      return scrapedData
    }

    if (!variants || variants.length === 0) {
      console.warn(`⚠️ ${this.name}: No variants found for SKU ${sku}`)
      return scrapedData
    }

    for (const offer of offers) {
      const attrs = offer.reebeloOffer?.attributes || {}
      
      // Find matching variant based on attributes
      const matchingVariant = variants.find(variant => {
        const storageMatch = !attrs.storage || 
          variant.storage?.toLowerCase().includes(attrs.storage.toLowerCase()) ||
          attrs.storage.toLowerCase().includes(variant.storage?.toLowerCase() || '')
        
        const conditionMatch = !attrs.condition || 
          variant.condition?.toLowerCase().includes(attrs.condition.toLowerCase()) ||
          attrs.condition.toLowerCase().includes(variant.condition?.toLowerCase() || '')
        
        const colorMatch = !attrs.color || 
          variant.color?.toLowerCase().includes(attrs.color.toLowerCase()) ||
          attrs.color.toLowerCase().includes(variant.color?.toLowerCase() || '')

        return storageMatch && conditionMatch && colorMatch
      })

      scrapedData.push({
        price: offer.price.toString(),
        stock: offer.reebeloOffer?.stock || 0,
        raw_response: {
          offer,
          sku,
          matched_variant_id: matchingVariant?.variant_id || null,
          matching_criteria: {
            storage: attrs.storage,
            condition: attrs.condition,
            color: attrs.color
          }
        },
        variant_id: matchingVariant?.id || null,
        product_id: matchingVariant?.product_id || null
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
      // Load SKUs and mappings
      await this.loadSkus()
      const mappings = await this.getProductMappings()

      if (this.skus.length === 0) {
        console.warn(`⚠️ ${this.name}: No SKUs found to process`)
        return {
          competitor: this.name,
          execution_id: this.executionId!,
          data: [],
          errors: ['No SKUs found to process'],
          total_processed: 0,
          success_count: 0
        }
      }

      console.log(`🚀 ${this.name}: Starting to scrape ${this.skus.length} SKUs`)

      // Process SKUs in batches to avoid overwhelming the API
      const batchSize = 10
      for (let i = 0; i < this.skus.length; i += batchSize) {
        const batch = this.skus.slice(i, i + batchSize)
        
        console.log(`📦 ${this.name}: Processing batch ${Math.floor(i / batchSize) + 1}/${Math.ceil(this.skus.length / batchSize)}`)

        for (const sku of batch) {
          try {
            totalProcessed++
            console.log(`🔍 ${this.name}: Fetching offers for SKU: ${sku}`)
            
            const offers = await this.fetchOffersBySku(sku)
            console.log(`   Found ${offers.length} offers for SKU ${sku}`)

            if (offers.length > 0) {
              const scrapedData = await this.matchOffersToVariants(offers, sku, mappings)
              allScrapedData.push(...scrapedData)
              successCount++
            }

          } catch (error: any) {
            const errorMsg = `SKU ${sku}: ${error.message}`
            errors.push(errorMsg)
            console.error(`❌ ${this.name}: ${errorMsg}`)
          }
        }

        // Rate limiting between batches
        if (i + batchSize < this.skus.length) {
          await new Promise(resolve => setTimeout(resolve, 1000))
        }
      }

      // Bulk insert all scraped data
      if (allScrapedData.length > 0) {
        await this.bulkInsertScrapedData(allScrapedData)
      }

      const duration = Date.now() - startTime
      console.log(`🎉 ${this.name}: Completed in ${Math.round(duration / 1000)}s`)
      console.log(`📊 ${this.name}: ${successCount}/${totalProcessed} SKUs successful, ${allScrapedData.length} data points`)

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