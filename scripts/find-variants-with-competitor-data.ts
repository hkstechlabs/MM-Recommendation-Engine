import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

const supabase = createClient(supabaseUrl, supabaseKey);

async function findVariantsWithCompetitorData() {
  console.log('🔍 Finding variants with competitor pricing data...\n');

  // Get variants that have competitor pricing data
  const { data: variantsWithPricing, error } = await supabase
    .from('scraped_data')
    .select(`
      variant_id,
      price,
      stock,
      created_at,
      competitors (
        title
      ),
      variants (
        variant_id,
        title,
        price,
        sku,
        products (
          title,
          vendor
        )
      )
    `)
    .not('variant_id', 'is', null)
    .not('competitor_id', 'is', null)
    .order('created_at', { ascending: false })
    .limit(20);

  if (error) {
    console.error('❌ Error:', error);
    return;
  }

  if (!variantsWithPricing || variantsWithPricing.length === 0) {
    console.log('❌ No variants found with competitor pricing data');
    return;
  }

  console.log(`✅ Found ${variantsWithPricing.length} recent variants with competitor data\n`);

  // Group by variant to show unique variants
  const variantMap = new Map();
  
  for (const item of variantsWithPricing) {
    const variant = item.variants as any;
    if (!variant) continue;
    
    const variantId = variant.variant_id;
    if (!variantMap.has(variantId)) {
      const product = variant.products as any;
      variantMap.set(variantId, {
        variantId: variantId,
        variantTitle: variant.title,
        productTitle: product?.title || 'Unknown',
        vendor: product?.vendor || 'Unknown',
        ourPrice: variant.price,
        sku: variant.sku,
        competitorPrices: []
      });
    }
    
    variantMap.get(variantId).competitorPrices.push({
      competitor: (item.competitors as any)?.title || 'Unknown',
      price: item.price,
      stock: item.stock,
      date: item.created_at
    });
  }

  console.log('📦 Variants with competitor pricing:\n');
  
  let count = 0;
  for (const [variantId, data] of variantMap.entries()) {
    count++;
    if (count > 10) break; // Show only first 10
    
    console.log(`${count}. ${data.productTitle}`);
    console.log(`   Variant: ${data.variantTitle}`);
    console.log(`   Vendor: ${data.vendor}`);
    console.log(`   SKU: ${data.sku}`);
    console.log(`   Variant ID: ${variantId}`);
    console.log(`   Our Price: $${data.ourPrice}`);
    console.log(`   Competitor Prices:`);
    
    // Show unique competitors
    const uniqueCompetitors = new Map();
    for (const cp of data.competitorPrices) {
      if (!uniqueCompetitors.has(cp.competitor)) {
        uniqueCompetitors.set(cp.competitor, cp);
      }
    }
    
    for (const [competitor, cp] of uniqueCompetitors.entries()) {
      console.log(`     - ${competitor}: $${cp.price} (Stock: ${cp.stock})`);
    }
    console.log('');
  }

  console.log(`\n💡 To test, search for any of these products in the dashboard and view their variant details.`);
}

findVariantsWithCompetitorData().catch(console.error);
