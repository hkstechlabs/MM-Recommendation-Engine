import { createClient } from '@supabase/supabase-js'
import { config } from 'dotenv'

// Load environment variables
config({ path: '.env.local' })

console.log('🔍 Environment variables:')
console.log('NEXT_PUBLIC_SUPABASE_URL:', process.env.NEXT_PUBLIC_SUPABASE_URL)
console.log('SUPABASE_SERVICE_ROLE_KEY exists:', !!process.env.SUPABASE_SERVICE_ROLE_KEY)
console.log('NEXT_PUBLIC_SUPABASE_PUBLISHABLE_OR_ANON_KEY exists:', !!process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_OR_ANON_KEY)

// Test with service role key
console.log('\n🔍 Testing with service role key...')
const supabaseService = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  {
    auth: {
      persistSession: false,
      autoRefreshToken: false
    }
  }
)

// Test with anon key
console.log('\n🔍 Testing with anon key...')
const supabaseAnon = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_OR_ANON_KEY!,
  {
    auth: {
      persistSession: false,
      autoRefreshToken: false
    }
  }
)

async function testConnection() {
  try {
    console.log('\n📡 Testing service role connection...')
    const { data: serviceData, error: serviceError } = await supabaseService
      .from('products')
      .select('count')
      .limit(1)
    
    if (serviceError) {
      console.log('❌ Service role error:', serviceError.message)
    } else {
      console.log('✅ Service role connection successful')
    }

    console.log('\n📡 Testing anon key connection...')
    const { data: anonData, error: anonError } = await supabaseAnon
      .from('products')
      .select('count')
      .limit(1)
    
    if (anonError) {
      console.log('❌ Anon key error:', anonError.message)
    } else {
      console.log('✅ Anon key connection successful')
    }

    // Test table existence
    console.log('\n📋 Testing table existence...')
    const { data: tables, error: tablesError } = await supabaseService
      .rpc('get_table_names')
      .limit(10)
    
    if (tablesError) {
      console.log('❌ Table query error:', tablesError.message)
      
      // Try a different approach - direct query
      console.log('\n📋 Trying direct table query...')
      const { data: directData, error: directError } = await supabaseService
        .from('information_schema.tables')
        .select('table_name')
        .eq('table_schema', 'public')
        .limit(10)
      
      if (directError) {
        console.log('❌ Direct table query error:', directError.message)
      } else {
        console.log('✅ Direct table query successful:', directData)
      }
    } else {
      console.log('✅ Table query successful:', tables)
    }

  } catch (error) {
    console.error('🔥 Connection test failed:', error)
  }
}

testConnection()