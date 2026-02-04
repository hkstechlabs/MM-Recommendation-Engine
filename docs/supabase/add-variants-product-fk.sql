-- Migration: Add product_id column with foreign key constraint and cascade delete
-- STATUS: RESOLVED - This migration has been incorporated into the main schema.sql file

-- This migration is no longer needed as the variants table in schema.sql already includes:
-- 1. product_id uuid column
-- 2. variants_product_id_fkey foreign key constraint with ON DELETE CASCADE
-- 3. Performance index idx_variants_product_id

-- If you need to apply this migration to an existing database that doesn't have these changes:
-- Uncomment the lines below:

/*
-- Step 1: Add product_id column (uuid type to match products.id)
ALTER TABLE public.variants ADD COLUMN product_id uuid;

-- Step 2: Add the foreign key constraint with cascade delete
ALTER TABLE public.variants
ADD CONSTRAINT variants_product_id_fkey 
FOREIGN KEY (product_id) 
REFERENCES public.products(id) 
ON DELETE CASCADE;

-- Step 3: Add an index for better query performance
CREATE INDEX idx_variants_product_id ON public.variants(product_id);
*/
