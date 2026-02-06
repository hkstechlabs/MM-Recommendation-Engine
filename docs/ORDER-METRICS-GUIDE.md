# Order Metrics & Recommendation System

This system fetches order data from Shopify, calculates key metrics, and provides recommendation scores for your e-commerce platform.

## Overview

The system consists of:
1. **Database Schema** - Tables to store orders, line items, and calculated metrics
2. **Sync Service** - Fetches orders from Shopify API and calculates metrics
3. **API Endpoints** - Serves metrics data for your application
4. **CLI Tools** - Scripts to manage and view metrics

## Quick Start

### 1. Setup Database Schema

```bash
npm run setup-order-metrics
```

This creates the following tables:
- `orders` - Raw order data from Shopify
- `order_line_items` - Individual line items from orders
- `product_metrics` - Calculated metrics per product/period
- `customer_metrics` - Customer behavior metrics

### 2. Sync Order Data

```bash
# Sync first 100 orders (for testing)
npm run order-metrics-sync 100

# Sync all orders
npm run order-metrics-sync
```

### 3. View Calculated Metrics

```bash
# View summary
npm run view-metrics summary

# View top 20 products
npm run view-metrics top 20

# View trending products
npm run view-metrics trending

# Search for specific products
npm run view-metrics search "iPhone"
```

## Calculated Metrics

### Product Metrics

For each product and time period (daily, weekly, monthly, all-time):

- **Sales Metrics**
  - `total_orders` - Number of orders containing this product
  - `total_quantity_sold` - Total units sold
  - `total_revenue` - Total revenue generated
  - `average_order_value` - Average value per order

- **Performance Metrics**
  - `conversion_rate` - Purchase rate (future enhancement)
  - `return_rate` - Return/refund rate (future enhancement)

- **Popularity Metrics**
  - `view_count` - Product page views (future enhancement)
  - `add_to_cart_count` - Cart additions (future enhancement)
  - `purchase_count` - Actual purchases

- **Recommendation Scores**
  - `popularity_score` - Based on sales volume and order count
  - `trending_score` - Based on recent sales velocity
  - `recommendation_score` - Weighted combination of all factors

### Customer Metrics

- `total_orders` - Number of orders placed
- `total_spent` - Total amount spent
- `average_order_value` - Average spend per order
- `loyalty_score` - Customer loyalty rating
- `churn_risk_score` - Risk of customer leaving

## API Endpoints

### GET /api/metrics

Query parameters:
- `type` - Type of metrics (products, trending, recommendations, summary, customers)
- `period` - Time period (daily, weekly, monthly, all_time)
- `limit` - Number of results (default: 20)
- `sortBy` - Sort field (recommendation_score, popularity_score, etc.)
- `minScore` - Minimum score threshold
- `search` - Search term for product titles
- `category` - Filter by product type
- `vendor` - Filter by vendor

### Examples

```javascript
// Get top 10 products by recommendation score
fetch('/api/metrics?type=products&limit=10&sortBy=recommendation_score')

// Get trending products
fetch('/api/metrics?type=trending&limit=15')

// Get recommendations for a specific product
fetch('/api/metrics?type=recommendations&productId=123&limit=5')

// Get recommendations for a customer
fetch('/api/metrics?type=recommendations&customerId=456&limit=10')

// Search for iPhone products
fetch('/api/metrics?type=products&search=iPhone&limit=20')

// Get monthly metrics for a specific vendor
fetch('/api/metrics?type=products&period=monthly&vendor=Apple&limit=50')

// Get summary statistics
fetch('/api/metrics?type=summary')
```

## Recommendation Algorithm

The system calculates recommendation scores using:

1. **Popularity Score** (40% weight)
   - Based on total quantity sold and order count
   - Formula: `min(100, (quantity_sold * 0.1) + (order_count * 0.5))`

2. **Trending Score** (30% weight)
   - Based on recent sales velocity (last 30 days)
   - Formula: `min(100, recent_quantity * 2)`

3. **Revenue Impact** (30% weight)
   - Based on average order value
   - Formula: `min(30, average_order_value / 10)`

**Final Score**: `(popularity * 0.4) + (trending * 0.3) + (revenue * 0.3)`

