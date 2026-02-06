import { createServiceClient } from '@/lib/supabase/script-client'
import { config } from 'dotenv'

// Load environment variables
config({ path: '.env.local' })

const supabase = createServiceClient()

async function testOrderMetricsSystem(): Promise<void> {
  console.log('🧪 Testing Order Metrics System')
  console.log('=' .repeat(50))

  let allTestsPassed = true

  try {
    // Test 1: Check if tables exist
    console.log('📋 Test 1: Checking database tables...')
    
    const tables = ['orders', 'order_line_items', 'product_metrics', 'customer_metrics']
    
    for (const table of tables) {
      try {
        const { data, error } = await supabase
          .from(table)
          .select('*')
          .limit(1)

        if (error) {
          console.log(`❌ Table '${table}' - ${error.message}`)
          allTestsPassed = false
        } else {
          console.log(`✅ Table '${table}' exists and is accessible`)
        }
      } catch (error) {
        console.log(`❌ Table '${table}' - ${(error as Error).message}`)
        allTestsPassed = false
      }
    }

    // Test 2: Check environment variables
    console.log('\n🔑 Test 2: Checking environment variables...')
    
    const requiredEnvVars = ['MM_ACCESS_TOKEN', 'SUPABASE_URL', 'SUPABASE_SERVICE_ROLE_KEY']
    
    for (const envVar of requiredEnvVars) {
      if (process.env[envVar]) {
        console.log(`✅ ${envVar} is set`)
      } else {
        console.log(`❌ ${envVar} is missing`)
        allTestsPassed = false
      }
    }

    // Test 3: Check Shopify API connectivity
    console.log('\n🌐 Test 3: Testing Shopify API connectivity...')
    
    try {
      const MM_SHOPIFY_URL = 'https://ozmobiles-com-au.myshopify.com'
      const MM_ACCESS_TOKEN = process.env.MM_ACCESS_TOKEN
      const MM_API_VERSION = '2026-01'

      const response = await fetch(
        `${MM_SHOPIFY_URL}/admin/api/${MM_API_VERSION}/orders/count.json`,
        {
          headers: {
            'X-Shopify-Access-Token': MM_ACCESS_TOKEN!,
            'Content-Type': 'application/json',
          }
        }
      )

      if (response.ok) {
        const data = await response.json()
        console.log(`✅ Shopify API connected - ${data.count} orders available`)
      } else {
        console.log(`❌ Shopify API error: ${response.status} ${response.statusText}`)
        allTestsPassed = false
      }
    } catch (error) {
      console.log(`❌ Shopify API connection failed: ${(error as Error).message}`)
      allTestsPassed = false
    }

    // Test 4: Check existing data
    console.log('\n📊 Test 4: Checking existing data...')
    
    try {
      const { data: products, error: productsError } = await supabase
        .from('products')
        .select('id')
        .limit(1)

      if (productsError) {
        console.log(`❌ Products table error: ${productsError.message}`)
        allTestsPassed = false
      } else if (products && products.length > 0) {
        console.log(`✅ Products table has data (${products.length} sample records)`)
      } else {
        console.log(`⚠️ Products table is empty - run mm-sync first`)
      }

      const { data: orders, error: ordersError } = await supabase
        .from('orders')
        .select('id')
        .limit(1)

      if (ordersError) {
        console.log(`❌ Orders table error: ${ordersError.message}`)
        allTestsPassed = false
      } else if (orders && orders.length > 0) {
        console.log(`✅ Orders table has data (${orders.length} sample records)`)
      } else {
        console.log(`⚠️ Orders table is empty - run order-metrics-sync first`)
      }

      const { data: metrics, error: metricsError } = await supabase
        .from('product_metrics')
        .select('id')
        .limit(1)

      if (metricsError) {
        console.log(`❌ Product metrics table error: ${metricsError.message}`)
        allTestsPassed = false
      } else if (metrics && metrics.length > 0) {
        console.log(`✅ Product metrics table has data (${metrics.length} sample records)`)
      } else {
        console.log(`⚠️ Product metrics table is empty - run order-metrics-sync first`)
      }

    } catch (error) {
      console.log(`❌ Data check failed: ${(error as Error).message}`)
      allTestsPassed = false
    }

    // Test 5: Test API endpoint (if running)
    console.log('\n🔌 Test 5: Testing API endpoint...')
    
    try {
      // This will only work if the Next.js server is running
      const apiResponse = await fetch('http://localhost:3000/api/metrics?type=summary')
      
      if (apiResponse.ok) {
        const apiData = await apiResponse.json()
        console.log(`✅ API endpoint working - ${JSON.stringify(apiData.data?.totals || {})}`)
      } else {
        console.log(`⚠️ API endpoint not accessible (server may not be running)`)
      }
    } catch (error) {
      console.log(`⚠️ API endpoint test skipped (server not running)`)
    }

    // Summary
    console.log('\n' + '=' .repeat(50))
    
    if (allTestsPassed) {
      console.log('🎉 All tests passed! System is ready to use.')
      console.log('\n📝 Next steps:')
      console.log('1. Run: npm run order-metrics-sync 10  (test with 10 orders)')
      console.log('2. Run: npm run view-metrics summary')
      console.log('3. Start your Next.js server: npm run dev')
      console.log('4. Test API: http://localhost:3000/api/metrics?type=summary')
    } else {
      console.log('❌ Some tests failed. Please fix the issues above.')
      console.log('\n🔧 Common fixes:')
      console.log('1. Run: npm run setup-order-metrics')
      console.log('2. Check your .env.local file has all required variables')
      console.log('3. Ensure your Shopify access token is valid')
      console.log('4. Run: npm run mm-sync (to populate products table)')
    }

  } catch (error) {
    console.error('💥 Test suite failed:', (error as Error).message)
    process.exit(1)
  }
}

// Run if executed directly
if (require.main === module) {
  testOrderMetricsSystem().catch(error => {
    console.error('🔥 Test failed:', error)
    process.exit(1)
  })
}

export default testOrderMetricsSystem