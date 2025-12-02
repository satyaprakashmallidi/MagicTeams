-- Migration: Create bulk call history tables
-- Created: 2025-07-12

-- Table: call_campaigns
-- Stores campaign-level information for bulk calls
create table call_campaigns (
    campaign_id uuid primary key default gen_random_uuid(),
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now(),
    user_id uuid not null references auth.users(id) on delete cascade,
    
    -- Campaign metadata
    campaign_name text not null,               -- CSV file name or user-defined name
    file_id uuid,                              -- Reference to original CSV file if applicable
    
    -- Campaign status and metrics
    status text not null default 'pending',   -- 'pending', 'in_progress', 'completed', 'failed', 'cancelled'
    total_contacts integer not null default 0,
    successful_calls integer not null default 0,
    failed_calls integer not null default 0,
    pending_calls integer not null default 0,
    
    -- Timing information
    started_at timestamptz,
    completed_at timestamptz,
    
    -- Configuration snapshot (for audit trail)
    bot_id uuid,
    bot_name text,
    twilio_phone_number text,
    system_prompt text,
    voice_settings jsonb,
    field_mappings jsonb,                      -- CSV field to bot placeholder mappings
    
    -- Additional metadata
    notes text,
    agency_id text                             -- From user metadata
);

-- Table: call_campaign_contacts
-- Stores individual contact call records
create table call_campaign_contacts (
    contact_id uuid primary key default gen_random_uuid(),
    campaign_id uuid not null references call_campaigns(campaign_id) on delete cascade,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now(),
    
    -- Contact information
    contact_name text,
    contact_phone text not null,
    contact_email text,
    contact_data jsonb,                        -- All CSV fields for this contact
    
    -- Call information
    job_id uuid,                               -- From call queue system
    ultravox_call_id text,                     -- Actual call ID from Ultravox if available
    call_status text not null default 'pending', -- 'pending', 'queued', 'in_progress', 'completed', 'failed', 'cancelled'
    
    -- Call results
    call_duration integer,                     -- Duration in seconds
    call_summary text,                         -- AI generated summary
    call_notes text,                           -- Additional notes
    interest_level text,                       -- 'not_specified', 'interested', 'not_interested'
    
    -- Timing
    queued_at timestamptz,
    started_at timestamptz,
    completed_at timestamptz,
    
    -- Error handling
    error_message text,
    retry_count integer not null default 0
);

-- Table: call_jobs (from your existing schema - enhanced)
-- Enhanced version of the call_jobs table you already have
create table if not exists call_jobs (
    job_id uuid primary key default gen_random_uuid(),
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now(),
    status text not null default 'pending',   -- 'pending', 'processing', 'success', 'failed'
    payload jsonb not null,                    -- The original call request payload
    result jsonb,                              -- The result or error after processing
    error_message text,                        -- Error message if failed
    processed_at timestamptz,                  -- When the job was processed
    
    -- Additional fields for bulk call tracking
    campaign_id uuid references call_campaigns(campaign_id) on delete set null,
    contact_id uuid references call_campaign_contacts(contact_id) on delete set null,
    user_id uuid references auth.users(id) on delete cascade,
    ultravox_call_id text                      -- Link to actual call if successful
);

-- Indexes for performance
create index idx_call_campaigns_user_id on call_campaigns(user_id);
create index idx_call_campaigns_status on call_campaigns(status);
create index idx_call_campaigns_created_at on call_campaigns(created_at desc);

create index idx_call_campaign_contacts_campaign_id on call_campaign_contacts(campaign_id);
create index idx_call_campaign_contacts_status on call_campaign_contacts(call_status);
create index idx_call_campaign_contacts_phone on call_campaign_contacts(contact_phone);
create index idx_call_campaign_contacts_created_at on call_campaign_contacts(created_at desc);

