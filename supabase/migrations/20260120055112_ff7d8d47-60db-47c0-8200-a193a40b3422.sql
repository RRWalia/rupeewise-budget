-- Add user_id column to transactions table
ALTER TABLE public.transactions 
ADD COLUMN user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE;

-- Add user_id column to budgets table
ALTER TABLE public.budgets 
ADD COLUMN user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE;

-- Drop existing permissive policies on transactions
DROP POLICY IF EXISTS "Anyone can delete transactions" ON public.transactions;
DROP POLICY IF EXISTS "Anyone can insert transactions" ON public.transactions;
DROP POLICY IF EXISTS "Anyone can read transactions" ON public.transactions;
DROP POLICY IF EXISTS "Anyone can update transactions" ON public.transactions;

-- Drop existing permissive policies on budgets
DROP POLICY IF EXISTS "Anyone can delete budgets" ON public.budgets;
DROP POLICY IF EXISTS "Anyone can insert budgets" ON public.budgets;
DROP POLICY IF EXISTS "Anyone can read budgets" ON public.budgets;
DROP POLICY IF EXISTS "Anyone can update budgets" ON public.budgets;

-- Create secure RLS policies for transactions
CREATE POLICY "Users can read own transactions"
ON public.transactions FOR SELECT
TO authenticated
USING (user_id = auth.uid());

CREATE POLICY "Users can insert own transactions"
ON public.transactions FOR INSERT
TO authenticated
WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can update own transactions"
ON public.transactions FOR UPDATE
TO authenticated
USING (user_id = auth.uid());

CREATE POLICY "Users can delete own transactions"
ON public.transactions FOR DELETE
TO authenticated
USING (user_id = auth.uid());

-- Create secure RLS policies for budgets
CREATE POLICY "Users can read own budgets"
ON public.budgets FOR SELECT
TO authenticated
USING (user_id = auth.uid());

CREATE POLICY "Users can insert own budgets"
ON public.budgets FOR INSERT
TO authenticated
WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can update own budgets"
ON public.budgets FOR UPDATE
TO authenticated
USING (user_id = auth.uid());

CREATE POLICY "Users can delete own budgets"
ON public.budgets FOR DELETE
TO authenticated
USING (user_id = auth.uid());