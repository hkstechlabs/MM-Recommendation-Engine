import { createServiceClient } from '@/lib/supabase/script-client'
import { config } from 'dotenv'
import { readFileSync } from 'fs'
import { join } from 'path'

// Load environment variables
config({ path: '.env.local' })

const supabase = createServiceClient()

async function setupOrderMetricsSchema(): Promise<void> {
  console.log('🚀 Setting up Order Metrics database schema...')

  try {
    // Read the schema SQL file
    const schemaPath = join(process.cwd(), 'docs', 'supabase', 'order-metrics-schema.sql')
    const schemaSql = readFileSync(schemaPath, 'utf8')

    // Split the SQL into individual statements
    const statements = schemaSql
      .split(';')
      .map(stmt => stmt.trim())
      .filter(stmt => stmt.length > 0 && !stmt.startsWith('--'))

    console.log(`📝 Executing ${statements.length} SQL statements...`)

    // Execute each statement
    for (let i = 0; i < statements.length; i++) {
      const statement = statements[i]
      
      if (statement.trim()) {
        try {
          console.log(`⚡ Executing statement ${i + 1}/${statements.length}...`)
          
          const { error } = await supabase.rpc('exec_sql', { 
            sql_query: statement + ';' 
          })

          if (error) {
            // Check if it's a "already exists" error, which we can ignore
            if (error.message.includes('already exists') || 
                error.message.includes('relation') && error.message.includes('already exists')) {
              console.log(`⚠️ Statement ${i + 1} - Object already exists, skipping...`)
              continue
            }
            throw error
          }

          console.log(`✅ Statement ${i + 1} executed successfully`)
          
        } catch (statementError) {
          console.error(`❌ Error executing statement ${i + 1}:`, (statementError as Error).message)
          console.error(`Statement: ${statement.substring(0, 100)}...`)
          
          // Continue with other statements unless it's a critical error
          if ((statementError as Error).message.includes('does not exist')) {
            throw statementError
          }
        }
      }
    }

    console.log('✅ Order Metrics schema setup completed!')

    // Verify tables were created
    await verifyTables()

  } catch (error) {
    console.error('💥 Schema setup failed:', (error as Error).message)
    throw error
  }
}

async function verifyTables(): Promise<void> {
  console.log('🔍 Verifying tables were created...')

  const expectedTables = [
    'orders',
    'order_line_items', 
    'product_metrics',
    'customer_metrics'
  ]

  for (const tableName of expectedTables) {
    try {
      const { data, error } = await supabase
        .from(tableName)
        .select('*')
        .limit(1)

      if (error) {
        console.error(`❌ Table '${tableName}' verification failed:`, error.message)
      } else {
        console.log(`✅ Table '${tableName}' exists and is accessible`)
      }
    } catch (error) {
      console.error(`❌ Error verifying table '${tableName}':`, (error as Error).message)
    }
  }
}

async function checkExistingSchema(): Promise<void> {
  console.log('🔍 Checking existing schema...')

  try {
    // Check if tables already exist
    const { data: tables, error } = await supabase
      .from('information_schema.tables')
      .select('table_name')
      .eq('table_schema', 'public')
      .in('table_name', ['orders', 'order_line_items', 'product_metrics', 'customer_metrics'])

    if (error) {
      console.log('⚠️ Could not check existing tables, proceeding with setup...')
      return
    }

    if (tables && tables.length > 0) {
      console.log('📋 Found existing order metrics tables:')
      tables.forEach(table => console.log(`  - ${table.table_name}`))
      console.log('🔄 Will update schema if needed...')
    } else {
      console.log('📋 No existing order metrics tables found, creating new schema...')
    }

  } catch (error) {
    console.log('⚠️ Could not check existing schema, proceeding with setup...')
  }
}

// Main execution
async function main(): Promise<void> {
  try {
    await checkExistingSchema()
    await setupOrderMetricsSchema()
    
    console.log('🎉 Order Metrics setup completed successfully!')
    console.log('📝 Next steps:')
    console.log('  1. Run: npm run order-metrics-sync')
    console.log('  2. Check the product_metrics table for calculated metrics')
    console.log('  3. Use the metrics in your recommendation system')
    
  } catch (error) {
    console.error('🔥 Setup failed:', error)
    process.exit(1)
  }
}

// Run if executed directly
if (require.main === module) {
  main()
}

export { setupOrderMetricsSchema, verifyTables }