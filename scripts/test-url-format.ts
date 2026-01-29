import { createClient } from '@supabase/supabase-js'
import { config } from 'dotenv'

// Load environment variables
config({ path: '.env.local' })
config({ path: '.env' })

async function testUrlFormats() {
  console.log('🔍 Testing different URL formats...\n')
  
  const originalUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  
  console.log('Original URL:', originalUrl)
  
  // Test different URL formats
  const urlVariants = [
    originalUrl, // Original
    originalUrl?.replace(/\/$/, ''), // Remove trailing slash
    originalUrl?.replace(/\/$/, '') + '/', // Ensure trailing slash
  ].filter(Boolean) as string[]

  for (let i = 0; i < urlVariants.length; i++) {
    const url = urlVariants[i]
    console.log(`\nTesting variant ${i + 1}: ${url}`)
    
    try {
      const client = createClient(url, serviceRoleKey!, {
        auth: {
          persistSession: false
        }
      })

      // Test with a simple REST call instead of RPC
      const response = await fetch(`${url}/rest/v1/`, {
        headers: {
          'apikey': serviceRoleKey!,
          'Authorization': `Bearer ${serviceRoleKey!}`
        }
      })

      console.log(`HTTP Status: ${response.status}`)
      
      if (response.ok) {
        console.log('✅ REST endpoint accessible')
        
        // Now try a simple table query
        const { data, error } = await client
          .from('products')
          .select('id')
          .limit(1)
        
        if (error) {
          console.log('❌ Table query failed:', error.message)
        } else {
          console.log('✅ Table query successful')
          break // Success, exit loop
        }
      } else {
        console.log('❌ REST endpoint not accessible')
      }

    } catch (err) {
      console.log('❌ Exception:', (err as Error).message)
    }
  }
}

testUrlFormats().catch(console.error)