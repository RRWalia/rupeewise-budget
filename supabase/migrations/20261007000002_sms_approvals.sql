-- Forwarded bank SMS are suggestions only: they are not added to transactions
-- until the account owner approves them in the app.
-- Idempotent so it is safe to run again during a deployment retry.

CREATE TABLE IF NOT EXISTS public.pending_transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  bot_chat_id UUID REFERENCES public.bot_chats(id) ON DELETE SET NULL,
  source_fingerprint TEXT NOT NULL,
  telegram_message_id BIGINT,
  source_sender TEXT,
  amount NUMERIC NOT NULL CHECK (amount > 0 AND amount <= 100000000),
  date DATE NOT NULL,
  category TEXT NOT NULL,
  category_guessed BOOLEAN NOT NULL DEFAULT false,
  payment_mode TEXT NOT NULL DEFAULT 'Other'
    CHECK (payment_mode IN ('UPI', 'Card', 'Cash', 'Other')),
  note TEXT,
  type TEXT NOT NULL CHECK (type IN ('income', 'expense')),
  status TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'approved', 'dismissed')),
  transaction_id UUID REFERENCES public.transactions(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  decided_at TIMESTAMPTZ,
  CONSTRAINT pending_transactions_source_fingerprint_nonempty CHECK (length(source_fingerprint) > 0)
);

CREATE INDEX IF NOT EXISTS pending_transactions_user_status_created_idx
  ON public.pending_transactions (user_id, status, created_at DESC);

-- Stable hash of sender + normalized message content dedupes duplicate forwarder
-- deliveries even when Telegram assigns a new message ID on a second forward.
CREATE UNIQUE INDEX IF NOT EXISTS pending_transactions_user_fingerprint_uidx
  ON public.pending_transactions (user_id, source_fingerprint);

-- Telegram retries the same update with the same message ID; do not create twice.
CREATE UNIQUE INDEX IF NOT EXISTS pending_transactions_bot_message_uidx
  ON public.pending_transactions (bot_chat_id, telegram_message_id)
  WHERE bot_chat_id IS NOT NULL AND telegram_message_id IS NOT NULL;

ALTER TABLE public.pending_transactions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS pending_transactions_select_own ON public.pending_transactions;
CREATE POLICY pending_transactions_select_own
  ON public.pending_transactions
  FOR SELECT TO authenticated
  USING (user_id = auth.uid());

-- The app can only read candidates. Inserts come from the Telegram webhook, and
-- all state changes are performed by the guarded functions below.
REVOKE ALL ON TABLE public.pending_transactions FROM anon, authenticated;
GRANT SELECT ON TABLE public.pending_transactions TO authenticated;
GRANT ALL ON TABLE public.pending_transactions TO service_role;

