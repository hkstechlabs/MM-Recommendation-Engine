import { createScriptClient, createServiceClient } from '@/lib/supabase/script-client'
import { config } from 'dotenv'

// Load environment variables
config({ path: '.env.local' })

// Use service client for admin operations
const supabase = createServiceClient()

async function testDatabaseConnection() {
  console.log('🔍 Testing MM Sync Database Connection and Schema...')
  console.log('📍 Supabase URL:', process.env.NEXT_PUBLIC_SUPABASE_URL)
  
  try {
    // Test 1: Basic connection
    console.log('\n1️⃣ Testing basic connection...')
    const { error: testError } = await supabase
      .from('products')
      .select('count')
      .limit(1)

    if (testError) {
      console.error('❌ Database connection failed:', testError.message)
      return false
    }
    console.log('✅ Database connection successful')

    // Test 2: Check table structure
    console.log('\n2️⃣ Checking table structures...')
    
    // Test products table
    const { data: productsData, error: productsError } = await supabase
      .from('products')
      .select('*')
      .limit(1)
    
    if (productsError) {
      console.error('❌ Products table error:', productsError.message)
      return false
    }
    console.log('✅ Products table accessible')

    // Test variants table
    const { data: variantsData, error: variantsError } = await supabase
      .from('variants')
      .select('*')
      .limit(1)
    
    if (variantsError) {
      console.error('❌ Variants table error:', variantsError.message)
      return false
    }
    console.log('✅ Variants table accessible')

    // Test 3: Insert test data to verify schema compatibility
    console.log('\n3️⃣ Testing schema compatibility with test data...')
    
    const testProduct = {
      title: 'Test Product - MM Sync Schema Check',
      vendor: 'Test Vendor',
      product_type: 'Test Type',
      product_created_at: new Date().toISOString(),
      product_id: 999999999, // Use a high number to avoid conflicts
      status: 'test',
      tags: ['test', 'mm-sync', 'schema-check']
    }

    console.log('📝 Inserting test product...')
    const { data: insertedProduct, error: insertError } = await supabase
      .from('products')
      .insert(testProduct)
      .select()
      .single()

    if (insertError) {
      console.error('❌ Test product insertion failed:', insertError.message)
      console.error('💡 This might indicate schema mismatch')
      return false
    }
    console.log('✅ Test product inserted successfully:', insertedProduct.id)

    // Test variant insertion
    const testVariant = {
      product_id: testProduct.product_id,
      variant_id: 999999999,
      title: 'Test Variant - Schema Check',
      price: '99.99',
      sku: 'TEST-SKU-SCHEMA-001',
      storage: '128GB',
      condition: 'New',
      color: 'Black',
      inventory_quantity: 10,
      position: 1,
      taxable: true,
      requires_shipping: true
    }

    console.log('📝 Inserting test variant...')
    const { data: insertedVariant, error: variantError } = await supabase
      .from('variants')
      .insert(testVariant)
      .select()
      .single()

    if (variantError) {
      console.error('❌ Test variant insertion failed:', variantError.message)
      console.error('💡 This might indicate schema mismatch')
      // Clean up test product
      await supabase.from('products').delete().eq('id', insertedProduct.id)
      return false
    }
    console.log('✅ Test variant inserted successfully:', insertedVariant.id)

    // Test 4: Clean up test data
    console.log('\n4️⃣ Cleaning up test data...')
    await supabase.from('variants').delete().eq('id', insertedVariant.id)
    await supabase.from('products').delete().eq('id', insertedProduct.id)
    console.log('✅ Test data cleaned up successfully')

    // Test 5: Check MM Access Token
    console.log('\n5️⃣ Checking MM Access Token...')
    if (!process.env.MM_ACCESS_TOKEN) {
      console.warn('⚠️ MM_ACCESS_TOKEN not found in environment variables')
      return false
    }
    console.log('✅ MM Access Token is configured')

    console.log('\n🎉 All tests passed! MM Sync is ready to run.')
    return true

  } catch (error) {
    console.error('💥 Unexpected error during testing:', (error as Error).message)
    return false
  }
}

// Run the test
testDatabaseConnection().then(success => {
  if (success) {
    console.log('\n✨ Database and schema are fully compatible with MM Sync!')
    process.exit(0)
  } else {
    console.log('\n🚨 Issues found. Please check the errors above.')
    process.exit(1)
  }
}).catch(error => {
  console.error('🔥 Test failed with exception:', error)
  process.exit(1)
})