import { createServiceClient } from '@/lib/supabase/script-client'
import { config } from 'dotenv'

// Load environment variables
config({ path: '.env.local' })

const supabase = createServiceClient()

interface MetricsQuery {
  period?: string
  limit?: number
  sortBy?: string
  minScore?: number
}

class MetricsViewer {
  
  /**
   * View top performing products by recommendation score
   */
  async viewTopProducts(options: MetricsQuery = {}): Promise<void> {
    const { 
      period = 'all_time', 
      limit = 20, 
      sortBy = 'recommendation_score',
      minScore = 0 
    } = options

    console.log(`🏆 Top ${limit} Products (${period}, min score: ${minScore})`)
    console.log('=' .repeat(80))

    try {
      const { data: metrics, error } = await supabase
        .from('product_metrics')
        .select(`
          *,
          products!inner(
            title,
            vendor,
            product_type
          )
        `)
        .eq('period_type', period)
        .gte(sortBy, minScore)
        .order(sortBy, { ascending: false })
        .limit(limit)

      if (error) {
        throw error
      }

      if (!metrics || metrics.length === 0) {
        console.log('📭 No metrics found for the specified criteria')
        return
      }

      // Display results in a table format
      console.log('Rank | Product Title                    | Vendor      | Score | Sales | Revenue')
      console.log('-'.repeat(80))

      metrics.forEach((metric, index) => {
        const rank = (index + 1).toString().padStart(4)
        const title = metric.products.title.substring(0, 30).padEnd(30)
        const vendor = metric.products.vendor.substring(0, 10).padEnd(10)
        const score = metric.recommendation_score.toFixed(2).padStart(6)
        const sales = metric.total_quantity_sold.toString().padStart(5)
        const revenue = `$${metric.total_revenue.toFixed(0)}`.padStart(8)
        
        console.log(`${rank} | ${title} | ${vendor} | ${score} | ${sales} | ${revenue}`)
      })

      console.log('-'.repeat(80))
      console.log(`📊 Showing ${metrics.length} products`)

    } catch (error) {
      console.error('❌ Error viewing top products:', (error as Error).message)
    }
  }

  /**
   * View trending products (high trending score)
   */
  async viewTrendingProducts(limit: number = 15): Promise<void> {
    console.log(`📈 Top ${limit} Trending Products`)
    console.log('=' .repeat(80))

    try {
      const { data: metrics, error } = await supabase
        .from('product_metrics')
        .select(`
          *,
          products!inner(
            title,
            vendor,
            product_type
          )
        `)
        .eq('period_type', 'monthly')
        .gt('trending_score', 0)
        .order('trending_score', { ascending: false })
        .limit(limit)

      if (error) {
        throw error
      }

      if (!metrics || metrics.length === 0) {
        console.log('📭 No trending products found')
        return
      }

      console.log('Rank | Product Title                    | Trending | Popular | Recent Sales')
      console.log('-'.repeat(75))

      metrics.forEach((metric, index) => {
        const rank = (index + 1).toString().padStart(4)
        const title = metric.products.title.substring(0, 30).padEnd(30)
        const trending = metric.trending_score.toFixed(1).padStart(8)
        const popular = metric.popularity_score.toFixed(1).padStart(7)
        const sales = metric.total_quantity_sold.toString().padStart(12)
        
        console.log(`${rank} | ${title} | ${trending} | ${popular} | ${sales}`)
      })

    } catch (error) {
      console.error('❌ Error viewing trending products:', (error as Error).message)
    }
  }

  /**
   * View metrics summary
   */
  async viewSummary(): Promise<void> {
    console.log('📊 Metrics Summary')
    console.log('=' .repeat(50))

    try {
      // Get total counts
      const { data: orderCount } = await supabase
        .from('orders')
        .select('id', { count: 'exact', head: true })

      const { data: lineItemCount } = await supabase
        .from('order_line_items')
        .select('id', { count: 'exact', head: true })

      const { data: metricsCount } = await supabase
        .from('product_metrics')
        .select('id', { count: 'exact', head: true })

      // Get revenue totals
      const { data: revenueData } = await supabase
        .from('orders')
        .select('total_price')

      const totalRevenue = revenueData?.reduce((sum, order) => sum + (order.total_price || 0), 0) || 0

      // Get top metrics
      const { data: topProduct } = await supabase
        .from('product_metrics')
        .select(`
          recommendation_score,
          total_revenue,
          products!inner(title)
        `)
        .eq('period_type', 'all_time')
        .order('recommendation_score', { ascending: false })
        .limit(1)
        .single()

      console.log(`📦 Total Orders: ${orderCount?.length || 0}`)
      console.log(`📋 Total Line Items: ${lineItemCount?.length || 0}`)
      console.log(`📊 Total Metrics Records: ${metricsCount?.length || 0}`)
      console.log(`💰 Total Revenue: $${totalRevenue.toFixed(2)}`)
      
      if (topProduct) {
        console.log(`🏆 Top Product: ${topProduct.products.title}`)
        console.log(`   Score: ${topProduct.recommendation_score}`)
        console.log(`   Revenue: $${topProduct.total_revenue}`)
      }

      // Get period breakdown
      const { data: periodBreakdown } = await supabase
        .from('product_metrics')
        .select('period_type')

      const periods = periodBreakdown?.reduce((acc, metric) => {
        acc[metric.period_type] = (acc[metric.period_type] || 0) + 1
        return acc
      }, {} as Record<string, number>) || {}

      console.log('\n📅 Metrics by Period:')
      Object.entries(periods).forEach(([period, count]) => {
        console.log(`   ${period}: ${count} records`)
      })

    } catch (error) {
      console.error('❌ Error viewing summary:', (error as Error).message)
    }
  }

