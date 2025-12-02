-- Create voice recordings table in production
CREATE TABLE IF NOT EXISTS voice_recordings (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID REFERENCES auth.users NOT NULL,
    recording_name VARCHAR(255) NOT NULL,
    recording_url TEXT NOT NULL,
    recording_path TEXT NOT NULL,
    storage_path TEXT NOT NULL,
    duration INTEGER,
    file_size BIGINT,
    mime_type VARCHAR(100),
    status VARCHAR(50) DEFAULT 'pending',
    processed_url TEXT,
    processed_model_id VARCHAR(255),
    metadata JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Enable Row Level Security
ALTER TABLE voice_recordings ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if they exist
DROP POLICY IF EXISTS "Users can view own voice recordings" ON voice_recordings;
DROP POLICY IF EXISTS "Users can insert own voice recordings" ON voice_recordings;
DROP POLICY IF EXISTS "Users can update own voice recordings" ON voice_recordings;
DROP POLICY IF EXISTS "Users can delete own voice recordings" ON voice_recordings;

-- Create policies for secure access
CREATE POLICY "Users can view own voice recordings"
    ON voice_recordings
    FOR SELECT
    USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own voice recordings"
    ON voice_recordings
    FOR INSERT
    WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own voice recordings"
    ON voice_recordings
    FOR UPDATE
    USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own voice recordings"
    ON voice_recordings
    FOR DELETE
    USING (auth.uid() = user_id);

-- Create updated_at trigger function
CREATE OR REPLACE FUNCTION update_voice_recordings_timestamp()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Create trigger for updating timestamp
DROP TRIGGER IF EXISTS update_voice_recordings_timestamp ON voice_recordings;
CREATE TRIGGER update_voice_recordings_timestamp
    BEFORE UPDATE ON voice_recordings
    FOR EACH ROW
    EXECUTE FUNCTION update_voice_recordings_timestamp();

-- Grant necessary permissions
GRANT ALL ON voice_recordings TO authenticated;

-- Create indexes for better performance
DROP INDEX IF EXISTS idx_voice_recordings_user_id;
DROP INDEX IF EXISTS idx_voice_recordings_status;
CREATE INDEX idx_voice_recordings_user_id ON voice_recordings(user_id);
CREATE INDEX idx_voice_recordings_status ON voice_recordings(status);

-- Enable realtime
ALTER PUBLICATION supabase_realtime ADD TABLE voice_recordings;

-- Drop existing functions if they exist
drop function if exists delete_storage_object(text, text);
drop function if exists create_delete_storage_function();

-- Create the storage deletion function with proper permissions
create or replace function public.delete_storage_object(bucket_name text, file_path text)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  delete from storage.objects
  where bucket_id = (select id from storage.buckets where name = bucket_name)
  and name = file_path;
end;
$$;

-- Grant execute permission to authenticated users
grant execute on function public.delete_storage_object(text, text) to authenticated;

-- Enable the function for REST API access
comment on function public.delete_storage_object(text, text) is 'Deletes a file from Supabase storage';
