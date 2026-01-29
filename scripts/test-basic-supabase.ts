import { createClient } from '@supabase/supabase-js'
import { config } from 'dotenv'

// Load environment variables
config({ path: '.env.local' })

async function testBasicConnection() {
  console.log('🔍 Testing Basic Supabase Connection...')
  console.log('📍 URL:', process.env.NEXT_PUBLIC_SUPABASE_URL)
  console.log('📍 Anon Key:', process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_OR_ANON_KEY?.substring(0, 20) + '...')
  console.log('📍 Service Key:', process.env.SUPABASE_SERVICE_ROLE_KEY?.substring(0, 20) + '...')

  // Test with anon key first
  console.log('\n1️⃣ Testing with anon key...')
  const anonClient = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_OR_ANON_KEY!
  )

  try {
    const { data, error } = await anonClient
      .from('products')
      .select('count')
      .limit(1)

    if (error) {
      console.error('❌ Anon client error:', error.message)
    } else {
      console.log('✅ Anon client connection successful')
    }
  } catch (err) {
    console.error('❌ Anon client exception:', (err as Error).message)
  }

  // Test with service role key
  console.log('\n2️⃣ Testing with service role key...')
  const serviceClient = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )

  try {
    const { data, error } = await serviceClient
      .from('products')
      .select('count')
      .limit(1)

    if (error) {
      console.error('❌ Service client error:', error.message)
    } else {
      console.log('✅ Service client connection successful')
      return true
    }
  } catch (err) {
    console.error('❌ Service client exception:', (err as Error).message)
  }

  // Test basic health check
  console.log('\n3️⃣ Testing basic health check...')
  try {
    const response = await fetch(`${process.env.NEXT_PUBLIC_SUPABASE_URL}/rest/v1/`, {
      headers: {
        'apikey': process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_OR_ANON_KEY!,
        'Authorization': `Bearer ${process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_OR_ANON_KEY!}`
      }
    })
    
    console.log('📊 Health check status:', response.status)
    if (response.ok) {
      console.log('✅ Basic API endpoint is accessible')
    } else {
      console.error('❌ API endpoint returned:', response.status, response.statusText)
    }
  } catch (err) {
    console.error('❌ Health check failed:', (err as Error).message)
  }

  return false
}

testBasicConnection().then(success => {
  if (success) {
    console.log('\n✨ Connection successful!')
    process.exit(0)
  } else {
    console.log('\n🚨 Connection issues found.')
    process.exit(1)
  }
}).catch(error => {
  console.error('🔥 Test failed:', error)
  process.exit(1)
})