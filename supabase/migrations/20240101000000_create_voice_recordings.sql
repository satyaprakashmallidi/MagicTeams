-- Create voice_recordings table
CREATE TABLE voice_recordings (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    recording_name VARCHAR(255) NOT NULL,
    recording_url TEXT NOT NULL,
    duration INTEGER NOT NULL, -- Duration in seconds
    created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL,
    is_processed BOOLEAN DEFAULT FALSE,
    processed_url TEXT, -- URL for the processed/cloned voice file
    status VARCHAR(50) DEFAULT 'pending', -- pending, processing, completed, failed
    metadata JSONB DEFAULT '{}'::jsonb -- For any additional metadata
);

-- Create index on user_id for faster queries
CREATE INDEX idx_voice_recordings_user_id ON voice_recordings(user_id);

-- Create function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = TIMEZONE('utc'::text, NOW());
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Create trigger to automatically update updated_at
CREATE TRIGGER update_voice_recordings_updated_at
    BEFORE UPDATE ON voice_recordings
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();
