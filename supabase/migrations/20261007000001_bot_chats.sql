-- Telegram/WhatsApp bot bindings for chat-based expense logging (Phase 1: Telegram).
-- Idempotent: safe to re-run; every object is existence-guarded.

-- 'Other' payment mode: chat-logged transactions have no real payment rail,
-- so the existing CHECK constraint is widened (dropped and re-added, NOT VALID).
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'transactions_payment_mode_valid'
  ) THEN
    ALTER TABLE public.transactions
      DROP CONSTRAINT transactions_payment_mode_valid;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'transactions_payment_mode_valid'
  ) THEN
    ALTER TABLE public.transactions
      ADD CONSTRAINT transactions_payment_mode_valid CHECK (payment_mode IN ('UPI', 'Card', 'Cash', 'Other')) NOT VALID;
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS public.bot_chats (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  provider TEXT NOT NULL DEFAULT 'telegram' CHECK (provider IN ('telegram', 'whatsapp')),
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'active', 'disabled')),
  chat_id TEXT,
  bot_token TEXT NOT NULL,
  bot_username TEXT,
  bind_code TEXT,
  webhook_secret TEXT NOT NULL,
  last_transaction_id UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_bot_chats_user_provider ON public.bot_chats (user_id, provider);
-- One live connection per user per provider (disconnect sets status='disabled' instead of deleting, if history is ever needed).
CREATE UNIQUE INDEX IF NOT EXISTS idx_bot_chats_live_per_user ON public.bot_chats (user_id, provider) WHERE status <> 'disabled';
CREATE UNIQUE INDEX IF NOT EXISTS idx_bot_chats_webhook_secret ON public.bot_chats (webhook_secret);
CREATE UNIQUE INDEX IF NOT EXISTS idx_bot_chats_bind_code ON public.bot_chats (bind_code);

ALTER TABLE public.bot_chats ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policy WHERE polname = 'bot_chats_select_own') THEN
    CREATE POLICY bot_chats_select_own ON public.bot_chats
      FOR SELECT TO authenticated USING (user_id = auth.uid());
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_policy WHERE polname = 'bot_chats_insert_own') THEN
    CREATE POLICY bot_chats_insert_own ON public.bot_chats
      FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_policy WHERE polname = 'bot_chats_update_own') THEN
    CREATE POLICY bot_chats_update_own ON public.bot_chats
      FOR UPDATE TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_policy WHERE polname = 'bot_chats_delete_own') THEN
    CREATE POLICY bot_chats_delete_own ON public.bot_chats
      FOR DELETE TO authenticated USING (user_id = auth.uid());
  END IF;
END $$;
