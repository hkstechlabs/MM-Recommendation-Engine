#!/usr/bin/env tsx

/**
 * Fix executions table to add missing competitor_id column
 */

import { createServiceClient } from '@/lib/supabase/script-client'
import { config } from 'dotenv'

// Load environment variables
config({ path: '.env.local' })
config({ path: '.env' })

async function fixExecutionsTable() {
  console.log('🔧 Checking and fixing executions table...')
  
  const supabase = createServiceClient()
  
  try {
    // Try to select competitor_id to see if it exists
    const { data, error } = await supabase
      .from('executions')
      .select('id, competitor_id')
      .limit(1)

    if (error) {
      if (error.message.includes('competitor_id')) {
        console.error('❌ Missing competitor_id column in executions table!')
        console.log('\n📋 Please run this SQL in your Supabase dashboard:')
        console.log('   ALTER TABLE public.executions ADD COLUMN competitor_id uuid REFERENCES public.competitors(id);')
        console.log('   CREATE INDEX idx_executions_competitor_id ON public.executions(competitor_id);')
        return false
      } else {
        console.error('❌ Database error:', error.message)
        return false
      }
    }

    console.log('✅ Executions table has competitor_id column!')
    return true

  } catch (error: any) {
    console.error('❌ Check failed:', error.message)
    return false
  }
}

async function main() {
  const success = await fixExecutionsTable()
  
  if (success) {
    console.log('\n🎉 Executions table is ready!')
    console.log('Next: npm run sync-reebelo')
  }
  
  process.exit(success ? 0 : 1)
}

if (require.main === module) {
  main().catch(error => {
    console.error('💥 Fix failed:', error)
    process.exit(1)
  })
}