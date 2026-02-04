import { createServiceClient } from '@/lib/supabase/script-client'
import { config } from 'dotenv'
import { ReebeloScraper } from './scrapers/ReebeloScraper'
import { GreenGadgetsScraper } from './scrapers/GreenGadgetsScraper'
import { BaseScraper, ScraperResult } from './scrapers/BaseScraper'

// Load environment variables
config({ path: '.env.local' })
config({ path: '.env' })

interface CompetitorSyncStats {
  totalScrapers: number
  successfulScrapers: number
  failedScrapers: number
  totalDataPoints: number
  totalErrors: number
  duration: number
  results: ScraperResult[]
}

class CompetitorSyncService {
  private supabase = createServiceClient()
  private scrapers: BaseScraper[] = []

  constructor() {
    // Initialize all scrapers
    this.scrapers = [
      new ReebeloScraper(this.supabase),
      new GreenGadgetsScraper(this.supabase)
    ]
  }

  /**
   * Run all scrapers in parallel
   */
  async runAllScrapers(): Promise<CompetitorSyncStats> {
    const startTime = Date.now()
    console.log(`🚀 Starting competitor sync with ${this.scrapers.length} scrapers`)

    const results: ScraperResult[] = []
    const errors: string[] = []
    let successfulScrapers = 0
    let totalDataPoints = 0

    // Run scrapers in parallel for better performance
    const scraperPromises = this.scrapers.map(async (scraper) => {
      try {
        console.log(`🔄 Starting ${scraper.constructor.name}...`)
        const result = await scraper.run()
        results.push(result)
        totalDataPoints += result.data.length
        successfulScrapers++
        console.log(`✅ ${scraper.constructor.name} completed: ${result.data.length} data points`)
        return result
      } catch (error: any) {
        const errorMsg = `${scraper.constructor.name}: ${error.message}`
        errors.push(errorMsg)
        console.error(`❌ ${errorMsg}`)
        return null
      }
    })

    await Promise.allSettled(scraperPromises)

    const duration = Date.now() - startTime
    const stats: CompetitorSyncStats = {
      totalScrapers: this.scrapers.length,
      successfulScrapers,
      failedScrapers: this.scrapers.length - successfulScrapers,
      totalDataPoints,
      totalErrors: errors.length,
      duration,
      results: results.filter(r => r !== null)
    }

    this.logSummary(stats)
    return stats
  }

  /**
   * Run a specific scraper by name
   */
  async runScraper(scraperName: string): Promise<ScraperResult> {
    const scraper = this.scrapers.find(s => 
      s.constructor.name.toLowerCase().includes(scraperName.toLowerCase())
    )

    if (!scraper) {
      throw new Error(`Scraper '${scraperName}' not found. Available: ${this.scrapers.map(s => s.constructor.name).join(', ')}`)
    }

    console.log(`🔄 Running ${scraper.constructor.name}...`)
    const result = await scraper.run()
    console.log(`✅ ${scraper.constructor.name} completed: ${result.data.length} data points`)
    
    return result
  }

  /**
   * Log comprehensive summary
   */
  private logSummary(stats: CompetitorSyncStats): void {
    console.log('\n' + '='.repeat(60))
    console.log('🎉 COMPETITOR SYNC SUMMARY')
    console.log('='.repeat(60))
    console.log(`⏱️  Duration: ${Math.round(stats.duration / 1000)}s`)
    console.log(`🤖 Scrapers: ${stats.successfulScrapers}/${stats.totalScrapers} successful`)
    console.log(`📊 Data Points: ${stats.totalDataPoints} total`)
    console.log(`❌ Errors: ${stats.totalErrors}`)
    
    if (stats.results.length > 0) {
      console.log('\n📋 SCRAPER DETAILS:')
      stats.results.forEach(result => {
        console.log(`   ${result.competitor}: ${result.success_count}/${result.total_processed} successful, ${result.data.length} data points`)
        if (result.errors.length > 0) {
          console.log(`      Errors: ${result.errors.slice(0, 3).join(', ')}${result.errors.length > 3 ? '...' : ''}`)
        }
      })
    }
    
    console.log('='.repeat(60))
  }

  /**
   * Get recent scraping statistics
   */
  async getRecentStats(hours: number = 24): Promise<any> {
    const since = new Date(Date.now() - hours * 60 * 60 * 1000).toISOString()
    
    const { data, error } = await this.supabase
      .from('executions')
      .select(`
        id,
        start_time,
        end_time,
        status,
        competitor:competitors(title),
        scraped_data_count:scraped_data(count)
      `)
      .gte('start_time', since)
      .order('start_time', { ascending: false })

    if (error) {
      console.error('Failed to get recent stats:', error)
      return null
    }

    return data
  }
}
// Export for use as module
export default CompetitorSyncService

// CLI interface when run directly
if (require.main === module) {
  const syncService = new CompetitorSyncService()
  
  const args = process.argv.slice(2)
  const command = args[0]
  const scraperName = args[1]

  async function main() {
    try {
      switch (command) {
        case 'all':
          await syncService.runAllScrapers()
          break
          
        case 'scraper':
          if (!scraperName) {
            console.error('❌ Please specify a scraper name: reebelo, greengadgets')
            process.exit(1)
          }
          await syncService.runScraper(scraperName)
          break
          
        case 'stats':
          const hours = parseInt(scraperName) || 24
          const stats = await syncService.getRecentStats(hours)
          console.log('📊 Recent Stats:', JSON.stringify(stats, null, 2))
          break
          
        default:
          console.log('🤖 Competitor Sync Tool')
          console.log('')
          console.log('Usage:')
          console.log('  npm run competitor-sync all              # Run all scrapers')
          console.log('  npm run competitor-sync scraper reebelo  # Run specific scraper')
          console.log('  npm run competitor-sync stats [hours]    # Show recent stats')
          console.log('')
          console.log('Available scrapers: reebelo, greengadgets')
          break
      }
    } catch (error: any) {
      console.error('💥 Sync failed:', error.message)
      process.exit(1)
    }
  }

  main()
}