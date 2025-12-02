'use client';

import React, { useState, useEffect } from 'react';
import { SmartDataGrid } from '@/components/smart-column-generator';
import { DataGridItem } from '@/components/smart-column-generator/types';
import { LoadingSpinner } from '@/components/ui/loading-spinner';
import { Toaster } from '@/components/ui/toaster';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { toast } from '@/hooks/use-toast';
import { useCallRecords } from '@/hooks/use-call-records';
import { useBots } from '@/hooks/use-bots';
import { useCallTranscripts } from '@/hooks/use-callTranscripts';
import { useCallAnalytics } from '@/hooks/use-call-analytics';

// Cache durations
const TRANSCRIPT_CACHE_DURATION = 24 * 60 * 60 * 1000; // 24 hours

// Interface for cached transcript data
interface CachedTranscript {
  timestamp: number;
  data: any;
}

// Helper function to get cached transcript
const getCachedTranscript = (callId: string): any | null => {
  try {
    const cachedData = localStorage.getItem(`transcript_${callId}`);
    if (!cachedData) return null;
    
    const parsedData: CachedTranscript = JSON.parse(cachedData);
    
    // Check if cache is still valid
    if (Date.now() - parsedData.timestamp < TRANSCRIPT_CACHE_DURATION) {
      console.log(`Using cached transcript for call ${callId}`);
      return parsedData.data;
    }
    
    // Cache expired
    return null;
  } catch (error) {
    console.error('Error retrieving cached transcript:', error);
    return null;
  }
};

// Helper function to cache transcript
const cacheTranscript = (callId: string, data: any): void => {
  try {
    const cacheData: CachedTranscript = {
      timestamp: Date.now(),
      data
    };
    
    localStorage.setItem(`transcript_${callId}`, JSON.stringify(cacheData));
    console.log(`Cached transcript for call ${callId}`);
  } catch (error) {
    console.error('Error caching transcript:', error);
  }
};

