#!/usr/bin/env tsx

/**
 * Competitor Sync Cron Job
 * 
 * This script is designed to be run as a cron job for automated competitor data syncing.
 * It includes comprehensive logging, error handling, and notification capabilities.
 * 
 * Usage:
 *   # Run all scrapers
 *   tsx scripts/competitor-sync-cron.ts
 * 
 *   # Run specific scraper
 *   tsx scripts/competitor-sync-cron.ts reebelo
 * 
 * Cron examples:
 *   # Every 6 hours
 *   0 */6 * * * cd /path/to/project && npm run competitor-sync >> logs/competitor-sync.log 2>&1
 * 
 *   # Daily at 2 AM
 *   0 2 * * * cd /path/to/project && npm run competitor-sync >> logs/competitor-sync.log 2>&1
 */

import { writeFileSync, appendFileSync, existsSync, mkdirSync } from 'fs'
import { join } from 'path'
import CompetitorSyncService from './competitor-sync'

interface CronLogEntry {
  timestamp: string
  level: 'INFO' | 'WARN' | 'ERROR'
  message: string
  data?: any
}

class CompetitorSyncCron {
  private logDir = 'logs'
  private logFile = join(this.logDir, `competitor-sync-${new Date().toISOString().split('T')[0]}.log`)
  private syncService = new CompetitorSyncService()

  constructor() {
    this.ensureLogDirectory()
  }

  private ensureLogDirectory(): void {
    if (!existsSync(this.logDir)) {
      mkdirSync(this.logDir, { recursive: true })
    }
  }

  private log(level: CronLogEntry['level'], message: string, data?: any): void {
    const entry: CronLogEntry = {
      timestamp: new Date().toISOString(),
      level,
      message,
      data
    }

    const logLine = `[${entry.timestamp}] ${entry.level}: ${entry.message}${
      entry.data ? ` | ${JSON.stringify(entry.data)}` : ''
    }\n`

    // Write to console
    console.log(logLine.trim())

    // Append to log file
    try {
      appendFileSync(this.logFile, logLine)
    } catch (error) {
      console.error('Failed to write to log file:', error)
    }
  }

  async runSync(scraperName?: string): Promise<void> {
    const startTime = Date.now()
    this.log('INFO', `Starting competitor sync cron job${scraperName ? ` for ${scraperName}` : ''}`)

    try {
      let result
      
      if (scraperName) {
        this.log('INFO', `Running specific scraper: ${scraperName}`)
        result = await this.syncService.runScraper(scraperName)
        
        this.log('INFO', 'Scraper completed successfully', {
          scraper: scraperName,
          dataPoints: result.data.length,
          successRate: `${result.success_count}/${result.total_processed}`,
          errors: result.errors.length
        })
      } else {
        this.log('INFO', 'Running all scrapers')
        const stats = await this.syncService.runAllScrapers()
        
        this.log('INFO', 'All scrapers completed', {
          totalScrapers: stats.totalScrapers,
          successful: stats.successfulScrapers,
          failed: stats.failedScrapers,
          totalDataPoints: stats.totalDataPoints,
          duration: `${Math.round(stats.duration / 1000)}s`
        })

        // Log individual scraper results
        stats.results.forEach(result => {
          this.log('INFO', `Scraper result: ${result.competitor}`, {
            dataPoints: result.data.length,
            successRate: `${result.success_count}/${result.total_processed}`,
            errors: result.errors.length
          })
        })
      }

      const duration = Date.now() - startTime
      this.log('INFO', `Competitor sync cron job completed successfully in ${Math.round(duration / 1000)}s`)

    } catch (error: any) {
      const duration = Date.now() - startTime
      this.log('ERROR', 'Competitor sync cron job failed', {
        error: error.message,
        stack: error.stack,
        duration: `${Math.round(duration / 1000)}s`
      })
      
      // Exit with error code for cron monitoring
      process.exit(1)
    }
  }

  async healthCheck(): Promise<boolean> {
    try {
      this.log('INFO', 'Running health check')
      
      // Check recent stats to ensure system is working
      const stats = await this.syncService.getRecentStats(24)
      
      if (!stats || stats.length === 0) {
        this.log('WARN', 'No recent execution data found')
        return false
      }

      const recentFailures = stats.filter((s: any) => s.status === 'failed').length
      const totalRecent = stats.length
      const failureRate = recentFailures / totalRecent

      if (failureRate > 0.5) {
        this.log('WARN', 'High failure rate detected', {
          failures: recentFailures,
          total: totalRecent,
          failureRate: `${Math.round(failureRate * 100)}%`
        })
        return false
      }

      this.log('INFO', 'Health check passed', {
        recentExecutions: totalRecent,
        failures: recentFailures,
        failureRate: `${Math.round(failureRate * 100)}%`
      })
      
      return true
    } catch (error: any) {
      this.log('ERROR', 'Health check failed', { error: error.message })
      return false
    }
  }
}

// Main execution
async function main() {
  const cron = new CompetitorSyncCron()
  const args = process.argv.slice(2)
  const command = args[0]

  switch (command) {
    case 'health':
      const isHealthy = await cron.healthCheck()
      process.exit(isHealthy ? 0 : 1)
      break
      
    case 'reebelo':
    case 'greengadgets':
      await cron.runSync(command)
      break
      
    default:
      await cron.runSync()
      break
  }
}

// Handle uncaught errors
process.on('uncaughtException', (error) => {
  console.error('Uncaught Exception:', error)
  process.exit(1)
})

process.on('unhandledRejection', (reason, promise) => {
  console.error('Unhandled Rejection at:', promise, 'reason:', reason)
  process.exit(1)
})

if (require.main === module) {
  main().catch(error => {
    console.error('Fatal error:', error)
    process.exit(1)
  })
}