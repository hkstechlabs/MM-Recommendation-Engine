-- Complete schema fix for competitor sync system
-- Run this in your Supabase SQL editor

-- First, let's check what constraints exist and potentially drop problematic ones
-- (You may need to adjust this based on your actual constraints)

-- Drop any problematic self-referencing constraints on executions table
-- (This is a common issue when tables are created with incorrect foreign keys)
DO $$ 
DECLARE
    constraint_name text;
BEGIN
    -- Find and drop any self-referencing foreign key on executions.id
    FOR constraint_name IN 
        SELECT conname 
        FROM pg_constraint 
        WHERE conrelid = 'public.executions'::regclass 
        AND contype = 'f'
        AND conname LIKE '%id_fkey%'
    LOOP
        EXECUTE 'ALTER TABLE public.executions DROP CONSTRAINT IF EXISTS ' || constraint_name;
        RAISE NOTICE 'Dropped constraint: %', constraint_name;
    END LOOP;
END $$;

-- Ensure competitor_id column exists in executions table
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'executions' 
                   AND column_name = 'competitor_id') THEN
        ALTER TABLE public.executions ADD COLUMN competitor_id uuid;
        RAISE NOTICE 'Added competitor_id column to executions table';
    END IF;
END $$;

-- Add the correct foreign key constraint for competitor_id
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint 
                   WHERE conname = 'executions_competitor_id_fkey') THEN
        ALTER TABLE public.executions 
        ADD CONSTRAINT executions_competitor_id_fkey 
        FOREIGN KEY (competitor_id) REFERENCES public.competitors(id);
        RAISE NOTICE 'Added competitor_id foreign key constraint';
    END IF;
END $$;

-- Ensure all required columns exist in scraped_data table
DO $$ 
BEGIN
    -- Add competitor_id if missing
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'scraped_data' 
                   AND column_name = 'competitor_id') THEN
        ALTER TABLE public.scraped_data ADD COLUMN competitor_id uuid;
        RAISE NOTICE 'Added competitor_id to scraped_data';
    END IF;
    
    -- Add execution_id if missing
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'scraped_data' 
                   AND column_name = 'execution_id') THEN
        ALTER TABLE public.scraped_data ADD COLUMN execution_id uuid;
        RAISE NOTICE 'Added execution_id to scraped_data';
    END IF;
    
    -- Add product_id if missing
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'scraped_data' 
                   AND column_name = 'product_id') THEN
        ALTER TABLE public.scraped_data ADD COLUMN product_id uuid;
        RAISE NOTICE 'Added product_id to scraped_data';
    END IF;
    
    -- Add variant_id if missing
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'scraped_data' 
                   AND column_name = 'variant_id') THEN
        ALTER TABLE public.scraped_data ADD COLUMN variant_id uuid;
        RAISE NOTICE 'Added variant_id to scraped_data';
    END IF;
END $$;

-- Add foreign key constraints for scraped_data
DO $$
BEGIN
    -- Competitor foreign key
    IF NOT EXISTS (SELECT 1 FROM pg_constraint 
                   WHERE conname = 'scraped_data_competitor_id_fkey') THEN
        ALTER TABLE public.scraped_data 
        ADD CONSTRAINT scraped_data_competitor_id_fkey 
        FOREIGN KEY (competitor_id) REFERENCES public.competitors(id);
        RAISE NOTICE 'Added scraped_data competitor_id foreign key';
    END IF;
    
    -- Execution foreign key
    IF NOT EXISTS (SELECT 1 FROM pg_constraint 
                   WHERE conname = 'scraped_data_execution_id_fkey') THEN
        ALTER TABLE public.scraped_data 
        ADD CONSTRAINT scraped_data_execution_id_fkey 
        FOREIGN KEY (execution_id) REFERENCES public.executions(id);
        RAISE NOTICE 'Added scraped_data execution_id foreign key';
    END IF;
    
    -- Product foreign key
    IF NOT EXISTS (SELECT 1 FROM pg_constraint 
                   WHERE conname = 'scraped_data_product_id_fkey') THEN
        ALTER TABLE public.scraped_data 
        ADD CONSTRAINT scraped_data_product_id_fkey 
        FOREIGN KEY (product_id) REFERENCES public.products(id);
        RAISE NOTICE 'Added scraped_data product_id foreign key';
    END IF;
    
    -- Variant foreign key
    IF NOT EXISTS (SELECT 1 FROM pg_constraint 
                   WHERE conname = 'scraped_data_variant_id_fkey') THEN
        ALTER TABLE public.scraped_data 
        ADD CONSTRAINT scraped_data_variant_id_fkey 
        FOREIGN KEY (variant_id) REFERENCES public.variants(id);
        RAISE NOTICE 'Added scraped_data variant_id foreign key';
    END IF;
END $$;

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_executions_competitor_id ON public.executions(competitor_id);
CREATE INDEX IF NOT EXISTS idx_scraped_data_competitor_id ON public.scraped_data(competitor_id);
CREATE INDEX IF NOT EXISTS idx_scraped_data_execution_id ON public.scraped_data(execution_id);
CREATE INDEX IF NOT EXISTS idx_scraped_data_product_id ON public.scraped_data(product_id);
CREATE INDEX IF NOT EXISTS idx_scraped_data_variant_id ON public.scraped_data(variant_id);

-- Verify the schema is working
DO $$
DECLARE
    test_competitor_id uuid;
    test_execution_id uuid;
    test_scraped_id uuid;
BEGIN
    -- Test competitor insert
    INSERT INTO public.competitors (title, failed_executions, total_executions)
    VALUES ('schema-test', 0, 0)
    RETURNING id INTO test_competitor_id;
    
    -- Test execution insert
    INSERT INTO public.executions (competitor_id, start_time, status, trigger_source)
    VALUES (test_competitor_id, NOW(), 'test', 'schema-fix')
    RETURNING id INTO test_execution_id;
    
    -- Test scraped_data insert
    INSERT INTO public.scraped_data (price, stock, raw_response, competitor_id, execution_id)
    VALUES ('999.99', 1, '{"test": true}', test_competitor_id, test_execution_id)
    RETURNING id INTO test_scraped_id;
    
    -- Clean up test data
    DELETE FROM public.scraped_data WHERE id = test_scraped_id;
    DELETE FROM public.executions WHERE id = test_execution_id;
    DELETE FROM public.competitors WHERE id = test_competitor_id;
    
    RAISE NOTICE 'Schema verification successful!';
EXCEPTION
    WHEN OTHERS THEN
        RAISE NOTICE 'Schema verification failed: %', SQLERRM;
        -- Try to clean up any partial test data
        DELETE FROM public.scraped_data WHERE competitor_id = test_competitor_id;
        DELETE FROM public.executions WHERE competitor_id = test_competitor_id;
        DELETE FROM public.competitors WHERE id = test_competitor_id;
END $$;