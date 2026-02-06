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

interface ShopifyOrder {
  id: number
  order_number: number
  name: string
  email: string
  phone: string | null
  created_at: string
  updated_at: string
  cancelled_at: string | null
  closed_at: string | null
  processed_at: string | null
  currency: string
  total_price: string
  subtotal_price: string
  total_tax: string
  total_discounts: string
  total_line_items_price: string
  total_weight: number
  financial_status: string
  fulfillment_status: string | null
  order_status_url: string
  customer: {
    id: number
    email: string
    phone: string | null
    first_name: string
    last_name: string
    orders_count: number
    total_spent: string
  } | null
  shipping_address: any
  billing_address: any
  line_items: ShopifyLineItem[]
}

interface ShopifyLineItem {
  id: number
  product_id: number | null
  variant_id: number | null
  title: string
  variant_title: string | null
  sku: string
  vendor: string
  quantity: number
  price: string
  total_discount: string
  product_type: string | null
  fulfillment_status: string | null
  fulfillable_quantity: number
}

interface SyncStats {
  ordersProcessed: number
  lineItemsProcessed: number
  metricsCalculated: number
  errors: number
}

class OrderMetricsSyncService {
  private stats: SyncStats

  constructor() {
    this.stats = {
      ordersProcessed: 0,
      lineItemsProcessed: 0,
      metricsCalculated: 0,
      errors: 0,
    }
  }

