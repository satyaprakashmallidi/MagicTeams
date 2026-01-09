import { create } from 'zustand';
import { Voice } from '@/lib/types';
import { TwilioCredentials, TwilioPhoneNumber } from '@/types/twilio';
import { supabase } from '@/lib/supabase';
import { env } from '@/lib/env/getEnvVars';
import { useAuthStore } from '@/hooks/use-auth';
import { apiFetch } from '@/lib/utils/api-fetch';

interface VoiceState {
  voices: Voice[];
  selectedVoice: Voice | null;
  isLoading: boolean;
  error: string | null;
  twilioInfo: TwilioCredentials[] | [];
  lastFetched: number | null;
  twilioLastFetched: number | null;
}

interface VoiceActions {
  setVoices: (voices: Voice[]) => void;
  setSelectedVoice: (voice: Voice | null) => void;
  setTwilioInfo: (info: TwilioCredentials[] | null) => void;
  setError: (error: string | null) => void;
  fetchVoices: () => Promise<Voice[] | undefined>;
  loadTwilioInfo: () => Promise<TwilioCredentials[] | undefined>;
  addTwilioAccount: (account: Omit<TwilioCredentials, 'id' | 'user_id' | 'phone_numbers'>) => Promise<void>;
  updateTwilioAccount: (accountId: string, updates: Partial<TwilioCredentials>) => Promise<void>;
  deleteTwilioAccount: (accountId: string) => Promise<void>;
  addPhoneNumber: (accountId: string, phoneNumber: Omit<TwilioPhoneNumber, 'id'>) => Promise<void>;
  updatePhoneNumber: (phoneNumberId: string, updates: Partial<TwilioPhoneNumber>) => Promise<void>;
  deletePhoneNumber: (phoneNumberId: string) => Promise<void>;
}

type VoiceStore = VoiceState & VoiceActions;

const CACHE_DURATION = 5 * 60 * 1000; // 5 minutes