## Database Schema

### Orders Table
```sql
CREATE TABLE orders (
  id uuid PRIMARY KEY,
  order_id bigint UNIQUE,
  order_number text,
  customer_id bigint,
  total_price numeric(10,2),
  financial_status text,
  created_at_shopify timestamp,
  -- ... other fields
);
```

### Product Metrics Table
```sql
CREATE TABLE product_metrics (
  id uuid PRIMARY KEY,
  product_id uuid REFERENCES products(id),
  period_type text, -- 'daily', 'weekly', 'monthly', 'all_time'
  total_orders integer,
  total_quantity_sold integer,
  total_revenue numeric(10,2),
  popularity_score numeric(5,2),
  trending_score numeric(5,2),
  recommendation_score numeric(5,2),
  -- ... other metrics
);
```

## Automation

### Cron Jobs

Set up automated syncing:

```bash
# Add to crontab for daily sync at 2 AM
0 2 * * * cd /path/to/your/app && npm run order-metrics-sync

# Weekly full sync on Sundays at 3 AM
0 3 * * 0 cd /path/to/your/app && npm run order-metrics-sync 0
```

### Webhooks (Future Enhancement)

Consider setting up Shopify webhooks for real-time updates:
- `orders/create` - New order created
- `orders/updated` - Order status changed
- `orders/paid` - Payment completed

## Performance Considerations

1. **Batch Processing** - Orders are processed in batches of 100
2. **Rate Limiting** - 100ms delay between API calls
3. **Indexing** - Database indexes on key fields for fast queries
4. **Caching** - Consider Redis for frequently accessed metrics

## Monitoring

Monitor the system using:

```bash
# Check sync status
npm run view-metrics summary

# View recent errors in logs
tail -f logs/order-metrics-*.log

# Check database performance
# Monitor query execution times in Supabase dashboard
```

## Troubleshooting

### Common Issues

1. **Missing Access Token**
   ```
   Error: MM_ACCESS_TOKEN not found
   Solution: Add MM_ACCESS_TOKEN to .env.local
   ```

2. **Database Connection**
   ```
   Error: relation "orders" does not exist
   Solution: Run npm run setup-order-metrics
   ```

3. **API Rate Limits**
   ```
   Error: HTTP 429 Too Many Requests
   Solution: Increase delay between requests or reduce batch size
   ```

### Debug Commands

```bash
# Test database connection
npm run check-env

# View raw order data
npm run view-metrics search "test" 1

# Check table structure
# Use Supabase dashboard SQL editor
```

## Future Enhancements

1. **Machine Learning Models**
   - Collaborative filtering
   - Content-based recommendations
   - Customer segmentation

2. **Real-time Updates**
   - Shopify webhooks integration
   - Live metrics dashboard

3. **Advanced Analytics**
   - Cohort analysis
   - A/B testing framework
   - Predictive analytics

4. **Performance Optimization**
   - Redis caching layer
   - Materialized views
   - Background job processing

## Integration Examples

### React Component

```jsx
import { useEffect, useState } from 'react'

function RecommendedProducts({ productId }) {
  const [recommendations, setRecommendations] = useState([])

  useEffect(() => {
    fetch(`/api/metrics?type=recommendations&productId=${productId}&limit=5`)
      .then(res => res.json())
      .then(data => setRecommendations(data.data))
  }, [productId])

  return (
    <div>
      <h3>Recommended Products</h3>
      {recommendations.map(item => (
        <div key={item.id}>
          <h4>{item.products.title}</h4>
          <p>Score: {item.recommendation_score}</p>
          <p>Revenue: ${item.total_revenue}</p>
        </div>
      ))}
    </div>
  )
}
```

### Next.js API Route

```javascript
// pages/api/products/[id]/recommendations.js
export default async function handler(req, res) {
  const { id } = req.query
  
  const response = await fetch(
    `${process.env.NEXT_PUBLIC_BASE_URL}/api/metrics?type=recommendations&productId=${id}&limit=10`
  )
  
  const data = await response.json()
  res.json(data)
}
```

This system provides a solid foundation for product recommendations and can be extended with more sophisticated algorithms as your data grows.