-- Harden finance data integrity, indexing, and transaction audit history.

-- Enforce future writes without failing deployment if old MVP rows still need cleanup.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'transactions_user_id_required'
  ) THEN
    ALTER TABLE public.transactions
      ADD CONSTRAINT transactions_user_id_required CHECK (user_id IS NOT NULL) NOT VALID;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'transactions_amount_positive'
  ) THEN
    ALTER TABLE public.transactions
      ADD CONSTRAINT transactions_amount_positive CHECK (amount > 0) NOT VALID;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'transactions_payment_mode_valid'
  ) THEN
    ALTER TABLE public.transactions
      ADD CONSTRAINT transactions_payment_mode_valid CHECK (payment_mode IN ('UPI', 'Card', 'Cash')) NOT VALID;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'budgets_user_id_required'
  ) THEN
    ALTER TABLE public.budgets
      ADD CONSTRAINT budgets_user_id_required CHECK (user_id IS NOT NULL) NOT VALID;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'budgets_non_negative_amounts'
  ) THEN
    ALTER TABLE public.budgets
      ADD CONSTRAINT budgets_non_negative_amounts CHECK (
        monthly_income >= 0 AND
        overall_budget >= 0 AND
        savings_goal >= 0 AND
        grocery >= 0 AND
        housing >= 0 AND
        loans_emis >= 0 AND
        tuition_education >= 0 AND
        travel >= 0 AND
        shopping >= 0 AND
        entertainment >= 0 AND
        medical >= 0 AND
        personal >= 0 AND
        health >= 0
      ) NOT VALID;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'transaction_history_field_name_valid'
  ) THEN
    ALTER TABLE public.transaction_history
      ADD CONSTRAINT transaction_history_field_name_valid CHECK (
        field_name IN ('amount', 'date', 'category', 'payment_mode', 'note', 'type')
      ) NOT VALID;
  END IF;
END $$;

-- Ensure updates cannot move records across users.
DROP POLICY IF EXISTS "Users can update own transactions" ON public.transactions;
CREATE POLICY "Users can update own transactions"
  ON public.transactions FOR UPDATE
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS "Users can update own budgets" ON public.budgets;
CREATE POLICY "Users can update own budgets"
  ON public.budgets FOR UPDATE
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- Query-path indexes used by dashboard, budget, realtime refreshes, and history views.
CREATE INDEX IF NOT EXISTS transactions_user_date_idx
  ON public.transactions (user_id, date DESC, created_at DESC);

CREATE INDEX IF NOT EXISTS budgets_user_month_idx
  ON public.budgets (user_id, month);

CREATE INDEX IF NOT EXISTS transaction_history_user_transaction_edited_idx
  ON public.transaction_history (user_id, transaction_id, edited_at DESC);

-- Keep transaction updated_at consistent even if the client forgets to set it.
CREATE OR REPLACE FUNCTION public.set_transaction_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

DROP TRIGGER IF EXISTS set_transactions_updated_at ON public.transactions;
CREATE TRIGGER set_transactions_updated_at
BEFORE UPDATE OF amount, date, category, payment_mode, note, type
ON public.transactions
FOR EACH ROW
EXECUTE FUNCTION public.set_transaction_updated_at();

-- Database-owned audit history. This prevents clients from skipping or forging edit logs.
-- Clients can read their history, but inserts are owned by the trigger below.
DROP POLICY IF EXISTS "Users can insert own edit history" ON public.transaction_history;

CREATE OR REPLACE FUNCTION public.log_transaction_update_history()
RETURNS TRIGGER AS $$
DECLARE
  actor_user_id uuid := COALESCE(auth.uid(), NEW.user_id);
BEGIN
  IF OLD.amount IS DISTINCT FROM NEW.amount THEN
    INSERT INTO public.transaction_history (transaction_id, user_id, field_name, old_value, new_value)
    VALUES (NEW.id, actor_user_id, 'amount', OLD.amount::text, NEW.amount::text);
  END IF;

  IF OLD.date IS DISTINCT FROM NEW.date THEN
    INSERT INTO public.transaction_history (transaction_id, user_id, field_name, old_value, new_value)
    VALUES (NEW.id, actor_user_id, 'date', OLD.date::text, NEW.date::text);
  END IF;

  IF OLD.category IS DISTINCT FROM NEW.category THEN
    INSERT INTO public.transaction_history (transaction_id, user_id, field_name, old_value, new_value)
    VALUES (NEW.id, actor_user_id, 'category', OLD.category, NEW.category);
  END IF;

  IF OLD.payment_mode IS DISTINCT FROM NEW.payment_mode THEN
    INSERT INTO public.transaction_history (transaction_id, user_id, field_name, old_value, new_value)
    VALUES (NEW.id, actor_user_id, 'payment_mode', OLD.payment_mode, NEW.payment_mode);
  END IF;

  IF OLD.note IS DISTINCT FROM NEW.note THEN
    INSERT INTO public.transaction_history (transaction_id, user_id, field_name, old_value, new_value)
    VALUES (NEW.id, actor_user_id, 'note', OLD.note, NEW.note);
  END IF;

  IF OLD.type IS DISTINCT FROM NEW.type THEN
    INSERT INTO public.transaction_history (transaction_id, user_id, field_name, old_value, new_value)
    VALUES (NEW.id, actor_user_id, 'type', OLD.type, NEW.type);
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

DROP TRIGGER IF EXISTS log_transaction_update_history ON public.transactions;
CREATE TRIGGER log_transaction_update_history
AFTER UPDATE OF amount, date, category, payment_mode, note, type
ON public.transactions
FOR EACH ROW
EXECUTE FUNCTION public.log_transaction_update_history();
