# Competitor Sync System

A modern, optimized competitor data scraping system that integrates with the new Supabase schema for efficient bulk data operations.

## Overview

The system consists of:
- **Modern TypeScript scrapers** using the new schema
- **Bulk Supabase operations** for optimal performance
- **Execution tracking** with comprehensive logging
- **Error handling** and retry mechanisms
- **Cron job support** for automated syncing

## Architecture

```
┌─────────────────┐    ┌──────────────────┐    ┌─────────────────┐
│   Competitors   │    │    Executions    │    │  Scraped Data   │
│                 │    │                  │    │                 │
│ - id (uuid)     │◄───┤ - competitor_id  │◄───┤ - execution_id  │
│ - title         │    │ - start_time     │    │ - price         │
│ - executions    │    │ - end_time       │    │ - stock         │
│                 │    │ - status         │    │ - raw_response  │
└─────────────────┘    └──────────────────┘    └─────────────────┘
                                                        │
                       ┌─────────────────┐             │
                       │    Products     │◄────────────┤
                       │                 │             │
                       │ - id (uuid)     │             │
                       │ - product_id    │             │
                       │ - title         │             │
                       └─────────────────┘             │
                                │                      │
                       ┌─────────────────┐             │
                       │    Variants     │◄────────────┘
                       │                 │
                       │ - id (uuid)     │
                       │ - variant_id    │
                       │ - product_id    │
                       │ - sku           │
                       └─────────────────┘
```

## Quick Start

### 1. Install Dependencies

```bash
npm install axios
```

### 2. Set Environment Variables

Add to your `.env.local`:

```env
# Reebelo API (optional, has default)
REEBELO_API_KEY=your_reebelo_api_key

# Supabase (required)
NEXT_PUBLIC_SUPABASE_URL=your_supabase_url
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key
```

### 3. Set Up Database Functions

Run the SQL functions in your Supabase dashboard:

```bash
# Apply the competitor functions
cat docs/supabase/competitor-functions.sql | supabase db reset --db-url "your_db_url"
```

### 4. Run Scrapers

```bash
# Run all scrapers
npm run sync-all-competitors

# Run specific scraper
npm run sync-reebelo
npm run sync-greengadgets

# Check recent stats
npm run competitor-stats
```

## Available Scripts

| Script | Description |
|--------|-------------|
| `npm run sync-all-competitors` | Run all scrapers in parallel |
| `npm run sync-reebelo` | Run only Reebelo scraper |
| `npm run sync-greengadgets` | Run only Green Gadgets scraper |
| `npm run competitor-stats` | Show recent execution statistics |
| `npm run competitor-cron` | Run cron job version with logging |
| `npm run competitor-health` | Health check for monitoring |

## Scrapers

### Reebelo Scraper

- **Data Source**: Reebelo API (`https://a.reebelo.com/sockets/offers`)
- **Matching**: SKU-based with attribute fallback
- **Rate Limiting**: 100ms between requests, 1s between batches
- **Features**: Pagination support, condition/storage/color matching

### Green Gadgets Scraper

- **Data Source**: Shopify JSON API (`https://shop.greengadgets.net.au/products/{handle}.json`)
- **Matching**: SKU-based with attribute fallback
- **Rate Limiting**: 500ms between requests
- **Features**: Product handle-based scraping, variant attribute matching

## Cron Job Setup

### Daily Sync (Recommended)

```bash
# Add to crontab (crontab -e)
0 2 * * * cd /path/to/your/project && npm run competitor-cron >> logs/competitor-sync.log 2>&1
```

### Every 6 Hours

```bash
0 */6 * * * cd /path/to/your/project && npm run competitor-cron >> logs/competitor-sync.log 2>&1
```

### Health Check

```bash
# Check every hour
0 * * * * cd /path/to/your/project && npm run competitor-health
```

## Monitoring

### Log Files

Logs are automatically created in the `logs/` directory:
- `logs/competitor-sync-YYYY-MM-DD.log` - Daily log files
- Structured JSON logging for easy parsing
- Automatic log rotation by date

