-- Drop existing RLS policies for ultravox_webhooks
DROP POLICY IF EXISTS "Users can view own webhooks" ON ultravox_webhooks;
DROP POLICY IF EXISTS "Users can insert own webhooks" ON ultravox_webhooks;
DROP POLICY IF EXISTS "Users can update own webhooks" ON ultravox_webhooks;
DROP POLICY IF EXISTS "Users can delete own webhooks" ON ultravox_webhooks;

-- Create new policies that allow all authenticated users to see all webhooks
-- But users can only modify their own webhooks

-- All authenticated users can view all webhooks
CREATE POLICY "All users can view all webhooks" ON ultravox_webhooks
    FOR SELECT USING (auth.role() = 'authenticated');

-- Users can only insert their own webhooks
CREATE POLICY "Users can insert own webhooks" ON ultravox_webhooks
    FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Users can only update their own webhooks
CREATE POLICY "Users can update own webhooks" ON ultravox_webhooks
    FOR UPDATE USING (auth.uid() = user_id);

-- Users can only delete their own webhooks
CREATE POLICY "Users can delete own webhooks" ON ultravox_webhooks
    FOR DELETE USING (auth.uid() = user_id);