// hooks/use-call-transcripts.ts
import { useState, useCallback } from 'react';
import { useCallTranscriptsStore, CallMessage, CallTranscriptResponse } from '@/store/use-call-transcripts-store';
import { supabase } from '@/lib/supabase';
import { useToast } from './use-toast';
import { getEnvVars } from '@/lib/env/getEnvVars';  

export function useCallTranscripts() {
    const CACHE_DURATION = 5 * 60 * 1000; // 5 minutes
    const { toast } = useToast();
    const [currentCallId, setCurrentCallId] = useState<string | null>(null);

    const {
        transcripts,
        isLoading: storeLoading,
        error: storeError,
        setTranscript,
        appendTranscript,
        setLoading,
        setError,
        clearTranscript,
        clearAllTranscripts
    } = useCallTranscriptsStore();

    // Helper to check if we should fetch new data
    const shouldFetchTranscript = useCallback((callId: string) => {
        if (!transcripts[callId]) return true;

        const cache = transcripts[callId];
        const cacheExpired = Date.now() - cache.lastFetched > CACHE_DURATION;

        return cacheExpired;
    }, [transcripts]);

    // Fetch transcript chunks from the database and convert to CallMessages
    const fetchTranscript = useCallback(async (callId: string, cursor?: string) => {
        if (!callId) {
            setError('Call ID is required');
            return null;
        }

        setCurrentCallId(callId);

        // Check cache before fetching
        if (!cursor && !shouldFetchTranscript(callId)) {
            console.log('Using cached transcript for call:', callId);
            return transcripts[callId];
        }

        setLoading(true);
        setError(null);

        try {
            console.log(`Fetching transcript for call: ${callId} ${cursor ? `with cursor: ${cursor}` : ''}`);

            // First, try to get transcripts from the database
            let query = supabase
                .from('call_transcripts')
                .select('*')
                .eq('call_id', callId)
                .order('chunk_index', { ascending: true });

            // Apply pagination if cursor is provided
            if (cursor) {
                const parsedCursor = parseInt(cursor, 10);
                if (!isNaN(parsedCursor)) {
                    query = query.gt('chunk_index', parsedCursor).limit(20);
                }
            } else {
                query = query.limit(20);
            }

            const { data, error } = await query;

            // If we have data from the database, process and return it
            if (data && data.length > 0 && !error) {
                // Process and format the transcript chunks into CallMessages
                const messages: CallMessage[] = [];
                
                // Since transcript_chunk is stored as a JSON string containing an array of messages
                data.forEach(chunk => {
                    try {
                        const chunkMessages = JSON.parse(chunk.transcript_chunk);
                        if (Array.isArray(chunkMessages)) {
                            messages.push(...chunkMessages);
                        }
                    } catch (e) {
                        console.error('Error parsing transcript chunk:', e);
                    }
                });

                // Determine if there's more data to fetch
                const lastIndex = data[data.length - 1].chunk_index;
                const nextCursor = lastIndex !== undefined ? String(lastIndex) : null;

                // Check if there are more records
                const { count } = await supabase
                    .from('call_transcripts')
                    .select('*', { count: 'exact', head: true })
                    .eq('call_id', callId)
                    .gt('chunk_index', lastIndex);

                const hasMore = !!count && count > 0;

                // Update store based on whether this is initial load or pagination
                if (cursor) {
                    appendTranscript(callId, messages, hasMore, hasMore ? nextCursor : null);
                } else {
                    setTranscript(callId, messages, hasMore, hasMore ? nextCursor : null);
                }

                console.log(`Retrieved transcript from database for call: ${callId}`);
                setLoading(false);
                return {
                    messages,
                    hasMore,
                    nextCursor: hasMore ? nextCursor : null
                };
            }

            // If no data in database or there was an error, call the API
            console.log(`No transcript found in database for call: ${callId}, calling API...`);
            
            const { NEXT_PUBLIC_BACKEND_URL_WORKER } = getEnvVars();
            if (!NEXT_PUBLIC_BACKEND_URL_WORKER) {
                throw new Error('NEXT_PUBLIC_BACKEND_URL_WORKER is not defined');
            }
            
            // Call the API to get the transcript
            const apiUrl = `${NEXT_PUBLIC_BACKEND_URL_WORKER}/api/call-transcripts/${callId}${cursor ? `?cursor=${cursor}` : ''}`;
            const response = await fetch(apiUrl);
            
            if (!response.ok) {
                throw new Error(`API error: ${response.statusText}`);
            }
            
            const apiData = await response.json();
            
            if (apiData.status !== 'success' || !apiData.data) {
                throw new Error('Failed to fetch transcript from API');
            }
            
            const transcriptData = apiData.data as CallTranscriptResponse;
            
            // Update the store with API data
            if (cursor) {
                appendTranscript(
                    callId, 
                    transcriptData.results, 
                    !!transcriptData.next, 
                    transcriptData.next
                );
            } else {
                setTranscript(
                    callId, 
                    transcriptData.results, 
                    !!transcriptData.next, 
                    transcriptData.next
                );
            }
            
            setLoading(false);
            return {
                messages: transcriptData.results,
                hasMore: !!transcriptData.next,
                nextCursor: transcriptData.next
            };

        } catch (error) {
            console.error('Error fetching call transcript:', error);
            setError('Failed to fetch call transcript');
            setLoading(false);

            toast({
                title: 'Error',
                description: 'Failed to fetch call transcript',
                variant: 'destructive'
            });

            return null;
        }
    }, [shouldFetchTranscript, transcripts, setLoading, setError, setTranscript, appendTranscript, toast]);

    // Load more data (pagination)
    const loadMoreTranscript = useCallback(async (callId: string) => {
        const transcript = transcripts[callId];

        if (!transcript || !transcript.hasMore || !transcript.nextCursor) {
            return null;
        }

        return fetchTranscript(callId, transcript.nextCursor);
    }, [transcripts, fetchTranscript]);

    // Format transcript data for API response format
    const getFormattedTranscript = useCallback((callId: string): CallTranscriptResponse | null => {
        const transcript = transcripts[callId];

        if (!transcript) return null;

        return {
            next: transcript.hasMore ? transcript.nextCursor : null,
            previous: null, // This implementation doesn't track previous cursors
            total: transcript.messages.length,
            results: transcript.messages
        };
    }, [transcripts]);

    return {
        // State
        transcripts,
        isLoading: storeLoading,
        error: storeError,
        currentCallId,

        // Actions
        fetchTranscript,
        loadMoreTranscript,
        setCurrentCallId,
        clearTranscript,
        clearAllTranscripts,

        // Formatted data
        getTranscript: getFormattedTranscript,
    };
}