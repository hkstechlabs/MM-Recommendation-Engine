import { createClient } from '@supabase/supabase-js'
import { config } from 'dotenv'

// Load environment variables
config({ path: '.env.local' })

async function debugSupabase() {
  console.log('🔍 Debugging Supabase connection...\n')

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!

  console.log(`📡 Connecting to: ${supabaseUrl}`)
  console.log(`🔑 Using service key: ${serviceKey.substring(0, 20)}...\n`)

  // Create client with minimal configuration
  const supabase = createClient(supabaseUrl, serviceKey)

  try {
    // Test 1: Basic connection with a PostgreSQL function
    console.log('🧪 Test 1: Basic PostgreSQL connection')
    try {
      const { data, error } = await supabase.rpc('version')
      if (error) {
        console.log(`   ❌ Error: ${error.message}`)
      } else {
        console.log(`   ✅ Success: Connected to PostgreSQL`)
      }
    } catch (err) {
      console.log(`   ❌ Exception: ${err}`)
    }

    // Test 2: List all tables
    console.log('\n🧪 Test 2: List tables in public schema')
    try {
      const { data, error } = await supabase
        .from('information_schema.tables')
        .select('table_name')
        .eq('table_schema', 'public')
        .eq('table_type', 'BASE TABLE')

      if (error) {
        console.log(`   ❌ Error: ${error.message}`)
      } else {
        console.log(`   ✅ Found ${data?.length || 0} tables:`)
        data?.forEach(table => console.log(`      - ${table.table_name}`))
      }
    } catch (err) {
      console.log(`   ❌ Exception: ${err}`)
    }

    // Test 3: Check if products table exists and is accessible
    console.log('\n🧪 Test 3: Check products table structure')
    try {
      const { data, error } = await supabase
        .from('information_schema.columns')
        .select('column_name, data_type')
        .eq('table_schema', 'public')
        .eq('table_name', 'products')

      if (error) {
        console.log(`   ❌ Error: ${error.message}`)
      } else if (!data || data.length === 0) {
        console.log(`   ⚠️ Products table not found or not accessible`)
      } else {
        console.log(`   ✅ Products table has ${data.length} columns:`)
        data.forEach(col => console.log(`      - ${col.column_name}: ${col.data_type}`))
      }
    } catch (err) {
      console.log(`   ❌ Exception: ${err}`)
    }

    // Test 4: Try to insert a test record
    console.log('\n🧪 Test 4: Test insert operation')
    try {
      const testProduct = {
        title: 'Test Product - DELETE ME',
        vendor: 'Test Vendor',
        product_type: 'Test Type',
        product_id: 999999999,
        status: 'test'
      }

      const { data, error } = await supabase
        .from('products')
        .insert(testProduct)
        .select()

      if (error) {
        console.log(`   ❌ Insert Error: ${error.message}`)
        console.log(`   Details: ${JSON.stringify(error, null, 2)}`)
      } else {
        console.log(`   ✅ Insert successful, record ID: ${data[0]?.id}`)
        
        // Clean up - delete the test record
        const { error: deleteError } = await supabase
          .from('products')
          .delete()
          .eq('id', data[0].id)
        
        if (deleteError) {
          console.log(`   ⚠️ Cleanup failed: ${deleteError.message}`)
        } else {
          console.log(`   🧹 Test record cleaned up`)
        }
      }
    } catch (err) {
      console.log(`   ❌ Exception: ${err}`)
    }

  } catch (error) {
    console.error('🔥 Fatal error:', error)
  }
}

debugSupabase().catch(console.error)