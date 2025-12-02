"use client";

import { useState, useCallback, useEffect, useMemo } from 'react';
import { useCallRecords } from './use-call-records';
import { createClientComponentClient } from '@supabase/auth-helpers-nextjs';
import { useAuthStore } from '@/hooks/use-auth';
import { getEnvVars } from '@/lib/env/getEnvVars';
import { CallRecord, useCallRecordsStore } from '@/store/use-call-records-store';

// Cache duration from memory pattern
const CACHE_DURATION = 5 * 60 * 1000; // 5 minutes

interface CallSummary {
  short_summary: string;
  long_summary: string;
  created: string;
  joined: string;
  ended: string;
  end_reason: string;
  recording_enabled: boolean;
  voice: string;
  temperature: number;
  system_prompt: string;
}

interface AnalyticsData {
  date: string;
  calls: number;
  talkTime: number;
  cost: number;
}

// Split interfaces for state and actions per pattern
interface CallAnalyticsState {
  dateRange: {
    from: Date;
    to: Date;
  };
  isLoading: boolean;
  error: Error | null;
  callSummaries: Record<string, CallSummary>;
  analyticsData: AnalyticsData[];
  _analyticsData: AnalyticsData[];
  lastFetched: number;
}

export function useCallAnalytics() {
  const [state, setState] = useState<CallAnalyticsState>({
    dateRange: {
      from: new Date(new Date().setDate(new Date().getDate() - 30)), // Last 30 days
      to: new Date()
    },
    isLoading: false,
    error: null,
    callSummaries: {},
    analyticsData: [],
    _analyticsData: [],
    lastFetched: 0
  });
  const { callRecords , fetchCallRecords } = useCallRecordsStore();

  const { from, to } = state.dateRange;
  const { isLoading, analyticsData, _analyticsData, callSummaries, lastFetched } = state;
  
  const setFrom = useCallback((date: Date) => {
    setState(prev => ({ ...prev, dateRange: { ...prev.dateRange, from: date } }));
  }, []);

  const setTo = useCallback((date: Date) => {
    setState(prev => ({ ...prev, dateRange: { ...prev.dateRange, to: date } }));
  }, []);

  const supabase = createClientComponentClient();

  // Reset error before new requests
  const clearError = useCallback(() => {
    setState(prev => ({ ...prev, error: null }));
  }, []);

  // Cache validation per pattern
  const isCacheValid = useCallback((cachedFrom: Date, cachedTo: Date) => {
    const now = Date.now();
    return (
      now - lastFetched < CACHE_DURATION &&
      cachedFrom.getTime() === from.getTime() &&
      cachedTo.getTime() === to.getTime()
    );
  }, [lastFetched, from, to]);

  // Fetch analytics data for date range
  const fetchAnalytics = useCallback(async () => {
    clearError();
    if (isLoading || !from || !to || isNaN(from.getTime()) || isNaN(to.getTime())) {
      return;
    }

    // Return cached data if valid
    if (isCacheValid(from, to)) {
      console.log("analytics data already fetched / cached");
      return analyticsData;
    }

    setState(prev => ({ ...prev, isLoading: true }));
    
    try {

      if(!callRecords || callRecords.length === 0){
        console.log("fetching call records -------- beacuse did not find any");
        await fetchCallRecords();

        // console.log("call records fetched" , callRecords);
      }else{
        // console.log("call records already fetched" , callRecords);
      }

      // Get all call IDs from the call records
      const callIds = callRecords.map((detail: CallRecord) => detail.call_id);

      const chunkSize = 200;
      const chunks = [];
      for (let i = 0; i < callIds.length; i += chunkSize) {
        chunks.push(callIds.slice(i, i + chunkSize));
      }

      if (callIds.length === 0) {
        setState(prev => ({
          ...prev,
          isLoading: false,
          analyticsData: [],
          _analyticsData: [],
        }));
        console.log('No New call data found for the selected date range');
        return [];
      }


      console.log("-----------------------------------------------------------------")

      const acc_data = [];
      const foundCallIds = new Set<string>();

      for(let i = 0; i < chunks.length; i++){
        const { data, error } = await supabase
        .from('call_details')
        .select('*')
        .in('call_id', chunks[i])
        .gte('created', from.toISOString())
        .lte('created', to.toISOString());

        if (error) {
         console.error('Error fetching call summaries:', error);
         return [];
        }

        if(data){
          acc_data.push(...data);
          data.forEach(d => foundCallIds.add(d.call_id));
        }
      }

      const missingCallIds = callIds.filter(id => !foundCallIds.has(id));

      if(missingCallIds.length > 0){
        console.log(`Fetching details for ${missingCallIds.length} missing calls from API.`);
        const backendUrl = getEnvVars().NEXT_PUBLIC_BACKEND_URL_WORKER;
        if(backendUrl){
          const promises = missingCallIds.map(callId => 
            fetch(`${backendUrl}/api/get-call-details?call_id=${callId}`)
              .then(res => {
                if(!res.ok){
                  console.error(`Failed to fetch call details for ${callId}, status: ${res.status}`);
                  return null;
                }
                return res.json();
              })
              .then(body => {
                if(body && body.data){
                  return body.data;
                }
                return null;
              })
              .catch(err => {
                console.error(`Error fetching call details for ${callId} from API:`, err);
                return null;
              })
          );
          const missingDetails = (await Promise.all(promises)).filter(Boolean);
          acc_data.push(...missingDetails);
        }
      }


      // Process analytics data
      const analyticsMap = new Map<string, AnalyticsData>();
       
      acc_data.forEach((detail: any) => {
        const date = new Date(detail.created).toISOString().split('T')[0];
        const existing = analyticsMap.get(date) || {
          date,
          calls: 0,
          talkTime: 0,
          cost: 0
        };

        const talkTime = detail.ended && detail.joined
          ? (new Date(detail.ended).getTime() - new Date(detail.joined).getTime()) / 1000
          : 0;

        analyticsMap.set(date, {
          ...existing,
          calls: existing.calls + 1,
          talkTime: existing.talkTime + talkTime
        });
      });

      // Sort by date and fill missing dates
      const startDate = new Date(from);
      const endDate = new Date(to);
      const sortedAnalytics: AnalyticsData[] = [];

      for (let d = startDate; d <= endDate; d.setDate(d.getDate() + 1)) {
        const date = d.toISOString().split('T')[0];
        sortedAnalytics.push(
          analyticsMap.get(date) || {
            date,
            calls: 0,
            talkTime: 0,
            cost: 0
          }
        );
      }

      setState(prev => ({
        ...prev,
        isLoading: false,
        analyticsData: sortedAnalytics,
        lastFetched: Date.now()
      }));

      return sortedAnalytics;
    } catch (error) {
      console.error('Error fetching analytics:', error);
      setState(prev => ({ 
        ...prev, 
        isLoading: false, 
        error: error as Error,
        lastFetched: Date.now()
      }));
      return [];
    }
  }, [clearError, isLoading, from, to, isCacheValid, analyticsData, callRecords, fetchCallRecords, supabase]);

  const fetchCallSummary = useCallback(async (callId: string) => {
    try {
      clearError();
      
      // Return cached data if valid
      if (state.callSummaries[callId]) {
        return state.callSummaries[callId];
      }

      if (!callId) {
        throw new Error('Call ID is required');
      }

      if (!getEnvVars().NEXT_PUBLIC_BACKEND_URL_WORKER) {
        throw new Error('Backend URL is not defined');
      }

      const response = await fetch(getEnvVars().NEXT_PUBLIC_BACKEND_URL_WORKER + `/api/get-call-details?call_id=${callId}`);
      const data = await response.json();

      if (!response.ok) {
        console.error('Failed to fetch call summary:', data.error);
        return;
      }

      if (data?.data) {
        const summary = {
          short_summary: data.data.short_summary || '',
          long_summary: data.data.long_summary || '',
          created: data.data.created || '',
          joined: data.data.joined || '',
          ended: data.data.ended || '',
          end_reason: data.data.end_reason || '',
          recording_enabled: data.data.recording_enabled || false,
          voice: data.data.voice || '',
          temperature: data.data.temperature || 0,
          system_prompt: data.data.system_prompt || ''
        };

        setState(prev => ({
          ...prev,
          callSummaries: {
            ...prev.callSummaries,
            [callId]: summary
          },
          lastFetched: Date.now()
        }));
        return summary;
      }
    } catch (error) {
      setState(prev => ({ ...prev, error: error as Error }));
      console.error('Error fetching call summary:', error);
    }
  }, [state.callSummaries, isCacheValid, clearError, from, to]);

  const fetchGroupCallSummaries = useCallback(async (callIds: string[]) => {
    // Filter out call IDs that we already have valid cached summaries for
    const missingCallIds = callIds.filter(id => !state.callSummaries[id] || !isCacheValid(from, to));
    if (missingCallIds.length === 0) return;

    try {
      clearError();

      const acc_data = [];
      const chunkSize = 200;
      const chunks = [];
      for (let i = 0; i < missingCallIds.length; i += chunkSize) {
        chunks.push(missingCallIds.slice(i, i + chunkSize));
      }

      for(let i = 0; i < chunks.length; i++){
        
      const { data, error } = await supabase
        .from('call_details')
        .select('*')
        .in('call_id', chunks[i]);

      if (error) throw error;

      if (data) {
        acc_data.push(data);
      }

      }

      const summariesMap = {};

      if (acc_data) {
        acc_data.forEach((detail: any) => {
         detail.forEach((detail: any) => {
          //@ts-ignore
          summariesMap[detail.call_id] = {
            short_summary: detail.short_summary || '',
            long_summary: detail.long_summary || '',
            created: detail.created || '',
            joined: detail.joined || '',
            ended: detail.ended || '',
            end_reason: detail.end_reason || '',
            recording_enabled: detail.recording_enabled || false,
            voice: detail.voice || '',
            temperature: detail.temperature || 0,
            system_prompt: detail.system_prompt || ''
          }
        });
      });

        setState(prev => ({
          ...prev,
          callSummaries: {
            ...prev.callSummaries,
            ...summariesMap
          },
          lastFetched: Date.now()
        }));
      }
    } catch (error) {
      setState(prev => ({ ...prev, error: error as Error }));
      console.error('Error fetching group call summaries:', error);
    }
  }, [supabase, state.callSummaries, isCacheValid, clearError, from, to]);

  // Memoize filter function
  const filterAnalyticsByDateRange = useCallback((data: AnalyticsData[], fromDate: Date, toDate: Date) => {
    return data.filter(day => {
      const dayDate = new Date(day.date);
      return dayDate >= fromDate && dayDate <= toDate;
    });
  }, []);

  // Fetch data when dependencies change
  useEffect(() => {
    const shouldFetch = !isLoading && (
      !isCacheValid(from, to)
    );
    
    if (shouldFetch) {
      void fetchAnalytics();
    }
  }, [from, to, isLoading, isCacheValid, fetchAnalytics]);

  // Filter analytics data when raw data changes
  useEffect(() => {
    if (!analyticsData) {
      setState(prev => ({
        ...prev,
        _analyticsData: []
      }));
      return;
    }
    
    const filteredAnalytics = filterAnalyticsByDateRange(analyticsData, from, to);
    const currentAnalytics = _analyticsData;
    
    // Only update if data has actually changed
    if (!currentAnalytics || 
        currentAnalytics.length !== filteredAnalytics.length ||
        JSON.stringify(currentAnalytics) !== JSON.stringify(filteredAnalytics)) {
      setState(prev => ({
        ...prev,
        _analyticsData: filteredAnalytics
      }));
    }
  }, [analyticsData, from, to, filterAnalyticsByDateRange, _analyticsData]);

  useEffect(() => {
    fetchAnalytics();
  }, [callRecords]);

  // Memoize analytics calculations
  const analytics = useMemo(() => ({
    totalCalls: _analyticsData.reduce((sum, day) => sum + day.calls, 0),
    totalTalkTime: _analyticsData.reduce((sum, day) => sum + day.talkTime, 0)
  }), [_analyticsData]);

  const averageTalkTimePerCall = useMemo(() => 
    analytics.totalCalls ? analytics.totalTalkTime / analytics.totalCalls : 0,
  [analytics]);

  return {
    data: state._analyticsData,
    isLoading: state.isLoading,
    error: state.error,
    callSummaries: state.callSummaries,
    fetchCallSummary,
    fetchGroupCallSummaries,
    fetchAnalytics,
    totalCalls: analytics.totalCalls,
    totalTalkTime: analytics.totalTalkTime,
    averageTalkTimePerCall,
    setFrom,
    setTo,
    from,
    to
  };
}
