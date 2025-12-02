import { create } from 'zustand';
import { Bot } from '@/types/database';
import { supabase } from '@/lib/supabase';
import { useAuthStore } from '@/hooks/use-auth';

interface BotState {
  bots: Bot[];
  selectedBotId: string | null;
  isLoading: boolean;
  error: string | null;
  lastFetched: number | null;
}

interface BotActions {
  setBots: (bots: Bot[]) => void;
  setSelectedBotId: (botId: string | null) => void;
  fetchBots: () => Promise<Bot[]>;
  addBot: (bot: Bot) => Promise<void>;
  updateBot: (botId: string, bot: Bot) => Promise<void>;
  deleteBot: (botId: string) => Promise<void>;
  duplicateBot: (botId: string) => Promise<Bot | null>;
}

type BotStore = BotState & BotActions;

const CACHE_DURATION = 5 * 60 * 1000; // 5 minutes

export const useBotStore = create<BotStore>((set, get) => ({
  // Initial State
  bots: [],
  selectedBotId: null,
  isLoading: false,
  error: null,
  lastFetched: null,

  // Basic Actions
  setBots: (bots) => set({ bots }),
  setSelectedBotId: (selectedBotId) => set({ selectedBotId }),

  // Async Actions
  fetchBots: async () => {
    const state = get();
    const now = Date.now();

    // Return early if cache is valid and we have data
    const isCacheValid = state.lastFetched && (now - state.lastFetched < CACHE_DURATION);
    if (isCacheValid && state.bots.length > 0) {
      return state.bots;
    }

    try {
      set({ isLoading: true, error: null });

      const userId = await useAuthStore.getState().getUserId();
      if (!userId) {
        throw new Error('User not authenticated');
      }

      const { data, error } = await supabase
        .from('bots')
        .select('*')
        .eq('user_id', userId)
        .order('created_at', { ascending: false });

      if (error) throw error;

      const bots = data || [];
      
      set({ 
        bots,
        lastFetched: now,
        error: null
      });

      return bots;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to fetch bots';
      set({ 
        error: errorMessage,
        bots: []
      });
      return [];
    } finally {
      set({ isLoading: false });
    }
  },

  addBot: async (bot: Bot) => {
    try {
      set({ isLoading: true, error: null });

      const userId = await useAuthStore.getState().getUserId();
      if (!userId) {
        throw new Error('User not authenticated');
      }

      // const { data, error } = await supabase
      //   .from('bots')
      //   .insert([{ ...bot, user_id: userId }])
      //   .select()
      //   .single();

      // if (error) throw error;
      // if (!data) throw new Error('Failed to add bot');

      set(state => ({ 
        bots: [bot, ...state.bots],
        selectedBotId: bot.id,
        lastFetched: Date.now(),
        error: null
      }));
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to add bot';
      set({ error: errorMessage });
      throw error;
    } finally {
      set({ isLoading: false });
    }
  },

  updateBot: async (botId: string, bot: Bot) => {
    try {
      set({ isLoading: true, error: null });

      const userId = await useAuthStore.getState().getUserId();
      if (!userId) {
        throw new Error('User not authenticated');
      }

      const { data, error } = await supabase
        .from('bots')
        .update(bot)
        .eq('id', botId)
        .eq('user_id', userId)
        .select()
        .single();

      if (error) throw error;
      if (!data) throw new Error('Failed to update bot');

      set(state => ({
        bots: state.bots.map(b => b.id === botId ? data : b),
        lastFetched: Date.now(),
        error: null
      }));
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to update bot';
      set({ error: errorMessage });
      throw error;
    } finally {
      set({ isLoading: false });
    }
  },

  deleteBot: async (botId: string) => {
    try {
      set({ isLoading: true, error: null });

      const userId = await useAuthStore.getState().getUserId();
      if (!userId) {
        throw new Error('User not authenticated');
      }

      const { error } = await supabase
        .from('bots')
        .delete()
        .eq('id', botId)
        .eq('user_id', userId);

      if (error) throw error;

      set(state => ({
        bots: state.bots.filter(b => b.id !== botId),
        selectedBotId: state.selectedBotId === botId ? null : state.selectedBotId,
        lastFetched: Date.now(),
        error: null
      }));
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to delete bot';
      set({ error: errorMessage });
      throw error;
    } finally {
      set({ isLoading: false });
    }
  },

  duplicateBot: async (botId: string) => {
    try {
      set({ isLoading: true, error: null });

      const userId = await useAuthStore.getState().getUserId();
      if (!userId) {
        throw new Error('User not authenticated');
      }

      const state = get();
      const originalBot = state.bots.find(b => b.id === botId);
      
      if (!originalBot) {
        throw new Error('Bot not found');
      }

      console.log('originalBot', originalBot);

      // Create new bot with duplicated data
      const duplicatedBot: Omit<Bot, 'id' | 'created_at'> = {
        name: `${originalBot.name} (Copy)`,
        phone_number: originalBot.phone_number || '',
        voice: originalBot.voice,
        system_prompt: originalBot.system_prompt,
        user_id: userId,
        is_appointment_booking_allowed: originalBot.is_appointment_booking_allowed || false,
        appointment_tool_id: originalBot.appointment_tool_id,
        is_deleted: false,
        knowledge_base_id: originalBot.knowledge_base_id,
        temperature: originalBot.temperature,
        twilio_phone_number: originalBot.twilio_phone_number,
        is_call_transfer_allowed: originalBot.is_call_transfer_allowed || false,
        call_transfer_number: originalBot.call_transfer_number,
        model: originalBot.model || 'fixie-ai/ultravox',
        custom_questions: originalBot.custom_questions ? JSON.parse(JSON.stringify(originalBot.custom_questions)) : [],
        selected_tools: originalBot.selected_tools ? [...originalBot.selected_tools] : [],
        first_speaker: originalBot.first_speaker,
      };

      const { data, error } = await supabase
        .from('bots')
        .insert([duplicatedBot])
        .select()
        .single();

      if (error) throw error;
      if (!data) throw new Error('Failed to duplicate bot');

      const newBot = data as Bot;

      set(state => ({ 
        bots: [newBot, ...state.bots],
        selectedBotId: newBot.id,
        lastFetched: Date.now(),
        error: null
      }));

      return newBot;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to duplicate bot';
      set({ error: errorMessage });
      throw error;
    } finally {
      set({ isLoading: false });
    }
  }
}));
