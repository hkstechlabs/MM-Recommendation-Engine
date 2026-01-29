#!/usr/bin/env tsx

import MMSyncService from './mm-sync'

/**
 * Test script for MM Sync functionality
 * This script tests database connection and basic operations
 */
async function testMMSync() {
  console.log('🧪 Starting MM Sync Test...')
  
  const syncService = new MMSyncService()
  
  try {
    // Test database connection and schema
    console.log('\n📋 Testing database connection and schema...')
    const dbTestPassed = await (syncService as any).testDatabaseConnection()
    
    if (dbTestPassed) {
      console.log('✅ Database test passed! Schema is working correctly.')
      console.log('📝 Check the logs directory for detailed test logs.')
    } else {
      console.log('❌ Database test failed! Check the logs for details.')
      process.exit(1)
    }
    
  } catch (error) {
    console.error('🔥 Test failed with error:', error)
    process.exit(1)
  }
}

// Run the test
testMMSync()