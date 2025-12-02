import { create } from 'zustand';
import { supabase } from '@/lib/supabase';

interface AuthState {
  userId: string | null;
  isLoading: boolean;
  error: string | null;
  lastFetched: number | null;
}

interface AuthActions {
  getUserId: () => Promise<string | undefined>;
}

type AuthStore = AuthState & AuthActions;

const CACHE_DURATION = 5 * 60 * 1000; // 5 minutes

export const useAuthStore = create<AuthStore>((set, get) => ({
  userId: null,
  isLoading: false,
  error: null,
  lastFetched: null,

  getUserId: async () => {
    const state = get();
    const now = Date.now();

    // Return cached userId if valid
    const isCacheValid = state.lastFetched && (now - state.lastFetched < CACHE_DURATION);
    if (isCacheValid && state.userId) {
      return state.userId;
    }

    try {
      set({ isLoading: true, error: null });
      const { data: { user } } = await supabase.auth.getUser();
      
      if (user?.id) {
        set({ 
          userId: user.id,
          lastFetched: now
        });
        return user.id;
      }
      return undefined;
    } catch (error) {
      set({ error: error instanceof Error ? error.message : 'Failed to get user ID' });
      return undefined;
    } finally {
      set({ isLoading: false });
    }
  }
}));
