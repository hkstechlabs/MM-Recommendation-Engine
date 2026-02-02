-- Add unique constraints for MM sync bulk operations
-- Run this in your Supabase SQL Editor

-- Add unique constraint on products.product_id (Shopify product ID)
ALTER TABLE public.products 
ADD CONSTRAINT products_product_id_unique UNIQUE (product_id);

-- Add unique constraint on variants.variant_id (Shopify variant ID)  
ALTER TABLE public.variants 
ADD CONSTRAINT variants_variant_id_unique UNIQUE (variant_id);

-- Add indexes for better performance on these unique fields
CREATE INDEX IF NOT EXISTS idx_products_product_id ON public.products(product_id);
CREATE INDEX IF NOT EXISTS idx_variants_variant_id ON public.variants(variant_id);

-- Verify constraints were added
SELECT 
    constraint_name, 
    table_name, 
    constraint_type 
FROM information_schema.table_constraints 
WHERE table_name IN ('products', 'variants') 
    AND constraint_type = 'UNIQUE'
    AND constraint_name LIKE '%_unique';