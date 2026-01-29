const axios = require('axios');
require('dotenv').config();

const SUPABASE_BASE_URL = process.env.SUPABASE_BASE_URL;
const SUPABASE_API_KEY = process.env.SUPABASE_API_KEY;
const SUPABASE_AUTH_TOKEN = process.env.SUPABASE_AUTH_TOKEN;

const headers = {
  'apiKey': SUPABASE_API_KEY,
  'Authorization': `Bearer ${SUPABASE_AUTH_TOKEN}`,
  'Content-Type': 'application/json',
  'Prefer': 'return=minimal',
};

/**
 * Fetch all mappings from Supabase with product information
 * Returns array of mappings with structure:
 * {
 *   id: number,
 *   mm: string,
 *   reebelo: string,
 *   "green gadgets": string,
 *   variant: number,
 *   product_id: number (from variants table)
 * }
 */

async function fetchMappings() {
  try {
    console.log('🔍 Fetching basic mappings...');
    const mappingsResponse = await axios.get(`${SUPABASE_BASE_URL}/mappings`, {
      headers,
    });
    
    const mappings = mappingsResponse.data;
    console.log(`✅ Fetched ${mappings.length} mappings`);
    
    // Get unique variant IDs from mappings
    const variantIds = [...new Set(mappings.map(m => m.variant))];
    console.log(`🔍 Fetching product_id for ${variantIds.length} variants: [${variantIds.join(', ')}]`);
    
    // Fetch product_id for each variant
    const variantsResponse = await axios.get(
      `${SUPABASE_BASE_URL}/variants?select=id,product_id&id=in.(${variantIds.join(',')})`, 
      { headers }
    );
    
    const variants = variantsResponse.data;
    console.log(`✅ Fetched product_id for ${variants.length} variants:`, variants);
    
    // Create a map of variant_id -> product_id
    const variantToProduct = {};
    variants.forEach(variant => {
      variantToProduct[variant.id] = variant.product_id;
      console.log(`   Variant ${variant.id} -> Product ${variant.product_id}`);
    });
    
    // Add product_id to mappings
    const mappingsWithProductId = mappings.map(mapping => ({
      ...mapping,
      product_id: variantToProduct[mapping.variant] || null
    }));
    
    console.log('✅ Successfully enriched mappings with product_id:');
    mappingsWithProductId.forEach(mapping => {
      console.log(`   Mapping ${mapping.id}: variant ${mapping.variant} -> product ${mapping.product_id}`);
    });
    
    return mappingsWithProductId;
    
  } catch (error) {
    console.error('❌ Error fetching mappings with product_id:', error.message);
    console.log('🔄 Falling back to basic mappings without product_id...');
    
    // Fallback to basic mappings if anything fails
    try {
      const fallbackResponse = await axios.get(`${SUPABASE_BASE_URL}/mappings`, {
        headers,
      });
      return fallbackResponse.data;
    } catch (fallbackError) {
      console.error('❌ Fallback also failed:', fallbackError.message);
      throw fallbackError;
    }
  }
}

/**
 * Transform mappings into a format useful for scrapers
 * Returns object with competitor-specific SKU arrays and variant tracking
 */
function transformMappings(mappings) {
  const reebeloSkus = [];
  const greenGadgetsSkus = [];
  const skuToVariant = {};

  for (const mapping of mappings) {
    // Reebelo mappings
    if (mapping.reebelo) {
      reebeloSkus.push(mapping.reebelo);
      skuToVariant[mapping.reebelo] = {
        variantId: mapping.variant,
        mmSku: mapping.mm,
        mappingId: mapping.id,
        productId: mapping.product_id, // Include product_id
      };
      console.log(`🔍 Reebelo mapping: ${mapping.reebelo} -> variant ${mapping.variant}, product ${mapping.product_id}`);
    }

    // Green Gadgets mappings
    if (mapping['green gadgets']) {
      greenGadgetsSkus.push(mapping['green gadgets']);
      skuToVariant[mapping['green gadgets']] = {
        variantId: mapping.variant,
        mmSku: mapping.mm,
        mappingId: mapping.id,
        productId: mapping.product_id, // Include product_id
      };
      console.log(`🔍 Green Gadgets mapping: ${mapping['green gadgets']} -> variant ${mapping.variant}, product ${mapping.product_id}`);
    }
  }

  return {
    reebelo: {
      skus: [...new Set(reebeloSkus)], // Remove duplicates
      skuToVariant,
    },
    greenGadgets: {
      productHandles: [...new Set(greenGadgetsSkus)], // Remove duplicates
      skuToVariant,
    },
  };
}

