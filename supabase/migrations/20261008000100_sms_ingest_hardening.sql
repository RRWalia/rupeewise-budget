-- Audit log and sliding-window rate limiting for the public sms-ingest edge
-- function. Only the first 8 characters of any presented webhook secret are
-- stored here, never the full secret.
-- Idempotent so it is safe to run again during a deployment retry.

CREATE TABLE IF NOT EXISTS public.sms_ingest_logs (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  bot_chat_id UUID REFERENCES public.bot_chats(id) ON DELETE SET NULL,
  secret_prefix TEXT,
  ip TEXT,
  user_agent TEXT,
  sender TEXT,
  outcome TEXT NOT NULL
    CHECK (outcome IN ('enqueued', 'duplicate', 'not_sms', 'not_transaction', 'unauthorized', 'rate_limited', 'error')),
  amount NUMERIC,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS sms_ingest_logs_bot_chat_created_idx
  ON public.sms_ingest_logs (bot_chat_id, created_at DESC);

ALTER TABLE public.sms_ingest_logs ENABLE ROW LEVEL SECURITY;

-- Deliberately NO policies: this is an audit log written only by the
-- sms-ingest edge function via the service-role key, and it must stay
-- unreadable to anon/authenticated clients.
REVOKE ALL ON TABLE public.sms_ingest_logs FROM anon, authenticated;
GRANT ALL ON TABLE public.sms_ingest_logs TO service_role;
