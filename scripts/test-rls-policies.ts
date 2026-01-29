import { createScriptClient } from '@/lib/supabase/script-client'

console.log('🔍 Testing RLS policies with anon user...')

const supabase = createScriptClient()

async function testRLSPolicies() {
  try {
    console.log('\n📋 Testing products table access...')
    
    // Test SELECT
    const { data: products, error: selectError } = await supabase
      .from('products')
      .select('*')
      .limit(5)
    
    if (selectError) {
      console.log('❌ Products SELECT error:', selectError.message)
    } else {
      console.log('✅ Products SELECT successful, found', products?.length || 0, 'products')
    }

    // Test INSERT
    const testProduct = {
      title: 'RLS Test Product',
      vendor: 'Test Vendor',
      product_type: 'Test',
      product_created_at: new Date().toISOString(),
      product_id: 999999998,
      status: 'test',
      tags: ['rls-test']
    }

    const { data: insertedProduct, error: insertError } = await supabase
      .from('products')
      .insert(testProduct)
      .select()
      .single()

    if (insertError) {
      console.log('❌ Products INSERT error:', insertError.message)
    } else {
      console.log('✅ Products INSERT successful, ID:', insertedProduct.id)
      
      // Clean up test product
      const { error: deleteError } = await supabase
        .from('products')
        .delete()
        .eq('id', insertedProduct.id)
      
      if (deleteError) {
        console.log('⚠️ Failed to clean up test product:', deleteError.message)
      } else {
        console.log('✅ Test product cleaned up successfully')
      }
    }

    console.log('\n📋 Testing variants table access...')
    
    // Test SELECT
    const { data: variants, error: variantSelectError } = await supabase
      .from('variants')
      .select('*')
      .limit(5)
    
    if (variantSelectError) {
      console.log('❌ Variants SELECT error:', variantSelectError.message)
    } else {
      console.log('✅ Variants SELECT successful, found', variants?.length || 0, 'variants')
    }

    console.log('\n🎉 RLS policy test completed!')

  } catch (error) {
    console.error('🔥 RLS test failed:', error)
  }
}

testRLSPolicies()