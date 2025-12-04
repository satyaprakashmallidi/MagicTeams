import { supabase } from "@/lib/supabase";
import { create } from "zustand";
import { useAuthStore } from "@/hooks/use-auth";
import { MinuteBalanceService } from "@/lib/services/minute-balance.service";

interface PricingData {
    time_rem: number;
    is_twilio_allowed: boolean;
    cost: number;
    user_id: string;
}

interface PricingState {
    time: number;           // Total time (Agency + Direct)
    agencyTime: number;     // Agency specific time
    directTime: number;     // Direct specific time
    isTwilioAllowed: boolean;
    callStarted: boolean;
    costPerMinute: number;
    isLoading: boolean;
    error: string | null;
    lastFetched: number | null;
    userType?: 'agency' | 'direct' | 'both';
}

interface PricingActions {
    setTime: (time: number) => void;
    setTwilioAllowed: (twilioAllowed: boolean) => void;
    setCallStarted: (callStarted: boolean) => void;
    setCostPerMinute: (costPerMinute: number) => void;
    fetchPricingTools: () => Promise<void>;
    updatePricing: (updates: Partial<PricingData>) => Promise<void>;
    resetToDefault: () => Promise<void>;
    updateTimeRemaining: (timeUsed: number) => Promise<void>;
}

type PricingStore = PricingState & PricingActions;

const CACHE_DURATION = 5 * 60 * 1000; // 5 minutes

const DEFAULT_PRICING: Omit<PricingData, 'user_id'> = {
    time_rem: 300,
    is_twilio_allowed: false,
    cost: 0.02 // $0.02 per minute
};

