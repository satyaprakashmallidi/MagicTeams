-- Migration: Add realtime data capture settings to bots table
-- Created: 2025-09-04
-- This replaces the custom_questions with more flexible realtime capture configuration

-- Add new columns for realtime data capture
ALTER TABLE bots ADD COLUMN is_realtime_capture_enabled boolean DEFAULT false;
ALTER TABLE bots ADD COLUMN realtime_capture_fields jsonb DEFAULT '[]'::jsonb;

-- Update comments for documentation
COMMENT ON COLUMN bots.is_realtime_capture_enabled IS 'Boolean flag to enable/disable realtime data capture during calls';
COMMENT ON COLUMN bots.realtime_capture_fields IS 'Array of custom field definitions for realtime data capture during calls';

-- Add index for better performance when querying realtime capture settings
CREATE INDEX idx_bots_realtime_capture ON bots (is_realtime_capture_enabled) WHERE is_realtime_capture_enabled = true;

-- Example structure for realtime_capture_fields:
-- [
--   {
--     "id": "field_1",
--     "name": "budget",
--     "type": "number", // "text", "number", "enum", "boolean"
--     "description": "Customer's budget for the service",
--     "required": true,
--     "enum_values": [] // only used when type is "enum"
--   },
--   {
--     "id": "field_2", 
--     "name": "interestLevel",
--     "type": "enum",
--     "description": "Customer's interest level",
--     "required": true,
--     "enum_values": ["highly_interested", "moderately_interested", "not_interested"]
--   }
-- ]