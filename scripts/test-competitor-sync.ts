#!/usr/bin/env tsx

/**
 * Test script for the competitor sync system
 * Verifies database connectivity and basic functionality
 */

import { createServiceClient } from '@/lib/supabase/script-client'
import { config } from 'dotenv'

// Load environment variables
config({ path: '.env.local' })
config({ path: '.env' })

async function testDatabaseConnection() {
  console.log('🔍 Testing database connection...')
  
  const supabase = createServiceClient()
  
  try {
    // Test basic connectivity
    const { data, error } = await supabase
      .from('competitors')
      .select('*', { count: 'exact', head: true })

    if (error) {
      console.error('❌ Database connection failed:', error.message)
      return false
    }

    console.log('✅ Database connection successful')
    return true
  } catch (error: any) {
    console.error('❌ Database connection error:', error.message)
    return false
  }
}

async function testTableStructure() {
  console.log('🔍 Testing table structure...')
  
  const supabase = createServiceClient()
  
  const tables = ['competitors', 'executions', 'products', 'variants', 'scraped_data']
  
  for (const table of tables) {
    try {
      const { data, error } = await supabase
        .from(table)
        .select('*')
        .limit(1)

      if (error) {
        console.error(`❌ Table ${table} error:`, error.message)
        return false
      }

      console.log(`✅ Table ${table} accessible`)
    } catch (error: any) {
      console.error(`❌ Table ${table} error:`, error.message)
      return false
    }
  }

  return true
}

async function testProductsAndVariants() {
  console.log('🔍 Testing products and variants data...')
  
  const supabase = createServiceClient()
  
  try {
    const { data: products, error: productsError, count: productsCount } = await supabase
      .from('products')
      .select('*', { count: 'exact', head: true })

    if (productsError) {
      console.error('❌ Products query failed:', productsError.message)
      return false
    }

    const { data: variants, error: variantsError, count: variantsCount } = await supabase
      .from('variants')
      .select('*', { count: 'exact', head: true })

    if (variantsError) {
      console.error('❌ Variants query failed:', variantsError.message)
      return false
    }

    console.log(`✅ Found ${productsCount || 0} products, ${variantsCount || 0} variants`)
    
    if ((productsCount || 0) === 0) {
      console.warn('⚠️ No products found. Run MM sync first: npm run mm-sync')
    }

    return true
  } catch (error: any) {
    console.error('❌ Products/variants test failed:', error.message)
    return false
  }
}

async function testEnvironmentVariables() {
  console.log('🔍 Testing environment variables...')
  
  const required = [
    'NEXT_PUBLIC_SUPABASE_URL',
    'SUPABASE_SERVICE_ROLE_KEY'
  ]

  const optional = [
    'REEBELO_API_KEY'
  ]

  let allGood = true

  for (const envVar of required) {
    if (!process.env[envVar]) {
      console.error(`❌ Missing required environment variable: ${envVar}`)
      allGood = false
    } else {
      console.log(`✅ ${envVar} is set`)
    }
  }

  for (const envVar of optional) {
    if (!process.env[envVar]) {
      console.warn(`⚠️ Optional environment variable not set: ${envVar}`)
    } else {
      console.log(`✅ ${envVar} is set`)
    }
  }

  return allGood
}

async function main() {
  console.log('🚀 Testing Competitor Sync System')
  console.log('=' .repeat(50))

  const tests = [
    { name: 'Environment Variables', fn: testEnvironmentVariables },
    { name: 'Database Connection', fn: testDatabaseConnection },
    { name: 'Table Structure', fn: testTableStructure },
    { name: 'Products and Variants', fn: testProductsAndVariants }
  ]

  let allPassed = true

  for (const test of tests) {
    console.log(`\n📋 ${test.name}`)
    const passed = await test.fn()
    if (!passed) {
      allPassed = false
    }
  }

  console.log('\n' + '='.repeat(50))
  
  if (allPassed) {
    console.log('🎉 All tests passed! System is ready for competitor sync.')
    console.log('\nNext steps:')
    console.log('1. Run: npm run sync-all-competitors')
    console.log('2. Check: npm run competitor-stats')
  } else {
    console.log('❌ Some tests failed. Please fix the issues above.')
    process.exit(1)
  }
}

if (require.main === module) {
  main().catch(error => {
    console.error('💥 Test failed:', error)
    process.exit(1)
  })
}