export const useVoiceStore = create<VoiceStore>((set, get) => ({
  // Initial State
  voices: [],
  selectedVoice: null,
  isLoading: false,
  error: null,
  twilioInfo: [],
  lastFetched: null,
  twilioLastFetched: null,

  // Basic Actions
  setVoices: (voices) => set({ voices }),
  setSelectedVoice: (voice) => set({ selectedVoice: voice }),
  setTwilioInfo: (info) => set({ twilioInfo: info || [] }),
  setError: (error) => set({ error }),

  // Async Actions
  fetchVoices: async () => {
    const state = get();
    const now = Date.now();

    const isCacheValid = state.lastFetched && (now - state.lastFetched < CACHE_DURATION);
    if (isCacheValid && state.voices.length > 0) {
      return state.voices;
    }

    try {
      set({ isLoading: true, error: null });

      const response = await apiFetch(env.NEXT_PUBLIC_BACKEND_URL_WORKER + '/api/voices');
      if (!response.ok) {
        throw new Error('Failed to fetch voices');
      }

      const data = await response.json();
      const voices = data.data;

      set({
        voices,
        lastFetched: now,
        error: null
      });

      return voices;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to fetch voices';
      set({
        error: errorMessage,
        voices: []
      });
      return undefined;
    } finally {
      set({ isLoading: false });
    }
  },

  loadTwilioInfo: async () => {
    const state = get();
    const now = Date.now();

    // Check cache validity for Twilio info
    const isCacheValid = state.twilioLastFetched && (now - state.twilioLastFetched < CACHE_DURATION);
    if (isCacheValid && state.twilioInfo && state.twilioInfo.length > 0) {
      return state.twilioInfo;
    }

    try {
      set({ isLoading: true, error: null });

      const userId = await useAuthStore.getState().getUserId();
      if (!userId) {
        throw new Error('User not authenticated');
      }

      const { data, error } = await supabase
        .from('twilio_account')
        .select(`
          id,
          account_name,
          account_sid,
          auth_token,
          is_active,
          twilio_phone_numbers (
            id,
            phone_number,
            friendly_name,
            is_active,
            account_id,
            bot_id
          )
        `)
        .eq('user_id', userId);

      if (error) throw error;

      if (!data) {
        set({ twilioInfo: [], twilioLastFetched: now });
        return undefined;
      }

      const transformedData: TwilioCredentials[] = data.map(account => ({
        id: account.id,
        user_id: userId,
        account_name: account.account_name,
        account_sid: account.account_sid,
        auth_token: account.auth_token,
        is_active: account.is_active,
        phone_numbers: account.twilio_phone_numbers?.map(phone => ({
          id: phone.id,
          account_id: account.id,
          phone_number: phone.phone_number,
          friendly_name: phone.friendly_name,
          is_active: phone.is_active,
          bot_id: phone.bot_id
        })) || []
      }));

      set({
        twilioInfo: transformedData,
        twilioLastFetched: now,
        error: null
      });

      return transformedData;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to load Twilio info';
      set({ error: errorMessage, twilioInfo: [] });
      return undefined;
    } finally {
      set({ isLoading: false });
    }
  },

  addTwilioAccount: async (account) => {
    try {
      set({ isLoading: true, error: null });

      const userId = await useAuthStore.getState().getUserId();
      if (!userId) {
        throw new Error('User not authenticated');
      }

      const { data, error } = await supabase
        .from('twilio_account')
        .insert([{ ...account, user_id: userId }])
        .select()
        .single();

      if (error) throw error;
      if (!data) throw new Error('Failed to add Twilio account');

      const newAccount: TwilioCredentials = {
        ...data,
        phone_numbers: [],
        user_id: userId
      };

      set(state => ({
        twilioInfo: state.twilioInfo ? [...state.twilioInfo, newAccount] : [newAccount],
        twilioLastFetched: Date.now(),
        error: null
      }));
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to add Twilio account';
      set({ error: errorMessage });
      throw error;
    } finally {
      set({ isLoading: false });
    }
  },

  updateTwilioAccount: async (accountId, updates) => {
    try {
      set({ isLoading: true, error: null });

      const userId = await useAuthStore.getState().getUserId();
      if (!userId) {
        throw new Error('User not authenticated');
      }

      const { data, error } = await supabase
        .from('twilio_account')
        .update(updates)
        .eq('id', accountId)
        .eq('user_id', userId)
        .select()
        .single();

      if (error) throw error;
      if (!data) throw new Error('Failed to update Twilio account');

      set(state => ({
        twilioInfo: state.twilioInfo?.map(account =>
          account.id === accountId
            ? { ...account, ...data }
            : account
        ) || null,
        twilioLastFetched: Date.now(),
        error: null
      }));
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to update Twilio account';
      set({ error: errorMessage });
      throw error;
    } finally {
      set({ isLoading: false });
    }
  },

  deleteTwilioAccount: async (accountId) => {
    try {
      set({ isLoading: true, error: null });

      const userId = await useAuthStore.getState().getUserId();
      if (!userId) {
        throw new Error('User not authenticated');
      }

      const { error } = await supabase
        .from('twilio_account')
        .delete()
        .eq('id', accountId)
        .eq('user_id', userId);

      if (error) throw error;

      set(state => ({
        twilioInfo: state.twilioInfo?.filter(account => account.id !== accountId) || null,
        twilioLastFetched: Date.now(),
        error: null
      }));
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to delete Twilio account';
      set({ error: errorMessage });
      throw error;
    } finally {
      set({ isLoading: false });
    }
  },

  addPhoneNumber: async (accountId, phoneNumber) => {
    try {
      set({ isLoading: true, error: null });

      const userId = await useAuthStore.getState().getUserId();
      if (!userId) {
        throw new Error('User not authenticated');
      }

      const { data, error } = await supabase
        .from('twilio_phone_numbers')
        .insert([{ ...phoneNumber, account_id: accountId }])
        .select()
        .single();

      if (error) throw error;
      if (!data) throw new Error('Failed to add phone number');

      set(state => ({
        twilioInfo: state.twilioInfo?.map(account =>
          account.id === accountId && account.phone_numbers
            ? {
              ...account,
              phone_numbers: [...account.phone_numbers, data]
            }
            : account
        ) || null,
        twilioLastFetched: Date.now(),
        error: null
      }));
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to add phone number';
      set({ error: errorMessage });
      throw error;
    } finally {
      set({ isLoading: false });
    }
  },

  updatePhoneNumber: async (phoneNumberId, updates) => {
    try {
      set({ isLoading: true, error: null });

      const { data, error } = await supabase
        .from('twilio_phone_numbers')
        .update(updates)
        .eq('id', phoneNumberId)
        .select()
        .single();

      if (error) throw error;
      if (!data) throw new Error('Failed to update phone number');

      set(state => ({
        twilioInfo: state.twilioInfo?.map(account => ({
          ...account,
          phone_numbers: account.phone_numbers?.map(phone =>
            phone.id === phoneNumberId
              ? { ...phone, ...data }
              : phone
          ) || []
        })) || null,
        twilioLastFetched: Date.now(),
        error: null
      }));
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to update phone number';
      set({ error: errorMessage });
      throw error;
    } finally {
      set({ isLoading: false });
    }
  },

  deletePhoneNumber: async (phoneNumberId) => {
    try {
      set({ isLoading: true, error: null });

      const { error } = await supabase
        .from('twilio_phone_numbers')
        .delete()
        .eq('id', phoneNumberId);

      if (error) throw error;

      set(state => ({
        twilioInfo: state.twilioInfo?.map(account => ({
          ...account,
          phone_numbers: account.phone_numbers?.filter(phone => phone.id !== phoneNumberId) || []
        })) || null,
        twilioLastFetched: Date.now(),
        error: null
      }));
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to delete phone number';
      set({ error: errorMessage });
      throw error;
    } finally {
      set({ isLoading: false });
    }
  }
}));
