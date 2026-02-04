#!/usr/bin/env tsx

/**
 * Check what columns actually exist in each table
 */

import { createServiceClient } from '@/lib/supabase/script-client'
import { config } from 'dotenv'

// Load environment variables
config({ path: '.env.local' })
config({ path: '.env' })

async function checkActualSchema() {
  console.log('🔍 Checking actual database schema...')
  
  const supabase = createServiceClient()
  
  const tables = ['competitors', 'executions', 'scraped_data']
  
  for (const table of tables) {
    try {
      console.log(`\n📋 Table: ${table}`)
      
      // Try to insert a minimal record to see what columns are required/available
      let testRecord: any = {}
      
      if (table === 'competitors') {
        testRecord = { title: 'test-schema-check' }
      } else if (table === 'executions') {
        testRecord = { status: 'test' }
      } else if (table === 'scraped_data') {
        testRecord = { price: '0', stock: 0 }
      }

      const { data, error } = await supabase
        .from(table)
        .insert([testRecord])
        .select('*')

      if (error) {
        console.error(`❌ Insert failed for ${table}:`, error.message)
        
        // Try to get schema info differently
        const { data: sample, error: selectError } = await supabase
          .from(table)
          .select('*')
          .limit(1)

        if (!selectError && sample && sample.length > 0) {
          console.log(`   Available columns: ${Object.keys(sample[0]).join(', ')}`)
        }
      } else {
        console.log(`✅ Insert successful for ${table}`)
        if (data && data.length > 0) {
          console.log(`   Columns: ${Object.keys(data[0]).join(', ')}`)
          
          // Clean up test record
          await supabase.from(table).delete().eq('id', data[0].id)
        }
      }

    } catch (error: any) {
      console.error(`❌ Failed to check ${table}:`, error.message)
    }
  }
}

async function main() {
  await checkActualSchema()
}

if (require.main === module) {
  main().catch(error => {
    console.error('💥 Check failed:', error)
    process.exit(1)
  })
}