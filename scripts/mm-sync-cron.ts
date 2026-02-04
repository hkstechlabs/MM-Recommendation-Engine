#!/usr/bin/env node

/**
 * MM Sync Cron Job Script
 * 
 * This script is optimized for cron job execution with:
 * - Automatic constraint detection
 * - Error handling and recovery
 * - Performance logging
 * - Exit codes for monitoring
 */

import MMSyncServiceWithUpsert from './mm-sync-with-upsert'

async function runCronSync() {
  const startTime = new Date()
  console.log(`🕐 MM Sync Cron Job Started: ${startTime.toISOString()}`)
  
  try {
    const syncService = new MMSyncServiceWithUpsert()
    await syncService.sync()
    
    const endTime = new Date()
    const duration = Math.round((endTime.getTime() - startTime.getTime()) / 1000)
    
    console.log(`✅ MM Sync Cron Job Completed Successfully`)
    console.log(`⏱️  Total Duration: ${duration} seconds`)
    console.log(`🕐 Completed At: ${endTime.toISOString()}`)
    
    // Exit with success code
    process.exit(0)
    
  } catch (error) {
    const endTime = new Date()
    const duration = Math.round((endTime.getTime() - startTime.getTime()) / 1000)
    
    console.error(`❌ MM Sync Cron Job Failed`)
    console.error(`💥 Error: ${(error as Error).message}`)
    console.error(`⏱️  Duration Before Failure: ${duration} seconds`)
    console.error(`🕐 Failed At: ${endTime.toISOString()}`)
    
    // Exit with error code for cron monitoring
    process.exit(1)
  }
}

// Handle process signals gracefully
process.on('SIGINT', () => {
  console.log('🛑 MM Sync interrupted by SIGINT')
  process.exit(130)
})

process.on('SIGTERM', () => {
  console.log('🛑 MM Sync terminated by SIGTERM')
  process.exit(143)
})

// Run the cron sync
runCronSync()