module.exports = function normalizeGreenGadgets(result) {
  return result.prices.map(p => ({
    competitor: 'green-gadgets',
    sku: p.sku,
    price: p.price,
    currency: p.currency,
    condition: p.condition,
    storage: p.storage,
    color: p.color,
    stock: p.available ? 1 : 0,
    sourceUrl: p.source_url,
    fetchedAt: result.fetchedAt,
    
    // Supabase mapping info
    variantId: p.variantId,
    mmSku: p.mmSku,
    mappingId: p.mappingId,
    productId: p.productId, // Add productId
    
    raw: p,
  }));
};
    