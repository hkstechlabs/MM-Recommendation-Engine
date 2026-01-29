module.exports = function normalizeReebelo(result) {
  return result.prices.map(p => ({
    competitor: 'reebelo',
    sku: p.sku,
    price: p.price,
    currency: p.currency,
    condition: p.condition,
    storage: p.storage,
    color: p.color,
    stock: p.stock,
    sourceUrl: p.sourceUrl,
    fetchedAt: result.fetchedAt,
    
    // Supabase mapping info
    variantId: p.variantId,
    mmSku: p.mmSku,
    mappingId: p.mappingId,
    productId: p.productId, // Add productId
    
    raw: p.raw,
  }));
};
