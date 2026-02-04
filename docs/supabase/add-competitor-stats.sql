-- Add statistics columns to competitors table if they don't exist

-- Add failed_executions column if it doesn't exist
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'competitors' 
                   AND column_name = 'failed_executions') THEN
        ALTER TABLE public.competitors ADD COLUMN failed_executions numeric DEFAULT 0;
    END IF;
END $$;

-- Add total_executions column if it doesn't exist
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'competitors' 
                   AND column_name = 'total_executions') THEN
        ALTER TABLE public.competitors ADD COLUMN total_executions numeric DEFAULT 0;
    END IF;
END $$;

-- Update existing competitors to have default values
UPDATE public.competitors 
SET 
    failed_executions = COALESCE(failed_executions, 0),
    total_executions = COALESCE(total_executions, 0)
WHERE failed_executions IS NULL OR total_executions IS NULL;