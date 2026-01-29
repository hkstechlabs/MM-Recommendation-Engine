import { createClient } from '@supabase/supabase-js'
import { config } from 'dotenv'

// Load environment variables
config({ path: '.env.local' })

async function testConnection() {
  console.log('🔍 Testing Supabase connection...')
  
  // Create Supabase client with better configuration
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_OR_ANON_KEY!,
    {
      auth: {
        persistSession: false,
        autoRefreshToken: false
      },
      db: {
        schema: 'public'
      }
    }
  )

  try {
    // Test basic connection with a simple query
    console.log('📡 Testing basic connection...')
    const { data, error } = await supabase.rpc('version')
    
    if (error) {
      console.error('❌ Basic connection failed:', error.message)
    } else {
      console.log('✅ Basic connection successful')
    }

    // Test products table access
    console.log('📋 Testing products table access...')
    const { data: productsData, error: productsError } = await supabase
      .from('products')
      .select('id')
      .limit(1)

    if (productsError) {
      console.error('❌ Products table access failed:', productsError.message)
      console.log('   This might be due to RLS policies or permissions')
    } else {
      console.log('✅ Products table accessible')
    }

    // Test variants table access
    console.log('📋 Testing variants table access...')
    const { data: variantsData, error: variantsError } = await supabase
      .from('variants')
      .select('id')
      .limit(1)

    if (variantsError) {
      console.error('❌ Variants table access failed:', variantsError.message)
      console.log('   This might be due to RLS policies or permissions')
    } else {
      console.log('✅ Variants table accessible')
    }

    return !productsError && !variantsError
  } catch (error) {
    console.error('❌ Unexpected error:', error)
    return false
  }
}

// Test MM Shopify connection
async function testShopifyConnection() {
  console.log('\n🔍 Testing MM Shopify connection...')
  
  const MM_ACCESS_TOKEN = process.env.MM_ACCESS_TOKEN
  if (!MM_ACCESS_TOKEN) {
    console.error('❌ MM_ACCESS_TOKEN not found in environment variables')
    return false
  }

  try {
    const response = await fetch(
      'https://ozmobiles-com-au.myshopify.com/admin/api/2026-01/products.json?limit=1',
      {
        headers: {
          'X-Shopify-Access-Token': MM_ACCESS_TOKEN,
          'Content-Type': 'application/json',
        }
      }
    )

    if (!response.ok) {
      console.error(`❌ Shopify API error: ${response.status} ${response.statusText}`)
      return false
    }

    const data = await response.json()
    console.log(`✅ Successfully connected to MM Shopify`)
    console.log(`📊 Sample response contains ${data.products?.length || 0} products`)
    
    return true
  } catch (error) {
    console.error('❌ Error connecting to Shopify:', error)
    return false
  }
}

async function main() {
  console.log('🚀 Running connection tests...\n')
  
  const supabaseOk = await testConnection()
  const shopifyOk = await testShopifyConnection()
  
  console.log('\n📋 Test Results:')
  console.log(`   Supabase: ${supabaseOk ? '✅ OK' : '❌ Failed'}`)
  console.log(`   Shopify:  ${shopifyOk ? '✅ OK' : '❌ Failed'}`)
  
  if (supabaseOk && shopifyOk) {
    console.log('\n🎉 All connections successful! Ready to run MM sync.')
  } else {
    console.log('\n⚠️ Some connections failed. Please check your configuration.')
    if (!supabaseOk) {
      console.log('\n💡 Supabase troubleshooting:')
      console.log('   - Check if SUPABASE_SERVICE_ROLE_KEY is set correctly')
      console.log('   - Verify RLS policies allow access to products/variants tables')
      console.log('   - Ensure the service role has proper permissions')
    }
    process.exit(1)
  }
}

main().catch(error => {
  console.error('🔥 Test failed:', error)
  process.exit(1)
})