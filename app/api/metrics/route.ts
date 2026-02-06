import { createServiceClient } from '@/lib/supabase/server'
import { NextRequest, NextResponse } from 'next/server'

export async function GET(request: NextRequest) {
  try {
    const supabase = createServiceClient()
    const { searchParams } = new URL(request.url)
    
    // Parse query parameters
    const type = searchParams.get('type') || 'products'
    const period = searchParams.get('period') || 'all_time'
    const limit = parseInt(searchParams.get('limit') || '20')
    const sortBy = searchParams.get('sortBy') || 'recommendation_score'
    const minScore = parseFloat(searchParams.get('minScore') || '0')
    const search = searchParams.get('search')
    const category = searchParams.get('category')
    const vendor = searchParams.get('vendor')

    switch (type) {
      case 'products':
        return await getProductMetrics(supabase, {
          period,
          limit,
          sortBy,
          minScore,
          search,
          category,
          vendor
        })

      case 'trending':
        return await getTrendingProducts(supabase, { limit })

      case 'recommendations':
        return await getRecommendations(supabase, {
          productId: searchParams.get('productId'),
          customerId: searchParams.get('customerId'),
          limit
        })

      case 'summary':
        return await getMetricsSummary(supabase)

      case 'customers':
        return await getCustomerMetrics(supabase, { limit })

      default:
        return NextResponse.json(
          { error: 'Invalid type parameter' },
          { status: 400 }
        )
    }

  } catch (error) {
    console.error('API Error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

async function getProductMetrics(supabase: any, options: {
  period: string
  limit: number
  sortBy: string
  minScore: number
  search?: string | null
  category?: string | null
  vendor?: string | null
}) {
  let query = supabase
    .from('product_metrics')
    .select(`
      *,
      products!inner(
        title,
        vendor,
        product_type,
        tags,
        status
      )
    `)
    .eq('period_type', options.period)
    .gte(options.sortBy, options.minScore)

  // Add filters
  if (options.search) {
    query = query.ilike('products.title', `%${options.search}%`)
  }

  if (options.category) {
    query = query.eq('products.product_type', options.category)
  }

  if (options.vendor) {
    query = query.eq('products.vendor', options.vendor)
  }

  // Add sorting
  const validSortFields = [
    'recommendation_score',
    'popularity_score', 
    'trending_score',
    'total_revenue',
    'total_quantity_sold',
    'total_orders'
  ]

  if (validSortFields.includes(options.sortBy)) {
    query = query.order(options.sortBy, { ascending: false })
  }

  query = query.limit(options.limit)

  const { data, error } = await query

  if (error) {
    throw error
  }

  return NextResponse.json({
    success: true,
    data: data || [],
    meta: {
      period: options.period,
      limit: options.limit,
      sortBy: options.sortBy,
      count: data?.length || 0
    }
  })
}

async function getTrendingProducts(supabase: any, options: { limit: number }) {
  const { data, error } = await supabase
    .from('product_metrics')
    .select(`
      *,
      products!inner(
        title,
        vendor,
        product_type,
        tags
      )
    `)
    .eq('period_type', 'monthly')
    .gt('trending_score', 0)
    .order('trending_score', { ascending: false })
    .limit(options.limit)

  if (error) {
    throw error
  }

  return NextResponse.json({
    success: true,
    data: data || [],
    meta: {
      type: 'trending',
      period: 'monthly',
      count: data?.length || 0
    }
  })
}

async function getRecommendations(supabase: any, options: {
  productId?: string | null
  customerId?: string | null
  limit: number
}) {
  // Basic recommendation logic - can be enhanced with ML models
  let query = supabase
    .from('product_metrics')
    .select(`
      *,
      products!inner(
        title,
        vendor,
        product_type,
        tags
      )
    `)
    .eq('period_type', 'all_time')
    .gt('recommendation_score', 10)
    .order('recommendation_score', { ascending: false })

  if (options.productId) {
    // Find similar products (same category/vendor)
    const { data: targetProduct } = await supabase
      .from('products')
      .select('product_type, vendor')
      .eq('id', options.productId)
      .single()

    if (targetProduct) {
      query = query.or(`products.product_type.eq.${targetProduct.product_type},products.vendor.eq.${targetProduct.vendor}`)
    }
  }

  if (options.customerId) {
    // Get customer preferences (simplified)
    const { data: customerOrders } = await supabase
      .from('order_line_items')
      .select(`
        product_type,
        vendor,
        orders!inner(customer_id)
      `)
      .eq('orders.customer_id', options.customerId)
      .limit(50)

    if (customerOrders && customerOrders.length > 0) {
      const preferredTypes = [...new Set(customerOrders.map(o => o.product_type).filter(Boolean))]
      const preferredVendors = [...new Set(customerOrders.map(o => o.vendor).filter(Boolean))]
      
      if (preferredTypes.length > 0 || preferredVendors.length > 0) {
        const conditions = []
        if (preferredTypes.length > 0) {
          conditions.push(`products.product_type.in.(${preferredTypes.join(',')})`)
        }
        if (preferredVendors.length > 0) {
          conditions.push(`products.vendor.in.(${preferredVendors.join(',')})`)
        }
        query = query.or(conditions.join(','))
      }
    }
  }

  query = query.limit(options.limit)

  const { data, error } = await query

  if (error) {
    throw error
  }

  return NextResponse.json({
    success: true,
    data: data || [],
    meta: {
      type: 'recommendations',
      productId: options.productId,
      customerId: options.customerId,
      count: data?.length || 0
    }
  })
}

async function getMetricsSummary(supabase: any) {
  try {
    // Get counts
    const [
      { count: orderCount },
      { count: lineItemCount },
      { count: metricsCount },
      { data: revenueData },
      { data: topProduct }
    ] = await Promise.all([
      supabase.from('orders').select('*', { count: 'exact', head: true }),
      supabase.from('order_line_items').select('*', { count: 'exact', head: true }),
      supabase.from('product_metrics').select('*', { count: 'exact', head: true }),
      supabase.from('orders').select('total_price'),
      supabase
        .from('product_metrics')
        .select(`
          recommendation_score,
          total_revenue,
          total_quantity_sold,
          products!inner(title, vendor)
        `)
        .eq('period_type', 'all_time')
        .order('recommendation_score', { ascending: false })
        .limit(1)
        .single()
    ])

    const totalRevenue = revenueData?.reduce((sum, order) => sum + (order.total_price || 0), 0) || 0

    // Get period breakdown
    const { data: periodData } = await supabase
      .from('product_metrics')
      .select('period_type')

    const periodBreakdown = periodData?.reduce((acc, metric) => {
      acc[metric.period_type] = (acc[metric.period_type] || 0) + 1
      return acc
    }, {} as Record<string, number>) || {}

    return NextResponse.json({
      success: true,
      data: {
        totals: {
          orders: orderCount || 0,
          lineItems: lineItemCount || 0,
          metricsRecords: metricsCount || 0,
          revenue: totalRevenue
        },
        topProduct: topProduct ? {
          title: topProduct.products.title,
          vendor: topProduct.products.vendor,
          score: topProduct.recommendation_score,
          revenue: topProduct.total_revenue,
          sales: topProduct.total_quantity_sold
        } : null,
        periodBreakdown
      }
    })

  } catch (error) {
    throw error
  }
}

async function getCustomerMetrics(supabase: any, options: { limit: number }) {
  const { data, error } = await supabase
    .from('customer_metrics')
    .select('*')
    .eq('period_type', 'all_time')
    .order('loyalty_score', { ascending: false })
    .limit(options.limit)

  if (error) {
    throw error
  }

  return NextResponse.json({
    success: true,
    data: data || [],
    meta: {
      type: 'customers',
      count: data?.length || 0
    }
  })
}