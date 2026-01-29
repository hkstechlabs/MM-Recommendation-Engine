import { createClient } from '@supabase/supabase-js'
import { config } from 'dotenv'

// Load environment variables
config({ path: '.env.local' })
config({ path: '.env' })

async function testBasicConnection() {
  console.log('🔍 Testing basic Supabase connection...\n')
  
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_OR_ANON_KEY
  
  console.log('Environment variables:')
  console.log('- SUPABASE_URL:', supabaseUrl ? '✅ Set' : '❌ Missing')
  console.log('- SERVICE_ROLE_KEY:', serviceRoleKey ? '✅ Set' : '❌ Missing')
  console.log('- ANON_KEY:', anonKey ? '✅ Set' : '❌ Missing')
  console.log()

  if (!supabaseUrl || !serviceRoleKey) {
    console.log('❌ Missing required environment variables')
    return
  }

  // Test with minimal configuration
  console.log('Testing with service role key...')
  try {
    const client = createClient(supabaseUrl, serviceRoleKey, {
      auth: {
        persistSession: false
      }
    })

    // Try a very simple query first
    console.log('Attempting simple query...')
    const { data, error } = await client.rpc('version')
    
    if (error) {
      console.log('❌ Version query failed:', error.message)
    } else {
      console.log('✅ Version query successful:', data)
    }

    // Try to list tables
    console.log('Attempting to query information_schema...')
    const { data: tables, error: tablesError } = await client
      .from('information_schema.tables')
      .select('table_name')
      .eq('table_schema', 'public')
      .limit(5)

    if (tablesError) {
      console.log('❌ Tables query failed:', tablesError.message)
    } else {
      console.log('✅ Tables query successful:', tables?.map(t => t.table_name))
    }

  } catch (err) {
    console.log('❌ Connection exception:', (err as Error).message)
  }

  // Test with anon key
  console.log('\nTesting with anon key...')
  try {
    const anonClient = createClient(supabaseUrl, anonKey!, {
      auth: {
        persistSession: false
      }
    })

    const { data, error } = await anonClient.rpc('version')
    
    if (error) {
      console.log('❌ Anon version query failed:', error.message)
    } else {
      console.log('✅ Anon version query successful:', data)
    }

  } catch (err) {
    console.log('❌ Anon connection exception:', (err as Error).message)
  }
}

testBasicConnection().catch(console.error)