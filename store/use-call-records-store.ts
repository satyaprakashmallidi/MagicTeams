import { create } from 'zustand';
import { supabase } from '@/lib/supabase';
import { useAuthStore } from '@/hooks/use-auth';

export interface CallRecord {
  call_id: string;
  user_id: string;
  bot_id: string;
  created_at: string;
  additional_data: any;
}

interface CallRecordsState {
  callRecords: CallRecord[];
  selectedCallId: string | null;
  isLoading: boolean;
  error: string | null;
  lastFetched: number | null;
}

interface CallRecordsActions {
  // State setters
  setCallRecords: (calls: CallRecord[]) => void;
  setSelectedCallId: (id: string | null) => void;
  clearError: () => void;
  
  // CRUD operations
  fetchCallRecords: () => Promise<void>;
  addCallRecord: (callRecord: Omit<CallRecord, 'user_id' | 'created_at'>) => Promise<void>;
  updateCallRecord: (callId: string, updates: Partial<CallRecord>) => Promise<void>;
  deleteCallRecord: (callId: string) => Promise<void>;
  deleteAllCallRecords: () => Promise<void>;
}

type CallRecordsStore = CallRecordsState & CallRecordsActions;

const CACHE_DURATION = 5 * 60 * 1000; // 5 minutes

export const useCallRecordsStore = create<CallRecordsStore>((set, get) => ({
  // Initial State
  callRecords: [],
  selectedCallId: null,
  isLoading: false,
  error: null,
  lastFetched: null,

  // State setters
  setCallRecords: (calls) => set({ callRecords: calls }),
  setSelectedCallId: (id) => set({ selectedCallId: id }),
  clearError: () => set({ error: null }),

  // CRUD operations
  fetchCallRecords: async () => {
    const state = get();
    const now = Date.now();
    
    // Return cached data if valid
    if (state.lastFetched && (now - state.lastFetched < CACHE_DURATION) && state.callRecords.length > 0) {
      return;
    }

    set({ isLoading: true, error: null });

    try {
      const userId = await supabase.auth.getUser().then((res) => res.data.user?.id);
      if (!userId) {
        throw new Error('User not authenticated');
      }

      // Get current and previous month for partition names
      const getPartitionName = (date: Date) => {
        const year = date.getFullYear();
        console.log("year" , year);
        const month = String(date.getMonth() + 1).padStart(2, '0');
        console.log("month" , month);
        console.log("partition name" , `call_records_${year}_${month}`);
        return `call_records_${year}_${month}`;
      };

      const now = new Date();
      const currentMonth = new Date(now.getFullYear(), now.getMonth(), 1);
      const prevMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);

      const currentPartition = getPartitionName(currentMonth);
      const prevPartition = getPartitionName(prevMonth);


      // Function to fetch from a single partition
      const fetchFromPartition = async (partition: string) => {
        const { data, error } = await supabase
          .from(partition)
          .select('*')
          .eq('user_id', userId)
          .order('created_at', { ascending: false });
        
        if (error && error.code !== '42P01') { // Ignore "relation does not exist" error
          console.error(`Error fetching from partition ${partition}:`, error);
          throw error;
        }
        return data || [];
      };


      // Fetch from both current and previous month's partitions
      const [currentData, prevData] = await Promise.allSettled([
        fetchFromPartition(currentPartition),
        fetchFromPartition(prevPartition)
      ]);

      // Combine and sort results
      const allRecords = [
        ...(currentData.status === 'fulfilled' ? currentData.value : []),
        ...(prevData.status === 'fulfilled' ? prevData.value : [])
      ].sort((a, b) => 
        new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
      );

      set({ 
        callRecords: allRecords,
        lastFetched: now.getTime() 
      });

      // return data;
    } catch (error) {
      set({ error: error instanceof Error ? error.message : 'Failed to fetch call records' });
      throw error;
    } finally {
      set({ isLoading: false });
    }
  },

  addCallRecord: async ({ call_id, bot_id }) => {
    set({ isLoading: true, error: null });

    try {
      const userId = await useAuthStore.getState().getUserId();
      if (!userId) {
        throw new Error('User not authenticated');
      }

      const { data, error } = await supabase
        .from('call_records')
        .insert([{
          call_id,
          bot_id,
          user_id: userId,
        }])
        .select()
        .single();

      if (error) throw error;

      // Update local state optimistically
      set(state => ({ 
        callRecords: [data, ...state.callRecords],
        lastFetched: Date.now()
      }));

      return data;
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to add call record';
      set({ error: message });
      throw error;
    } finally {
      set({ isLoading: false });
    }
  },

  updateCallRecord: async (callId: string, updates: Partial<CallRecord>) => {
    set({ isLoading: true, error: null });

    try {
      const userId = await useAuthStore.getState().getUserId();
      if (!userId) {
        throw new Error('User not authenticated');
      }

      const { data, error } = await supabase
        .from('call_records')
        .update(updates)
        .eq('call_id', callId)
        .eq('user_id', userId)
        .select()
        .single();

      if (error) throw error;

      // Update local state optimistically
      set(state => ({
        callRecords: state.callRecords.map(record => 
          record.call_id === callId ? { ...record, ...updates } : record
        ),
        lastFetched: Date.now()
      }));

      return data;
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to update call record';
      set({ error: message });
      throw error;
    } finally {
      set({ isLoading: false });
    }
  },

  deleteCallRecord: async (callId: string) => {
    set({ isLoading: true, error: null });

    try {
      const userId = await useAuthStore.getState().getUserId();
      if (!userId) {
        throw new Error('User not authenticated');
      }

      const { error } = await supabase
        .from('call_records')
        .delete()
        .eq('call_id', callId)
        .eq('user_id', userId);

      if (error) throw error;

      // Update local state optimistically
      set(state => ({
        callRecords: state.callRecords.filter(record => record.call_id !== callId),
        selectedCallId: state.selectedCallId === callId ? null : state.selectedCallId,
        lastFetched: Date.now()
      }));
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to delete call record';
      set({ error: message });
      throw error;
    } finally {
      set({ isLoading: false });
    }
  },

  deleteAllCallRecords: async () => {
    set({ isLoading: true, error: null });

    try {
      const userId = await useAuthStore.getState().getUserId();
      if (!userId) {
        throw new Error('User not authenticated');
      }

      const { error } = await supabase
        .from('call_records')
        .delete()
        .eq('user_id', userId);

      if (error) throw error;

      // Update local state
      set({
        callRecords: [],
        selectedCallId: null,
        lastFetched: Date.now()
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to delete all call records';
      set({ error: message });
      throw error;
    } finally {
      set({ isLoading: false });
    }
  }
}));