// store/use-call-transcripts-store.ts
import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import { supabase } from '@/lib/supabase';

export interface CallMessage {
    role: string;
    text: string;
    medium: string;
    callStageId: string;
    callStageMessageIndex: number;
}

export interface CallTranscriptResponse {
    next: string | null;
    previous: string | null;
    total: number;
    results: CallMessage[];
}

interface CallTranscriptMap {
    [callId: string]: {
        messages: CallMessage[];
        lastFetched: number;
        hasMore: boolean;
        nextCursor: string | null;
    };
}

interface CallTranscriptsState {
    // State
    transcripts: CallTranscriptMap;
    isLoading: boolean;
    error: string | null;

    // Actions
    setTranscript: (callId: string, transcript: CallMessage[], hasMore: boolean, nextCursor: string | null) => void;
    appendTranscript: (callId: string, transcript: CallMessage[], hasMore: boolean, nextCursor: string | null) => void;
    setLoading: (isLoading: boolean) => void;
    setError: (error: string | null) => void;
    clearTranscript: (callId: string) => void;
    clearAllTranscripts: () => void;
}


// Create the store
export const useCallTranscriptsStore = create<CallTranscriptsState>()(
    persist(
        (set, get) => ({
            // Initial state
            transcripts: {},
            isLoading: false,
            error: null,

            // Actions
            setTranscript: (callId, messages, hasMore, nextCursor) =>
                set((state) => ({
                    transcripts: {
                        ...state.transcripts,
                        [callId]: {
                            messages,
                            lastFetched: Date.now(),
                            hasMore,
                            nextCursor
                        }
                    }
                })),

            appendTranscript: (callId, newMessages, hasMore, nextCursor) =>
                set((state) => {
                    const existingTranscript = state.transcripts[callId] || { messages: [], lastFetched: 0, hasMore: false, nextCursor: null };
                    return {
                        transcripts: {
                            ...state.transcripts,
                            [callId]: {
                                messages: [...existingTranscript.messages, ...newMessages],
                                lastFetched: Date.now(),
                                hasMore,
                                nextCursor
                            }
                        }
                    };
                }),

            setLoading: (isLoading) => set({ isLoading }),

            setError: (error) => set({ error }),

            clearTranscript: (callId) =>
                set((state) => {
                    const { [callId]: _, ...rest } = state.transcripts;
                    return { transcripts: rest };
                }),

            clearAllTranscripts: () => set({ transcripts: {} }),
        }),
        {
            name: 'call-transcripts-store',
            storage: createJSONStorage(() => localStorage),
            partialize: (state) => ({
                transcripts: state.transcripts,
            }),
        }
    )
);