  /**
   * Fetch and process orders page by page
   */
  async fetchAndProcessOrders(limit: number = 250, status: string = 'any', maxPages: number = 15): Promise<void> {
    console.log(`📦 Fetching and processing orders from MM Shopify (status: ${status}, max ${maxPages} pages)...`)
    
    let nextUrl: string | null = `${MM_SHOPIFY_URL}/admin/api/${MM_API_VERSION}/orders.json?limit=${limit}&status=${status}`
    let pageCount = 0
    let totalProcessed = 0

    const headers = {
      'X-Shopify-Access-Token': MM_ACCESS_TOKEN!,
      'Content-Type': 'application/json',
    }

    while (nextUrl && pageCount < maxPages) {
      try {
        pageCount++
        console.log(`📄 Processing page ${pageCount}/${maxPages}...`)
        
        const response = await fetch(nextUrl, { headers })
        
        if (!response.ok) {
          throw new Error(`HTTP ${response.status}: ${response.statusText}`)
        }

        const data = await response.json()
        const orders = data.orders || []
        
        console.log(`📥 Retrieved ${orders.length} orders from page ${pageCount}`)

        if (orders.length > 0) {
          // Process this page immediately
          await this.syncOrdersPage(orders, pageCount)
          totalProcessed += orders.length
          console.log(`✅ Page ${pageCount} processed - ${orders.length} orders (Total: ${totalProcessed})`)
        }

        // Check for next page
        const linkHeader = response.headers.get('link')
        nextUrl = this.parseNextUrl(linkHeader)
        
        // Rate limiting - wait between pages
        if (nextUrl && pageCount < maxPages) {
          console.log(`⏳ Waiting 200ms before next page...`)
          await new Promise(resolve => setTimeout(resolve, 200))
        }

      } catch (error) {
        console.error(`❌ Error processing page ${pageCount}:`, (error as Error).message)
        this.stats.errors++
        
        // Continue with next page on error
        const linkHeader = response?.headers?.get('link')
        nextUrl = this.parseNextUrl(linkHeader)
        
        if (nextUrl && pageCount < maxPages) {
          await new Promise(resolve => setTimeout(resolve, 500)) // Longer wait on error
        }
      }
    }

    console.log(`🎉 Completed processing ${pageCount} pages with ${totalProcessed} total orders`)
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
   * Prepare order data for database
   */
  private prepareOrderData(shopifyOrder: ShopifyOrder) {
    return {
      order_id: shopifyOrder.id,
      order_number: shopifyOrder.order_number?.toString(),
      name: shopifyOrder.name,
      email: shopifyOrder.email,
      phone: shopifyOrder.phone,
      created_at_shopify: shopifyOrder.created_at,
      updated_at_shopify: shopifyOrder.updated_at,
      cancelled_at: shopifyOrder.cancelled_at,
      closed_at: shopifyOrder.closed_at,
      processed_at: shopifyOrder.processed_at,
      currency: shopifyOrder.currency,
      total_price: parseFloat(shopifyOrder.total_price),
      subtotal_price: parseFloat(shopifyOrder.subtotal_price),
      total_tax: parseFloat(shopifyOrder.total_tax),
      total_discounts: parseFloat(shopifyOrder.total_discounts),
      total_line_items_price: parseFloat(shopifyOrder.total_line_items_price),
      total_weight: shopifyOrder.total_weight,
      financial_status: shopifyOrder.financial_status,
      fulfillment_status: shopifyOrder.fulfillment_status,
      order_status_url: shopifyOrder.order_status_url,
      customer_id: shopifyOrder.customer?.id,
      customer_email: shopifyOrder.customer?.email,
      customer_phone: shopifyOrder.customer?.phone,
      customer_first_name: shopifyOrder.customer?.first_name,
      customer_last_name: shopifyOrder.customer?.last_name,
      customer_orders_count: shopifyOrder.customer?.orders_count,
      customer_total_spent: shopifyOrder.customer ? parseFloat(shopifyOrder.customer.total_spent) : null,
      shipping_address: shopifyOrder.shipping_address,
      billing_address: shopifyOrder.billing_address,
      raw_response: shopifyOrder
    }
  }

  /**
   * Prepare line item data for database
   */
  private async prepareLineItemData(lineItem: ShopifyLineItem, orderUuid: string) {
    // Try to find matching product and variant in our database
    let productUuid = null
    let variantUuid = null

    if (lineItem.product_id) {
      try {
        const { data: product } = await supabase
          .from('products')
          .select('id')
          .eq('product_id', lineItem.product_id)
          .single()
        
        productUuid = product?.id
      } catch (error) {
        // Product not found in our database - this is normal for orders with products not in our catalog
        console.log(`⚠️ Product ${lineItem.product_id} not found in products table`)
      }
    }

    if (lineItem.variant_id) {
      try {
        const { data: variant } = await supabase
          .from('variants')
          .select('id')
          .eq('variant_id', lineItem.variant_id)
          .single()
        
        variantUuid = variant?.id
      } catch (error) {
        // Variant not found - this is normal
        console.log(`⚠️ Variant ${lineItem.variant_id} not found in variants table`)
      }
    }

    // Extract product attributes from title and SKU
    const titleText = lineItem.title || ''
    const skuText = lineItem.sku || ''
    const combinedText = `${titleText} ${skuText}`

    return {
      order_id: orderUuid,
      product_id: productUuid,
      variant_id: variantUuid,
      line_item_id: lineItem.id,
      shopify_product_id: lineItem.product_id,
      shopify_variant_id: lineItem.variant_id,
      title: lineItem.title,
      variant_title: lineItem.variant_title,
      sku: lineItem.sku,
      vendor: lineItem.vendor,
      quantity: lineItem.quantity,
      price: parseFloat(lineItem.price || '0'),
      total_discount: parseFloat(lineItem.total_discount || '0'),
      product_type: lineItem.product_type,
      storage: this.extractStorageFromText(combinedText),
      condition: this.extractConditionFromText(combinedText),
      color: this.extractColourFromText(combinedText),
      fulfillment_status: lineItem.fulfillment_status,
      fulfillable_quantity: lineItem.fulfillable_quantity
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
   * Sync a single page of orders to database
   */
  async syncOrdersPage(orders: ShopifyOrder[], pageNumber: number): Promise<void> {
    console.log(`⚡ Syncing page ${pageNumber} with ${orders.length} orders to database...`)

    const pageStats = {
      ordersProcessed: 0,
      lineItemsProcessed: 0,
      errors: 0
    }

    for (const order of orders) {
      try {
        // Prepare order data
        const orderData = this.prepareOrderData(order)

        // Upsert order
        const { data: upsertedOrder, error: orderError } = await supabase
          .from('orders')
          .upsert([orderData], { 
            onConflict: 'order_id',
            ignoreDuplicates: false 
          })
          .select('id')
          .single()

        if (orderError) {
          console.error(`❌ Error upserting order ${order.id}:`, orderError.message)
          pageStats.errors++
          this.stats.errors++
          continue
        }

        const orderUuid = upsertedOrder.id
        pageStats.ordersProcessed++
        this.stats.ordersProcessed++

        // Process line items
        if (order.line_items && order.line_items.length > 0) {
          const lineItemsData = []
          
          for (const lineItem of order.line_items) {
            const lineItemData = await this.prepareLineItemData(lineItem, orderUuid)
            lineItemsData.push(lineItemData)
          }

          // Process line items - check for existing ones first
          for (const lineItemData of lineItemsData) {
            try {
              // Check if line item already exists
              const { data: existingLineItem } = await supabase
                .from('order_line_items')
                .select('id')
                .eq('line_item_id', lineItemData.line_item_id)
                .single()

              if (existingLineItem) {
                // Update existing line item
                const { error: updateError } = await supabase
                  .from('order_line_items')
                  .update(lineItemData)
                  .eq('id', existingLineItem.id)

                if (updateError) {
                  console.error(`❌ Error updating line item ${lineItemData.line_item_id}:`, updateError.message)
                  pageStats.errors++
                  this.stats.errors++
                } else {
                  pageStats.lineItemsProcessed++
                  this.stats.lineItemsProcessed++
                }
              } else {
                // Insert new line item
                const { error: insertError } = await supabase
                  .from('order_line_items')
                  .insert([lineItemData])

                if (insertError) {
                  console.error(`❌ Error inserting line item ${lineItemData.line_item_id}:`, insertError.message)
                  pageStats.errors++
                  this.stats.errors++
                } else {
                  pageStats.lineItemsProcessed++
                  this.stats.lineItemsProcessed++
                }
              }
            } catch (error) {
              console.error(`❌ Error processing line item ${lineItemData.line_item_id}:`, (error as Error).message)
              pageStats.errors++
              this.stats.errors++
            }
          }
        }

      } catch (error) {
        console.error(`❌ Error processing order ${order.id}:`, (error as Error).message)
        pageStats.errors++
        this.stats.errors++
      }
    }

    console.log(`✅ Page ${pageNumber} completed: ${pageStats.ordersProcessed} orders, ${pageStats.lineItemsProcessed} line items, ${pageStats.errors} errors`)
  }

  /**
   * Calculate product metrics
   */
  async calculateProductMetrics(periodType: string = 'all_time'): Promise<void> {
    console.log(`📊 Calculating product metrics for period: ${periodType}...`)

    try {
      // Get date range based on period type
      const { periodStart, periodEnd } = this.getPeriodRange(periodType)

      // Calculate metrics for each product
      const { data: products, error: productsError } = await supabase
        .from('products')
        .select('id, product_id, title, vendor, product_type')

      if (productsError) {
        throw productsError
      }

      for (const product of products || []) {
        await this.calculateProductMetricsForProduct(product.id, periodType, periodStart, periodEnd)
        this.stats.metricsCalculated++
      }

      console.log(`✅ Calculated metrics for ${products?.length || 0} products`)

    } catch (error) {
      console.error('❌ Error calculating product metrics:', (error as Error).message)
      this.stats.errors++
    }
  }

  private getPeriodRange(periodType: string): { periodStart: Date | null, periodEnd: Date | null } {
    const now = new Date()
    let periodStart: Date | null = null
    let periodEnd: Date | null = now

    switch (periodType) {
      case 'daily':
        periodStart = new Date(now.getFullYear(), now.getMonth(), now.getDate())
        break
      case 'weekly':
        const weekStart = new Date(now)
        weekStart.setDate(now.getDate() - now.getDay())
        periodStart = weekStart
        break
      case 'monthly':
        periodStart = new Date(now.getFullYear(), now.getMonth(), 1)
        break
      case 'all_time':
        periodStart = null
        periodEnd = null
        break
    }

    return { periodStart, periodEnd }
  }

  private async calculateProductMetricsForProduct(
    productId: string, 
    periodType: string, 
    periodStart: Date | null, 
    periodEnd: Date | null
  ): Promise<void> {
    try {
      // Build query for order line items
      let query = supabase
        .from('order_line_items')
        .select(`
          quantity,
          price,
          total_discount,
          orders!inner(
            total_price,
            customer_id,
            created_at_shopify,
            financial_status
          )
        `)
        .eq('product_id', productId)

      // Add date filters if specified
      if (periodStart && periodEnd) {
        query = query
          .gte('orders.created_at_shopify', periodStart.toISOString())
          .lte('orders.created_at_shopify', periodEnd.toISOString())
      }

      const { data: lineItems, error } = await query

      if (error) {
        throw error
      }

      // Calculate metrics
      const totalOrders = new Set(lineItems?.map(item => item.orders.customer_id)).size || 0
      const totalQuantitySold = lineItems?.reduce((sum, item) => sum + item.quantity, 0) || 0
      const totalRevenue = lineItems?.reduce((sum, item) => sum + (item.price * item.quantity), 0) || 0
      const averageOrderValue = totalOrders > 0 ? totalRevenue / totalOrders : 0

      // Get current stock from variants
      const { data: variants } = await supabase
        .from('variants')
        .select('inventory_quantity')
        .eq('product_id', productId)

      const currentStock = variants?.reduce((sum, variant) => sum + (variant.inventory_quantity || 0), 0) || 0

      // Calculate popularity and recommendation scores
      const popularityScore = this.calculatePopularityScore(totalQuantitySold, totalOrders)
      const trendingScore = this.calculateTrendingScore(lineItems || [])
      const recommendationScore = this.calculateRecommendationScore(popularityScore, trendingScore, averageOrderValue)

      // Prepare metrics data
      const metricsData = {
        product_id: productId,
        variant_id: null, // Product-level metrics
        period_type: periodType,
        period_start: periodStart?.toISOString(),
        period_end: periodEnd?.toISOString(),
        total_orders: totalOrders,
        total_quantity_sold: totalQuantitySold,
        total_revenue: totalRevenue,
        average_order_value: averageOrderValue,
        current_stock: currentStock,
        popularity_score: popularityScore,
        trending_score: trendingScore,
        recommendation_score: recommendationScore,
        updated_at: new Date().toISOString()
      }

      // Upsert metrics
      const { error: metricsError } = await supabase
        .from('product_metrics')
        .upsert([metricsData], {
          onConflict: 'product_id,variant_id,period_type,period_start',
          ignoreDuplicates: false
        })

      if (metricsError) {
        throw metricsError
      }

    } catch (error) {
      console.error(`❌ Error calculating metrics for product ${productId}:`, (error as Error).message)
      this.stats.errors++
    }
  }

  private calculatePopularityScore(totalQuantitySold: number, totalOrders: number): number {
    // Simple popularity score based on quantity sold and order count
    return Math.min(100, (totalQuantitySold * 0.1) + (totalOrders * 0.5))
  }

  private calculateTrendingScore(lineItems: any[]): number {
    // Calculate trending based on recent sales velocity
    const now = new Date()
    const thirtyDaysAgo = new Date(now.getTime() - (30 * 24 * 60 * 60 * 1000))
    
    const recentSales = lineItems.filter(item => 
      new Date(item.orders.created_at_shopify) >= thirtyDaysAgo
    )
    
    const recentQuantity = recentSales.reduce((sum, item) => sum + item.quantity, 0)
    return Math.min(100, recentQuantity * 2)
  }

  private calculateRecommendationScore(popularityScore: number, trendingScore: number, averageOrderValue: number): number {
    // Weighted combination of different factors
    const weightedScore = (popularityScore * 0.4) + (trendingScore * 0.3) + (Math.min(averageOrderValue / 10, 30) * 0.3)
    return Math.round(weightedScore * 100) / 100
  }

  /**
   * Main sync function
   */
  async sync(maxPages: number = 15): Promise<void> {
    const startTime = new Date()
    console.log(`🚀 Starting Order Metrics sync at ${startTime.toISOString()}`)
    console.log(`📄 Processing maximum ${maxPages} pages for testing`)

    try {
      // Fetch and process orders page by page
      await this.fetchAndProcessOrders(250, 'any', maxPages)

      // Calculate metrics only if we have processed some orders
      if (this.stats.ordersProcessed > 0) {
        console.log(`📊 Calculating metrics for ${this.stats.ordersProcessed} processed orders...`)
        await this.calculateProductMetrics('all_time')
        await this.calculateProductMetrics('monthly')
        await this.calculateProductMetrics('weekly')
      } else {
        console.log(`⚠️ No orders processed, skipping metrics calculation`)
      }

      const endTime = new Date()
      const duration = endTime.getTime() - startTime.getTime()

      console.log('🎉 Order Metrics sync completed!')
      console.log(`📊 Final Stats:`)
      console.log(`  - Orders processed: ${this.stats.ordersProcessed}`)
      console.log(`  - Line items processed: ${this.stats.lineItemsProcessed}`)
      console.log(`  - Metrics calculated: ${this.stats.metricsCalculated}`)
      console.log(`  - Errors: ${this.stats.errors}`)
      console.log(`  - Duration: ${Math.round(duration / 1000)}s`)
      console.log(`  - Performance: ${Math.round(this.stats.ordersProcessed / (duration / 1000))} orders/sec`)

    } catch (error) {
      console.error('💥 Fatal error:', (error as Error).message)
      throw error
    }
  }
}

// Export for use as module
export default OrderMetricsSyncService

// Run if executed directly
if (require.main === module) {
  const syncService = new OrderMetricsSyncService()
  
  // Get max pages from command line args (default 5 for testing)
  const maxPages = process.argv[2] ? parseInt(process.argv[2]) : 5
  
  console.log(`🚀 Starting sync with maximum ${maxPages} pages`)
  
  syncService.sync(maxPages).catch(error => {
    console.error('🔥 Order Metrics sync failed:', error)
    process.exit(1)
  })
}