/**
 * Insert scraped data into the scraped_data table
 * @param {number} executionId - The execution ID
 * @param {Array} scrapedDataEntries - Array of scraped data entries
 */
async function insertScrapedData(executionId, scrapedDataEntries) {
  try {
    console.log(`📝 Inserting ${scrapedDataEntries.length} scraped data entries with competitor-specific columns...`);
    
    // Group entries by variant and competitor for proper aggregation
    const variantData = new Map();
    
    for (const entry of scrapedDataEntries) {
      const key = entry.variantId;
      if (!variantData.has(key)) {
        variantData.set(key, {
          execution_id: executionId,
          mapping_id: entry.mappingId,
          variant_id: entry.variantId,
          product_id: entry.productId || null, // Use productId from entry
          reebelo_price: null,
          greengadgets_price: null,
          reebelo_stock: null,
          greengadgets_stock: null,
        });
        console.log(`🔍 Created variant record for ${entry.variantId} with product_id: ${entry.productId}`);
      }
      
      const variant = variantData.get(key);
      
      // Set competitor-specific fields
      if (entry.competitor === 'reebelo') {
        variant.reebelo_price = entry.price;
        variant.reebelo_stock = entry.stock || 0;
        console.log(`🔍 Setting Reebelo data: price=${entry.price}, stock=${entry.stock}`);
      } else if (entry.competitor === 'green-gadgets') {
        variant.greengadgets_price = entry.price;
        variant.greengadgets_stock = entry.stock || 0;
        console.log(`🔍 Setting Green Gadgets data: price=${entry.price}, stock=${entry.stock}`);
      }
    }
    
    const recordsToInsert = Array.from(variantData.values());
    console.log(`📋 Aggregated into ${recordsToInsert.length} variant records`);
    console.log(`📋 Full record to insert:`, JSON.stringify(recordsToInsert[0], null, 2));
    
    // Insert aggregated records with return=representation to see what was actually inserted
    const response = await axios.post(
      `${SUPABASE_BASE_URL}/scraped_data`,
      recordsToInsert,
      { 
        headers: {
          ...headers,
          'Prefer': 'return=representation'
        }
      }
    );
    
    console.log(`📋 Database response:`, JSON.stringify(response.data, null, 2));
    console.log(`✅ Successfully inserted ${recordsToInsert.length} variant records with competitor prices and stock`);
    return true;
  } catch (error) {
    console.error(`❌ Error inserting scraped data:`, error.message);
    if (error.response) {
      console.error('   Status:', error.response.status);
      console.error('   Data:', JSON.stringify(error.response.data, null, 2));
    }
    
    // Provide helpful debugging info
    console.error(`� Debug info:`);
    console.error(`   - Execution ID: ${executionId}`);
    console.error(`   - Sample entry:`, JSON.stringify(scrapedDataEntries[0], null, 2));
    console.error(`💡 Please check your scraped_data table columns in Supabase`);
    
    throw error;
  }
}

/**
 * Update variant pricing and stock information
 * @param {number} variantId - The variant ID to update
 * @param {object} updates - Object containing fields to update
 * @param {number} updates.reebelo_price - Reebelo price (decimal)
 * @param {number} updates.greengadgets_price - Green Gadgets price (decimal)
 * @param {number} updates.reebelo_stock - Reebelo stock (integer)
 * @param {number} updates.greengadgets_stock - Green Gadgets stock (integer)
 */
async function updateVariant(variantId, updates) {
  try {
    const response = await axios.patch(
      `${SUPABASE_BASE_URL}/variants?id=eq.${variantId}`,
      updates,
      { headers }
    );
    return true;
  } catch (error) {
    console.error(`❌ Error updating variant ${variantId}:`, error.message);
    if (error.response) {
      console.error('   Status:', error.response.status);
      console.error('   Data:', JSON.stringify(error.response.data, null, 2));
      console.error('   Attempted update:', JSON.stringify(updates, null, 2));
    }
    throw error;
  }
}

