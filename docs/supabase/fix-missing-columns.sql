-- Fix missing columns in database tables

-- Add competitor_id to executions table if it doesn't exist
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'executions' 
                   AND column_name = 'competitor_id') THEN
        ALTER TABLE public.executions ADD COLUMN competitor_id uuid REFERENCES public.competitors(id);
        CREATE INDEX idx_executions_competitor_id ON public.executions(competitor_id);
    END IF;
END $$;

-- Ensure all required columns exist in scraped_data table
DO $$ 
BEGIN
    -- Add variant_id if missing
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'scraped_data' 
                   AND column_name = 'variant_id') THEN
        ALTER TABLE public.scraped_data ADD COLUMN variant_id uuid REFERENCES public.variants(id);
    END IF;
    
    -- Add product_id if missing
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'scraped_data' 
                   AND column_name = 'product_id') THEN
        ALTER TABLE public.scraped_data ADD COLUMN product_id uuid REFERENCES public.products(id);
    END IF;
    
    -- Add execution_id if missing
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'scraped_data' 
                   AND column_name = 'execution_id') THEN
        ALTER TABLE public.scraped_data ADD COLUMN execution_id uuid REFERENCES public.executions(id);
    END IF;
    
    -- Add competitor_id if missing
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'scraped_data' 
                   AND column_name = 'competitor_id') THEN
        ALTER TABLE public.scraped_data ADD COLUMN competitor_id uuid REFERENCES public.competitors(id);
    END IF;
END $$;

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_scraped_data_variant_id ON public.scraped_data(variant_id);
CREATE INDEX IF NOT EXISTS idx_scraped_data_product_id ON public.scraped_data(product_id);
CREATE INDEX IF NOT EXISTS idx_scraped_data_execution_id ON public.scraped_data(execution_id);
CREATE INDEX IF NOT EXISTS idx_scraped_data_competitor_id ON public.scraped_data(competitor_id);