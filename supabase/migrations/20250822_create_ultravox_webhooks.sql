-- Create ultravox_webhooks table for managing Ultravox webhooks
CREATE TABLE ultravox_webhooks (
    webhook_id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    ultravox_webhook_id VARCHAR(255) UNIQUE, -- ID returned from Ultravox API
    url VARCHAR(500) NOT NULL,
    events TEXT[] NOT NULL, -- Array of webhook events ['call.started', 'call.joined', 'call.ended']
    agent_id UUID REFERENCES bots(id) ON DELETE SET NULL, -- Optional association with bot/agent
    status VARCHAR(50) DEFAULT 'normal', -- normal, unhealthy
    last_status_change TIMESTAMP WITH TIME ZONE,
    secret_key VARCHAR(255), -- Store encrypted webhook secret
    recent_failures JSONB DEFAULT '[]'::jsonb, -- Array of recent failure objects
    created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL
);

-- Add RLS policies
ALTER TABLE ultravox_webhooks ENABLE ROW LEVEL SECURITY;

-- Users can only access their own webhooks
CREATE POLICY "Users can view own webhooks" ON ultravox_webhooks
    FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own webhooks" ON ultravox_webhooks
    FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own webhooks" ON ultravox_webhooks
    FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own webhooks" ON ultravox_webhooks
    FOR DELETE USING (auth.uid() = user_id);

-- Add indexes for performance
CREATE INDEX idx_ultravox_webhooks_user_id ON ultravox_webhooks(user_id);
CREATE INDEX idx_ultravox_webhooks_agent_id ON ultravox_webhooks(agent_id);
CREATE INDEX idx_ultravox_webhooks_ultravox_id ON ultravox_webhooks(ultravox_webhook_id);

-- Add updated_at trigger using existing function
CREATE TRIGGER update_ultravox_webhooks_updated_at 
    BEFORE UPDATE ON ultravox_webhooks 
    FOR EACH ROW 
    EXECUTE FUNCTION update_updated_at_column();