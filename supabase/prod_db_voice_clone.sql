-- Create voice clone credentials table in production
CREATE TABLE IF NOT EXISTS voice_clone_credentials (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID REFERENCES auth.users NOT NULL,
    api_key VARCHAR(255) NOT NULL,
    model_id VARCHAR(255),
    voice_id VARCHAR(255),
    provider VARCHAR(50) DEFAULT 'elevenlabs',
    api_url TEXT,
    quota_limit INTEGER,
    quota_used INTEGER DEFAULT 0,
    settings JSONB DEFAULT '{}'::jsonb,
    last_used_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    is_active BOOLEAN DEFAULT true,
    CONSTRAINT unique_user_api_key UNIQUE(user_id, api_key)
);

-- Enable Row Level Security
ALTER TABLE voice_clone_credentials ENABLE ROW LEVEL SECURITY;

-- Create policies for secure access
-- Allow users to view only their own credentials
CREATE POLICY "Users can view own voice clone credentials"
    ON voice_clone_credentials
    FOR SELECT
    USING (auth.uid() = user_id);

-- Allow users to insert their own credentials
CREATE POLICY "Users can insert own voice clone credentials"
    ON voice_clone_credentials
    FOR INSERT
    WITH CHECK (auth.uid() = user_id);

-- Allow users to update their own credentials
CREATE POLICY "Users can update own voice clone credentials"
    ON voice_clone_credentials
    FOR UPDATE
    USING (auth.uid() = user_id);

-- Allow users to delete their own credentials
CREATE POLICY "Users can delete own voice clone credentials"
    ON voice_clone_credentials
    FOR DELETE
    USING (auth.uid() = user_id);

-- Create updated_at trigger function
CREATE OR REPLACE FUNCTION update_voice_clone_credentials_timestamp()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Create trigger for updating timestamp
CREATE TRIGGER update_voice_clone_credentials_timestamp
    BEFORE UPDATE ON voice_clone_credentials
    FOR EACH ROW
    EXECUTE FUNCTION update_voice_clone_credentials_timestamp();

-- Create trigger to update last_used_at
CREATE OR REPLACE FUNCTION update_last_used_timestamp()
RETURNS TRIGGER AS $$
BEGIN
    NEW.last_used_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_last_used_timestamp
    BEFORE UPDATE ON voice_clone_credentials
    FOR EACH ROW
    WHEN (OLD.quota_used IS DISTINCT FROM NEW.quota_used)
    EXECUTE FUNCTION update_last_used_timestamp();

-- Grant necessary permissions
GRANT ALL ON voice_clone_credentials TO authenticated;

-- Create indexes for better performance
CREATE INDEX idx_voice_clone_credentials_user_id ON voice_clone_credentials(user_id);
CREATE INDEX idx_voice_clone_credentials_is_active ON voice_clone_credentials(is_active);
CREATE INDEX idx_voice_clone_credentials_provider ON voice_clone_credentials(provider);
