-- Add unique constraints for upsert operations
-- These constraints are needed for the MM sync bulk operations

-- Add unique constraint on products.product_id (Shopify product ID)
ALTER TABLE public.products 
ADD CONSTRAINT products_product_id_unique UNIQUE (product_id);

-- Add unique constraint on variants.variant_id (Shopify variant ID)  
ALTER TABLE public.variants 
ADD CONSTRAINT variants_variant_id_unique UNIQUE (variant_id);

-- Add indexes for better performance on these unique fields
CREATE INDEX IF NOT EXISTS idx_products_product_id ON public.products(product_id);
CREATE INDEX IF NOT EXISTS idx_variants_variant_id ON public.variants(variant_id);