-- Add selected_tools column to bots table to store custom tools selected for each bot
ALTER TABLE bots ADD COLUMN IF NOT EXISTS selected_tools TEXT[] DEFAULT '{}';

-- Add comment to document the column purpose
COMMENT ON COLUMN bots.selected_tools IS 'Array of tool IDs selected for this bot to use during calls';