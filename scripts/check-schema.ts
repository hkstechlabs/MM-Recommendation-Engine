#!/usr/bin/env tsx

/**
 * Check current database schema
 */

import { createServiceClient } from '@/lib/supabase/script-client'
import { config } from 'dotenv'

// Load environment variables
config({ path: '.env.local' })
config({ path: '.env' })

async function checkSchema() {
  console.log('🔍 Checking database schema...')
  
  const supabase = createServiceClient()
  
  const tables = ['competitors', 'executions', 'products', 'variants', 'scraped_data']
  
  for (const table of tables) {
    try {
      console.log(`\n📋 Table: ${table}`)
      
      // Get first row to see structure
      const { data, error } = await supabase
        .from(table)
        .select('*')
        .limit(1)

      if (error) {
        console.error(`❌ Error querying ${table}:`, error.message)
        continue
      }

      if (data && data.length > 0) {
        const columns = Object.keys(data[0])
        console.log(`   Columns: ${columns.join(', ')}`)
      } else {
        console.log(`   No data in ${table}`)
        
        // Try to get column info from information_schema
        const { data: schemaData, error: schemaError } = await supabase
          .rpc('exec_sql', {
            sql: `SELECT column_name, data_type FROM information_schema.columns WHERE table_name = '${table}' ORDER BY ordinal_position`
          })

        if (!schemaError && schemaData) {
          console.log(`   Schema columns:`, schemaData)
        }
      }

    } catch (error: any) {
      console.error(`❌ Failed to check ${table}:`, error.message)
    }
  }
}

async function main() {
  await checkSchema()
}

if (require.main === module) {
  main().catch(error => {
    console.error('💥 Check failed:', error)
    process.exit(1)
  })
}