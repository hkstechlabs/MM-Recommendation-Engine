import { config } from 'dotenv'

// Load environment variables
config({ path: '.env.local' })

async function testSupabaseRest() {
  console.log('🔍 Testing Supabase REST API directly...')
  console.log('📍 URL:', process.env.NEXT_PUBLIC_SUPABASE_URL)

  const baseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_OR_ANON_KEY
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY

  // Test 1: Basic health check
  console.log('\n1️⃣ Testing basic health check...')
  try {
    const response = await fetch(`${baseUrl}/rest/v1/`, {
      method: 'GET',
      headers: {
        'apikey': anonKey!,
        'Authorization': `Bearer ${anonKey!}`,
        'Content-Type': 'application/json'
      }
    })
    
    console.log('📊 Health check status:', response.status)
    console.log('📊 Response headers:', Object.fromEntries(response.headers.entries()))
    
    if (response.ok) {
      console.log('✅ Basic API endpoint is accessible')
    } else {
      const text = await response.text()
      console.error('❌ API endpoint error:', text)
    }
  } catch (err) {
    console.error('❌ Health check failed:', (err as Error).message)
  }

  // Test 2: Try to access products table with anon key
  console.log('\n2️⃣ Testing products table access with anon key...')
  try {
    const response = await fetch(`${baseUrl}/rest/v1/products?select=count&limit=1`, {
      method: 'GET',
      headers: {
        'apikey': anonKey!,
        'Authorization': `Bearer ${anonKey!}`,
        'Content-Type': 'application/json'
      }
    })
    
    console.log('📊 Products query status:', response.status)
    
    if (response.ok) {
      const data = await response.json()
      console.log('✅ Products table accessible with anon key:', data)
    } else {
      const text = await response.text()
      console.error('❌ Products query error:', text)
    }
  } catch (err) {
    console.error('❌ Products query failed:', (err as Error).message)
  }

  // Test 3: Try to access products table with service key
  console.log('\n3️⃣ Testing products table access with service key...')
  try {
    const response = await fetch(`${baseUrl}/rest/v1/products?select=count&limit=1`, {
      method: 'GET',
      headers: {
        'apikey': serviceKey!,
        'Authorization': `Bearer ${serviceKey!}`,
        'Content-Type': 'application/json'
      }
    })
    
    console.log('📊 Products query status (service):', response.status)
    
    if (response.ok) {
      const data = await response.json()
      console.log('✅ Products table accessible with service key:', data)
      return true
    } else {
      const text = await response.text()
      console.error('❌ Products query error (service):', text)
    }
  } catch (err) {
    console.error('❌ Products query failed (service):', (err as Error).message)
  }

  // Test 4: Check if tables exist
  console.log('\n4️⃣ Checking if tables exist...')
  try {
    const response = await fetch(`${baseUrl}/rest/v1/`, {
      method: 'GET',
      headers: {
        'apikey': serviceKey!,
        'Authorization': `Bearer ${serviceKey!}`,
        'Accept': 'application/vnd.pgrst.object+json'
      }
    })
    
    if (response.ok) {
      const schema = await response.json()
      console.log('📊 Available endpoints:', Object.keys(schema.definitions || {}))
    }
  } catch (err) {
    console.error('❌ Schema check failed:', (err as Error).message)
  }

  return false
}

testSupabaseRest().then(success => {
  if (success) {
    console.log('\n✨ REST API connection successful!')
    process.exit(0)
  } else {
    console.log('\n🚨 REST API connection issues found.')
    process.exit(1)
  }
}).catch(error => {
  console.error('🔥 Test failed:', error)
  process.exit(1)
})