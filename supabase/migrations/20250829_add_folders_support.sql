-- Create folders table for organizing CSV files
CREATE TABLE IF NOT EXISTS folders (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR NOT NULL,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(name, user_id)
);

-- Add folder_id column to files table
ALTER TABLE files ADD COLUMN IF NOT EXISTS folder_id UUID REFERENCES folders(id) ON DELETE SET NULL;

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_folders_user_id ON folders(user_id);
CREATE INDEX IF NOT EXISTS idx_files_folder_id ON files(folder_id);

-- Create RLS policies for folders
ALTER TABLE folders ENABLE ROW LEVEL SECURITY;

-- Users can only see their own folders
CREATE POLICY "Users can view their own folders" ON folders
    FOR SELECT USING (auth.uid() = user_id);

-- Users can insert their own folders
CREATE POLICY "Users can insert their own folders" ON folders
    FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Users can update their own folders
CREATE POLICY "Users can update their own folders" ON folders
    FOR UPDATE USING (auth.uid() = user_id);

-- Users can delete their own folders
CREATE POLICY "Users can delete their own folders" ON folders
    FOR DELETE USING (auth.uid() = user_id);

-- Create default "Uncategorized" folder for existing users (optional)
-- This will be handled in the application code instead