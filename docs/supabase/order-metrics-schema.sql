-- Order Metrics Schema for Recommendation System
-- This schema adds tables to store order data and calculated metrics

-- Table 1: Orders (stores raw order data from Shopify)
CREATE TABLE public.orders (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  
  -- Shopify order data
  order_id bigint NOT NULL,
  order_number text,
  name text,
  email text,
  phone text,
  created_at_shopify timestamp with time zone,
  updated_at_shopify timestamp with time zone,
  cancelled_at timestamp with time zone,
  closed_at timestamp with time zone,
  processed_at timestamp with time zone,
  
  -- Order details
  currency text DEFAULT 'AUD',
  total_price numeric(10,2),
  subtotal_price numeric(10,2),
  total_tax numeric(10,2),
  total_discounts numeric(10,2),
  total_line_items_price numeric(10,2),
  total_weight numeric(10,2),
  
  -- Status fields
  financial_status text, -- pending, authorized, partially_paid, paid, partially_refunded, refunded, voided
  fulfillment_status text, -- null, fulfilled, partial, restocked
  order_status_url text,
  
  -- Customer info
  customer_id bigint,
  customer_email text,
  customer_phone text,
  customer_first_name text,
  customer_last_name text,
  customer_orders_count integer,
  customer_total_spent numeric(10,2),
  
  -- Shipping info
  shipping_address jsonb,
  billing_address jsonb,
  
  -- Raw response for debugging
  raw_response jsonb,
  
  CONSTRAINT orders_pkey PRIMARY KEY (id),
  CONSTRAINT orders_order_id_unique UNIQUE (order_id)
);

-- Table 2: Order Line Items (detailed line items from orders)
CREATE TABLE public.order_line_items (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  
  -- Relations
  order_id uuid NOT NULL,
  product_id uuid, -- FK to products table
  variant_id uuid, -- FK to variants table
  
  -- Shopify IDs
  line_item_id bigint,
  shopify_product_id bigint,
  shopify_variant_id bigint,
  
  -- Line item details
  title text,
  variant_title text,
  sku text,
  vendor text,
  quantity integer NOT NULL,
  price numeric(10,2),
  total_discount numeric(10,2),
  
  -- Product attributes
  product_type text,
  storage text,
  condition text,
  color text,
  
  -- Fulfillment
  fulfillment_status text,
  fulfillable_quantity integer,
  
  CONSTRAINT order_line_items_pkey PRIMARY KEY (id),
  CONSTRAINT order_line_items_order_id_fkey FOREIGN KEY (order_id) REFERENCES public.orders(id) ON DELETE CASCADE,
  CONSTRAINT order_line_items_product_id_fkey FOREIGN KEY (product_id) REFERENCES public.products(id),
  CONSTRAINT order_line_items_variant_id_fkey FOREIGN KEY (variant_id) REFERENCES public.variants(id),
  CONSTRAINT order_line_items_line_item_id_unique UNIQUE (line_item_id)
);

