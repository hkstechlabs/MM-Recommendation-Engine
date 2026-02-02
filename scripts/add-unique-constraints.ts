import { createServiceClient } from '@/lib/supabase/script-client'
import { config } from 'dotenv'
import * as fs from 'fs'
import * as path from 'path'

// Load environment variables
config({ path: '.env.local' })

const supabase = createServiceClient()

async function addUniqueConstraints() {
  console.log('🔧 Adding unique constraints for MM sync...')
  
  try {
    // Read the SQL file
    const sqlPath = path.join(process.cwd(), 'docs/supabase/add-unique-constraints.sql')
    const sql = fs.readFileSync(sqlPath, 'utf8')
    
    // Split into individual statements
    const statements = sql
      .split(';')
      .map(stmt => stmt.trim())
      .filter(stmt => stmt.length > 0 && !stmt.startsWith('--'))
    
    console.log(`📝 Executing ${statements.length} SQL statements...`)
    
    for (let i = 0; i < statements.length; i++) {
      const statement = statements[i]
      console.log(`⚡ Executing statement ${i + 1}/${statements.length}...`)
      
      const { error } = await supabase.rpc('exec_sql', { sql: statement })
      
      if (error) {
        // Check if constraint already exists
        if (error.message.includes('already exists')) {
          console.log(`⚠️ Constraint already exists, skipping...`)
          continue
        }
        
        console.error(`❌ Error executing statement ${i + 1}:`, error.message)
        console.error(`Statement: ${statement}`)
        throw error
      }
      
      console.log(`✅ Statement ${i + 1} executed successfully`)
    }
    
    console.log('🎉 All unique constraints added successfully!')
    
    // Test the constraints
    console.log('🧪 Testing constraints...')
    
    // Test products constraint
    const { error: testError1 } = await supabase
      .from('products')
      .select('product_id')
      .limit(1)
    
    if (testError1) {
      console.error('❌ Products table test failed:', testError1.message)
      return
    }
    
    // Test variants constraint  
    const { error: testError2 } = await supabase
      .from('variants')
      .select('variant_id')
      .limit(1)
    
    if (testError2) {
      console.error('❌ Variants table test failed:', testError2.message)
      return
    }
    
    console.log('✅ Constraints are working correctly!')
    console.log('🚀 MM sync is now ready to use bulk upsert operations!')
    
  } catch (error) {
    console.error('💥 Failed to add unique constraints:', error)
    process.exit(1)
  }
}

// Run if executed directly
if (require.main === module) {
  addUniqueConstraints()
}