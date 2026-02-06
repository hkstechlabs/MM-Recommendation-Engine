import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

const supabase = createClient(supabaseUrl, supabaseKey);

async function checkCompetitorData() {
  console.log('🔍 Checking competitor data availability...\n');

  // Check competitors table
  const { data: competitors, error: competitorsError } = await supabase
    .from('competitors')
    .select('*');

  if (competitorsError) {
    console.error('❌ Error fetching competitors:', competitorsError);
  } else {
    console.log(`✅ Competitors found: ${competitors?.length || 0}`);
    if (competitors && competitors.length > 0) {
      console.log('Competitors:');
      competitors.forEach(c => {
        console.log(`  - ${c.title} (ID: ${c.id})`);
      });
    }
  }

  console.log('\n');

  // Check scraped_data table
  const { data: scrapedData, error: scrapedError } = await supabase
    .from('scraped_data')
    .select('*')
    .limit(10);

  if (scrapedError) {
    console.error('❌ Error fetching scraped data:', scrapedError);
  } else {
    console.log(`✅ Scraped data records found: ${scrapedData?.length || 0}`);
    if (scrapedData && scrapedData.length > 0) {
      console.log('Sample scraped data:');
      scrapedData.slice(0, 3).forEach(d => {
        console.log(`  - Price: $${d.price}, Stock: ${d.stock}, Created: ${d.created_at}`);
      });
    }
  }

  console.log('\n');

  // Check if there's any scraped data with competitor info
  const { data: competitorPrices, error: pricesError } = await supabase
    .from('scraped_data')
    .select(`
      price,
      stock,
      created_at,
      variant_id,
      competitors (
        title
      )
    `)
    .not('competitor_id', 'is', null)
    .limit(10);

  if (pricesError) {
    console.error('❌ Error fetching competitor prices:', pricesError);
  } else {
    console.log(`✅ Competitor price records: ${competitorPrices?.length || 0}`);
    if (competitorPrices && competitorPrices.length > 0) {
      console.log('Sample competitor prices:');
      competitorPrices.slice(0, 5).forEach(p => {
        console.log(`  - ${(p.competitors as any)?.title || 'Unknown'}: $${p.price} (Stock: ${p.stock})`);
      });
    }
  }

  console.log('\n');

  // Check total counts
  const { count: totalScrapedCount } = await supabase
    .from('scraped_data')
    .select('*', { count: 'exact', head: true });

  const { count: totalVariantsCount } = await supabase
    .from('variants')
    .select('*', { count: 'exact', head: true });

  console.log('📊 Summary:');
  console.log(`  - Total competitors: ${competitors?.length || 0}`);
  console.log(`  - Total scraped data records: ${totalScrapedCount || 0}`);
  console.log(`  - Total variants: ${totalVariantsCount || 0}`);
  
  if (totalScrapedCount && totalScrapedCount > 0 && totalVariantsCount && totalVariantsCount > 0) {
    const coverage = ((totalScrapedCount / totalVariantsCount) * 100).toFixed(2);
    console.log(`  - Coverage: ${coverage}% of variants have competitor data`);
  }

  console.log('\n✅ Check complete!');
}

checkCompetitorData().catch(console.error);
