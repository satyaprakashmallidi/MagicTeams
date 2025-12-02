import { create } from 'zustand';
import { Webhook, CreateWebhookRequest, UpdateWebhookRequest, DatabaseWebhook } from '@/types/webhooks';
import { WebhookService } from '@/lib/services/webhook.service';
import { useAuthStore } from '@/hooks/use-auth';

interface WebhookState {
  webhooks: Webhook[];
  userWebhooks: DatabaseWebhook[];
  selectedWebhookId: string | null;
  isLoading: boolean;
  error: string | null;
  lastFetched: number | null;
}

interface WebhookActions {
  setWebhooks: (webhooks: Webhook[]) => void;
  setUserWebhooks: (webhooks: DatabaseWebhook[]) => void;
  setSelectedWebhookId: (webhookId: string | null) => void;
  fetchWebhooks: (agentId?: string) => Promise<Webhook[]>;
  fetchUserWebhooks: () => Promise<DatabaseWebhook[]>;
  createWebhook: (request: CreateWebhookRequest) => Promise<Webhook>;
  updateWebhook: (webhookId: string, request: UpdateWebhookRequest) => Promise<Webhook>;
  deleteWebhook: (webhookId: string) => Promise<void>;
  testWebhook: (webhookUrl: string) => Promise<boolean>;
  clearError: () => void;
}

type WebhookStore = WebhookState & WebhookActions;

const CACHE_DURATION = 5 * 60 * 1000; // 5 minutes

export const useWebhookStore = create<WebhookStore>((set, get) => ({
  // Initial State
  webhooks: [],
  userWebhooks: [],
  selectedWebhookId: null,
  isLoading: false,
  error: null,
  lastFetched: null,

  // Basic Actions
  setWebhooks: (webhooks) => set({ webhooks }),
  setUserWebhooks: (userWebhooks) => set({ userWebhooks }),
  setSelectedWebhookId: (selectedWebhookId) => set({ selectedWebhookId }),
  clearError: () => set({ error: null }),

  // Async Actions
  fetchWebhooks: async (agentId?: string) => {
    const state = get();
    const now = Date.now();

    // Return early if cache is valid and we have data
    const isCacheValid = state.lastFetched && (now - state.lastFetched < CACHE_DURATION);
    if (isCacheValid && state.webhooks.length >= 0 && !agentId) {
      return state.webhooks;
    }

    // Prevent multiple simultaneous calls
    if (state.isLoading) {
      return state.webhooks;
    }

    try {
      set({ isLoading: true, error: null });

      const response = await WebhookService.listWebhooks(agentId);
      const webhooks = response.results || response || [];
      
      set({ 
        webhooks,
        lastFetched: now,
        error: null
      });

      return webhooks;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to fetch webhooks';
      set({ 
        error: errorMessage,
        webhooks: []
      });
      return [];
    } finally {
      set({ isLoading: false });
    }
  },

  fetchUserWebhooks: async () => {
    const state = get();
    
    // Prevent multiple simultaneous calls
    if (state.isLoading) {
      return state.userWebhooks;
    }

    try {
      set({ isLoading: true, error: null });

      const userId = await useAuthStore.getState().getUserId();
      if (!userId) {
        throw new Error('User not authenticated');
      }

      const userWebhooks = await WebhookService.getUserWebhooks(userId);
      
      set({ 
        userWebhooks,
        error: null
      });

      return userWebhooks;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to fetch user webhooks';
      set({ 
        error: errorMessage,
        userWebhooks: []
      });
      return [];
    } finally {
      set({ isLoading: false });
    }
  },

  createWebhook: async (request: CreateWebhookRequest) => {
    try {
      set({ isLoading: true, error: null });

      const userId = await useAuthStore.getState().getUserId();
      if (!userId) {
        throw new Error('User not authenticated');
      }

      const newWebhook = await WebhookService.createWebhook(request, userId);
      
      // Add to current webhooks list
      const currentWebhooks = get().webhooks;
      set({ 
        webhooks: [newWebhook, ...currentWebhooks],
        error: null
      });

      // Refresh user webhooks
      get().fetchUserWebhooks();

      return newWebhook;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to create webhook';
      set({ error: errorMessage });
      throw error;
    } finally {
      set({ isLoading: false });
    }
  },

  updateWebhook: async (webhookId: string, request: UpdateWebhookRequest) => {
    try {
      set({ isLoading: true, error: null });

      const userId = await useAuthStore.getState().getUserId();
      if (!userId) {
        throw new Error('User not authenticated');
      }

      const updatedWebhook = await WebhookService.updateWebhook(webhookId, request, userId);
      
      // Update in current webhooks list
      const currentWebhooks = get().webhooks;
      const updatedWebhooks = currentWebhooks.map(webhook => 
        webhook.webhook_id === webhookId ? updatedWebhook : webhook
      );
      
      set({ 
        webhooks: updatedWebhooks,
        error: null
      });

      // Refresh user webhooks
      get().fetchUserWebhooks();

      return updatedWebhook;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to update webhook';
      set({ error: errorMessage });
      throw error;
    } finally {
      set({ isLoading: false });
    }
  },

  deleteWebhook: async (webhookId: string) => {
    try {
      set({ isLoading: true, error: null });

      const userId = await useAuthStore.getState().getUserId();
      if (!userId) {
        throw new Error('User not authenticated');
      }

      await WebhookService.deleteWebhook(webhookId, userId);
      
      // Remove from current webhooks list
      const currentWebhooks = get().webhooks;
      const filteredWebhooks = currentWebhooks.filter(webhook => 
        webhook.webhook_id !== webhookId
      );
      
      // Remove from user webhooks list
      const currentUserWebhooks = get().userWebhooks;
      const filteredUserWebhooks = currentUserWebhooks.filter(webhook => 
        webhook.webhook_id !== webhookId
      );
      
      set({ 
        webhooks: filteredWebhooks,
        userWebhooks: filteredUserWebhooks,
        error: null
      });

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to delete webhook';
      set({ error: errorMessage });
      throw error;
    } finally {
      set({ isLoading: false });
    }
  },

  testWebhook: async (webhookUrl: string) => {
    try {
      set({ error: null });
      return await WebhookService.testWebhook(webhookUrl);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to test webhook';
      set({ error: errorMessage });
      return false;
    }
  },
}));