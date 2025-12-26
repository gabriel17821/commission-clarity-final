-- Add offer-related columns to invoice_products table
ALTER TABLE public.invoice_products 
ADD COLUMN IF NOT EXISTS quantity_sold numeric NOT NULL DEFAULT 0,
ADD COLUMN IF NOT EXISTS quantity_free numeric NOT NULL DEFAULT 0,
ADD COLUMN IF NOT EXISTS unit_price numeric NOT NULL DEFAULT 0,
ADD COLUMN IF NOT EXISTS gross_amount numeric NOT NULL DEFAULT 0,
ADD COLUMN IF NOT EXISTS net_amount numeric NOT NULL DEFAULT 0;

-- Add comment for clarity
COMMENT ON COLUMN public.invoice_products.quantity_sold IS 'Quantity actually sold (paid for)';
COMMENT ON COLUMN public.invoice_products.quantity_free IS 'Quantity given for free (offers like 10+1)';
COMMENT ON COLUMN public.invoice_products.unit_price IS 'Price per unit';
COMMENT ON COLUMN public.invoice_products.gross_amount IS 'Total gross value (all units at unit price)';
COMMENT ON COLUMN public.invoice_products.net_amount IS 'Net amount (only sold units, commission calculated on this)';

-- Add gross and net totals to invoices
ALTER TABLE public.invoices
ADD COLUMN IF NOT EXISTS gross_total numeric NOT NULL DEFAULT 0,
ADD COLUMN IF NOT EXISTS net_total numeric NOT NULL DEFAULT 0;