export default function SmartColumnGeneratorPage() {
  // Get call history data from hooks
  const { callData, isLoading: callDataLoading } = useCallRecords();
  const { bots } = useBots();

  const [data, setData] = useState<DataGridItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [geminiApiKey, setGeminiApiKey] = useState<string>('');
  const [apiKeyInput, setApiKeyInput] = useState<string>('');
  const [showApiKeyForm, setShowApiKeyForm] = useState<boolean>(false);
  const [loadedTranscripts, setLoadedTranscripts] = useState<Set<string>>(new Set());
  
  // State machine states
  const [dataFetchStatus, setDataFetchStatus] = useState<'idle' | 'processing' | 'fetching_details' | 'complete'>('idle');

  const { fetchTranscript } = useCallTranscripts();
  const { callSummaries, fetchCallSummary } = useCallAnalytics();

  useEffect(() => {
    const envApiKey = process.env.GEMINI_API_KEY || "AIzaSyDXsh8lO2gdQPQYyzLg_OxQLqq_XkkU0hs";
    if (envApiKey) {
      console.log('[SmartColumnGeneratorPage] Using API key from environment variable');
      setGeminiApiKey(envApiKey);
    } else {
      const savedApiKey = localStorage.getItem('gemini_api_key');
      if (savedApiKey) {
        console.log('[SmartColumnGeneratorPage] Using API key from localStorage');
        setGeminiApiKey(savedApiKey);
      }
    }
  }, []);

  // Unified data fetching process with state machine
  useEffect(() => {
    if (callDataLoading) {
      return; // Wait for callData to be ready
    }
    
    // Process and fetch data in a state machine
    const processData = async () => {
      // STATE: IDLE -> PROCESSING
      if (dataFetchStatus === 'idle' && callData.length > 0) {
        console.log('== State: Idle -> Processing call history data ==');
        setDataFetchStatus('processing');
        
        try {
          const processedData: DataGridItem[] = [];
          
          // Process calls 10 at a time max to avoid overwhelming API
          let callCount = 0;
          const maxCalls = 10;
          
          // Process each day of call data
          outerLoop: for (const dayGroup of callData) {
            // Process each call in this day
            for (const callDetail of dayGroup.call_details) {
              // Limit the number of calls we process to avoid overloading the API
              if (callCount >= maxCalls) {
                break outerLoop;
              }
              
              const callId = Object.keys(callDetail)[0];
              const botId = callDetail[callId];
              
              const botName = bots?.find(bot => bot.id === botId)?.name || 'Unknown Bot';
              const callDate = new Date(dayGroup.call_date);
              
              // Initialize the call item with basic info
              const callItem: DataGridItem = {
                call_date: callDate.toLocaleDateString(),
                bot_name: botName,
                call_id: callId,
                // Add placeholder values by default
                call_short_summary: 'Loading summary...',
                full_transcript: 'Loading transcript...',
              };
              
              try {
                // Check if we have the summary in cache first
                if (callSummaries[callId]) {
                  const summary = callSummaries[callId];
                  if (summary.short_summary) callItem.call_short_summary = summary.short_summary;
                  if (summary.end_reason) callItem.call_end_reason = summary.end_reason;
                }
              } catch (error) {
                console.error(`Error processing summary for call ${callId}:`, error);
                callItem.call_short_summary = 'Error loading summary';
              }
              
              processedData.push(callItem);
              callCount++;
            }
          }
          
          console.log(`Processed ${processedData.length} calls`);
          setData(processedData);
          
          // Move to the next state only if we have data
          if (processedData.length > 0) {
            setDataFetchStatus('fetching_details');
          } else {
            setDataFetchStatus('complete');
            setLoading(false);
          }
        } catch (error) {
          console.error('Error processing call data:', error);
          toast({
            title: 'Error',
            description: 'Failed to process call history data',
            variant: 'destructive',
          });
          setDataFetchStatus('complete'); // Mark as complete even if error
          setLoading(false);
        }
      }
      
      // STATE: PROCESSING -> FETCHING_DETAILS
      else if (dataFetchStatus === 'fetching_details' && data.length > 0) {
        console.log('== State: Processing -> Fetching details for displayed calls ==');
        
        try {
          const updatedData = [...data];
          let hasChanges = false;
          let allLoaded = true;
          
          // Process calls one by one
          for (let i = 0; i < updatedData.length; i++) {
            const callItem = updatedData[i];
            const callId = callItem.call_id as string;
            
            // Skip if we already have transcript data
            if (callItem.full_transcript && callItem.full_transcript !== 'Loading transcript...') {
              continue;
            }
            
            // Skip if we've already loaded this transcript in this session
            if (loadedTranscripts.has(callId)) {
              continue;
            }
            
            allLoaded = false; // At least one item needs loading
            
            try {
              // First check local storage cache
              const cachedTranscript = getCachedTranscript(callId);
              
              let transcript;
              if (cachedTranscript) {
                transcript = cachedTranscript;
                console.log(`Using cached transcript for call ${callId}`);
              } else {
                // Fetch from API if not in cache
                console.log(`Fetching transcript for call ${callId}`);
                transcript = await fetchTranscript(callId);
                
                // Cache the result
                if (transcript && transcript.messages) {
                  cacheTranscript(callId, transcript);
                }
              }
              
              if (transcript && transcript.messages && transcript.messages.length > 0) {
                const fullTranscript = transcript.messages
                  .map((msg: any) => `${msg.role === 'user' ? 'User' : 'Assistant'}: ${msg.text}`)
                  .join('\n\n');
                
                callItem.full_transcript = fullTranscript;
                
                // Mark as loaded
                const newLoadedTranscripts = new Set(loadedTranscripts);
                newLoadedTranscripts.add(callId);
                setLoadedTranscripts(newLoadedTranscripts);
                
                hasChanges = true;
              } else {
                callItem.full_transcript = 'No transcript available';
                hasChanges = true;
              }
            } catch (error) {
              console.error(`Error fetching transcript for call ${callId}:`, error);
              callItem.full_transcript = 'Error fetching transcript';
              hasChanges = true;
            }
            
            // Fetch summary if not already fetched
            if (!callItem.call_short_summary || callItem.call_short_summary === 'Loading summary...') {
              try {
                console.log(`Fetching summary for call ${callId}`);
                const summary = await fetchCallSummary(callId);
                
                if (summary) {
                  if (summary.short_summary) callItem.call_short_summary = summary.short_summary;
                  if (summary.end_reason) callItem.call_end_reason = summary.end_reason;
                  hasChanges = true;
                }
              } catch (error) {
                console.error(`Error fetching summary for call ${callId}:`, error);
                callItem.call_short_summary = 'Error fetching summary';
                hasChanges = true;
              }
            }
            
            // Break after processing one item to prevent long-running operations
            // This allows us to pick up where we left off on the next effect cycle
            break;
          }
          
          if (hasChanges) {
            // Use functional update to avoid dependency issues
            setData(prevData => {
              // If the data length has changed between renders, maintain current data
              if (prevData.length !== updatedData.length) return prevData;
              return [...updatedData];
            });
          }
          
          // If all items are loaded, mark as complete
          if (allLoaded) {
            console.log('== State: Fetching details -> Complete ==');
            setDataFetchStatus('complete');
            setLoading(false);
          }
        } catch (error) {
          console.error('Error fetching call details:', error);
          setDataFetchStatus('complete'); // Mark as complete even if error
          setLoading(false);
        }
      }
      
      // STATE: COMPLETE
      else if (dataFetchStatus === 'complete') {
        setLoading(false);
      }
    };
    
    processData();
    
  }, [callData, callDataLoading, bots, dataFetchStatus, data, loadedTranscripts, callSummaries, fetchTranscript, fetchCallSummary]);

  const handleSaveApiKey = () => {
    if (apiKeyInput.trim()) {
      // Save to state and localStorage
      setGeminiApiKey(apiKeyInput);
      localStorage.setItem('gemini_api_key', apiKeyInput);
      setShowApiKeyForm(false);
      toast({
        title: 'API Key Saved',
        description: 'Your Gemini API key has been saved and will be used for transformations.'
      });
    } else {
      toast({
        title: 'Error',
        description: 'Please enter a valid API key',
        variant: 'destructive'
      });
    }
  };

  const handleClearApiKey = () => {
    setGeminiApiKey('');
    setApiKeyInput('');
    localStorage.removeItem('gemini_api_key');
    toast({
      title: 'API Key Cleared',
      description: 'Your Gemini API key has been removed'
    });
  };

  return (
    <div className="container mx-auto p-4">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-3xl font-bold">Call History Smart Column Generator</h1>
        
        <div className="flex items-center space-x-2">
          {geminiApiKey ? (
            <>
              <span className="text-sm text-green-600">✓ Gemini API Key Set</span>
              <Button 
                variant="outline" 
                size="sm"
                onClick={() => setShowApiKeyForm(!showApiKeyForm)}
              >
                Update Key
              </Button>
              <Button 
                variant="outline" 
                size="sm"
                onClick={handleClearApiKey}
              >
                Clear Key
              </Button>
            </>
          ) : (
            <Button 
              onClick={() => setShowApiKeyForm(!showApiKeyForm)}
              size="sm"
            >
              {showApiKeyForm ? 'Cancel' : 'Set Gemini API Key'}
            </Button>
          )}
        </div>
      </div>
      
      {showApiKeyForm && (
        <div className="mb-6 p-4 border rounded-lg bg-gray-50">
          <h2 className="text-lg font-medium mb-2">Gemini API Key</h2>
          <p className="text-sm text-gray-600 mb-4">
            Enter your Gemini API key to enhance column generation with AI.
            You can get a key from the <a href="https://ai.google.dev/tutorials/setup" target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline">Google AI Studio</a>.
          </p>
          <div className="flex space-x-2">
            <Input
              type="password"
              value={apiKeyInput}
              onChange={(e) => setApiKeyInput(e.target.value)}
              placeholder="Enter your Gemini API key"
              className="max-w-md"
            />
            <Button onClick={handleSaveApiKey}>Save Key</Button>
          </div>
        </div>
      )}
      
      {loading || callDataLoading ? (
        <div className="flex flex-col items-center justify-center h-64">
          <LoadingSpinner className="w-10 h-10 text-primary" />
          <p className="mt-4 text-gray-500">
            {dataFetchStatus === 'processing' 
              ? 'Processing call history data...' 
              : 'Loading call history data...'}
          </p>
        </div>
      ) : data.length > 0 ? (
        <SmartDataGrid 
          data={data}
          title="Call Data for Analysis"
          geminiApiKey={geminiApiKey}
        />
      ) : (
        <div className="p-8 bg-gray-50 border border-dashed rounded-lg text-center">
          <p className="text-gray-500 mb-4">No call history data available</p>
          <p className="text-sm text-gray-400">
            Your call history will appear here once you have made some calls.
          </p>
        </div>
      )}
      
      <Toaster />
    </div>
  );
} 