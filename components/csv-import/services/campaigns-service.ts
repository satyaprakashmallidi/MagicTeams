// Campaigns service for frontend integration with backend API

export interface Campaign {
  campaign_id: string;
  campaign_name: string;
  user_id: string;
  status: 'pending' | 'in_progress' | 'completed' | 'failed' | 'cancelled';
  total_contacts: number;
  successful_calls: number;
  failed_calls: number;
  pending_calls: number;
  created_at: string;
  updated_at: string;
  started_at?: string;
  completed_at?: string;
  bot_id?: string;
  bot_name?: string;
  twilio_phone_number?: string;
  system_prompt?: string;
  voice_settings?: any;
  field_mappings?: any;
  notes?: string;
  // Scheduling fields
  scheduled_start_time?: string;
  timezone?: string;
  is_recurring?: boolean;
  recurring_type?: 'none' | 'daily' | 'weekly' | 'monthly';
  recurring_interval?: number;
  recurring_until?: string;
  max_executions?: number;
  execution_count?: number;
  auto_start?: boolean;
}

export interface CampaignContact {
  contact_id: string;
  campaign_id: string;
  contact_name?: string;
  contact_phone: string;
  contact_email?: string;
  contact_data: any;
  job_id?: string;
  ultravox_call_id?: string;
  call_status: 'pending' | 'queued' | 'in_progress' | 'completed' | 'failed' | 'cancelled';
  call_duration?: number;
  call_summary?: string;
  call_notes?: string;
  interest_level?: string;
  created_at: string;
  updated_at: string;
  queued_at?: string;
  started_at?: string;
  completed_at?: string;
  error_message?: string;
  retry_count: number;
  // AI Analysis fields
  ai_processed_answers?: any;
  ai_answers_generated_at?: string;
  // For joined data
  call_campaigns?: {
    campaign_name: string;
    campaign_settings?: any;
    timezone?: string;
  };
}

export interface TimeWindow {
  start_hour: number; // 0-23 (24-hour format)
  start_minute: number; // 0-59
  end_hour: number; // 0-23 (24-hour format)
  end_minute: number; // 0-59
  days_of_week?: number[]; // 0=Sunday, 1=Monday, etc. If not specified, applies to all days
}

export interface CampaignScheduling {
  scheduled_start_time?: string;
  timezone?: string;
  is_recurring?: boolean;
  recurring_type?: 'none' | 'daily' | 'weekly' | 'monthly';
  recurring_interval?: number;
  recurring_until?: string;
  max_executions?: number;
  auto_start?: boolean;
  timeWindow?: TimeWindow;
}

export interface CreateCampaignPayload {
  campaign_name: string;
  bot_id: string;
  bot_name?: string;
  twilio_phone_number: string; // Keep for backward compatibility
  twilio_phone_numbers?: string[]; // New field for multiple numbers
  system_prompt: string;
  voice_settings?: any;
  field_mappings?: any;
  contacts: any[];
  notes?: string;
  user_id: string;
  scheduling?: CampaignScheduling;
  campaign_settings?: {
    enableNumberLocking?: boolean;
    timeWindow?: TimeWindow;
    timezone?: string;
  };
}

export interface CampaignStats {
  total: number;
  pending: number;
  queued: number;
  in_progress: number;
  completed: number;
  failed: number;
}

class CampaignsService {
  private baseUrl: string;

  constructor() {
    // Use the worker backend URL
    this.baseUrl = process.env.NEXT_PUBLIC_BACKEND_URL_WORKER || 'http://localhost:8787';
  }

  private getHeaders(): HeadersInit {
    return {
      'Content-Type': 'application/json',
      'ngrok-skip-browser-warning': 'true', // Skip ngrok interstitial page
    };
  }

  async createCampaign(payload: CreateCampaignPayload): Promise<{ campaign_id: string; status: string; message: string }> {
    const response = await fetch(`${this.baseUrl}/api/campaigns`, {
      method: 'POST',
      headers: this.getHeaders(),
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.message || 'Failed to create campaign');
    }

    return response.json();
  }

  async getCampaigns(userId: string): Promise<{ campaigns: Campaign[] }> {
    const response = await fetch(`${this.baseUrl}/api/campaigns?user_id=${userId}`, {
      method: 'GET',
      headers: this.getHeaders(),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.message || 'Failed to fetch campaigns');
    }

    return response.json();
  }

  async getCampaign(campaignId: string): Promise<{ campaign: Campaign; contacts: CampaignContact[] }> {
    const response = await fetch(`${this.baseUrl}/api/campaigns/${campaignId}`, {
      method: 'GET',
      headers: this.getHeaders(),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.message || 'Failed to fetch campaign');
    }

    return response.json();
  }

  async getCampaignStats(campaignId: string): Promise<{ stats: CampaignStats }> {
    const response = await fetch(`${this.baseUrl}/api/campaigns/${campaignId}/stats`, {
      method: 'GET',
      headers: this.getHeaders(),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.message || 'Failed to fetch campaign stats');
    }

    return response.json();
  }

  async startCampaign(campaignId: string): Promise<{ status: string; message: string }> {
    const response = await fetch(`${this.baseUrl}/api/campaigns/${campaignId}/start`, {
      method: 'POST',
      headers: this.getHeaders(),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.message || 'Failed to start campaign');
    }

    return response.json();
  }

  async stopCampaign(campaignId: string): Promise<{ status: string; message: string }> {
    const response = await fetch(`${this.baseUrl}/api/campaigns/${campaignId}/stop`, {
      method: 'POST',
      headers: this.getHeaders(),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.message || 'Failed to stop campaign');
    }

    return response.json();
  }

  async updateContact(
    campaignId: string,
    contactId: string,
    updates: Partial<CampaignContact>
  ): Promise<{ status: string; message: string }> {
    const response = await fetch(`${this.baseUrl}/api/campaigns/${campaignId}/contacts/${contactId}`, {
      method: 'PUT',
      headers: this.getHeaders(),
      body: JSON.stringify(updates),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.message || 'Failed to update contact');
    }

    return response.json();
  }

  async deleteCampaign(campaignId: string): Promise<{ status: string; message: string }> {
    const response = await fetch(`${this.baseUrl}/api/campaigns/${campaignId}`, {
      method: 'DELETE',
      headers: this.getHeaders(),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.message || 'Failed to delete campaign');
    }

    return response.json();
  }

  async updateCampaignSchedule(campaignId: string, scheduling: CampaignScheduling): Promise<{ status: string; message: string }> {
    const response = await fetch(`${this.baseUrl}/api/campaigns/${campaignId}/schedule`, {
      method: 'PUT',
      headers: this.getHeaders(),
      body: JSON.stringify(scheduling),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.message || 'Failed to update campaign schedule');
    }

    return response.json();
  }

  async getScheduledCampaigns(userId?: string): Promise<{ campaigns: Campaign[] }> {
    const url = userId
      ? `${this.baseUrl}/api/campaigns/scheduled?user_id=${userId}`
      : `${this.baseUrl}/api/campaigns/scheduled`;

    const response = await fetch(url, {
      method: 'GET',
      headers: this.getHeaders(),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.message || 'Failed to fetch scheduled campaigns');
    }

    return response.json();
  }
}

export const campaignsService = new CampaignsService();