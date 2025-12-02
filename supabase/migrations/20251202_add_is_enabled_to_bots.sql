-- Migration: Add is_enabled column to bots table
-- Description: Adds a boolean flag to enable/disable bot functionality without deletion
-- Date: 2025-12-02

-- Add is_enabled column with default value of true
ALTER TABLE bots ADD COLUMN IF NOT EXISTS is_enabled boolean DEFAULT true;

-- Add comment for documentation
COMMENT ON COLUMN bots.is_enabled IS 'Boolean flag to enable/disable bot functionality. Disabled bots cannot make or receive calls.';

-- Create index for performance optimization on enabled bots
CREATE INDEX IF NOT EXISTS idx_bots_is_enabled ON bots (is_enabled) WHERE is_enabled = true;

-- Create index for user_id + is_enabled combination for faster queries
CREATE INDEX IF NOT EXISTS idx_bots_user_enabled ON bots (user_id, is_enabled) WHERE is_enabled = true;
