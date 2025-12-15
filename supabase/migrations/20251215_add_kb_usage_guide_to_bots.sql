-- Add knowledge_base_usage_guide column to bots table
ALTER TABLE bots 
ADD COLUMN IF NOT EXISTS knowledge_base_usage_guide TEXT;