  /**
   * View customer metrics
   */
  async viewCustomerMetrics(limit: number = 10): Promise<void> {
    console.log(`👥 Top ${limit} Customers by Loyalty Score`)
    console.log('=' .repeat(70))

    try {
      const { data: customers, error } = await supabase
        .from('customer_metrics')
        .select('*')
        .eq('period_type', 'all_time')
        .order('loyalty_score', { ascending: false })
        .limit(limit)

      if (error) {
        throw error
      }

      if (!customers || customers.length === 0) {
        console.log('📭 No customer metrics found')
        return
      }

      console.log('Rank | Customer Email               | Loyalty | Orders | Total Spent')
      console.log('-'.repeat(70))

      customers.forEach((customer, index) => {
        const rank = (index + 1).toString().padStart(4)
        const email = (customer.customer_email || 'N/A').substring(0, 25).padEnd(25)
        const loyalty = customer.loyalty_score.toFixed(1).padStart(7)
        const orders = customer.total_orders.toString().padStart(6)
        const spent = `$${customer.total_spent.toFixed(0)}`.padStart(11)
        
        console.log(`${rank} | ${email} | ${loyalty} | ${orders} | ${spent}`)
      })

    } catch (error) {
      console.error('❌ Error viewing customer metrics:', (error as Error).message)
    }
  }

  /**
   * Search products by criteria
   */
  async searchProducts(searchTerm: string, limit: number = 10): Promise<void> {
    console.log(`🔍 Search Results for: "${searchTerm}"`)
    console.log('=' .repeat(80))

    try {
      const { data: metrics, error } = await supabase
        .from('product_metrics')
        .select(`
          *,
          products!inner(
            title,
            vendor,
            product_type
          )
        `)
        .eq('period_type', 'all_time')
        .ilike('products.title', `%${searchTerm}%`)
        .order('recommendation_score', { ascending: false })
        .limit(limit)

      if (error) {
        throw error
      }

      if (!metrics || metrics.length === 0) {
        console.log(`📭 No products found matching "${searchTerm}"`)
        return
      }

      console.log('Product Title                    | Vendor      | Score | Sales | Revenue')
      console.log('-'.repeat(75))

      metrics.forEach((metric) => {
        const title = metric.products.title.substring(0, 30).padEnd(30)
        const vendor = metric.products.vendor.substring(0, 10).padEnd(10)
        const score = metric.recommendation_score.toFixed(2).padStart(6)
        const sales = metric.total_quantity_sold.toString().padStart(5)
        const revenue = `$${metric.total_revenue.toFixed(0)}`.padStart(8)
        
        console.log(`${title} | ${vendor} | ${score} | ${sales} | ${revenue}`)
      })

    } catch (error) {
      console.error('❌ Error searching products:', (error as Error).message)
    }
  }
}

// CLI interface
async function main(): Promise<void> {
  const viewer = new MetricsViewer()
  const command = process.argv[2]
  const arg1 = process.argv[3]
  const arg2 = process.argv[4]

  switch (command) {
    case 'top':
      const limit = arg1 ? parseInt(arg1) : 20
      const period = arg2 || 'all_time'
      await viewer.viewTopProducts({ limit, period })
      break

    case 'trending':
      const trendingLimit = arg1 ? parseInt(arg1) : 15
      await viewer.viewTrendingProducts(trendingLimit)
      break

    case 'summary':
      await viewer.viewSummary()
      break

    case 'customers':
      const customerLimit = arg1 ? parseInt(arg1) : 10
      await viewer.viewCustomerMetrics(customerLimit)
      break

    case 'search':
      if (!arg1) {
        console.log('❌ Please provide a search term')
        process.exit(1)
      }
      const searchLimit = arg2 ? parseInt(arg2) : 10
      await viewer.searchProducts(arg1, searchLimit)
      break

    default:
      console.log('📊 Order Metrics Viewer')
      console.log('Usage:')
      console.log('  npm run view-metrics summary              - View overall summary')
      console.log('  npm run view-metrics top [limit] [period] - View top products')
      console.log('  npm run view-metrics trending [limit]     - View trending products')
      console.log('  npm run view-metrics customers [limit]    - View top customers')
      console.log('  npm run view-metrics search <term> [limit] - Search products')
      console.log('')
      console.log('Examples:')
      console.log('  npm run view-metrics top 10 monthly')
      console.log('  npm run view-metrics search "iPhone"')
      console.log('  npm run view-metrics trending 20')
      break
  }
}

// Run if executed directly
if (require.main === module) {
  main().catch(error => {
    console.error('🔥 Metrics viewer failed:', error)
    process.exit(1)
  })
}

export default MetricsViewer