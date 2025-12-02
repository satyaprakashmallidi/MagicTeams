-- Create user_api_keys table for storing encrypted API keys per user
CREATE TABLE user_api_keys (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    service VARCHAR(50) NOT NULL, -- 'gemini', 'openai', etc.
    encrypted_key TEXT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL,
    
    -- Ensure one API key per service per user
    UNIQUE(user_id, service)
);

-- Add RLS policy
ALTER TABLE user_api_keys ENABLE ROW LEVEL SECURITY;

-- Users can only access their own API keys
CREATE POLICY "Users can view own API keys" ON user_api_keys
    FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own API keys" ON user_api_keys
    FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own API keys" ON user_api_keys
    FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own API keys" ON user_api_keys
    FOR DELETE USING (auth.uid() = user_id);

-- Add index for performance
CREATE INDEX idx_user_api_keys_user_service ON user_api_keys(user_id, service);

-- Add updated_at trigger
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = TIMEZONE('utc'::text, NOW());
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_user_api_keys_updated_at 
    BEFORE UPDATE ON user_api_keys 
    FOR EACH ROW 
    EXECUTE FUNCTION update_updated_at_column();