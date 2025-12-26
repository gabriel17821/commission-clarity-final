-- Add category/brand field to products table
ALTER TABLE public.products 
ADD COLUMN IF NOT EXISTS category text DEFAULT NULL;

-- Add comment for clarity
COMMENT ON COLUMN public.products.category IS 'Product category or brand (e.g., Azetabio, Vitalis, DLS)';

-- Add province/region field to clients table for geographic analysis
ALTER TABLE public.clients 
ADD COLUMN IF NOT EXISTS province text DEFAULT NULL;

-- Add comment for clarity
COMMENT ON COLUMN public.clients.province IS 'Province or region of the client in Dominican Republic';