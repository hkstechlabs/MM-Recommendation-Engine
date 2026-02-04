#!/usr/bin/env tsx

/**
 * Test Reebelo API with real SKUs from the database
 */

import axios from 'axios'
import { createServiceClient } from '@/lib/supabase/script-client'
import { config } from 'dotenv'

// Load environment variables
config({ path: '.env.local' })
config({ path: '.env' })

async function testWithRealSkus() {
  console.log('🔍 Testing Reebelo API with real SKUs from database...')
  
  const supabase = createServiceClient()
  const apiUrl = 'https://a.reebelo.com/sockets/offers'
  const apiKey = process.env.REEBELO_API_KEY || 'aCkLJ6izdU67cduknwGtfkzjj'
  
  try {
    // Get some real SKUs from the database
    const { data: variants, error } = await supabase
      .from('variants')
      .select('sku')
      .not('sku', 'is', null)
      .neq('sku', '')
      .limit(10)

    if (error) {
      console.error('❌ Failed to get SKUs:', error.message)
      return
    }

    if (!variants || variants.length === 0) {
      console.log('⚠️ No SKUs found in database')
      return
    }

    console.log(`📦 Found ${variants.length} SKUs to test`)

    let foundOffers = false
    
    for (const variant of variants.slice(0, 5)) { // Test first 5 SKUs
      const sku = variant.sku
      console.log(`\n📱 Testing SKU: ${sku}`)
      
      try {
        const response = await axios.get(apiUrl, {
          headers: {
            'content-type': 'application/json',
            'x-api-key': apiKey,
          },
          params: {
            search: sku,
            page: 1,
          },
          timeout: 15000
        })

        const data = response.data
        const offerCount = data?.publishedOffers?.length || 0
        console.log(`   Found ${offerCount} offers`)
        
        if (offerCount > 0) {
          foundOffers = true
          const firstOffer = data.publishedOffers[0]
          const attrs = firstOffer.reebeloOffer?.attributes || {}
          console.log(`   💰 Price: $${firstOffer.price}`)
          console.log(`   📦 Stock: ${firstOffer.reebeloOffer?.stock || 0}`)
          console.log(`   🏷️  Condition: ${attrs.condition || 'Unknown'}`)
          console.log(`   💾 Storage: ${attrs.storage || 'Unknown'}`)
          console.log(`   🎨 Color: ${attrs.color || 'Unknown'}`)
        }

        // Rate limiting
        await new Promise(resolve => setTimeout(resolve, 500))

      } catch (error: any) {
        console.error(`   ❌ API error: ${error.message}`)
      }
    }
    
    if (foundOffers) {
      console.log('\n🎉 Found offers! The Reebelo API is working with your SKUs.')
    } else {
      console.log('\n⚠️ No offers found for any SKUs. This might be normal if products are not available on Reebelo.')
    }

  } catch (error: any) {
    console.error('❌ Test failed:', error.message)
  }
}

async function main() {
  await testWithRealSkus()
}

if (require.main === module) {
  main().catch(error => {
    console.error('💥 Test failed:', error)
    process.exit(1)
  })
}