CREATE OR REPLACE FUNCTION public.approve_pending_transaction(
  p_pending_id UUID,
  p_amount NUMERIC DEFAULT NULL,
  p_type TEXT DEFAULT NULL,
  p_category TEXT DEFAULT NULL,
  p_date DATE DEFAULT NULL,
  p_payment_mode TEXT DEFAULT NULL,
  p_note TEXT DEFAULT NULL
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_pending public.pending_transactions%ROWTYPE;
  v_actor UUID := auth.uid();
  v_amount NUMERIC;
  v_type TEXT;
  v_category TEXT;
  v_date DATE;
  v_payment_mode TEXT;
  v_note TEXT;
  v_transaction_id UUID;
BEGIN
  IF v_actor IS NULL AND COALESCE(auth.role(), '') <> 'service_role' THEN
    RAISE EXCEPTION 'Authentication required' USING ERRCODE = '42501';
  END IF;

  SELECT * INTO v_pending
  FROM public.pending_transactions
  WHERE id = p_pending_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Pending transaction not found' USING ERRCODE = 'P0002';
  END IF;

  IF v_actor IS NOT NULL AND v_pending.user_id <> v_actor THEN
    RAISE EXCEPTION 'Not allowed to approve this transaction' USING ERRCODE = '42501';
  END IF;

  -- Make a repeated approval request safe after a mobile network retry.
  IF v_pending.status = 'approved' THEN
    RETURN v_pending.transaction_id;
  END IF;

  IF v_pending.status <> 'pending' THEN
    RAISE EXCEPTION 'This suggestion has already been dismissed' USING ERRCODE = 'P0001';
  END IF;

  v_amount := COALESCE(p_amount, v_pending.amount);
  v_type := COALESCE(p_type, v_pending.type);
  v_category := COALESCE(p_category, v_pending.category);
  v_date := COALESCE(p_date, v_pending.date);
  v_payment_mode := COALESCE(p_payment_mode, v_pending.payment_mode);
  v_note := LEFT(COALESCE(NULLIF(BTRIM(p_note), ''), NULLIF(BTRIM(v_pending.note), ''), 'Bank transaction'), 100);

  IF v_amount <= 0 OR v_amount > 100000000 THEN
    RAISE EXCEPTION 'Amount is outside the allowed range' USING ERRCODE = '22023';
  END IF;

  IF v_type NOT IN ('income', 'expense') THEN
    RAISE EXCEPTION 'Invalid transaction type' USING ERRCODE = '22023';
  END IF;

  IF v_type = 'expense' AND v_category NOT IN (
    'Grocery', 'Housing', 'Loans & EMIs', 'Tuition & Education', 'Travel',
    'Shopping', 'Entertainment', 'Medical', 'Personal', 'Health'
  ) THEN
    RAISE EXCEPTION 'Invalid expense category' USING ERRCODE = '22023';
  END IF;

  IF v_type = 'income' AND v_category NOT IN ('Salary', 'Freelance', 'Other') THEN
    RAISE EXCEPTION 'Invalid income category' USING ERRCODE = '22023';
  END IF;

  IF v_payment_mode NOT IN ('UPI', 'Card', 'Cash', 'Other') THEN
    RAISE EXCEPTION 'Invalid payment mode' USING ERRCODE = '22023';
  END IF;

  INSERT INTO public.transactions (user_id, amount, type, category, payment_mode, date, note)
  VALUES (v_pending.user_id, v_amount, v_type, v_category, v_payment_mode, v_date, '[SMS] ' || v_note)
  RETURNING id INTO v_transaction_id;

  UPDATE public.pending_transactions
  SET amount = v_amount,
      type = v_type,
      category = v_category,
      date = v_date,
      payment_mode = v_payment_mode,
      note = v_note,
      category_guessed = false,
      status = 'approved',
      transaction_id = v_transaction_id,
      decided_at = now()
  WHERE id = v_pending.id;

  RETURN v_transaction_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.dismiss_pending_transaction(p_pending_id UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_pending public.pending_transactions%ROWTYPE;
  v_actor UUID := auth.uid();
BEGIN
  IF v_actor IS NULL THEN
    RAISE EXCEPTION 'Authentication required' USING ERRCODE = '42501';
  END IF;

  SELECT * INTO v_pending
  FROM public.pending_transactions
  WHERE id = p_pending_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Pending transaction not found' USING ERRCODE = 'P0002';
  END IF;

  IF v_pending.user_id <> v_actor THEN
    RAISE EXCEPTION 'Not allowed to dismiss this transaction' USING ERRCODE = '42501';
  END IF;

  IF v_pending.status = 'dismissed' THEN
    RETURN;
  END IF;

  IF v_pending.status <> 'pending' THEN
    RAISE EXCEPTION 'An approved transaction cannot be dismissed here' USING ERRCODE = 'P0001';
  END IF;

  UPDATE public.pending_transactions
  SET status = 'dismissed', decided_at = now()
  WHERE id = v_pending.id;
END;
$$;

REVOKE ALL ON FUNCTION public.approve_pending_transaction(UUID, NUMERIC, TEXT, TEXT, DATE, TEXT, TEXT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.approve_pending_transaction(UUID, NUMERIC, TEXT, TEXT, DATE, TEXT, TEXT) TO authenticated, service_role;

REVOKE ALL ON FUNCTION public.dismiss_pending_transaction(UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.dismiss_pending_transaction(UUID) TO authenticated;
