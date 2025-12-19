-- Create analytics_data table for detailed sales analysis
CREATE TABLE public.analytics_data (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  invoice_id UUID REFERENCES public.invoices(id) ON DELETE CASCADE,
  client_id UUID REFERENCES public.clients(id) ON DELETE SET NULL,
  product_id UUID REFERENCES public.products(id) ON DELETE SET NULL,
  product_name TEXT NOT NULL,
  quantity NUMERIC NOT NULL DEFAULT 1,
  unit_price NUMERIC NOT NULL DEFAULT 0,
  total_amount NUMERIC NOT NULL DEFAULT 0,
  commission_percentage NUMERIC NOT NULL DEFAULT 0,
  commission_amount NUMERIC NOT NULL DEFAULT 0,
  sale_date DATE NOT NULL DEFAULT CURRENT_DATE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.analytics_data ENABLE ROW LEVEL SECURITY;

-- Create policies for public access (same as other tables)
CREATE POLICY "Enable read access for all users" 
ON public.analytics_data FOR SELECT USING (true);

CREATE POLICY "Enable insert access for all users" 
ON public.analytics_data FOR INSERT WITH CHECK (true);

CREATE POLICY "Enable update access for all users" 
ON public.analytics_data FOR UPDATE USING (true);

CREATE POLICY "Enable delete access for all users" 
ON public.analytics_data FOR DELETE USING (true);

-- Create indexes for better query performance
CREATE INDEX idx_analytics_client ON public.analytics_data(client_id);
CREATE INDEX idx_analytics_product ON public.analytics_data(product_id);
CREATE INDEX idx_analytics_date ON public.analytics_data(sale_date);
CREATE INDEX idx_analytics_invoice ON public.analytics_data(invoice_id);