import { getEnvVars } from '@/lib/env/getEnvVars';
import { 
  Webhook, 
  CreateWebhookRequest, 
  UpdateWebhookRequest, 
  WebhookListResponse,
  DatabaseWebhook 
} from '@/types/webhooks';
import { SupabaseService } from './supabase.service';

const { NEXT_PUBLIC_BACKEND_URL_WORKER } = getEnvVars();
const BASE_URL = `${NEXT_PUBLIC_BACKEND_URL_WORKER}/api/webhooks`;

export interface ApiResponse<T> {
  status: 'success' | 'error';
  data?: T;
  message?: string;
  error?: string;
}

export class WebhookService {
  static async listWebhooks(agentId?: string): Promise<WebhookListResponse> {
    const params = new URLSearchParams();
    if (agentId) {
      params.append('agent_id', agentId);
    }
    params.append('user_id', await SupabaseService.getInstance().getUserId() || '');

    const url = params.toString() ? `${BASE_URL}/user?${params.toString()}` : `${BASE_URL}/user`;
    const response = await fetch(url);
    
    if (!response.ok) {
      throw new Error(`Failed to list webhooks: ${response.statusText}`);
    }

    const result: ApiResponse<WebhookListResponse> = await response.json();
    
    if (result.status === 'error') {
      throw new Error(result.message || result.error || 'Failed to list webhooks');
    }

    return result.data!;
  }

  static async getWebhook(webhookId: string, userId: string): Promise<Webhook> {
    const params = new URLSearchParams({ user_id: userId });
    const response = await fetch(`${BASE_URL}/${webhookId}?${params.toString()}`);
    
    if (!response.ok) {
      throw new Error(`Failed to get webhook: ${response.statusText}`);
    }

    const result: ApiResponse<Webhook> = await response.json();
    
    if (result.status === 'error') {
      throw new Error(result.message || result.error || 'Failed to get webhook');
    }

    return result.data!;
  }

  static async createWebhook(request: CreateWebhookRequest, userId: string): Promise<Webhook> {
    const response = await fetch(BASE_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        ...request,
        user_id: userId,
      }),
    });

    if (!response.ok) {
      throw new Error(`Failed to create webhook: ${response.statusText}`);
    }

    const result: ApiResponse<Webhook> = await response.json();
    
    if (result.status === 'error') {
      throw new Error(result.message || result.error || 'Failed to create webhook');
    }

    return result.data!;
  }

  static async updateWebhook(webhookId: string, request: UpdateWebhookRequest, userId: string): Promise<Webhook> {
    const response = await fetch(`${BASE_URL}/${webhookId}`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        ...request,
        user_id: userId,
      }),
    });

    if (!response.ok) {
      throw new Error(`Failed to update webhook: ${response.statusText}`);
    }

    const result: ApiResponse<Webhook> = await response.json();
    
    if (result.status === 'error') {
      throw new Error(result.message || result.error || 'Failed to update webhook');
    }

    return result.data!;
  }

  static async deleteWebhook(webhookId: string, userId: string): Promise<void> {
    const params = new URLSearchParams({ user_id: userId });
    const response = await fetch(`${BASE_URL}/${webhookId}?${params.toString()}`, {
      method: 'DELETE',
    });

    if (!response.ok) {
      throw new Error(`Failed to delete webhook: ${response.statusText}`);
    }

    const result: ApiResponse<void> = await response.json();
    
    if (result.status === 'error') {
      throw new Error(result.message || result.error || 'Failed to delete webhook');
    }
  }

  static async getUserWebhooks(userId: string): Promise<DatabaseWebhook[]> {
    const params = new URLSearchParams({ user_id: userId });
    const response = await fetch(`${BASE_URL}/user?${params.toString()}`);
    
    if (!response.ok) {
      throw new Error(`Failed to get user webhooks: ${response.statusText}`);
    }

    const result: ApiResponse<DatabaseWebhook[]> = await response.json();
    
    if (result.status === 'error') {
      throw new Error(result.message || result.error || 'Failed to get user webhooks');
    }

    return result.data || [];
  }

  static async testWebhook(webhookUrl: string): Promise<boolean> {
    try {
      // Test webhook by sending a sample payload
      const testPayload = {
        event: 'webhook.test',
        timestamp: new Date().toISOString(),
        data: {
          message: 'This is a test webhook from Magic Teams'
        }
      };

      const response = await fetch(webhookUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'User-Agent': 'Magic-Teams-Webhook-Test/1.0',
        },
        body: JSON.stringify(testPayload),
      });

      return response.ok;
    } catch (error) {
      console.error('Webhook test failed:', error);
      return false;
    }
  }
}