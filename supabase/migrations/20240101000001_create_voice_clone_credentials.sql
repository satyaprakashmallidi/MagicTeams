-- Create voice_clone_credentials table
CREATE TABLE voice_clone_credentials (
    id SERIAL PRIMARY KEY,
    user_id UUID REFERENCES auth.users NOT NULL,
    api_key VARCHAR(255) NOT NULL,
    model_id VARCHAR(255),
    voice_id VARCHAR(255),
    settings JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    is_active BOOLEAN DEFAULT true,
    UNIQUE(user_id, api_key)
);

-- Create RLS policies
ALTER TABLE voice_clone_credentials ENABLE ROW LEVEL SECURITY;

-- Create policy to allow users to only see their own credentials
CREATE POLICY "Users can view their own voice clone credentials"
    ON voice_clone_credentials
    FOR SELECT
    USING (auth.uid() = user_id);

-- Create policy to allow users to insert their own credentials
CREATE POLICY "Users can insert their own voice clone credentials"
    ON voice_clone_credentials
    FOR INSERT
    WITH CHECK (auth.uid() = user_id);

-- Create policy to allow users to update their own credentials
CREATE POLICY "Users can update their own voice clone credentials"
    ON voice_clone_credentials
    FOR UPDATE
    USING (auth.uid() = user_id);

-- Create policy to allow users to delete their own credentials
CREATE POLICY "Users can delete their own voice clone credentials"
    ON voice_clone_credentials
    FOR DELETE
    USING (auth.uid() = user_id);

-- Create function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_voice_clone_credentials_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Create trigger for updating updated_at
CREATE TRIGGER update_voice_clone_credentials_timestamp
    BEFORE UPDATE ON voice_clone_credentials
    FOR EACH ROW
    EXECUTE FUNCTION update_voice_clone_credentials_updated_at();
