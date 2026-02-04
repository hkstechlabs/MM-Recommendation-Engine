#!/usr/bin/env tsx

/**
 * Ensure database schema is properly set up for competitor sync
 */

import { createServiceClient } from '@/lib/supabase/script-client'
import { config } from 'dotenv'

// Load environment variables
config({ path: '.env.local' })
config({ path: '.env' })

async function ensureSchema() {
  console.log('🔧 Ensuring database schema is ready for competitor sync...')
  
  const supabase = createServiceClient()
  
  try {
    // Test 1: Check if we can create a competitor
    console.log('\n1️⃣ Testing competitors table...')
    const { data: competitor, error: competitorError } = await supabase
      .from('competitors')
      .insert({
        title: 'schema-test-competitor',
        failed_executions: 0,
        total_executions: 0
      })
      .select('id')
      .single()

    if (competitorError) {
      console.error('❌ Competitors table issue:', competitorError.message)
      return false
    }
    console.log('✅ Competitors table working')

    // Test 2: Check if we can create an execution
    console.log('\n2️⃣ Testing executions table...')
    const { data: execution, error: executionError } = await supabase
      .from('executions')
      .insert({
        competitor_id: competitor.id,
        start_time: new Date().toISOString(),
        status: 'test',
        trigger_source: 'schema-test'
      })
      .select('id')
      .single()

    if (executionError) {
      console.error('❌ Executions table issue:', executionError.message)
      console.log('\n📋 You may need to run this SQL in Supabase dashboard:')
      console.log('ALTER TABLE public.executions ADD COLUMN competitor_id uuid REFERENCES public.competitors(id);')
      
      // Clean up competitor
      await supabase.from('competitors').delete().eq('id', competitor.id)
      return false
    }
    console.log('✅ Executions table working')

    // Test 3: Check if we can create scraped data
    console.log('\n3️⃣ Testing scraped_data table...')
    const { data: scrapedData, error: scrapedError } = await supabase
      .from('scraped_data')
      .insert({
        price: '999.99',
        stock: 1,
        raw_response: { test: true },
        competitor_id: competitor.id,
        execution_id: execution.id,
        product_id: null, // Allow null for unmatched products
        variant_id: null  // Allow null for unmatched variants
      })
      .select('id')
      .single()

    if (scrapedError) {
      console.error('❌ Scraped data table issue:', scrapedError.message)
      console.log('\n📋 You may need to run this SQL in Supabase dashboard:')
      console.log('ALTER TABLE public.scraped_data ADD COLUMN competitor_id uuid REFERENCES public.competitors(id);')
      console.log('ALTER TABLE public.scraped_data ADD COLUMN execution_id uuid REFERENCES public.executions(id);')
      
      // Clean up
      await supabase.from('executions').delete().eq('id', execution.id)
      await supabase.from('competitors').delete().eq('id', competitor.id)
      return false
    }
    console.log('✅ Scraped data table working')

    // Clean up test data
    console.log('\n🧹 Cleaning up test data...')
    await supabase.from('scraped_data').delete().eq('id', scrapedData.id)
    await supabase.from('executions').delete().eq('id', execution.id)
    await supabase.from('competitors').delete().eq('id', competitor.id)

    console.log('\n🎉 Database schema is ready for competitor sync!')
    return true

  } catch (error: any) {
    console.error('❌ Schema check failed:', error.message)
    return false
  }
}

async function main() {
  const success = await ensureSchema()
  
  if (success) {
    console.log('\n🚀 Ready to run competitor sync!')
    console.log('Try: npm run sync-reebelo')
  } else {
    console.log('\n❌ Schema needs to be fixed first.')
    console.log('Please run the SQL commands shown above in your Supabase dashboard.')
  }
  
  process.exit(success ? 0 : 1)
}

if (require.main === module) {
  main().catch(error => {
    console.error('💥 Schema check failed:', error)
    process.exit(1)
  })
}