-- Migration: Create xPay payment tables
-- Description: Creates minute_packages and payment_transactions tables for xPay integration

-- ============================================
-- Table: minute_packages
-- Stores available minute packages for purchase
-- ============================================
CREATE TABLE minute_packages (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    name TEXT NOT NULL,
    description TEXT,
    minutes INTEGER NOT NULL,
    price_cents INTEGER NOT NULL,
    currency TEXT DEFAULT 'USD' NOT NULL,
    is_active BOOLEAN DEFAULT true NOT NULL,
    sort_order INTEGER DEFAULT 0 NOT NULL,
    created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT now() NOT NULL
);

-- Index for active packages query
CREATE INDEX minute_packages_is_active_idx ON minute_packages(is_active);
CREATE INDEX minute_packages_sort_order_idx ON minute_packages(sort_order);

-- Enable RLS
ALTER TABLE minute_packages ENABLE ROW LEVEL SECURITY;

-- Anyone can read active packages
CREATE POLICY "Anyone can read active minute packages"
    ON minute_packages FOR SELECT
    USING (is_active = true);

-- Only service role can manage packages
CREATE POLICY "Service role can manage minute packages"
    ON minute_packages FOR ALL
    USING (auth.role() = 'service_role');

-- ============================================
-- Table: payment_transactions
-- Logs all payment attempts for auditing
-- ============================================
CREATE TABLE payment_transactions (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    package_id UUID REFERENCES minute_packages(id),
    x_intent_id TEXT UNIQUE,
    receipt_id TEXT,
    amount_cents INTEGER NOT NULL,
    currency TEXT DEFAULT 'USD' NOT NULL,
    minutes_purchased INTEGER NOT NULL,
    status TEXT DEFAULT 'CREATED' NOT NULL CHECK (status IN ('CREATED', 'SUCCESS', 'FAILED', 'CANCELLED')),
    payment_method TEXT,
    xpay_event_id TEXT,
    metadata JSONB DEFAULT '{}',
    error_message TEXT,
    created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
    completed_at TIMESTAMPTZ
);

-- Indexes for common queries
CREATE INDEX payment_transactions_user_id_idx ON payment_transactions(user_id);
CREATE INDEX payment_transactions_x_intent_id_idx ON payment_transactions(x_intent_id);
CREATE INDEX payment_transactions_status_idx ON payment_transactions(status);
CREATE INDEX payment_transactions_created_at_idx ON payment_transactions(created_at DESC);

-- Enable RLS
ALTER TABLE payment_transactions ENABLE ROW LEVEL SECURITY;

-- Users can only view their own transactions
CREATE POLICY "Users can view their own transactions"
    ON payment_transactions FOR SELECT
    USING (auth.uid() = user_id);

-- Service role can manage all transactions (for webhook handler)
CREATE POLICY "Service role can manage all transactions"
    ON payment_transactions FOR ALL
    USING (auth.role() = 'service_role');

-- ============================================
-- Seed data: Default minute packages
-- ============================================
INSERT INTO minute_packages (name, description, minutes, price_cents, currency, sort_order) VALUES
    ('Starter', 'Perfect for getting started with AI calling', 30, 300, 'USD', 1),
    ('Standard', 'Most popular choice for regular users', 60, 600, 'USD', 2),
    ('Pro', 'Great value for power users', 120, 1200, 'USD', 3),
    ('Enterprise', 'Best value for high-volume calling', 300, 3000, 'USD', 4);

-- ============================================
-- Function: Update updated_at timestamp
-- ============================================
CREATE OR REPLACE FUNCTION update_minute_packages_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER minute_packages_updated_at_trigger
    BEFORE UPDATE ON minute_packages
    FOR EACH ROW
    EXECUTE FUNCTION update_minute_packages_updated_at();

-- ============================================
-- Grant permissions
-- ============================================
GRANT SELECT ON minute_packages TO authenticated;
GRANT SELECT ON payment_transactions TO authenticated;
