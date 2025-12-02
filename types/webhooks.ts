export type WebhookEvent = 'call.started' | 'call.joined' | 'call.ended';

export interface WebhookFailure {
  timestamp: string;
  statusCode: number;
  error: string;
}

export interface Webhook {
  webhook_id: string;
  created: string;
  url: string;
  events: WebhookEvent[];
  status: 'normal' | 'unhealthy';
  lastStatusChange: string | null;
  recentFailures: WebhookFailure[];
  agentId?: string | null;
  secrets?: string[];
}

export interface CreateWebhookRequest {
  url: string;
  events: WebhookEvent[];
  agentId?: string | null;
  secrets?: string[];
}

export interface UpdateWebhookRequest {
  url?: string;
  events?: WebhookEvent[];
  agentId?: string | null;
  secrets?: string[];
}

export interface WebhookListResponse {
  next: string | null;
  previous: string | null;
  results: Webhook[];
}

export interface DatabaseWebhook {
  webhook_id: string;
  user_id: string;
  ultravox_webhook_id: string | null;
  url: string;
  events: WebhookEvent[];
  agent_id: string | null;
  status: 'normal' | 'unhealthy';
  last_status_change: string | null;
  secret_key: string | null;
  recent_failures: WebhookFailure[];
  created_at: string;
  updated_at: string;
}

export const WEBHOOK_EVENTS: { value: WebhookEvent; label: string; description: string }[] = [
  {
    value: 'call.started',
    label: 'Call Started',
    description: 'Triggered when a call begins'
  },
  {
    value: 'call.joined',
    label: 'Call Joined',
    description: 'Triggered when a participant joins the call'
  },
  {
    value: 'call.ended',
    label: 'Call Ended',
    description: 'Triggered when a call ends'
  }
];