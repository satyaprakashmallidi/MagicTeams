-- Add time window support to call_campaigns table
ALTER TABLE call_campaigns 
ADD COLUMN IF NOT EXISTS campaign_settings jsonb DEFAULT '{}';

-- Add index for campaign settings queries
CREATE INDEX IF NOT EXISTS idx_call_campaigns_settings ON call_campaigns USING GIN (campaign_settings);

-- Add comments for documentation  
COMMENT ON COLUMN call_campaigns.campaign_settings IS 'JSON settings including timeWindow, enableNumberLocking, timezone, etc.';

-- Example campaign_settings structure:
-- {
--   "enableNumberLocking": true,
--   "timeWindow": {
--     "start_hour": 9,
--     "start_minute": 0,
--     "end_hour": 17,
--     "end_minute": 0,
--     "days_of_week": [1, 2, 3, 4, 5]
--   },
--   "timezone": "America/New_York"
-- }

-- Update existing campaigns to have empty settings if null
UPDATE call_campaigns 
SET campaign_settings = '{}' 
WHERE campaign_settings IS NULL;