-- Table 3: Product Metrics (calculated metrics for recommendation system)
CREATE TABLE public.product_metrics (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  
  -- Relations
  product_id uuid NOT NULL,
  variant_id uuid,
  
  -- Time period for metrics (daily, weekly, monthly, all-time)
  period_type text NOT NULL, -- 'daily', 'weekly', 'monthly', 'all_time'
  period_start timestamp with time zone,
  period_end timestamp with time zone,
  
  -- Sales metrics
  total_orders integer DEFAULT 0,
  total_quantity_sold integer DEFAULT 0,
  total_revenue numeric(10,2) DEFAULT 0,
  average_order_value numeric(10,2) DEFAULT 0,
  
  -- Performance metrics
  conversion_rate numeric(5,4) DEFAULT 0, -- percentage as decimal
  return_rate numeric(5,4) DEFAULT 0,
  customer_satisfaction_score numeric(3,2) DEFAULT 0,
  
  -- Popularity metrics
  view_count integer DEFAULT 0,
  add_to_cart_count integer DEFAULT 0,
  purchase_count integer DEFAULT 0,
  
  -- Inventory metrics
  current_stock integer DEFAULT 0,
  stock_turnover_rate numeric(5,2) DEFAULT 0,
  days_in_stock integer DEFAULT 0,
  
  -- Customer behavior metrics
  unique_customers integer DEFAULT 0,
  repeat_customers integer DEFAULT 0,
  average_days_between_orders numeric(5,2) DEFAULT 0,
  
  -- Recommendation scores (calculated)
  popularity_score numeric(5,2) DEFAULT 0,
  trending_score numeric(5,2) DEFAULT 0,
  recommendation_score numeric(5,2) DEFAULT 0,
  
  CONSTRAINT product_metrics_pkey PRIMARY KEY (id),
  CONSTRAINT product_metrics_product_id_fkey FOREIGN KEY (product_id) REFERENCES public.products(id) ON DELETE CASCADE,
  CONSTRAINT product_metrics_variant_id_fkey FOREIGN KEY (variant_id) REFERENCES public.variants(id) ON DELETE CASCADE,
  CONSTRAINT product_metrics_period_unique UNIQUE (product_id, variant_id, period_type, period_start)
);

-- Table 4: Customer Metrics (customer behavior for recommendations)
CREATE TABLE public.customer_metrics (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  
  -- Customer identification
  customer_id bigint NOT NULL,
  customer_email text,
  
  -- Time period
  period_type text NOT NULL,
  period_start timestamp with time zone,
  period_end timestamp with time zone,
  
  -- Purchase behavior
  total_orders integer DEFAULT 0,
  total_spent numeric(10,2) DEFAULT 0,
  average_order_value numeric(10,2) DEFAULT 0,
  days_since_last_order integer DEFAULT 0,
  
  -- Product preferences
  favorite_categories text[],
  favorite_brands text[],
  preferred_price_range_min numeric(10,2),
  preferred_price_range_max numeric(10,2),
  
  -- Behavioral scores
  loyalty_score numeric(5,2) DEFAULT 0,
  engagement_score numeric(5,2) DEFAULT 0,
  churn_risk_score numeric(5,2) DEFAULT 0,
  
  CONSTRAINT customer_metrics_pkey PRIMARY KEY (id),
  CONSTRAINT customer_metrics_customer_period_unique UNIQUE (customer_id, period_type, period_start)
);

-- Indexes for better query performance
CREATE INDEX idx_orders_order_id ON public.orders(order_id);
CREATE INDEX idx_orders_customer_id ON public.orders(customer_id);
CREATE INDEX idx_orders_created_at ON public.orders(created_at_shopify);
CREATE INDEX idx_orders_financial_status ON public.orders(financial_status);

CREATE INDEX idx_order_line_items_order_id ON public.order_line_items(order_id);
CREATE INDEX idx_order_line_items_product_id ON public.order_line_items(product_id);
CREATE INDEX idx_order_line_items_variant_id ON public.order_line_items(variant_id);
CREATE INDEX idx_order_line_items_shopify_product_id ON public.order_line_items(shopify_product_id);
CREATE INDEX idx_order_line_items_shopify_variant_id ON public.order_line_items(shopify_variant_id);

CREATE INDEX idx_product_metrics_product_id ON public.product_metrics(product_id);
CREATE INDEX idx_product_metrics_variant_id ON public.product_metrics(variant_id);
CREATE INDEX idx_product_metrics_period ON public.product_metrics(period_type, period_start);
CREATE INDEX idx_product_metrics_recommendation_score ON public.product_metrics(recommendation_score DESC);

CREATE INDEX idx_customer_metrics_customer_id ON public.customer_metrics(customer_id);
CREATE INDEX idx_customer_metrics_period ON public.customer_metrics(period_type, period_start);
CREATE INDEX idx_customer_metrics_loyalty_score ON public.customer_metrics(loyalty_score DESC);