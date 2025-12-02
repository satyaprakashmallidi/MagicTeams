-- Add headers and pagination columns to files table
ALTER TABLE files 
ADD COLUMN IF NOT EXISTS headers jsonb,
ADD COLUMN IF NOT EXISTS current_page integer DEFAULT 1,
ADD COLUMN IF NOT EXISTS rows_per_page integer DEFAULT 10;