### Database Monitoring

```sql
-- Check recent executions
SELECT * FROM get_competitor_stats(24);

-- View execution details
SELECT 
  c.title,
  e.status,
  e.start_time,
  e.end_time,
  COUNT(sd.id) as data_points
FROM competitors c
JOIN executions e ON c.id = e.competitor_id
LEFT JOIN scraped_data sd ON e.id = sd.execution_id
WHERE e.start_time >= NOW() - INTERVAL '24 hours'
GROUP BY c.title, e.id, e.status, e.start_time, e.end_time
ORDER BY e.start_time DESC;
```

## Performance

### Optimizations

- **Bulk Operations**: Uses Supabase bulk insert for maximum performance
- **Parallel Processing**: Scrapers run in parallel when using "all" command
- **Batch Processing**: Large datasets processed in batches of 1000 records
- **Connection Pooling**: Reuses Supabase connections efficiently

### Expected Performance

- **Reebelo**: ~50-100 SKUs per minute
- **Green Gadgets**: ~20-30 products per minute
- **Database Inserts**: ~1000 records per second

## Error Handling

### Automatic Retry

- Network timeouts: 3 retries with exponential backoff
- Rate limiting: Automatic delay and retry
- Database errors: Logged and execution marked as failed

### Error Tracking

All errors are:
- Logged to execution records in database
- Written to log files with full stack traces
- Counted in competitor statistics
- Available via the stats API

## Extending the System

### Adding New Scrapers

1. Create a new scraper class extending `BaseScraper`:

```typescript
import { BaseScraper, ScraperResult } from './BaseScraper'

export class NewScraper extends BaseScraper {
  constructor(supabase: SupabaseClient) {
    super('new-scraper', supabase)
  }

  async scrape(): Promise<ScraperResult> {
    // Your scraping logic here
    return {
      competitor: this.name,
      execution_id: this.executionId!,
      data: [], // Your scraped data
      errors: [],
      total_processed: 0,
      success_count: 0
    }
  }
}
```

2. Add to the main sync service:

```typescript
// In competitor-sync.ts
this.scrapers = [
  new ReebeloScraper(this.supabase),
  new GreenGadgetsScraper(this.supabase),
  new NewScraper(this.supabase) // Add your scraper
]
```

3. Add npm script:

```json
{
  "sync-newscraper": "tsx scripts/competitor-sync.ts scraper newscraper"
}
```

## Troubleshooting

### Common Issues

1. **No data scraped**: Check if products/variants exist in database
2. **Rate limiting**: Increase delays in scraper configuration
3. **Database errors**: Verify Supabase connection and permissions
4. **Memory issues**: Reduce batch sizes in scrapers

### Debug Mode

Enable detailed logging:

```bash
DEBUG=1 npm run sync-all-competitors
```

### Health Checks

```bash
# Check system health
npm run competitor-health

# View recent stats
npm run competitor-stats
```

## API Reference

### CompetitorSyncService

```typescript
class CompetitorSyncService {
  // Run all scrapers
  async runAllScrapers(): Promise<CompetitorSyncStats>
  
  // Run specific scraper
  async runScraper(scraperName: string): Promise<ScraperResult>
  
  // Get recent statistics
  async getRecentStats(hours: number = 24): Promise<any>
}
```

### BaseScraper

```typescript
abstract class BaseScraper {
  // Initialize competitor and execution records
  async initialize(): Promise<void>
  
  // Update execution status
  async updateExecution(status: 'completed' | 'failed', errorMsg?: any): Promise<void>
  
  // Bulk insert scraped data
  async bulkInsertScrapedData(data: ScrapedDataPoint[]): Promise<void>
  
  // Get product/variant mappings
  async getProductMappings(): Promise<{products: Map<number, string>, variants: Map<number, string>}>
  
  // Main scraping method (implement in subclass)
  abstract scrape(): Promise<ScraperResult>
  
  // Run with error handling
  async run(): Promise<ScraperResult>
}
```