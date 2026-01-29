#!/usr/bin/env npx tsx

import { createClient } from '@supabase/supabase-js'
import { config } from 'dotenv'

// Load environment variables
config({ path: '.env.local' })

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY!

console.log('🔍 Detailed Supabase Debug...')
console.log('URL:', supabaseUrl)
console.log('Service Role Key:', serviceRoleKey ? `${serviceRoleKey.substring(0, 20)}...` : 'NOT SET')

// Create client with service role key
const supabase = createClient(supabaseUrl, serviceRoleKey, {
  auth: {
    persistSession: false,
    autoRefreshToken: false
  }
})

async function debugSupabase() {
  try {
    console.log('\n📋 Testing basic connection...')
    
    // Test 1: Simple query to check connection
    const { data: healthCheck, error: healthError } = await supabase
      .from('products')
      .select('count')
      .limit(1)
    
    if (healthError) {
      console.log('❌ Health check failed:', healthError)
      
      // Try to get more details about the error
      console.log('Error details:', {
        message: healthError.message,
        details: healthError.details,
        hint: healthError.hint,
        code: healthError.code
      })
      
      // Test if we can access the database at all
      console.log('\n📋 Testing raw SQL query...')
      const { data: sqlTest, error: sqlError } = await supabase.rpc('version')
      
      if (sqlError) {
        console.log('❌ SQL test failed:', sqlError)
      } else {
        console.log('✅ SQL test passed:', sqlTest)
      }
      
      // Check if tables exist
      console.log('\n📋 Checking if tables exist...')
      const { data: tableCheck, error: tableError } = await supabase
        .from('information_schema.tables')
        .select('table_name')
        .eq('table_schema', 'public')
        .in('table_name', ['products', 'variants', 'competitors', 'executions', 'scraped_data'])
      
      if (tableError) {
        console.log('❌ Table check failed:', tableError)
      } else {
        console.log('✅ Tables found:', tableCheck?.map(t => t.table_name))
      }
      
    } else {
      console.log('✅ Health check passed')
    }
    
    // Test 2: Try to create the tables if they don't exist
    console.log('\n📋 Attempting to create tables from schema...')
    
    // Read and execute schema
    const fs = require('fs')
    const path = require('path')
    const schemaPath = path.join(process.cwd(), 'docs/supabase/schema.sql')
    
    if (fs.existsSync(schemaPath)) {
      const schema = fs.readFileSync(schemaPath, 'utf8')
      console.log('📄 Schema file found, length:', schema.length)
      
      // Split schema into individual statements
      const statements = schema
        .split(';')
        .map(s => s.trim())
        .filter(s => s.length > 0 && !s.startsWith('--'))
      
      console.log('📝 Found', statements.length, 'SQL statements')
      
      for (let i = 0; i < statements.length; i++) {
        const statement = statements[i]
        if (statement.toLowerCase().includes('create table')) {
          const tableName = statement.match(/create table (?:public\.)?(\w+)/i)?.[1]
          console.log(`\n📋 Creating table: ${tableName}`)
          
          try {
            const { error } = await supabase.rpc('exec_sql', { sql: statement })
            if (error) {
              console.log(`❌ Failed to create ${tableName}:`, error.message)
            } else {
              console.log(`✅ Created ${tableName}`)
            }
          } catch (err) {
            console.log(`❌ Exception creating ${tableName}:`, err)
          }
        }
      }
    } else {
      console.log('❌ Schema file not found at:', schemaPath)
    }
    
    // Test 3: Final connection test
    console.log('\n📋 Final connection test...')
    const { data: finalTest, error: finalError } = await supabase
      .from('products')
      .select('count')
      .limit(1)
    
    if (finalError) {
      console.log('❌ Final test failed:', finalError.message)
    } else {
      console.log('✅ Final test passed')
    }
    
  } catch (error) {
    console.error('🔥 Debug failed:', error)
  }
}

debugSupabase()