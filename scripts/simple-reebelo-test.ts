#!/usr/bin/env tsx

/**
 * Simple Reebelo test without complex database relationships
 */

import axios from 'axios'
import { createServiceClient } from '@/lib/supabase/script-client'
import { config } from 'dotenv'

// Load environment variables
config({ path: '.env.local' })
config({ path: '.env' })

async function testReebeloAPI() {
  console.log('🔍 Testing Reebelo API...')
  
  const apiUrl = 'https://a.reebelo.com/sockets/offers'
  const apiKey = process.env.REEBELO_API_KEY || 'aCkLJ6izdU67cduknwGtfkzjj'
  
  try {
    // Test with a few different SKUs
    const testSkus = ['IPHONE15PRO128GB', 'IPHONE14PRO128GB', 'SAMSUNGS24ULTRA256GB', 'IPHONE13PRO128GB']
    
    let foundOffers = false
    
    for (const testSku of testSkus) {
      console.log(`📱 Testing with SKU: ${testSku}`)
      
      const response = await axios.get(apiUrl, {
        headers: {
          'content-type': 'application/json',
          'x-api-key': apiKey,
        },
        params: {
          search: testSku,
          page: 1,
        },
        timeout: 15000
      })

      const data = response.data
      console.log(`   Found ${data?.publishedOffers?.length || 0} offers`)
      
      if (data?.publishedOffers?.length > 0) {
        const firstOffer = data.publishedOffers[0]
        console.log(`   💰 First offer: $${firstOffer.price} - ${firstOffer.reebeloOffer?.attributes?.condition || 'Unknown condition'}`)
        foundOffers = true
        return data // Return first successful result
      }
      
      // Small delay between requests
      await new Promise(resolve => setTimeout(resolve, 500))
    }
    
    if (!foundOffers) {
      console.log('⚠️ No offers found for any test SKUs')
    }

  } catch (error: any) {
    console.error('❌ Reebelo API test failed:', error.message)
    if (error.response) {
      console.error(`   Status: ${error.response.status}`)
      console.error(`   Data:`, error.response.data)
    }
    return null
  }
}

async function testDatabaseInsert() {
  console.log('\n🔍 Testing database insert...')
  
  const supabase = createServiceClient()
  
  try {
    // Create a test competitor
    const { data: existingCompetitor, error: checkError } = await supabase
      .from('competitors')
      .select('id')
      .eq('title', 'reebelo-test')
      .single()

    let competitor
    if (checkError && checkError.code === 'PGRST116') {
      // Competitor doesn't exist, create it
      const { data: newCompetitor, error: createError } = await supabase
        .from('competitors')
        .insert({
          title: 'reebelo-test',
          failed_executions: 0,
          total_executions: 0
        })
        .select('id')
        .single()

      if (createError) {
        console.error('❌ Failed to create competitor:', createError.message)
        return false
      }
      competitor = newCompetitor
    } else if (checkError) {
      console.error('❌ Failed to check competitor:', checkError.message)
      return false
    } else {
      competitor = existingCompetitor
    }

    console.log(`✅ Competitor created/found: ${competitor.id}`)

    // Create a test execution
    const { data: execution, error: executionError } = await supabase
      .from('executions')
      .insert({
        competitor_id: competitor.id,
        start_time: new Date().toISOString(),
        status: 'running',
        trigger_source: 'test'
      })
      .select('id')
      .single()

    if (executionError) {
      console.error('❌ Failed to create execution:', executionError.message)
      return false
    }

    console.log(`✅ Execution created: ${execution.id}`)

    // Test scraped_data insert
    const testData = {
      price: '999.99',
      stock: 5,
      raw_response: { test: 'data', timestamp: new Date().toISOString() },
      competitor_id: competitor.id,
      execution_id: execution.id,
      created_at: new Date().toISOString()
    }

    const { data: scrapedData, error: insertError } = await supabase
      .from('scraped_data')
      .insert([testData])
      .select('id')

    if (insertError) {
      console.error('❌ Failed to insert scraped data:', insertError.message)
      return false
    }

    console.log(`✅ Test data inserted: ${scrapedData?.[0]?.id}`)

    // Clean up test data
    await supabase.from('scraped_data').delete().eq('id', scrapedData[0].id)
    await supabase.from('executions').delete().eq('id', execution.id)
    console.log('🧹 Cleaned up test data')

    return true

  } catch (error: any) {
    console.error('❌ Database test failed:', error.message)
    return false
  }
}

async function main() {
  console.log('🚀 Simple Reebelo Test')
  console.log('=' .repeat(40))

  // Test API
  const apiData = await testReebeloAPI()
  
  // Test Database
  const dbSuccess = await testDatabaseInsert()

  console.log('\n' + '='.repeat(40))
  
  if (apiData && dbSuccess) {
    console.log('🎉 All tests passed!')
    console.log('\nNext steps:')
    console.log('1. Run the SQL from docs/supabase/fix-missing-columns.sql in Supabase dashboard')
    console.log('2. Then run: npm run sync-reebelo')
  } else {
    console.log('❌ Some tests failed. Check the errors above.')
    process.exit(1)
  }
}

if (require.main === module) {
  main().catch(error => {
    console.error('💥 Test failed:', error)
    process.exit(1)
  })
}