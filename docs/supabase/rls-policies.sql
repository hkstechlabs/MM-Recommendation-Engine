-- RLS Policies for Products and Variants Tables
-- These policies allow anonymous users to read and write to products and variants tables

-- Enable RLS on products table
ALTER TABLE public.products ENABLE ROW LEVEL SECURITY;

-- Enable RLS on variants table  
ALTER TABLE public.variants ENABLE ROW LEVEL SECURITY;

-- Policy for anonymous users to SELECT from products table
CREATE POLICY "Allow anonymous users to read products" ON public.products
FOR SELECT TO anon
USING (true);

-- Policy for anonymous users to INSERT into products table
CREATE POLICY "Allow anonymous users to insert products" ON public.products
FOR INSERT TO anon
WITH CHECK (true);

-- Policy for anonymous users to UPDATE products table
CREATE POLICY "Allow anonymous users to update products" ON public.products
FOR UPDATE TO anon
USING (true)
WITH CHECK (true);

-- Policy for anonymous users to DELETE from products table
CREATE POLICY "Allow anonymous users to delete products" ON public.products
FOR DELETE TO anon
USING (true);

-- Policy for anonymous users to SELECT from variants table
CREATE POLICY "Allow anonymous users to read variants" ON public.variants
FOR SELECT TO anon
USING (true);

-- Policy for anonymous users to INSERT into variants table
CREATE POLICY "Allow anonymous users to insert variants" ON public.variants
FOR INSERT TO anon
WITH CHECK (true);

-- Policy for anonymous users to UPDATE variants table
CREATE POLICY "Allow anonymous users to update variants" ON public.variants
FOR UPDATE TO anon
USING (true)
WITH CHECK (true);

-- Policy for anonymous users to DELETE from variants table
CREATE POLICY "Allow anonymous users to delete variants" ON public.variants
FOR DELETE TO anon
USING (true);

-- Grant necessary permissions to anon role
GRANT ALL ON public.products TO anon;
GRANT ALL ON public.variants TO anon;
GRANT USAGE ON SCHEMA public TO anon;