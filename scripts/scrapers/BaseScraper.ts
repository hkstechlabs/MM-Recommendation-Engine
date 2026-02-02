import { SupabaseClient } from '@supabase/supabase-js'

export interface ScrapedDataPoint {
  price: string
  stock: number
  raw_response: any
  variant_id?: string
  product_id?: string
}

export interface ScraperResult {
  competitor: string
  execution_id: string
  data: ScrapedDataPoint[]
  errors: string[]
  total_processed: number
  success_count: number
}

export abstract class BaseScraper {
  protected name: string
  protected supabase: SupabaseClient
  protected competitorId: string | null = null
  protected executionId: string | null = null

  constructor(name: string, supabase: SupabaseClient) {
    this.name = name
    this.supabase = supabase
  }

  /**
   * Initialize competitor and execution records
   */
  async initialize(): Promise<void> {
    try {
      // Get or create competitor record
      const { data: competitor, error: competitorError } = await this.supabase
        .from('competitors')
        .select('id')
        .eq('title', this.name)
        .single()

      if (competitorError && competitorError.code !== 'PGRST116') {
        throw competitorError
      }

      if (!competitor) {
        const { data: newCompetitor, error: createError } = await this.supabase
          .from('competitors')
          .insert({
            title: this.name,
            failed_executions: 0,
            total_executions: 0
          })
          .select('id')
          .single()

        if (createError) throw createError
        this.competitorId = newCompetitor.id
      } else {
        this.competitorId = competitor.id
      }

      // Create execution record
      const { data: execution, error: executionError } = await this.supabase
        .from('executions')
        .insert({
          competitor_id: this.competitorId,
          start_time: new Date().toISOString(),
          status: 'running',
          trigger_source: 'script'
        })
        .select('id')
        .single()

      if (executionError) throw executionError
      this.executionId = execution.id

      console.log(`✅ ${this.name}: Initialized competitor ${this.competitorId}, execution ${this.executionId}`)
    } catch (error) {
      console.error(`❌ ${this.name}: Failed to initialize:`, error)
      throw error
    }
  }

  /**
   * Update execution status
   */
  async updateExecution(status: 'completed' | 'failed', errorMsg?: any): Promise<void> {
    if (!this.executionId) return

    try {
      const updateData: any = {
        status,
        end_time: new Date().toISOString()
      }

      if (errorMsg) {
        updateData.error_msg = typeof errorMsg === 'string' ? { message: errorMsg } : errorMsg
      }

      await this.supabase
        .from('executions')
        .update(updateData)
        .eq('id', this.executionId)

      // Update competitor stats
      if (this.competitorId) {
        // Get current stats
        const { data: competitor } = await this.supabase
          .from('competitors')
          .select('failed_executions, total_executions')
          .eq('id', this.competitorId)
          .single()

        if (competitor) {
          const updates: any = {
            total_executions: (competitor.total_executions || 0) + 1
          }

          if (status === 'failed') {
            updates.failed_executions = (competitor.failed_executions || 0) + 1
          }

          await this.supabase
            .from('competitors')
            .update(updates)
            .eq('id', this.competitorId)
        }
      }
    } catch (error) {
      console.error(`❌ ${this.name}: Failed to update execution:`, error)
    }
  }

  /**
   * Bulk insert scraped data
   */
  async bulkInsertScrapedData(data: ScrapedDataPoint[]): Promise<void> {
    if (!this.executionId || !this.competitorId || data.length === 0) return

    try {
      const insertData = data.map(item => ({
        price: item.price,
        stock: item.stock,
        raw_response: item.raw_response,
        variant_id: item.variant_id || null,
        product_id: item.product_id || null,
        execution_id: this.executionId,
        competitor_id: this.competitorId,
        created_at: new Date().toISOString()
      }))

      // Insert in batches of 1000 for optimal performance
      const batchSize = 1000
      for (let i = 0; i < insertData.length; i += batchSize) {
        const batch = insertData.slice(i, i + batchSize)
        
        const { error } = await this.supabase
          .from('scraped_data')
          .insert(batch)

        if (error) {
          console.error(`❌ ${this.name}: Batch insert failed:`, error)
          throw error
        }

        console.log(`✅ ${this.name}: Inserted batch ${Math.floor(i / batchSize) + 1} (${batch.length} records)`)
      }

      console.log(`🎉 ${this.name}: Successfully inserted ${data.length} scraped data points`)
    } catch (error) {
      console.error(`❌ ${this.name}: Failed to insert scraped data:`, error)
      throw error
    }
  }

  /**
   * Get product and variant mappings for the scraper
   */
  async getProductMappings(): Promise<{
    products: Map<number, string>, // product_id -> uuid
    variants: Map<number, string>  // variant_id -> uuid
  }> {
    try {
      const [productsResult, variantsResult] = await Promise.all([
        this.supabase.from('products').select('id, product_id'),
        this.supabase.from('variants').select('id, variant_id')
      ])

      if (productsResult.error) throw productsResult.error
      if (variantsResult.error) throw variantsResult.error

      const products = new Map<number, string>()
      const variants = new Map<number, string>()

      productsResult.data?.forEach(p => products.set(p.product_id, p.id))
      variantsResult.data?.forEach(v => variants.set(v.variant_id, v.id))

      console.log(`📊 ${this.name}: Loaded ${products.size} products, ${variants.size} variants`)
      return { products, variants }
    } catch (error) {
      console.error(`❌ ${this.name}: Failed to load mappings:`, error)
      throw error
    }
  }

  /**
   * Abstract method to be implemented by each scraper
   */
  abstract scrape(): Promise<ScraperResult>

  /**
   * Main run method with error handling
   */
  async run(): Promise<ScraperResult> {
    try {
      await this.initialize()
      const result = await this.scrape()
      await this.updateExecution('completed')
      return result
    } catch (error) {
      await this.updateExecution('failed', error)
      throw error
    }
  }
}