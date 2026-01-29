const axios = require('axios');
const BaseScraper = require('./BaseScraper');

class GreenGadgetsScraper extends BaseScraper {
  constructor() {
    super('green-gadgets');

    // Product handles will be loaded from Supabase mappings
    this.productHandles = [];
    this.skuToVariant = {};
  }

  async run(mappings) {
    // Load product handles from Supabase mappings
    if (mappings && mappings.greenGadgets) {
      this.productHandles = mappings.greenGadgets.productHandles;
      this.skuToVariant = mappings.greenGadgets.skuToVariant;
    }

    console.log(`🔍 Green Gadgets: Processing ${this.productHandles.length} product handles:`, this.productHandles);

    if (this.productHandles.length === 0) {
      console.warn('⚠️ No Green Gadgets product handles found in mappings');
      return {
        competitor: this.name,
        fetchedAt: new Date().toISOString(),
        prices: [],
        rawProducts: [],
      };
    }

    const prices = [];
    const rawProducts = [];

    // Convert product handles to URLs
    const productUrls = this.productHandles.map(
      handle => `https://shop.greengadgets.net.au/products/${handle}.json`
    );

    for (const url of productUrls) {
      try {
        console.log(`🔍 Fetching Green Gadgets product: ${url}`);
        
        const response = await axios.get(url, {
          timeout: 15000,
          headers: {
            'User-Agent': 'Mozilla/5.0',
            Accept: 'application/json',
          },
        });

        const product = response.data?.product;
        if (!product || !Array.isArray(product.variants)) {
          throw new Error('Invalid product JSON structure');
        }

        rawProducts.push(product);

        for (const variant of product.variants) {
          // Get variant info from mapping using product handle
          const variantInfo = this.skuToVariant[product.handle] || {};

          prices.push({
            competitor: this.name,
            fetchedAt: new Date().toISOString(),

            product_handle: product.handle,
            product_title: product.title,

            sku: variant.sku,
            variant_id: variant.id,

            storage: variant.option1,
            color: variant.option2,
            condition: variant.option3,

            price: Number(variant.price),
            currency: variant.price_currency || 'AUD',

            compare_at_price: variant.compare_at_price
              ? Number(variant.compare_at_price)
              : null,

            available: true,
            sourceUrl: url,

            // Supabase mapping info
            variantId: variantInfo.variantId,
            mmSku: variantInfo.mmSku,
            mappingId: variantInfo.mappingId,
            productId: variantInfo.productId,
          });
        }
      } catch (error) {
        console.error(`❌ Green Gadgets API error for URL: ${url}`);
        console.error(`   Status: ${error.response?.status || 'No response'}`);
        console.error(`   Status Text: ${error.response?.statusText || 'N/A'}`);
        console.error(`   Response Data:`, JSON.stringify(error.response?.data, null, 2));
        console.error(`   Request Headers:`, error.config?.headers);
        console.error(`   Full Error:`, error.message);
        throw error;
      }
    }

    return {
      competitor: this.name,
      fetchedAt: new Date().toISOString(),
      prices,
      rawProducts,
    };
  }
}

module.exports = GreenGadgetsScraper;
