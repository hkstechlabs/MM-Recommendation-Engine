import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

export async function GET() {
  try {
    console.log('🔍 Testing database connection from API route...')
    
    const supabase = await createClient()
    
    // Test basic connection
    const { data, error } = await supabase
      .from('products')
      .select('count')
      .limit(1)
    
    if (error) {
      console.log('❌ Database query failed:', error.message)
      return NextResponse.json({ 
        success: false, 
        error: error.message,
        details: 'Database query failed'
      }, { status: 500 })
    }

    console.log('✅ Database connection successful')

    // Test insertion
    const testProduct = {
      title: 'Test Product - API Route',
      vendor: 'Test Vendor',
      product_type: 'Test Type',
      product_created_at: new Date().toISOString(),
      product_id: 999999997,
      status: 'test',
      tags: ['test', 'api-route']
    }

    const { data: insertedProduct, error: insertError } = await supabase
      .from('products')
      .insert(testProduct)
      .select()
      .single()

    if (insertError) {
      console.log('❌ Test insertion failed:', insertError.message)
      return NextResponse.json({ 
        success: false, 
        error: insertError.message,
        details: 'Test insertion failed'
      }, { status: 500 })
    }

    console.log('✅ Test insertion successful:', insertedProduct.id)

    // Test variant insertion
    const testVariant = {
      product_id: testProduct.product_id,
      variant_id: 999999997,
      title: 'Test Variant',
      price: '99.99',
      sku: 'TEST-SKU-API',
      storage: '128GB',
      condition: 'New',
      color: 'Black',
      inventory_quantity: 10,
      position: 1,
      taxable: true,
      requires_shipping: true
    }

    const { data: insertedVariant, error: variantError } = await supabase
      .from('variants')
      .insert(testVariant)
      .select()
      .single()

    if (variantError) {
      console.log('❌ Variant insertion failed:', variantError.message)
      // Clean up product
      await supabase.from('products').delete().eq('id', insertedProduct.id)
      return NextResponse.json({ 
        success: false, 
        error: variantError.message,
        details: 'Variant insertion failed'
      }, { status: 500 })
    }

    console.log('✅ Variant insertion successful:', insertedVariant.id)

    // Clean up test data
    await supabase.from('variants').delete().eq('id', insertedVariant.id)
    await supabase.from('products').delete().eq('id', insertedProduct.id)
    console.log('✅ Test data cleaned up')

    return NextResponse.json({ 
      success: true, 
      message: 'Database connection and operations successful',
      testResults: {
        productInserted: insertedProduct.id,
        variantInserted: insertedVariant.id,
        cleanedUp: true
      }
    })

  } catch (error) {
    console.error('❌ API route exception:', error)
    return NextResponse.json({ 
      success: false, 
      error: (error as Error).message,
      details: 'API route exception'
    }, { status: 500 })
  }
}