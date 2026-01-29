const scrapers = require('./scrapers');
const normalize = require('./normalize');
const axios = require('axios');
require('dotenv').config();
const {
  fetchMappings,
  transformMappings,
  insertScrapedData,
  updateVariant
} = require('./services/supabase');

// Import Supabase config for direct API calls
const SUPABASE_BASE_URL = process.env.SUPABASE_BASE_URL;
const SUPABASE_API_KEY = process.env.SUPABASE_API_KEY;
const SUPABASE_AUTH_TOKEN = process.env.SUPABASE_AUTH_TOKEN;

const headers = {
  'apiKey': SUPABASE_API_KEY,
  'Authorization': `Bearer ${SUPABASE_AUTH_TOKEN}`,
  'Content-Type': 'application/json',
  'Prefer': 'return=minimal',
};

function aggregateByVariant(allNormalizedData) {
  const variantMap = new Map();

  for (const item of allNormalizedData) {
    const { variantId, competitor, price, stock } = item;
    if (!variantId) continue;

    if (!variantMap.has(variantId)) {
      variantMap.set(variantId, {
        variantId,
        reebelo_price: null,
        greengadgets_price: null,
        reebelo_stock: null,
        greengadgets_stock: null,
      });
    }

    const variant = variantMap.get(variantId);

    if (competitor === 'reebelo') {
      if (variant.reebelo_price === null || price < variant.reebelo_price) {
        variant.reebelo_price = price;
      }
      variant.reebelo_stock = (variant.reebelo_stock || 0) + (stock || 0);
    } else if (competitor === 'green-gadgets') {
      if (variant.greengadgets_price === null || price < variant.greengadgets_price) {
        variant.greengadgets_price = price;
      }
      variant.greengadgets_stock = (variant.greengadgets_stock || 0) + (stock || 0);
    }
  }

  return Array.from(variantMap.values());
}

