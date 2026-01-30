-- WARNING: This schema is for context only and is not meant to be run.
-- Table order and constraints may not be valid for execution.
CREATE TABLE public.competitors (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  title text,
  failed_executions numeric,
  total_executiosn numeric,
  CONSTRAINT competitors_pkey PRIMARY KEY (id)
);


CREATE TABLE public.executions (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  start_time timestamp with time zone DEFAULT now(),
  end_time timestamp with time zone,
  status text,
  error_msg jsonb,
  raw_response jsonb,
  trigger_source text DEFAULT 'manual'::text,
  CONSTRAINT executions_pkey PRIMARY KEY (id),
  CONSTRAINT executions_id_fkey FOREIGN KEY (id) REFERENCES public.competitors(id)
);


CREATE TABLE public.products (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  title text,
  vendor text,
  product_type text,
  product_created_at timestamp without time zone,
  tags ARRAY,
  status text,
  product_id bigint,
  CONSTRAINT products_pkey PRIMARY KEY (id)
);


CREATE TABLE public.scraped_data (
  id uuid NOT NULL DEFAULT uuid_generate_v4(),
  price text,
  stock integer,
  created_at timestamp without time zone DEFAULT now(),
  raw_response jsonb,
  variant_id uuid DEFAULT gen_random_uuid(),
  product_id uuid DEFAULT gen_random_uuid(),
  execution_id uuid DEFAULT gen_random_uuid(),
  competitor_id uuid DEFAULT gen_random_uuid(),
  CONSTRAINT scraped_data_pkey PRIMARY KEY (id),
  CONSTRAINT scraped_data_competitor_id_fkey FOREIGN KEY (competitor_id) REFERENCES public.competitors(id),
  CONSTRAINT scraped_data_execution_id_fkey FOREIGN KEY (execution_id) REFERENCES public.executions(id),
  CONSTRAINT scraped_data_product_id_fkey FOREIGN KEY (product_id) REFERENCES public.products(id),
  CONSTRAINT scraped_data_variant_id_fkey FOREIGN KEY (variant_id) REFERENCES public.variants(id)
);


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
  CONSTRAINT variants_product_id_fkey FOREIGN KEY (product_id) REFERENCES public.products(id) ON DELETE CASCADE
);