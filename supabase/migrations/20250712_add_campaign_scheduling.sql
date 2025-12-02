-- Add scheduling fields to call_campaigns table
ALTER TABLE call_campaigns 
ADD COLUMN IF NOT EXISTS scheduled_start_time timestamptz,
ADD COLUMN IF NOT EXISTS timezone varchar(50) DEFAULT 'UTC',
ADD COLUMN IF NOT EXISTS recurring_type varchar(20) CHECK (recurring_type IN ('none', 'daily', 'weekly', 'monthly')),
ADD COLUMN IF NOT EXISTS recurring_interval int DEFAULT 1,
ADD COLUMN IF NOT EXISTS recurring_until timestamptz,
ADD COLUMN IF NOT EXISTS max_executions int,
ADD COLUMN IF NOT EXISTS execution_count int DEFAULT 0,
ADD COLUMN IF NOT EXISTS is_recurring boolean DEFAULT false,
ADD COLUMN IF NOT EXISTS auto_start boolean DEFAULT false;

-- Add indexes for scheduling queries
CREATE INDEX IF NOT EXISTS idx_call_campaigns_scheduled_start ON call_campaigns(scheduled_start_time) WHERE scheduled_start_time IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_call_campaigns_recurring ON call_campaigns(is_recurring, status) WHERE is_recurring = true;
CREATE INDEX IF NOT EXISTS idx_call_campaigns_auto_start ON call_campaigns(auto_start, scheduled_start_time, status) WHERE auto_start = true;

-- Create campaign execution history table for tracking recurring campaigns
CREATE TABLE IF NOT EXISTS campaign_executions (
  execution_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id uuid NOT NULL REFERENCES call_campaigns(campaign_id) ON DELETE CASCADE,
  scheduled_time timestamptz NOT NULL,
  started_at timestamptz,
  completed_at timestamptz,
  status varchar(20) DEFAULT 'pending' CHECK (status IN ('pending', 'in_progress', 'completed', 'failed', 'cancelled')),
  total_contacts int DEFAULT 0,
  successful_calls int DEFAULT 0,
  failed_calls int DEFAULT 0,
  error_message text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Add indexes for campaign executions
CREATE INDEX IF NOT EXISTS idx_campaign_executions_campaign_id ON campaign_executions(campaign_id);
CREATE INDEX IF NOT EXISTS idx_campaign_executions_scheduled_time ON campaign_executions(scheduled_time);
CREATE INDEX IF NOT EXISTS idx_campaign_executions_status ON campaign_executions(status);

-- Add comments for documentation
COMMENT ON COLUMN call_campaigns.scheduled_start_time IS 'When the campaign should start execution';
COMMENT ON COLUMN call_campaigns.timezone IS 'Timezone for scheduling (e.g., America/New_York)';
COMMENT ON COLUMN call_campaigns.recurring_type IS 'Type of recurrence: none, daily, weekly, monthly';
COMMENT ON COLUMN call_campaigns.recurring_interval IS 'Interval for recurrence (e.g., every 2 weeks)';
COMMENT ON COLUMN call_campaigns.recurring_until IS 'End date for recurring campaigns';
COMMENT ON COLUMN call_campaigns.max_executions IS 'Maximum number of executions for recurring campaigns';
COMMENT ON COLUMN call_campaigns.execution_count IS 'Current number of executions completed';
COMMENT ON COLUMN call_campaigns.is_recurring IS 'Whether this campaign repeats';
COMMENT ON COLUMN call_campaigns.auto_start IS 'Whether to automatically start at scheduled time';

COMMENT ON TABLE campaign_executions IS 'History of campaign executions for recurring campaigns';