
-- Drop all restrictive policies on transactions
DROP POLICY "Users can delete own transactions" ON public.transactions;
DROP POLICY "Users can insert own transactions" ON public.transactions;
DROP POLICY "Users can read own transactions" ON public.transactions;
DROP POLICY "Users can update own transactions" ON public.transactions;

-- Recreate as PERMISSIVE policies
CREATE POLICY "Users can read own transactions"
  ON public.transactions FOR SELECT
  USING (user_id = auth.uid());

CREATE POLICY "Users can insert own transactions"
  ON public.transactions FOR INSERT
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can update own transactions"
  ON public.transactions FOR UPDATE
  USING (user_id = auth.uid());

CREATE POLICY "Users can delete own transactions"
  ON public.transactions FOR DELETE
  USING (user_id = auth.uid());

-- Fix budgets table too (same issue)
DROP POLICY "Users can delete own budgets" ON public.budgets;
DROP POLICY "Users can insert own budgets" ON public.budgets;
DROP POLICY "Users can read own budgets" ON public.budgets;
DROP POLICY "Users can update own budgets" ON public.budgets;

CREATE POLICY "Users can read own budgets"
  ON public.budgets FOR SELECT
  USING (user_id = auth.uid());

CREATE POLICY "Users can insert own budgets"
  ON public.budgets FOR INSERT
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can update own budgets"
  ON public.budgets FOR UPDATE
  USING (user_id = auth.uid());

CREATE POLICY "Users can delete own budgets"
  ON public.budgets FOR DELETE
  USING (user_id = auth.uid());
