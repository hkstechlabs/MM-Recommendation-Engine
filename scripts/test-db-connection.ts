import { createNodeClient, createNodeAnonClient } from '@/lib/supabase/node-client'

async function testDatabaseConnections() {
  console.log('🔍 Testing database connections...\n')

  // Test 1: Node client with service role (admin access)
  console.log('1. Testing Node client with service role...')
  try {
    const nodeClient = createNodeClient()
    const { data, error } = await nodeClient
      .from('products')
      .select('count')
      .limit(1)
    
    if (error) {
      console.log('❌ Node client failed:', error.message)
    } else {
      console.log('✅ Node client connection successful')
    }
  } catch (err) {
    console.log('❌ Node client exception:', (err as Error).message)
  }

  // Test 2: Node anon client
  console.log('\n2. Testing Node anon client...')
  try {
    const nodeAnonClient = createNodeAnonClient()
    const { data, error } = await nodeAnonClient
      .from('products')
      .select('count')
      .limit(1)
    
    if (error) {
      console.log('❌ Node anon client failed:', error.message)
    } else {
      console.log('✅ Node anon client connection successful')
    }
  } catch (err) {
    console.log('❌ Node anon client exception:', (err as Error).message)
  }

  // Test 3: Insert test data with node client
  console.log('\n3. Testing data insertion with node client...')
  try {
    const nodeClient = createNodeClient()
    
    const testProduct = {
      title: 'Test Product - Connection Test',
      vendor: 'Test Vendor',
      product_type: 'Test Type',
      product_created_at: new Date().toISOString(),
      product_id: 999999998,
      status: 'test',
      tags: ['test', 'connection-test']
    }

    const { data: insertedProduct, error: insertError } = await nodeClient
      .from('products')
      .insert(testProduct)
      .select()
      .single()

    if (insertError) {
      console.log('❌ Test product insertion failed:', insertError.message)
    } else {
      console.log('✅ Test product inserted successfully:', insertedProduct.id)
      
      // Test variant insertion
      const testVariant = {
        product_id: testProduct.product_id,
        variant_id: 999999998,
        title: 'Test Variant',
        price: '99.99',
        sku: 'TEST-SKU-002',
        storage: '128GB',
        condition: 'New',
        color: 'Black',
        inventory_quantity: 10,
        position: 1,
        taxable: true,
        requires_shipping: true
      }

      const { data: insertedVariant, error: variantError } = await nodeClient
        .from('variants')
        .insert(testVariant)
        .select()
        .single()

      if (variantError) {
        console.log('❌ Test variant insertion failed:', variantError.message)
      } else {
        console.log('✅ Test variant inserted successfully:', insertedVariant.id)
        
        // Clean up
        await nodeClient.from('variants').delete().eq('id', insertedVariant.id)
        console.log('✅ Test variant cleaned up')
      }
      
      await nodeClient.from('products').delete().eq('id', insertedProduct.id)
      console.log('✅ Test product cleaned up')
    }
  } catch (err) {
    console.log('❌ Data insertion test exception:', (err as Error).message)
  }

  console.log('\n🏁 Database connection tests completed')
}

// Run the test
testDatabaseConnections().catch(console.error)