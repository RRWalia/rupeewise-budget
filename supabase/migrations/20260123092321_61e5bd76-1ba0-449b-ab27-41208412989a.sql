-- Drop the old constraint that only allows one budget per month globally
-- This was incorrectly restricting to one budget per month for all users
-- The correct constraint (month, user_id) already exists
ALTER TABLE public.budgets DROP CONSTRAINT IF EXISTS budgets_month_unique;