-- Migration: Add product_id column with foreign key constraint and cascade delete

-- Step 1: Add product_id column (uuid type to match products.id)
ALTER TABLE public.variants ADD COLUMN product_id uuid;

-- Step 2: Add the foreign key constraint with cascade delete
ALTER TABLE public.variants
ADD CONSTRAINT variants_product_id_fkey 
FOREIGN KEY (product_id) 
REFERENCES public.products(id) 
ON DELETE CASCADE;

-- Step 3: (Optional) Add an index for better query performance
CREATE INDEX idx_variants_product_id ON public.variants(product_id);
