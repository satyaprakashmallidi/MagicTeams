-- Drop existing tables if they exist
DROP TABLE IF EXISTS twilio_phone_numbers;
DROP TABLE IF EXISTS twilio_account;

-- Create the main twilio account table
CREATE TABLE twilio_account (
    id SERIAL PRIMARY KEY,
    user_id UUID REFERENCES auth.users(id) NOT NULL,
    account_name VARCHAR(255) NOT NULL,
    account_sid VARCHAR(255) NOT NULL,
    auth_token VARCHAR(255) NOT NULL,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Create the phone numbers table
CREATE TABLE twilio_phone_numbers (
    id SERIAL PRIMARY KEY,
    account_id INTEGER REFERENCES twilio_account(id) ON DELETE CASCADE NOT NULL,
    phone_number VARCHAR(20) NOT NULL,
    friendly_name VARCHAR(255),
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Add indexes for better query performance
CREATE INDEX IF NOT EXISTS idx_twilio_account_user_id ON twilio_account(user_id);
CREATE INDEX IF NOT EXISTS idx_twilio_phone_numbers_account_id ON twilio_phone_numbers(account_id);

-- Enable Row Level Security
ALTER TABLE twilio_account ENABLE ROW LEVEL SECURITY;
ALTER TABLE twilio_phone_numbers ENABLE ROW LEVEL SECURITY;

-- Create RLS policies for twilio_account
CREATE POLICY "Users can view their own twilio account"
    ON twilio_account FOR SELECT
    USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own twilio account"
    ON twilio_account FOR INSERT
    WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own twilio account"
    ON twilio_account FOR UPDATE
    USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own twilio account"
    ON twilio_account FOR DELETE
    USING (auth.uid() = user_id);

-- Create RLS policies for twilio_phone_numbers
CREATE POLICY "Users can view their own twilio phone numbers"
    ON twilio_phone_numbers FOR SELECT
    USING (EXISTS (
        SELECT 1 FROM twilio_account
        WHERE twilio_account.id = twilio_phone_numbers.account_id
        AND twilio_account.user_id = auth.uid()
    ));

CREATE POLICY "Users can insert their own twilio phone numbers"
    ON twilio_phone_numbers FOR INSERT
    WITH CHECK (EXISTS (
        SELECT 1 FROM twilio_account
        WHERE twilio_account.id = twilio_phone_numbers.account_id
        AND twilio_account.user_id = auth.uid()
    ));

CREATE POLICY "Users can update their own twilio phone numbers"
    ON twilio_phone_numbers FOR UPDATE
    USING (EXISTS (
        SELECT 1 FROM twilio_account
        WHERE twilio_account.id = twilio_phone_numbers.account_id
        AND twilio_account.user_id = auth.uid()
    ));

CREATE POLICY "Users can delete their own twilio phone numbers"
    ON twilio_phone_numbers FOR DELETE
    USING (EXISTS (
        SELECT 1 FROM twilio_account
        WHERE twilio_account.id = twilio_phone_numbers.account_id
        AND twilio_account.user_id = auth.uid()
    ));

-- Create updated_at triggers
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_twilio_account_updated_at
    BEFORE UPDATE ON twilio_account
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_twilio_phone_numbers_updated_at
    BEFORE UPDATE ON twilio_phone_numbers
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- Grant access to authenticated users
GRANT ALL ON twilio_account TO authenticated;
GRANT ALL ON twilio_phone_numbers TO authenticated;
GRANT USAGE, SELECT ON SEQUENCE twilio_account_id_seq TO authenticated;
GRANT USAGE, SELECT ON SEQUENCE twilio_phone_numbers_id_seq TO authenticated;