export const usePricingToolsStore = create<PricingStore>((set, get) => ({
    // Initial State
    time: DEFAULT_PRICING.time_rem,
    agencyTime: 0,
    directTime: 0,
    isTwilioAllowed: DEFAULT_PRICING.is_twilio_allowed,
    callStarted: false,
    costPerMinute: DEFAULT_PRICING.cost,
    isLoading: false,
    error: null,
    lastFetched: null,

    // Basic Actions
    setTime: (time) => set({ time }),
    setTwilioAllowed: (twilioAllowed) => set({ isTwilioAllowed: twilioAllowed }),
    setCallStarted: (callStarted) => set({ callStarted }),
    setCostPerMinute: (costPerMinute) => set({ costPerMinute }),

    // Async Actions
    fetchPricingTools: async () => {
        const state = get();
        const now = Date.now();

        // Return early if cache is valid and we have data
        const isCacheValid = state.lastFetched && (now - state.lastFetched < CACHE_DURATION);
        if (isCacheValid && state.time > 0) {
            console.log('[PricingStore] Using cached balance');
            return;
        }

        try {
            set({ isLoading: true, error: null });

            const userId = await useAuthStore.getState().getUserId();
            if (!userId) {
                console.warn('[PricingStore] No user ID found');
                throw new Error('User not authenticated');
            }

            console.log('[PricingStore] Fetching balance using MinuteBalanceService...');

            // Use unified service to fetch balance (handles both user types)
            const balanceResult = await MinuteBalanceService.getBalance(userId);

            console.log('[PricingStore] Balance fetched:', {
                userType: balanceResult.userType,
                balance: balanceResult.balance,
                agency: balanceResult.agencyBalance,
                direct: balanceResult.directBalance
            });

            set({
                time: balanceResult.balance,
                agencyTime: balanceResult.agencyBalance,
                directTime: balanceResult.directBalance,
                isTwilioAllowed: true, // Default to true for now
                costPerMinute: balanceResult.costPerMinute || DEFAULT_PRICING.cost,
                lastFetched: now,
                userType: balanceResult.userType
            });

        } catch (error) {
            console.error('[PricingStore] Error fetching balance:', error);
            set({
                error: error instanceof Error ? error.message : 'Failed to fetch pricing data',
                time: DEFAULT_PRICING.time_rem,
                isTwilioAllowed: DEFAULT_PRICING.is_twilio_allowed,
                costPerMinute: DEFAULT_PRICING.cost,
                lastFetched: now
            });
        } finally {
            set({ isLoading: false });
        }
    },

    updatePricing: async (updates) => {
        try {
            set({ isLoading: true, error: null });

            const userId = await useAuthStore.getState().getUserId();
            if (!userId) {
                throw new Error('User not authenticated');
            }

            // Get current user's email to find linked accounts
            const { data: { user } } = await supabase.auth.getUser();
            const userEmail = user?.email;

            // Update current user's pricing
            const { data, error } = await supabase
                .from('pricing')
                .update(updates)
                .eq('user_id', userId)
                .select()
                .single();

            if (error) throw error;

            // Also update linked accounts with same email (different auth methods)
            if (userEmail) {
                const { data: { users } } = await supabase.auth.admin.listUsers();
                const linkedUserIds = users
                    ?.filter(u => u.email === userEmail && u.id !== userId)
                    .map(u => u.id) || [];

                if (linkedUserIds.length > 0) {
                    await supabase
                        .from('pricing')
                        .update(updates)
                        .in('user_id', linkedUserIds);
                }
            }

            // Refresh full state after update to ensure sync
            await get().fetchPricingTools();

        } catch (error) {
            set({ error: error instanceof Error ? error.message : 'Failed to update pricing' });
        } finally {
            set({ isLoading: false });
        }
    },

    resetToDefault: async () => {
        try {
            set({ isLoading: true, error: null });

            const userId = await useAuthStore.getState().getUserId();
            if (!userId) {
                throw new Error('User not authenticated');
            }

            // Get current user's email to find linked accounts
            const { data: { user } } = await supabase.auth.getUser();
            const userEmail = user?.email;

            // Update current user's pricing
            const { data, error } = await supabase
                .from('pricing')
                .update(DEFAULT_PRICING)
                .eq('user_id', userId)
                .select()
                .single();

            if (error) throw error;

            // Also update linked accounts with same email (different auth methods)
            if (userEmail) {
                const { data: { users } } = await supabase.auth.admin.listUsers();
                const linkedUserIds = users
                    ?.filter(u => u.email === userEmail && u.id !== userId)
                    .map(u => u.id) || [];

                if (linkedUserIds.length > 0) {
                    await supabase
                        .from('pricing')
                        .update(DEFAULT_PRICING)
                        .in('user_id', linkedUserIds);
                }
            }

            set({
                time: DEFAULT_PRICING.time_rem,
                agencyTime: 0,
                directTime: DEFAULT_PRICING.time_rem,
                isTwilioAllowed: DEFAULT_PRICING.is_twilio_allowed,
                costPerMinute: DEFAULT_PRICING.cost,
                lastFetched: Date.now()
            });
        } catch (error) {
            set({ error: error instanceof Error ? error.message : 'Failed to reset pricing' });
        } finally {
            set({ isLoading: false });
        }
    },

    updateTimeRemaining: async (timeUsed) => {
        try {
            // Don't set loading true here as it might cause UI flicker during active calls
            // set({ isLoading: true, error: null });

            const userId = await useAuthStore.getState().getUserId();
            if (!userId) {
                console.error('[PricingStore] No user ID for minute deduction');
                throw new Error('User not authenticated');
            }

            const state = get();
            console.log(`[PricingStore] Deducting ${timeUsed} seconds from balance...`);

            // Use unified service to deduct minutes (handles both user types)
            const result = await MinuteBalanceService.deductMinutes(userId, timeUsed);

            if (result.success) {
                console.log(`[PricingStore] Minutes deducted successfully.New balance: ${result.newBalance} seconds`);
                set({
                    time: result.newBalance,
                    agencyTime: result.newAgencyBalance,
                    directTime: result.newDirectBalance,
                    lastFetched: Date.now()
                });
            } else {
                console.error('[PricingStore] Failed to deduct minutes:', result.error);

                // Optimistically update UI even if backend fails (fallback logic)
                const newTime = Math.max(0, state.time - timeUsed);
                set({
                    time: newTime,
                    lastFetched: Date.now(),
                    error: result.error || 'Failed to update time remaining'
                });
            }
        } catch (error) {
            console.error('[PricingStore] Error in updateTimeRemaining:', error);

            // Optimistically update UI on error
            const state = get();
            const newTime = Math.max(0, state.time - timeUsed);
            set({
                time: newTime,
                lastFetched: Date.now(),
                error: error instanceof Error ? error.message : 'Failed to update time remaining'
            });
        } finally {
            set({ isLoading: false });
        }
    }
}));