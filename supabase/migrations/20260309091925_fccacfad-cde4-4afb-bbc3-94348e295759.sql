
-- Add updated_at column to transactions
ALTER TABLE public.transactions ADD COLUMN IF NOT EXISTS updated_at timestamptz DEFAULT NULL;

-- Create transaction edit history table
CREATE TABLE public.transaction_history (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  transaction_id uuid NOT NULL REFERENCES public.transactions(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  field_name text NOT NULL,
  old_value text,
  new_value text,
  edited_at timestamptz NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.transaction_history ENABLE ROW LEVEL SECURITY;

-- RLS policies for transaction_history
CREATE POLICY "Users can read own edit history"
  ON public.transaction_history FOR SELECT
  USING (user_id = auth.uid());

CREATE POLICY "Users can insert own edit history"
  ON public.transaction_history FOR INSERT
  WITH CHECK (user_id = auth.uid());
