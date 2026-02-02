-- Consolidated Database Schema
-- This schema creates all tables in the correct order with proper foreign key relationships

-- Enable UUID extension if not already enabled
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Table 1: Competitors (no dependencies)
CREATE TABLE public.competitors (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  title text,
  failed_executions numeric,
  total_executions numeric,
  CONSTRAINT competitors_pkey PRIMARY KEY (id)
);

-- Table 2: Executions (depends on competitors)
CREATE TABLE public.executions (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  start_time timestamp with time zone DEFAULT now(),
  end_time timestamp with time zone,
  status text,
  error_msg jsonb,
  raw_response jsonb,
  trigger_source text DEFAULT 'manual'::text,
  competitor_id uuid,
  CONSTRAINT executions_pkey PRIMARY KEY (id),
  CONSTRAINT executions_competitor_id_fkey FOREIGN KEY (competitor_id) REFERENCES public.competitors(id)
);

-- Table 3: Products (no dependencies)
CREATE TABLE public.products (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  title text,
  image_id bigint null,
  vendor text,
  product_type text,
  product_created_at timestamp without time zone,
  tags text[],
  status text,
  product_id bigint,
  CONSTRAINT products_pkey PRIMARY KEY (id),
  CONSTRAINT products_product_id_unique UNIQUE (product_id)
);

-- Table 4: Variants (depends on products)
CREATE TABLE public.variants (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  product_id uuid,
  variant_id bigint,
  title text,
  price text,
  position smallint,
  compare_at_price text,
  storage text,
  condition text,
  color text,
  taxable boolean,
  fulfillment_service text,
  requires_shipping boolean,
  sku text,
  weight real,
  weight_unit text,
  inventory_item_id numeric,
  inventory_quantity integer,
  old_inventory_quantity integer,
  image_id bigint,
  CONSTRAINT variants_pkey PRIMARY KEY (id),
  CONSTRAINT variants_product_id_fkey FOREIGN KEY (product_id) REFERENCES public.products(id) ON DELETE CASCADE,
  CONSTRAINT variants_variant_id_unique UNIQUE (variant_id)
);

-- Table 5: Scraped Data (depends on all other tables)
CREATE TABLE public.scraped_data (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  price text,
  stock integer,
  created_at timestamp without time zone DEFAULT now(),
  raw_response jsonb,
  variant_id uuid,
  product_id uuid,
  execution_id uuid,
  competitor_id uuid,
  CONSTRAINT scraped_data_pkey PRIMARY KEY (id),
  CONSTRAINT scraped_data_competitor_id_fkey FOREIGN KEY (competitor_id) REFERENCES public.competitors(id),
  CONSTRAINT scraped_data_execution_id_fkey FOREIGN KEY (execution_id) REFERENCES public.executions(id),
  CONSTRAINT scraped_data_product_id_fkey FOREIGN KEY (product_id) REFERENCES public.products(id),
  CONSTRAINT scraped_data_variant_id_fkey FOREIGN KEY (variant_id) REFERENCES public.variants(id)
);

-- Indexes for better query performance
CREATE INDEX idx_variants_product_id ON public.variants(product_id);
CREATE INDEX idx_products_product_id ON public.products(product_id);
CREATE INDEX idx_variants_variant_id ON public.variants(variant_id);
CREATE INDEX idx_scraped_data_variant_id ON public.scraped_data(variant_id);
CREATE INDEX idx_scraped_data_product_id ON public.scraped_data(product_id);
CREATE INDEX idx_scraped_data_execution_id ON public.scraped_data(execution_id);
CREATE INDEX idx_scraped_data_competitor_id ON public.scraped_data(competitor_id);
CREATE INDEX idx_executions_competitor_id ON public.executions(competitor_id);