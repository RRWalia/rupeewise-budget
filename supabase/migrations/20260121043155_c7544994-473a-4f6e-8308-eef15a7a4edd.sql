-- Add unique constraint on month + user_id for budgets table
ALTER TABLE public.budgets ADD CONSTRAINT budgets_month_user_unique UNIQUE (month, user_id);