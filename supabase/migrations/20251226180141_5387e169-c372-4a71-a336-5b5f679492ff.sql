-- Create table for persisting CSV matches globally
CREATE TABLE public.csv_matches (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  match_type TEXT NOT NULL CHECK (match_type IN ('product', 'client')),
  csv_name TEXT NOT NULL,
  matched_id UUID NOT NULL,
  matched_name TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(match_type, csv_name)
);

-- Enable RLS but allow public access (no auth required)
ALTER TABLE public.csv_matches ENABLE ROW LEVEL SECURITY;

-- Everyone can read matches
CREATE POLICY "Anyone can view csv_matches"
ON public.csv_matches
FOR SELECT
USING (true);

-- Everyone can insert matches
CREATE POLICY "Anyone can insert csv_matches"
ON public.csv_matches
FOR INSERT
WITH CHECK (true);

-- Everyone can update matches
CREATE POLICY "Anyone can update csv_matches"
ON public.csv_matches
FOR UPDATE
USING (true);

-- Everyone can delete matches
CREATE POLICY "Anyone can delete csv_matches"
ON public.csv_matches
FOR DELETE
USING (true);