async function main() {
  const overallStartTime = new Date();
  console.log('📥 Fetching mappings from Supabase...');

  // Create overall execution record
  let overallExecutionId = null;
  try {
    const response = await axios.post(`${SUPABASE_BASE_URL}/executions`, {
      start_time: overallStartTime.toISOString(),
      gg_status: 'pending',
      reebelo_status: 'pending',
      executed_by: 'node-scraper',
      notes: 'Starting full scraper execution for both Green Gadgets and Reebelo'
    }, {
      headers: {
        ...headers,
        'Prefer': 'return=representation'
      }
    });

    overallExecutionId = response.data[0]?.id;
    console.log(`📝 Created overall execution record: ${overallExecutionId}`);
  } catch (createError) {
    console.warn(`⚠️ Could not create overall execution record:`, createError.response?.data?.message || createError.message);
  }

  const mappingsRaw = await fetchMappings();
  const transformedMappings = transformMappings(mappingsRaw);
  console.log(`✅ Loaded ${mappingsRaw.length} mappings from Supabase`);

  const allNormalizedData = [];
  let ggResult = null;
  let reebeloResult = null;
  let ggError = null;
  let reebeloError = null;

  for (const scraper of scrapers) {
    try {
      // Update status to running for current scraper
      if (overallExecutionId) {
        const statusUpdate = {};
        if (scraper.name === 'reebelo') {
          statusUpdate.reebelo_status = 'running';
        } else if (scraper.name === 'green-gadgets') {
          statusUpdate.gg_status = 'running';
        }

        await axios.patch(
          `${SUPABASE_BASE_URL}/executions?id=eq.${overallExecutionId}`,
          statusUpdate,
          { headers }
        );
      }

      console.log(`🚀 Starting scraper: ${scraper.name}`);
      const result = await scraper.run(transformedMappings);

      // Store results for final update
      if (scraper.name === 'reebelo') {
        reebeloResult = result;
      } else if (scraper.name === 'green-gadgets') {
        ggResult = result;
      }

      console.log(`✅ ${scraper.name} scraped ${result.prices?.length || 0} prices`);

      // Update status to completed for current scraper
      if (overallExecutionId) {
        const statusUpdate = {};
        if (scraper.name === 'reebelo') {
          statusUpdate.reebelo_status = 'completed';
        } else if (scraper.name === 'green-gadgets') {
          statusUpdate.gg_status = 'completed';
        }

        await axios.patch(
          `${SUPABASE_BASE_URL}/executions?id=eq.${overallExecutionId}`,
          statusUpdate,
          { headers }
        );
      }

      // Normalize the data
      const normalizedData = normalize(scraper.name, result);
      allNormalizedData.push(...normalizedData);

    } catch (err) {
      console.error(`❌ Error processing scraper ${scraper.name}:`, err.message);

      // Store error for final update
      if (scraper.name === 'reebelo') {
        reebeloError = err.message;
      } else if (scraper.name === 'green-gadgets') {
        ggError = err.message;
      }

      // Update status to failed for current scraper
      if (overallExecutionId) {
        const statusUpdate = {};
        if (scraper.name === 'reebelo') {
          statusUpdate.reebelo_status = 'failed';
          statusUpdate.reebelo_error = err.message;
        } else if (scraper.name === 'green-gadgets') {
          statusUpdate.gg_status = 'failed';
          statusUpdate.gg_error = err.message;
        }

        await axios.patch(
          `${SUPABASE_BASE_URL}/executions?id=eq.${overallExecutionId}`,
          statusUpdate,
          { headers }
        );
      }

      // Add detailed error logging for HTTP errors
      if (err.response) {
        console.error(`   HTTP Status: ${err.response.status}`);
        console.error(`   HTTP Status Text: ${err.response.statusText}`);
        console.error(`   Response Data:`, JSON.stringify(err.response.data, null, 2));
        console.error(`   Request URL: ${err.config?.url}`);
        console.error(`   Request Method: ${err.config?.method}`);
        console.error(`   Request Headers:`, err.config?.headers);
        console.error(`   Request Params:`, err.config?.params);
      }

      console.error(`   Full error stack:`, err.stack);
    }
  }

  console.log('\n📊 Processing scraped data...');

  // Prepare scraped data entries for the new table
  const scrapedDataEntries = [];

  for (const item of allNormalizedData) {
    if (item.variantId && item.price !== null && item.price !== undefined) {
      scrapedDataEntries.push({
        mappingId: item.mappingId,
        variantId: item.variantId,
        productId: item.productId || null, // Add if available
        competitor: item.competitor,
        price: item.price,
        stock: item.stock || 0,
        sku: item.sku,
        product_handle: item.product_handle,
        raw: item.raw
      });

      // Debug the first entry
      if (scrapedDataEntries.length === 1) {
        console.log(`🔍 Sample normalized item:`, {
          competitor: item.competitor,
          variantId: item.variantId,
          productId: item.productId,
          mappingId: item.mappingId,
          price: item.price
        });
      }
    }
  }

  console.log(`📦 Found ${scrapedDataEntries.length} scraped data entries to process`);

  let historicalInsertCount = 0;
  let variantUpdateCount = 0;
  let errorCount = 0;

  // Step 1: Insert historical data into scraped_data table
  if (scrapedDataEntries.length > 0 && overallExecutionId) {
    try {
      await insertScrapedData(overallExecutionId, scrapedDataEntries);
      historicalInsertCount = scrapedDataEntries.length;
      console.log(`✅ Inserted historical data into scraped_data table`);
    } catch (err) {
      console.error(`❌ Failed to insert scraped data:`, err.message);
    }
  }

  // Step 2: Update variants table with latest prices and stock
  console.log('\n📊 Updating variants with latest prices...');
  const variantUpdates = aggregateByVariant(allNormalizedData);
  console.log(`📦 Found ${variantUpdates.length} variants to update`);

  for (const update of variantUpdates) {
    try {
      const { variantId, ...fields } = update;
      await updateVariant(variantId, fields);
      variantUpdateCount++;
      console.log(`✅ Updated variant ${variantId} with latest prices:`, fields);
    } catch (err) {
      errorCount++;
      console.error(`❌ Failed to update variant ${update.variantId}:`, err.message);
    }
  }

  if (scrapedDataEntries.length === 0) {
    console.log(`⚠️ No valid scraped data to process`);
  } else if (!overallExecutionId) {
    console.log(`⚠️ No execution ID available for scraped data insertion`);
  }

  const overallEndTime = new Date();
  const totalRuntime = overallEndTime - overallStartTime;

  // Final execution update
  if (overallExecutionId) {
    try {
      await axios.patch(
        `${SUPABASE_BASE_URL}/executions?id=eq.${overallExecutionId}`,
        {
          end_time: overallEndTime.toISOString(),
          total_runtime: totalRuntime,
          gg_raw_response: ggResult,
          reebelo_raw_response: reebeloResult,
          notes: `Execution completed in ${totalRuntime}ms. Historical: ${historicalInsertCount}, Variants: ${variantUpdateCount}, Errors: ${errorCount}.`
        },
        { headers }
      );
      console.log(`📝 Final execution update: ${overallExecutionId} (${totalRuntime}ms total)`);
    } catch (updateError) {
      console.warn(`⚠️ Could not update final execution record:`, updateError.response?.data?.message || updateError.message);
    }
  }

  console.log(`\n🎉 Scraping complete!`);
  console.log(`   📊 Historical Records: ${historicalInsertCount}`);
  console.log(`   ✅ Variants Updated: ${variantUpdateCount}`);
  console.log(`   ❌ Errors: ${errorCount}`);
  console.log(`   ⏱️ Total Runtime: ${totalRuntime}ms`);
}

main().catch(err => {
  console.error('🔥 Fatal error:', err);
  process.exit(1);
});
