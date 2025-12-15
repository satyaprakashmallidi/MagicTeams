-- Add selected_webhooks column to bots table to store webhooks selected for each bot
ALTER TABLE bots ADD COLUMN IF NOT EXISTS selected_webhooks TEXT[] DEFAULT '{}';

-- Add comment to document the column purpose
COMMENT ON COLUMN bots.selected_webhooks IS 'Array of webhook IDs selected for this bot to receive events';
