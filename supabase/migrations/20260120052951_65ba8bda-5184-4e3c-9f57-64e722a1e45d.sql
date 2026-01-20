-- Create budgets table for monthly budget settings
CREATE TABLE IF NOT EXISTS public.budgets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  month TEXT NOT NULL,

  monthly_income NUMERIC NOT NULL DEFAULT 0,
  overall_budget NUMERIC NOT NULL DEFAULT 0,
  savings_goal NUMERIC NOT NULL DEFAULT 0,

  grocery NUMERIC NOT NULL DEFAULT 0,
  housing NUMERIC NOT NULL DEFAULT 0,
  loans_emis NUMERIC NOT NULL DEFAULT 0,
  tuition_education NUMERIC NOT NULL DEFAULT 0,
  travel NUMERIC NOT NULL DEFAULT 0,
  shopping NUMERIC NOT NULL DEFAULT 0,
  entertainment NUMERIC NOT NULL DEFAULT 0,
  medical NUMERIC NOT NULL DEFAULT 0,
  personal NUMERIC NOT NULL DEFAULT 0,
  health NUMERIC NOT NULL DEFAULT 0,

  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),

  CONSTRAINT budgets_month_unique UNIQUE (month)
);

-- Timestamp trigger function
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

-- Trigger to keep updated_at fresh
DROP TRIGGER IF EXISTS update_budgets_updated_at ON public.budgets;
CREATE TRIGGER update_budgets_updated_at
BEFORE UPDATE ON public.budgets
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Enable RLS
ALTER TABLE public.budgets ENABLE ROW LEVEL SECURITY;

-- Policies (matching current MVP openness of transactions)
DROP POLICY IF EXISTS "Anyone can read budgets" ON public.budgets;
CREATE POLICY "Anyone can read budgets"
ON public.budgets
FOR SELECT
USING (true);

DROP POLICY IF EXISTS "Anyone can insert budgets" ON public.budgets;
CREATE POLICY "Anyone can insert budgets"
ON public.budgets
FOR INSERT
WITH CHECK (true);

DROP POLICY IF EXISTS "Anyone can update budgets" ON public.budgets;
CREATE POLICY "Anyone can update budgets"
ON public.budgets
FOR UPDATE
USING (true)
WITH CHECK (true);

DROP POLICY IF EXISTS "Anyone can delete budgets" ON public.budgets;
CREATE POLICY "Anyone can delete budgets"
ON public.budgets
FOR DELETE
USING (true);