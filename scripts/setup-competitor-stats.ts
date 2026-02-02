#!/usr/bin/env tsx

/**
 * Setup script to check and add competitor statistics columns
 */

import { createServiceClient } from '@/lib/supabase/script-client'
import { config } from 'dotenv'

// Load environment variables
config({ path: '.env.local' })
config({ path: '.env' })

async function checkCompetitorStats() {
  console.log('🔍 Checking competitor statistics columns...')
  
  const supabase = createServiceClient()
  
  try {
    // Try to select the columns to see if they exist
    const { data, error } = await supabase
      .from('competitors')
      .select('id, title, failed_executions, total_executions')
      .limit(1)

    if (error) {
      if (error.message.includes('failed_executions') || error.message.includes('total_executions')) {
        console.error('❌ Missing competitor statistics columns!')
        console.log('\n📋 Please run this SQL in your Supabase dashboard:')
        console.log('   ALTER TABLE public.competitors ADD COLUMN failed_executions numeric DEFAULT 0;')
        console.log('   ALTER TABLE public.competitors ADD COLUMN total_executions numeric DEFAULT 0;')
        console.log('\nOr copy and paste from: docs/supabase/add-competitor-stats.sql')
        return false
      } else {
        console.error('❌ Database error:', error.message)
        return false
      }
    }

    console.log('✅ Competitor statistics columns exist!')
    
    // Initialize any null values
    const { error: updateError } = await supabase
      .from('competitors')
      .update({
        failed_executions: 0,
        total_executions: 0
      })
      .is('failed_executions', null)

    if (updateError) {
      console.warn('⚠️ Could not initialize null values:', updateError.message)
    } else {
      console.log('✅ Initialized competitor statistics!')
    }

    return true

  } catch (error: any) {
    console.error('❌ Check failed:', error.message)
    return false
  }
}

async function main() {
  const success = await checkCompetitorStats()
  
  if (success) {
    console.log('\n🎉 System is ready for competitor sync!')
    console.log('Next: npm run sync-reebelo')
  }
  
  process.exit(success ? 0 : 1)
}

if (require.main === module) {
  main().catch(error => {
    console.error('💥 Check failed:', error)
    process.exit(1)
  })
}