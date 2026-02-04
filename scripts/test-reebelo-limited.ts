#!/usr/bin/env tsx

/**
 * Test Reebelo scraper with limited SKUs to see full process
 */

import { createServiceClient } from '@/lib/supabase/script-client'
import { config } from 'dotenv'

// Load environment variables
config({ path: '.env.local' })
config({ path: '.env' })

async function testLimitedReebelo() {
  console.log('🧪 Testing Reebelo scraper with limited SKUs...')
  
  const supabase = createServiceClient()
  
  try {
    // Create a test competitor
    const { data: competitor, error: competitorError } = await supabase
      .from('competitors')
      .upsert({
        title: 'reebelo-test-limited',
        failed_executions: 0,
        total_executions: 0
      })
      .select('id')
      .single()

    if (competitorError) {
      console.error('❌ Failed to create competitor:', competitorError.message)
      return
    }

    console.log(`✅ Created test competitor: ${competitor.id}`)

    // Create execution
    const { data: execution, error: executionError } = await supabase
      .from('executions')
      .insert({
        competitor_id: competitor.id,
        start_time: new Date().toISOString(),
        status: 'running',
        trigger_source: 'limited-test'
      })
      .select('id')
      .single()

    if (executionError) {
      console.error('❌ Failed to create execution:', executionError.message)
      return
    }

    console.log(`✅ Created execution: ${execution.id}`)

    // Get a few SKUs to test
    const { data: variants, error: variantsError } = await supabase
      .from('variants')
      .select('sku, id, product_id')
      .not('sku', 'is', null)
      .neq('sku', '')
      .limit(5)

    if (variantsError) {
      console.error('❌ Failed to get variants:', variantsError.message)
      return
    }

    console.log(`📦 Testing with ${variants.length} SKUs`)

    // Test Reebelo API with these SKUs
    const axios = require('axios')
    const apiUrl = 'https://a.reebelo.com/sockets/offers'
    const apiKey = process.env.REEBELO_API_KEY || 'aCkLJ6izdU67cduknwGtfkzjj'
    
    const scrapedData = []

    for (const variant of variants) {
      try {
        console.log(`🔍 Testing SKU: ${variant.sku}`)
        
        const response = await axios.get(apiUrl, {
          headers: {
            'content-type': 'application/json',
            'x-api-key': apiKey,
          },
          params: {
            search: variant.sku,
            page: 1,
          },
          timeout: 15000
        })

        const offers = response.data?.publishedOffers || []
        console.log(`   Found ${offers.length} offers`)

        for (const offer of offers) {
          scrapedData.push({
            price: offer.price.toString(),
            stock: offer.reebeloOffer?.stock || 0,
            raw_response: offer,
            competitor_id: competitor.id,
            execution_id: execution.id,
            variant_id: variant.id,
            product_id: variant.product_id
          })
        }

        // Rate limiting
        await new Promise(resolve => setTimeout(resolve, 500))

      } catch (error: any) {
        console.error(`   ❌ Error for SKU ${variant.sku}:`, error.message)
      }
    }

    // Insert scraped data
    if (scrapedData.length > 0) {
      console.log(`\n💾 Inserting ${scrapedData.length} data points...`)
      
      const { data: insertedData, error: insertError } = await supabase
        .from('scraped_data')
        .insert(scrapedData)
        .select('id')

      if (insertError) {
        console.error('❌ Failed to insert data:', insertError.message)
      } else {
        console.log(`✅ Successfully inserted ${insertedData.length} records`)
      }
    }

    // Update execution status
    await supabase
      .from('executions')
      .update({
        status: 'completed',
        end_time: new Date().toISOString()
      })
      .eq('id', execution.id)

    console.log('\n🎉 Limited test completed successfully!')
    console.log(`📊 Results: ${scrapedData.length} data points from ${variants.length} SKUs`)

  } catch (error: any) {
    console.error('❌ Test failed:', error.message)
  }
}

async function main() {
  await testLimitedReebelo()
}

if (require.main === module) {
  main().catch(error => {
    console.error('💥 Test failed:', error)
    process.exit(1)
  })
}