/** ------------------- EXECUTIONS ------------------- **/
async function createExecution() {
  const startTime = new Date().toISOString();
  
  // Simplified execution record - only use basic fields that should exist
  const response = await axios.post(`${SUPABASE_BASE_URL}/executions`, {
    start_time: startTime,
    status: 'running',
  }, { headers });
  
  return response.data[0]; // Returns the execution record
}

async function updateExecution(executionId, updates) {
  await axios.patch(
    `${SUPABASE_BASE_URL}/executions?id=eq.${executionId}`,
    { ...updates, updated_at: new Date().toISOString() },
    { headers }
  );
}

async function completeExecution(executionId, extra = {}) {
  await updateExecution(executionId, {
    end_time: new Date().toISOString(),
    ...extra,
  });
}

async function runScraperWithLogging(scraperName, scraperFn) {
  const startTime = new Date();
  console.log(`🚀 Starting scraper: ${scraperName} at ${startTime.toISOString()}`);
  
  // Create execution record with initial status
  let executionId = null;
  
  try {
    const response = await axios.post(`${SUPABASE_BASE_URL}/executions`, {
      start_time: startTime.toISOString(),
      gg_status: scraperName === 'green-gadgets' ? 'running' : 'pending',
      reebelo_status: scraperName === 'reebelo' ? 'running' : 'pending',
      executed_by: 'node-scraper', // Add identifier for who/what ran this
      notes: `Starting ${scraperName} scraper execution`
    }, { 
      headers: {
        ...headers,
        'Prefer': 'return=representation'
      }
    });
    
    executionId = response.data[0]?.id;
    console.log(`📝 Created execution record: ${executionId} for ${scraperName}`);
    
  } catch (createError) {
    console.warn(`⚠️ Could not create execution record:`, createError.response?.data?.message || createError.message);
    console.log(`   Continuing without execution logging...`);
  }
  
  try {
    const result = await scraperFn();
    const endTime = new Date();
    const totalRuntime = endTime - startTime; // milliseconds
    
    console.log(`✅ Scraper ${scraperName} completed successfully in ${totalRuntime}ms`);
    
    // Update execution with success
    if (executionId) {
      const successUpdate = {
        end_time: endTime.toISOString(),
        total_runtime: totalRuntime,
        notes: `${scraperName} completed successfully. Found ${result?.prices?.length || 0} prices.`
      };
      
      if (scraperName === 'reebelo') {
        successUpdate.reebelo_status = 'completed';
        successUpdate.reebelo_raw_response = result;
      } else if (scraperName === 'green-gadgets') {
        successUpdate.gg_status = 'completed';
        successUpdate.gg_raw_response = result;
      }
      
      await axios.patch(
        `${SUPABASE_BASE_URL}/executions?id=eq.${executionId}`,
        successUpdate,
        { headers }
      );
      console.log(`📝 Updated execution record ${executionId} with success (${totalRuntime}ms runtime)`);
    }
    
    return result;

  } catch (err) {
    const endTime = new Date();
    const totalRuntime = endTime - startTime; // milliseconds
    
    console.error(`❌ Error in scraper ${scraperName} after ${totalRuntime}ms:`, err.message);
    
    // Update execution with error
    if (executionId) {
      const errorUpdate = {
        end_time: endTime.toISOString(),
        total_runtime: totalRuntime,
        notes: `${scraperName} failed after ${totalRuntime}ms: ${err.message}`
      };
      
      if (scraperName === 'reebelo') {
        errorUpdate.reebelo_status = 'failed';
        errorUpdate.reebelo_error = err.message;
      } else if (scraperName === 'green-gadgets') {
        errorUpdate.gg_status = 'failed';
        errorUpdate.gg_error = err.message;
      }
      
      try {
        await axios.patch(
          `${SUPABASE_BASE_URL}/executions?id=eq.${executionId}`,
          errorUpdate,
          { headers }
        );
        console.log(`📝 Updated execution record ${executionId} with error (${totalRuntime}ms runtime)`);
      } catch (updateError) {
        console.warn(`⚠️ Could not update execution record:`, updateError.response?.data?.message || updateError.message);
      }
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
    
    throw err; // Re-throw so main.js can handle it
  }
}


module.exports = {
  fetchMappings,
  transformMappings,
  // updateVariant, // Keep for backward compatibility
  insertScrapedData
};
