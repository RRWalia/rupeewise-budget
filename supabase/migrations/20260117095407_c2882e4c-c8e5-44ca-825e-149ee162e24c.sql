-- Create transactions table
CREATE TABLE public.transactions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  amount NUMERIC NOT NULL,
  date DATE NOT NULL DEFAULT CURRENT_DATE,
  category TEXT NOT NULL,
  payment_mode TEXT NOT NULL DEFAULT 'UPI',
  note TEXT,
  type TEXT NOT NULL CHECK (type IN ('income', 'expense')),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable Row Level Security (public access for MVP - no auth required)
ALTER TABLE public.transactions ENABLE ROW LEVEL SECURITY;

-- Create policy for public read access
CREATE POLICY "Anyone can read transactions"
ON public.transactions
FOR SELECT
USING (true);

-- Create policy for public insert access
CREATE POLICY "Anyone can insert transactions"
ON public.transactions
FOR INSERT
WITH CHECK (true);

-- Create policy for public update access
CREATE POLICY "Anyone can update transactions"
ON public.transactions
FOR UPDATE
USING (true);

-- Create policy for public delete access
CREATE POLICY "Anyone can delete transactions"
ON public.transactions
FOR DELETE
USING (true);