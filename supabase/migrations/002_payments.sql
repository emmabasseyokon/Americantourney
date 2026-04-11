-- Payment gating: track free usage and payment transactions

-- Add free usage tracking to profiles
ALTER TABLE profiles
  ADD COLUMN free_tournament_used boolean NOT NULL DEFAULT false,
  ADD COLUMN free_scoreboard_used boolean NOT NULL DEFAULT false;

-- Payments table
CREATE TABLE payments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  item_type text NOT NULL CHECK (item_type IN ('tournament', 'scoreboard')),
  amount_kobo bigint NOT NULL,
  currency text NOT NULL CHECK (currency IN ('NGN', 'USD')),
  paystack_reference text UNIQUE NOT NULL,
  paystack_access_code text,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'success', 'failed')),
  item_metadata jsonb,
  created_item_id uuid,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE payments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own payments"
  ON payments FOR SELECT USING (auth.uid() = user_id);