create index idx_call_jobs_status on call_jobs(status);
create index idx_call_jobs_campaign_id on call_jobs(campaign_id);
create index idx_call_jobs_user_id on call_jobs(user_id);
create index idx_call_jobs_created_at on call_jobs(created_at desc);

-- RLS (Row Level Security) policies
alter table call_campaigns enable row level security;
alter table call_campaign_contacts enable row level security;
alter table call_jobs enable row level security;

-- Policy: Users can only access their own campaigns
create policy "Users can view their own campaigns" on call_campaigns
    for select using (auth.uid() = user_id);

create policy "Users can insert their own campaigns" on call_campaigns
    for insert with check (auth.uid() = user_id);

create policy "Users can update their own campaigns" on call_campaigns
    for update using (auth.uid() = user_id);

create policy "Users can delete their own campaigns" on call_campaigns
    for delete using (auth.uid() = user_id);

-- Policy: Users can only access contacts from their campaigns
create policy "Users can view contacts from their campaigns" on call_campaign_contacts
    for select using (
        exists (
            select 1 from call_campaigns 
            where call_campaigns.campaign_id = call_campaign_contacts.campaign_id 
            and call_campaigns.user_id = auth.uid()
        )
    );

create policy "Users can insert contacts to their campaigns" on call_campaign_contacts
    for insert with check (
        exists (
            select 1 from call_campaigns 
            where call_campaigns.campaign_id = call_campaign_contacts.campaign_id 
            and call_campaigns.user_id = auth.uid()
        )
    );

create policy "Users can update contacts in their campaigns" on call_campaign_contacts
    for update using (
        exists (
            select 1 from call_campaigns 
            where call_campaigns.campaign_id = call_campaign_contacts.campaign_id 
            and call_campaigns.user_id = auth.uid()
        )
    );

-- Policy: Users can only access their own call jobs
create policy "Users can view their own call jobs" on call_jobs
    for select using (auth.uid() = user_id);

create policy "Users can insert their own call jobs" on call_jobs
    for insert with check (auth.uid() = user_id);

create policy "Users can update their own call jobs" on call_jobs
    for update using (auth.uid() = user_id);

-- Functions to automatically update timestamps
create or replace function update_updated_at_column()
returns trigger as $$
begin
    new.updated_at = now();
    return new;
end;
$$ language plpgsql;

-- Triggers for automatic timestamp updates
create trigger update_call_campaigns_updated_at
    before update on call_campaigns
    for each row execute function update_updated_at_column();

create trigger update_call_campaign_contacts_updated_at
    before update on call_campaign_contacts
    for each row execute function update_updated_at_column();

create trigger update_call_jobs_updated_at
    before update on call_jobs
    for each row execute function update_updated_at_column();

-- Function to automatically update campaign metrics
create or replace function update_campaign_metrics()
returns trigger as $$
begin
    -- Update campaign metrics when contact status changes
    if tg_op = 'UPDATE' and old.call_status != new.call_status then
        update call_campaigns set
            successful_calls = (
                select count(*) from call_campaign_contacts 
                where campaign_id = new.campaign_id and call_status = 'completed'
            ),
            failed_calls = (
                select count(*) from call_campaign_contacts 
                where campaign_id = new.campaign_id and call_status = 'failed'
            ),
            pending_calls = (
                select count(*) from call_campaign_contacts 
                where campaign_id = new.campaign_id and call_status in ('pending', 'queued', 'in_progress')
            ),
            updated_at = now()
        where campaign_id = new.campaign_id;
        
        -- Update campaign status to completed if all calls are done
        update call_campaigns set
            status = case 
                when pending_calls = 0 then 'completed'
                else status
            end,
            completed_at = case 
                when pending_calls = 0 and completed_at is null then now()
                else completed_at
            end
        where campaign_id = new.campaign_id;
    end if;
    
    return new;
end;
$$ language plpgsql;

-- Trigger to update campaign metrics
create trigger update_campaign_metrics_trigger
    after update on call_campaign_contacts
    for each row execute function update_campaign_metrics();