-- Migration: Add custom questions to bots and AI-processed answers to call history
-- Created: 2025-08-05

-- Add custom_questions field to bots table for storing user-defined questions
ALTER TABLE bots ADD COLUMN custom_questions jsonb DEFAULT '[]'::jsonb;

-- Add ai_processed_answers to call_campaign_contacts for storing Gemini responses
ALTER TABLE call_campaign_contacts ADD COLUMN ai_processed_answers jsonb DEFAULT '{}'::jsonb;
ALTER TABLE call_campaign_contacts ADD COLUMN ai_answers_generated_at timestamptz;

-- Add index for better performance when querying AI processed answers
CREATE INDEX idx_call_campaign_contacts_ai_answers ON call_campaign_contacts USING gin(ai_processed_answers);

-- Add comment for documentation
COMMENT ON COLUMN bots.custom_questions IS 'Array of custom questions that users want to extract from call transcripts/summaries using AI';
COMMENT ON COLUMN call_campaign_contacts.ai_processed_answers IS 'JSON object containing AI-processed answers to custom questions from call transcripts/summaries';
COMMENT ON COLUMN call_campaign_contacts.ai_answers_generated_at IS 'Timestamp when AI answers were generated to avoid re-processing';

-- Example structure for custom_questions:
-- [
--   {
--     "id": "q1",
--     "question": "How many square feet does the user want?",
--     "enabled": true
--   },
--   {
--     "id": "q2", 
--     "question": "What is their budget range?",
--     "enabled": true
--   }
-- ]

-- Example structure for ai_processed_answers:
-- {
--   "q1": {
--     "question": "How many square feet does the user want?",
--     "answer": "100 square feet",
--     "confidence": "high"
--   },
--   "q2": {
--     "question": "What is their budget range?", 
--     "answer": "Not specified in the conversation",
--     "confidence": "low"
--   }
-- }