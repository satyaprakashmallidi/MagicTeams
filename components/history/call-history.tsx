"use client"

import React, { useState, useEffect, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Icon } from '@/components/ui/icons';
import { Input } from '@/components/ui/input';
import {
  Card,
  CardHeader,
  CardContent,
} from '@/components/ui/card';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { cn } from "@/lib/utils";
import { useBots } from '@/hooks/use-bots';
import { usePricing } from '@/hooks/use-pricing';
import { useCallRecords } from '@/hooks/use-call-records';
import { useCallAnalytics } from '@/hooks/use-call-analytics';
import { useVoices } from '@/hooks/use-voices';
import { useCallTranscripts } from '@/hooks/use-callTranscripts';
import { CallMessage } from '@/store/use-call-transcripts-store';
import { useCallRecordsStore } from '@/store/use-call-records-store';
import { Badge } from '@/components/ui/badge';
import { supabase } from '@/lib/supabase';
import { CampaignContact } from '@/components/csv-import/services/campaigns-service';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"

const ITEMS_PER_PAGE = 7;

interface CallDetail {
  [key: string]: string;
}

interface CallGroup {
  call_date: string;
  call_details: CallDetail[];
}

interface CallHistoryProps {
  costPerMinute: number
}

interface BotInfo {
  id: string;
  name: string;
}

interface TranscriptMessage extends CallMessage {}

interface CallExportData {
  call_id: string;
  bot_id: string;
  bot_name: string;
  summary: any; // Using any for CallSummary as it's not clearly typed in the original code
  transcript: CallMessage[];
  timestamp?: string;
}

interface DayExportData {
  date: string;
  formatted_date: string;
  calls: Array<{
    call_id: string;
    bot_id: string;
    bot_name: string;
    summary: any;
    transcript: CallMessage[];
  }>;
}

// Add this utility function near the top of the file
const formatDuration = (startTime: string, endTime: string): string => {
  const start = new Date(startTime).getTime();
  const end = new Date(endTime).getTime();
  const duration = end - start;
  
  const minutes = Math.floor(duration / 60000);
  const seconds = ((duration % 60000) / 1000).toFixed(0);
  
  if(minutes === 0) {
    return `${seconds}s`;
  }

  return `${minutes}m ${seconds}s`;
};

const cost = (startTime: string, endTime: string , costPerMinute: number): string => {
  const start = new Date(startTime).getTime();
  const end = new Date(endTime).getTime();
  const duration = end - start;
  const seconds = duration / 1000;
  // here is the cost per minute in cents
  return ((seconds / 60) * (costPerMinute / 100) ).toFixed(2);
};

export function CallHistory() {
  // Tab state
  const [currentTab, setCurrentTab] = useState("grouped");

  // Existing state
  const [expandedDate, setExpandedDate] = useState<string | null>(null);
  const [selectedCall, setSelectedCall] = useState<{callId: string, botId: string} | null>(null);
  const [isPromptDialogOpen, setIsPromptDialogOpen] = useState(false);
  const [isTranscriptDialogOpen, setIsTranscriptDialogOpen] = useState(false);
  const [botsNames , setBotNames] = useState<Record<string, string>>({});
  const [isTranscriptOpen, setIsTranscriptOpen] = useState(false);
  const [isSummaryOpen, setIsSummaryOpen] = useState(false);

  // Individual calls state
  const [allContacts, setAllContacts] = useState<CampaignContact[]>([]);
  const [isLoadingAllContacts, setIsLoadingAllContacts] = useState(false);
  const [individualCallsSearchTerm, setIndividualCallsSearchTerm] = useState("");
  const [individualCallsStatusFilter, setIndividualCallsStatusFilter] = useState<string>("all");
  const [individualCallsDateFilter, setIndividualCallsDateFilter] = useState<string>("all");
  const [userId, setUserId] = useState<string | null>(null);
  const [transcript, setTranscript] = useState<Array<{
    role: string;
    text: string;
    medium?: string;
    callStageMessageIndex?: number;
    callStageId?: string;
  }>>([]);
  const [isLoadingTranscript, setIsLoadingTranscript] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [playbackSpeed, setPlaybackSpeed] = useState(1);
  const [showOptions, setShowOptions] = useState(false);
  const [showSpeedOptions, setShowSpeedOptions] = useState(false);
  const [isLoadingRecording, setIsLoadingRecording] = useState(false);
  const [volume, setVolume] = useState(1);
  const [isMuted, setIsMuted] = useState(false);
  const [showVolumeSlider, setShowVolumeSlider] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const optionsRef = useRef<HTMLDivElement>(null);
  const volumeRef = useRef<HTMLDivElement>(null);
  const [isLoadingMoreTranscript, setIsLoadingMoreTranscript] = useState(false);
  const [transcriptPage, setTranscriptPage] = useState(0);
  const [isExporting, setIsExporting] = useState<string | null>(null);
  const { bots } = useBots();
  const { callData: historyData, isLoading, error } = useCallRecords();
  const { callRecords } = useCallRecordsStore();
  
  // Debug: Log callRecords when component mounts or updates
  useEffect(() => {
    console.log('All callRecords from store:', callRecords);
    console.log('Number of records:', callRecords.length);
    if (callRecords.length > 0) {
      console.log('Sample record:', callRecords[0]);
      console.log('Sample additional_data:', callRecords[0].additional_data);
    }
  }, [callRecords]);
  const { costPerMinute } = usePricing();
  const { callSummaries, fetchCallSummary, fetchGroupCallSummaries } = useCallAnalytics();
  const { voices } = useVoices();
  const { 
    fetchTranscript, 
    loadMoreTranscript,
    isLoading: transcriptHookLoading, 
    error: transcriptError,
    transcripts,
    currentCallId,
    setCurrentCallId
  } = useCallTranscripts();

  useEffect(() => {
    if(bots && bots.length > 0) {
      const botNames: Record<string, string> = {};
      bots.forEach((bot: BotInfo) => {
        botNames[bot.id] = bot.name;
      });
      setBotNames(botNames);
    }
  }, [bots]);

  useEffect(() => {
    if(selectedCall && !callSummaries[selectedCall.callId]) {
      console.log('Fetching call summary for call ID:', selectedCall.callId);
      fetchCallSummary(selectedCall.callId);
    }
  }, [selectedCall]);

  const handleExpandClick = (date: string) => {
    setExpandedDate(expandedDate === date ? null : date);
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });
  };

  useEffect(() => {
    if(selectedCall && selectedCall.callId) {
      fetchRecording(selectedCall.callId);
    }
  }, [selectedCall]);

  // Fetch user ID
  useEffect(() => {
    const fetchUserId = async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      setUserId(user?.id || null);
    };
    fetchUserId();
  }, []);

  // Fetch individual calls when user ID is available
  useEffect(() => {
    if (userId) {
      fetchAllIndividualCalls();
    }
  }, [userId]);

  // Function to fetch all individual calls across campaigns
  const fetchAllIndividualCalls = async () => {
    if (!userId) return;

    setIsLoadingAllContacts(true);
    try {
      const { data, error } = await supabase
        .from("call_campaign_contacts")
        .select(`
          *,
          call_campaigns(campaign_name, bot_name, twilio_phone_number)
        `)
        .order("created_at", { ascending: false });

      if (error) {
        console.error("Error fetching individual calls:", error);
        return;
      }

      setAllContacts(data || []);
    } catch (error) {
      console.error("Error fetching individual calls:", error);
    } finally {
      setIsLoadingAllContacts(false);
    }
  };

  const fetchRecording = async (callId: string) => {
    setIsLoadingRecording(true);
    try {
      const response = await fetch(`/api/ultravox/getCallRecording?callId=${callId}`);
      if (!response.ok) console.error('Failed to fetch recording');

      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      
      if (audioRef.current) {
        audioRef.current.src = url;
      }
    } catch (error) {
      console.error('Error fetching recording:', error);
    } finally {
      setIsLoadingRecording(false);
    }
  };

  const handleCallClick = async (callId: string, botId: string) => {
    console.log(`Call selected: ${callId}, previous call: ${selectedCall?.callId}`);
    
    // Clear transcript if selecting a different call
    if (selectedCall?.callId !== callId) {
      // Only reset if we're selecting a different call
      console.log(`Clearing transcript data for new call selection`);
      // Close the transcript section if it was open
      setIsTranscriptOpen(false);
    } else {
      console.log(`Same call selected, keeping existing transcript data`);
    }
    
    setSelectedCall({ callId, botId });
  };

  // Helper function to get captured data for the selected call
  const getCapturedDataForCall = (callId: string) => {
    const callRecord = callRecords.find(record => record.call_id === callId);
    console.log('Looking for call:', callId);
    console.log('Found record:', callRecord);
    console.log('Additional data:', callRecord?.additional_data);
    console.log('Captured data:', callRecord?.additional_data?.captured_data);
    return callRecord?.additional_data?.captured_data || null;
  };

  const handleTranscriptToggle = async (open: boolean) => {
    console.log(`Transcript dropdown ${open ? 'opened' : 'closed'} for call: ${selectedCall?.callId}`);
    setIsTranscriptOpen(open);
    
    // Reset transcript page when opening
    if (open) {
      setTranscriptPage(0);
    }
    
    // Only fetch when expanding AND we have a selected call
    if (open && selectedCall) {
      console.log(`Checking if transcript needs to be fetched for call: ${selectedCall.callId}`);
      
      setIsLoadingTranscript(true);
      try {
        console.log(`Starting transcript fetch for call: ${selectedCall.callId}`);
        const result = await fetchTranscript(selectedCall.callId);
        console.log(`Transcript fetch complete`);
        
        if (result && result.messages) {
          console.log(`Received ${result.messages.length} messages`);
          setTranscript(result.messages);
          setCurrentCallId(selectedCall.callId);
        } else {
          console.log('No transcript messages returned');
          setTranscript([]);
        }
      } catch (error) {
        console.error('Error fetching transcript:', error);
      } finally {
        setIsLoadingTranscript(false);
      }
    }
  };

  const handlePlayRecording = async () => {
    console.log('Current playing state:', isPlaying);
    if (!audioRef.current) return;

    if (isPlaying) {
      console.log('Attempting to pause');
      setIsPlaying(false); // Set state before pause
      audioRef.current.pause();
    } else {
      try {
        console.log('Attempting to play');
        setIsPlaying(true); // Set state before play
        await audioRef.current.play();
      } catch (error) {
        console.error('Playback error:', error);
        setIsPlaying(false);
      }
    }
    console.log('Final playing state:', !isPlaying);
  };

  const formatTime = (time: number) => {
    const minutes = Math.floor(time / 60);
    const seconds = Math.floor(time % 60);
    return `${minutes}:${seconds.toString().padStart(2, '0')}`;
  };

  const calculateCost = (durationInSeconds: number) => {
    // this is because the cost per minute is in cents
    const cost = (((Number(durationInSeconds) / 60) * (costPerMinute / 100)).toFixed(2));
    return cost;
  };

  const handleTimeUpdate = () => {
    if (audioRef.current) {
      setCurrentTime(audioRef.current.currentTime);
    }
  };

  const handleLoadedMetadata = () => {
    if (audioRef.current) {
      setDuration(audioRef.current.duration);
    }
  };

  const handleSeek = (e: React.ChangeEvent<HTMLInputElement>) => {
    const time = parseFloat(e.target.value);
    if (audioRef.current) {
      audioRef.current.currentTime = time;
      setCurrentTime(time);
    }
  };

  const handleSkip = (seconds: number) => {
    if (audioRef.current) {
      const newTime = audioRef.current.currentTime + seconds;
      audioRef.current.currentTime = Math.max(0, Math.min(newTime, duration));
    }
  };

  const handleSpeedChange = (speed: number) => {
    if (audioRef.current) {
      audioRef.current.playbackRate = speed;
      setPlaybackSpeed(speed);
    }
  };

  const handleDownload = async () => {
    if (!selectedCall) return;
    try {
      const response = await fetch(`/api/ultravox/getCallRecording?callId=${selectedCall.callId}`);
      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `recording-${selectedCall.callId}.wav`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      setShowOptions(false);
    } catch (error) {
      console.error('Error downloading recording:', error);
    }
  };

  // Handle volume change
  const handleVolumeChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const newVolume = parseFloat(event.target.value);
    setVolume(newVolume);
    if (audioRef.current) {
      audioRef.current.volume = newVolume;
      setIsMuted(newVolume === 0);
    }
  };

  // Toggle mute
  const toggleMute = () => {
    if (audioRef.current) {
      if (isMuted) {
        audioRef.current.volume = volume;
        setIsMuted(false);
      } else {
        audioRef.current.volume = 0;
        setIsMuted(true);
      }
    }
  };

  // Get volume icon based on current volume
  const getVolumeIcon = () => {
    if (isMuted || volume === 0) return "volume-mute";
    if (volume < 0.3) return "volume-low";
    if (volume < 0.7) return "volume-medium";
    return "volumeUp";
  };

  // Close popups when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (volumeRef.current && !volumeRef.current.contains(event.target as Node)) {
        setShowVolumeSlider(false);
      }
      if (optionsRef.current && !optionsRef.current.contains(event.target as Node)) {
        setShowOptions(false);
        setShowSpeedOptions(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  useEffect(() => {
    if (audioRef.current) {
      audioRef.current.addEventListener('loadedmetadata', () => {
        setDuration(audioRef.current?.duration || 0);
      });
    }
  }, [audioRef.current]);

  // Calculate paginated data
  const startIdx = (currentPage - 1) * ITEMS_PER_PAGE;
  const paginatedData = historyData.slice(startIdx, startIdx + ITEMS_PER_PAGE);
  const totalPages = Math.ceil(historyData.length / ITEMS_PER_PAGE);

  // Helper function for status badges
  const getStatusBadge = (status: string) => {
    switch (status) {
      case "completed":
        return (
          <Badge variant="default" className="bg-green-100 text-green-800">
            Answered
          </Badge>
        );
      case "in_progress":
        return (
          <Badge variant="default" className="bg-blue-100 text-blue-800">
            In Progress
          </Badge>
        );
      case "failed":
        return <Badge variant="destructive">Failed</Badge>;
      case "cancelled":
        return <Badge variant="outline">Cancelled</Badge>;
      case "pending":
        return <Badge variant="secondary">Pending</Badge>;
      case "queued":
        return (
          <Badge variant="default" className="bg-yellow-100 text-yellow-800">
            Queued
          </Badge>
        );
      case "unjoined":
        return <Badge variant="outline">Not Answered</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  // Helper function to format date
  const formatDateShort = (date: string, format?: string) => {
    const d = new Date(date);
    if (format === "MMM dd, HH:mm") {
      return d.toLocaleDateString("en-US", {
        month: "short",
        day: "2-digit",
        hour: "2-digit",
        minute: "2-digit",
      });
    }
    return d.toLocaleDateString("en-US", {
      month: "short",
      day: "2-digit",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  // Helper function to format call duration in seconds
  const formatCallDuration = (seconds: number) => {
    if (!seconds) return "N/A";
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;
    return `${minutes}:${remainingSeconds.toString().padStart(2, "0")}`;
  };

  // Filter individual calls
  const filteredIndividualCalls = allContacts.filter((contact) => {
    const matchesSearch =
      contact.contact_phone.includes(individualCallsSearchTerm) ||
      contact.contact_name?.toLowerCase().includes(individualCallsSearchTerm.toLowerCase()) ||
      contact.contact_email?.toLowerCase().includes(individualCallsSearchTerm.toLowerCase());

    const matchesStatus =
      individualCallsStatusFilter === "all" || contact.call_status === individualCallsStatusFilter;

    const matchesDate =
      individualCallsDateFilter === "all" ||
      (individualCallsDateFilter === "today" && contact.completed_at &&
        new Date(contact.completed_at).toDateString() === new Date().toDateString()) ||
      (individualCallsDateFilter === "week" && contact.completed_at &&
        new Date(contact.completed_at) > new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)) ||
      (individualCallsDateFilter === "month" && contact.completed_at &&
        new Date(contact.completed_at) > new Date(Date.now() - 30 * 24 * 60 * 60 * 1000));

    return matchesSearch && matchesStatus && matchesDate;
  });

  // Helper to determine if a message is from the bot or user
  const isUserMessage = (role: string) => {
    return role === 'MESSAGE_ROLE_USER' || role === 'user' || role === 'USER';
  };

  // Combine loading states
  const isTranscriptLoading = isLoadingTranscript || transcriptHookLoading;

  // Add this function to handle navigation between transcript pages
  const handleTranscriptPageChange = async (newPage: number) => {
    if (!selectedCall) return;
    
    // Don't go below 0 or above available chunks
    if (newPage < 0) return;
    
    console.log(`Navigating to transcript page ${newPage}`);
    
    // If we're moving forward and there might be more chunks to load
    if (newPage > transcriptPage && selectedCall && 
        transcripts[selectedCall.callId]?.hasMore &&
        newPage >= Object.keys(transcripts[selectedCall.callId]?.messages || {}).length / 10) {
      
      console.log(`Loading more chunks to view page ${newPage}`);
      setIsLoadingMoreTranscript(true);
      
      try {
        // Load more chunks
        const result = await loadMoreTranscript(selectedCall.callId);
        
        if (result && result.messages) {
          // Append new messages
          setTranscript(prev => [...prev, ...result.messages]);
        }
      } catch (error) {
        console.error('Error loading more transcript chunks:', error);
      } finally {
        setIsLoadingMoreTranscript(false);
      }
    }
    
    // Update the page
    setTranscriptPage(newPage);
  };

  // Add a function to export single call data
  const handleExportCall = async (callId: string, botId: string) => {
    if (!callId) return;
    
    setIsExporting(callId);
    
    try {
      // Ensure we have call summary
      if (!callSummaries[callId]) {
        await fetchCallSummary(callId);
      }
      
      // Fetch complete transcript
      const completeTranscript: CallMessage[] = [];
      let currentTranscript = await fetchTranscript(callId);
      
      if (currentTranscript && currentTranscript.messages) {
        completeTranscript.push(...currentTranscript.messages);
        
        // Keep loading more transcript chunks if available
        while (currentTranscript && currentTranscript.hasMore) {
          currentTranscript = await loadMoreTranscript(callId);
          if (currentTranscript && currentTranscript.messages) {
            completeTranscript.push(...currentTranscript.messages);
          } else {
            break;
          }
        }
      }
      
      // Prepare data for export
      const exportData: CallExportData = {
        call_id: callId,
        bot_id: botId,
        bot_name: botsNames[botId] || 'Agent',
        summary: callSummaries[callId],
        transcript: completeTranscript,
        timestamp: new Date().toISOString()
      };
      
      // Create and download JSON file
      const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `call-export-${callId}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      
    } catch (error) {
      console.error('Error exporting call data:', error);
    } finally {
      setIsExporting(null);
    }
  };
  
  // Add a function to export all calls from a day
  const handleExportDay = async (dateGroup: CallGroup) => {
    const callIds = dateGroup.call_details.map(obj => Object.keys(obj)[0]);
    const date = new Date(dateGroup.call_date).toLocaleDateString('en-US').replace(/\//g, '-');
    
    setIsExporting(dateGroup.call_date);
    
    try {
      // Ensure we have summaries for all calls
      await fetchGroupCallSummaries(callIds);
      
      const exportData: DayExportData = {
        date: dateGroup.call_date,
        formatted_date: formatDate(dateGroup.call_date),
        calls: []
      };
      
      // Process each call
      for (const call of dateGroup.call_details) {
        const callId = Object.keys(call)[0];
        const botId = Object.values(call)[0];
        
        // Fetch complete transcript for this call
        const completeTranscript: CallMessage[] = [];
        let currentTranscript = await fetchTranscript(callId);
        
        if (currentTranscript && currentTranscript.messages) {
          // Use the spread operator with push to add all elements
          completeTranscript.push(...currentTranscript.messages);
          
          // Keep loading more transcript chunks if available
          while (currentTranscript && currentTranscript.hasMore) {
            currentTranscript = await loadMoreTranscript(callId);
            if (currentTranscript && currentTranscript.messages) {
              completeTranscript.push(...currentTranscript.messages);
            } else {
              break;
            }
          }
        }
        
        // Add call data to export
        exportData.calls.push({
          call_id: callId,
          bot_id: botId,
          bot_name: botsNames[botId] || 'Agent',
          summary: callSummaries[callId],
          transcript: completeTranscript
        });
      }
      
      // Create and download JSON file
      const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `call-exports-${date}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      
    } catch (error) {
      console.error('Error exporting day data:', error);
    } finally {
      setIsExporting(null);
    }
  };

  return (
    <div className="space-y-4 p-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Call History</h1>
          <p className="text-muted-foreground">
            View and manage your call conversations
          </p>
        </div>
      </div>

      <Tabs value={currentTab} onValueChange={setCurrentTab} className="space-y-4">
        <TabsList>
          <TabsTrigger value="grouped">
            Grouped Calls ({historyData.length} total)
          </TabsTrigger>
          <TabsTrigger value="individual-calls">
            Individual Calls ({allContacts.length})
          </TabsTrigger>
        </TabsList>

        <TabsContent value="grouped" className="space-y-4">
          <div className="flex h-[calc(100vh-16rem)]">
      {/* Left section - Call List */}
      <div className="w-1/2 border-r flex flex-col overflow-y-auto [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none] relative">
        {/* <div className="sticky top-0 bg-background z-10 p-4 border-b">
          <h1 className="text-xl font-bold tracking-tight">Call History</h1>
          <p className="text-sm text-muted-foreground mt-1">
            {historyData.length} total calls across {new Set(historyData.map(d => d.call_date)).size} days
          </p>
        </div> */}
        <div className="space-y-2 p-2">
          {paginatedData.map((dateGroup) => (
            <Collapsible
              key={dateGroup.call_date}
              open={expandedDate === dateGroup.call_date}
              onOpenChange={() => handleExpandClick(dateGroup.call_date)}
            >
              <Card className="rounded-lg shadow-sm hover:shadow-md transition-shadow">
                <CardHeader className="p-3">
                  <div className="flex items-center justify-between cursor-pointer">
                    <CollapsibleTrigger asChild onClick={() => {
                      console.log('Fetching call summaries for date:', dateGroup.call_date);
                      fetchGroupCallSummaries(dateGroup.call_details.map(obj => Object.keys(obj)[0]))}}>
                      <div className="flex items-center justify-between cursor-pointer flex-grow">
                        <div className="space-y-0.5">
                          <h3 className="text-base font-medium">
                            {formatDate(dateGroup.call_date)}
                          </h3>
                          <p className="text-xs text-muted-foreground">
                            {dateGroup.call_details.length} calls
                          </p>
                        </div>
                        <Button variant="ghost" size="icon" className="h-8 w-8">
                          <Icon 
                            name={expandedDate === dateGroup.call_date ? 'chevronUp' : 'chevronDown'} 
                            className="h-4 w-4"
                          />
                        </Button>
                      </div>
                    </CollapsibleTrigger>
                    <Button 
                      variant="outline"
                      size="sm"
                      className="ml-2"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleExportDay(dateGroup);
                      }}
                      disabled={isExporting !== null}
                    >
                      {isExporting === dateGroup.call_date ? (
                        <Icon name="spinner" className="h-4 w-4 animate-spin mr-1" />
                      ) : (
                        <Icon name="download" className="h-4 w-4 mr-1" />
                      )}
                      Export
                    </Button>
                  </div>
                </CardHeader>
                
                <CollapsibleContent>
                  <CardContent className="p-2 space-y-1">
                    {dateGroup.call_details.map((call) => {
                      const callId = Object.keys(call)[0];
                      const botId = Object.values(call)[0];
                      const isSelected = selectedCall?.callId === callId;
                      
                      return (
                        <Card 
                          key={callId} 
                          className={cn(
                            "cursor-pointer transition-colors border",
                            isSelected ? "bg-accent border-accent" : "bg-muted hover:bg-accent/50"
                          )}
                          onClick={() => handleCallClick(callId, botId)}
                        >
                          <CardContent className="p-2">
                            <div className="flex justify-between items-center">
                              <div className="space-y-0.5">
                                <h4 className="text-sm font-medium">
                                  Call with {botsNames[botId] || 'Agent'}
                                </h4>
                              </div>
                              <div className="flex items-center">
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  className="h-10 w-10"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handleExportCall(callId, botId);
                                  }}
                                  disabled={isExporting !== null}
                                >
                                  {isExporting === callId ? (
                                    <Icon name="spinner" className="h-4 w-4 animate-spin" />
                                  ) : (
                                    <Icon name="download" className="h-4 w-4" />
                                  )}
                                </Button>
                                <Icon name="chevronRight" className="h-4 w-4" />
                              </div>
                            </div>
                          </CardContent>
                        </Card>
                      );
                    })}
                  </CardContent>
                </CollapsibleContent>
              </Card>
            </Collapsible>
          ))}
        </div>
        {/* Pagination Controls */}
        <div className="sticky bottom-0 bg-background border-t p-3 mt-auto rounded-lg rounded-ss-none rounded-se-none flex justify-between items-center">
          <Button
            variant="ghost"
            onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
            disabled={currentPage === 1}
          >
            <Icon name="chevronLeft" className="h-4 w-4 mr-2" />
            Previous
          </Button>
          <span className="text-sm text-muted-foreground">
            Page {currentPage} of {totalPages}
          </span>
          <Button
            variant="ghost"
            onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
            disabled={currentPage === totalPages}
          >
            Next
            <Icon name="chevronRight" className="h-4 w-4 ml-2" />
          </Button>
        </div>
      </div>

      {/* Right section - Call Details */}
      <div className="w-1/2 p-4 overflow-y-auto bg-muted/30 [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]">
        {selectedCall ? (
          <div className="space-y-4">
            <div className="space-y-1">
              <h2 className="text-xl font-semibold">Call Details</h2>
              <p className="text-sm text-muted-foreground">
                with {botsNames[selectedCall.botId]}
              </p>
            </div>
            
            <div className="space-y-3">
              <Card>
                <CardHeader className="p-3">
                  <Collapsible open={isTranscriptOpen} onOpenChange={handleTranscriptToggle}>
                    <CollapsibleTrigger asChild>
                      <Button variant="ghost" size="sm" className="w-full justify-start -ml-2">
                        <Icon name={isTranscriptOpen ? "chevronDown" : "chevronRight"} className="h-4 w-4 mr-2" />
                        Transcript
                      </Button>
                    </CollapsibleTrigger>
                    <CollapsibleContent>
                      <div className="pt-3">
                        {isTranscriptLoading ? (
                          <div className="flex justify-center py-4">
                            <Icon name="spinner" className="h-5 w-5 animate-spin" />
                          </div>
                        ) : transcript.length > 0 ? (
                          <div className="space-y-3">
                            <div className="flex items-center justify-between mb-1">
                              <label className="block text-sm font-bold">Conversation</label>
                              <Button
                                variant="ghost"
                                size="sm"
                                className="flex items-center gap-1 h-6"
                                onClick={() => setIsTranscriptDialogOpen(true)}
                              >
                                <Icon name="expand" className="h-3 w-3" />
                                <span className="text-xs">Expand</span>
                              </Button>
                            </div>

                            <div className="bg-muted rounded-lg p-3">
                              <div className="max-h-48 overflow-y-auto space-y-2 text-sm scro"
                                style={{
                                  scrollbarWidth: 'thin',
                                  scrollbarColor: 'gray-400/40 gray-100/50',
                                }}
                              >
                                {/* Show the first few messages from the first chunk */}
                                {transcript.slice(0, 6).map((message, idx) => (
                                  <div 
                                    key={idx} 
                                    className={cn(
                                      "p-2 rounded-lg",
                                      isUserMessage(message.role) 
                                        ? "bg-background border border-border ml-6" 
                                        : "bg-accent/20 mr-6"
                                    )}
                                  >
                                    <div className="font-medium text-xs mb-1 flex items-center justify-between">
                                      <span>{isUserMessage(message.role) ? 'USER' : 'AGENT'}</span>
                                    </div>
                                    <div className="whitespace-pre-wrap break-words">
                                      {message.text}
                                    </div>
                                  </div>
                                ))}
                                {transcript.length > 6 && (
                                  <div className="text-center text-muted-foreground text-xs p-2">
                                    <Button
                                      variant="ghost"
                                      size="sm"
                                      className="text-xs"
                                      onClick={() => setIsTranscriptDialogOpen(true)}
                                    >
                                      View all {transcript.length} messages ({Math.ceil(transcript.length / 10)} chunks)
                                    </Button>
                                  </div>
                                )}
                              </div>
                            </div>

                            <Dialog open={isTranscriptDialogOpen} onOpenChange={setIsTranscriptDialogOpen}>
                              <DialogContent className="max-w-[800px] h-[80vh]">
                                <DialogHeader>
                                  <DialogTitle>Call Transcript </DialogTitle>
                                </DialogHeader>
                                <div className="flex-1 overflow-y-auto p-4 bg-muted/30 rounded-lg"
                                  style={{
                                    scrollbarWidth: 'thin',
                                    scrollbarColor: 'gray-400/40 gray-100/50',
                                  }}
                                >
                                  {isLoadingMoreTranscript ? (
                                    <div className="flex justify-center py-8">
                                      <Icon name="spinner" className="h-8 w-8 animate-spin" />
                                    </div>
                                  ) : (
                                    <>
                                      <div className="space-y-4">
                                        {/* Calculate which messages to show based on the current page */}
                                        {transcript
                                          .slice(transcriptPage * 10, (transcriptPage + 1) * 10) // Show 10 messages per page
                                          .map((message, idx) => (
                                            <div 
                                              key={idx} 
                                              className={cn(
                                                "p-3 rounded-lg",
                                                isUserMessage(message.role) 
                                                  ? "bg-background border border-border ml-12" 
                                                  : "bg-accent/20 mr-12"
                                              )}
                                            >
                                              <div className="font-medium text-sm mb-1 flex items-center">
                                                <span>
                                                  {isUserMessage(message.role) ? 'USER' : 'AGENT'}
                                                </span>
                                              </div>
                                              <div className="whitespace-pre-wrap break-words">
                                                {message.text}
                                              </div>
                                            </div>
                                          ))}
                                      </div>
                                      
                                      {/* Pagination controls */}
                                      <div className="mt-6 flex justify-between items-center">
                                        <Button
                                          variant="outline"
                                          size="sm"
                                          onClick={() => handleTranscriptPageChange(transcriptPage - 1)}
                                          disabled={transcriptPage === 0 || isLoadingMoreTranscript}
                                          className="flex items-center gap-1"
                                        >
                                          <Icon name="chevronLeft" className="h-4 w-4" />
                                          Previous page
                                        </Button>
                                        
                                        <span className="text-sm text-muted-foreground">
                                        Page {transcriptPage + 1} of {Math.ceil(transcript.length / 10)}
                                          {selectedCall && transcripts[selectedCall.callId]?.hasMore ? "+" : ""}
                                        </span>
                                        
                                        <Button
                                          variant="outline"
                                          size="sm"
                                          onClick={() => handleTranscriptPageChange(transcriptPage + 1)}
                                          disabled={
                                            (transcriptPage + 1) * 10 >= transcript.length && 
                                            (!selectedCall || !transcripts[selectedCall.callId]?.hasMore) ||
                                            isLoadingMoreTranscript
                                          }
                                          className="flex items-center gap-1"
                                        >
                                          Next page
                                          <Icon name="chevronRight" className="h-4 w-4" />
                                        </Button>
                                      </div>
                                      
                                      {/* Page counter */}
                                      <div className="mt-2 text-center text-xs text-muted-foreground">
                                        Showing messages {transcriptPage * 10 + 1}-{Math.min((transcriptPage + 1) * 10, transcript.length)} of {transcript.length}
                                        {selectedCall && transcripts[selectedCall.callId]?.hasMore ? " (more available)" : ""}
                                      </div>
                                    </>
                                  )}
                                </div>
                              </DialogContent>
                            </Dialog>
                          </div>
                        ) : (
                          <div className="text-center text-muted-foreground py-4">
                            No transcript available for this call
                          </div>
                        )}
                      </div>
                    </CollapsibleContent>
                  </Collapsible>
                </CardHeader>
              </Card>

              {/* Captured Data Section */}
              {selectedCall && getCapturedDataForCall(selectedCall.callId) && (
                <Card>
                  <CardHeader className="p-3">
                    <h3 className="text-sm font-medium">Captured Data</h3>
                  </CardHeader>
                  <CardContent className="pt-0">
                    <div className="space-y-2">
                      <div className="bg-muted rounded-lg p-3">
                        <div className="space-y-2">
                          {Object.entries(getCapturedDataForCall(selectedCall.callId) || {}).map(([key, value]) => (
                            <div key={key} className="flex items-center gap-2 space-y-1">
                              <span className="text-sm font-medium capitalize">
                                {key.replace(/([A-Z])/g, ' $1').replace(/^./, str => str.toUpperCase())}:
                              </span>
                              <span className="text-sm text-muted-foreground bg-background rounded px-2 py-1">
                                {typeof value === 'object' ? JSON.stringify(value, null, 2) : String(value)}
                              </span>
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              )}

              <Card>
                <CardHeader className="p-3">
                  <h3 className="text-sm font-medium">Call Details</h3>
                  <CardContent className="pt-3">
                    <div 
                      className="max-h-[300px] overflow-y-auto text-sm scrollbar-thin scrollbar-thumb-rounded scrollbar-thumb-gray-300/50 scrollbar-track-rounded scrollbar-track-gray-100/50 scrollbar-w-0.2"
                    >
                      {selectedCall && (
                        <div className="space-y-2">
                          <p><b>Call ID :</b> {selectedCall.callId}</p>
                          <p><b>End Reason :</b> {callSummaries[selectedCall.callId]?.end_reason}</p>
                          {callSummaries[selectedCall.callId]?.end_reason !== 'unjoined' && (
                            <>
                              <p><b>Summary :</b> {callSummaries[selectedCall.callId]?.long_summary}</p>
                              <p><b>Call Duration :</b> {formatDuration(callSummaries[selectedCall.callId]?.joined, callSummaries[selectedCall.callId]?.ended)}</p>
                              <p><b>Cost :</b> {cost(callSummaries[selectedCall.callId]?.joined, callSummaries[selectedCall.callId]?.ended , costPerMinute)}$</p>
                            </>
                          )}
                          <p><b>Recording Enabled :</b> {callSummaries[selectedCall.callId]?.recording_enabled === true ? 'Yes' : 'No'}</p>
                          <p><b>Voice :</b> {voices.find((voice) => voice.voiceId === callSummaries[selectedCall.callId]?.voice)?.name}</p>
                          <p><b>Temperature :</b> {callSummaries[selectedCall.callId]?.temperature}</p>
                          <div className="">
                            <div className="flex items-center justify-between mb-1">
                              <label className="block text-sm font-bold">System Prompt</label>
                              <Button
                                variant="ghost"
                                size="sm"
                                className="flex items-center gap-1 h-6"
                                onClick={() => setIsPromptDialogOpen(true)}
                              >
                                <Icon name="expand" className="h-3 w-3" />
                                <span className="text-xs">Expand</span>
                              </Button>
                            </div>
                            <div className="bg-muted rounded-lg p-3">
                              <pre className="whitespace-pre-wrap break-words text-sm max-h-24 overflow-y-auto">{callSummaries[selectedCall.callId]?.system_prompt}</pre>
                            </div>

                            <Dialog open={isPromptDialogOpen} onOpenChange={setIsPromptDialogOpen}>
                              <DialogContent className="max-w-[1200px] h-[80vh]">
                                <DialogHeader>
                                  <DialogTitle>System Prompt</DialogTitle>
                                </DialogHeader>
                                <div className="flex-1 overflow-auto p-6 bg-muted rounded-lg">
                                  <pre className="whitespace-pre-wrap break-words text-sm">
                                    {callSummaries[selectedCall?.callId]?.system_prompt}
                                  </pre>
                                </div>
                              </DialogContent>
                            </Dialog>
                          </div>
                        </div>
                      )}
                    </div>
                  </CardContent>
                </CardHeader>
              </Card>

              <Card>
                <CardHeader className="p-3">
                  <h3 className="text-sm font-medium">Recording</h3>
                </CardHeader>
                <CardContent className="">
                  <div className="bg-muted rounded-md p-3">
                    <audio 
                      ref={audioRef}
                      className="hidden"
                      controls={false}
                      onPlay={() => setIsPlaying(true)}
                      onPause={() => setIsPlaying(false)}
                      onEnded={() => setIsPlaying(false)}
                      onTimeUpdate={handleTimeUpdate}
                      onLoadedMetadata={handleLoadedMetadata}
                      onError={(e) => {
                        console.error('Audio error:', e);
                        setIsPlaying(false);
                      }}
                    />
                    
                    <div className="flex items-center space-x-3 bg-background rounded-full px-3">
                      {/* Play/Pause Button */}
                      <button 
                        onClick={handlePlayRecording}
                        className="focus:outline-none"
                        disabled={isLoadingRecording}
                      >
                        {isLoadingRecording ? (
                          <Icon name="spinner" className="h-4 w-4 animate-spin" />
                        ) : isPlaying ? (
                          <Icon name="pauseCircle" className="h-4 w-4" />
                        ) : (
                          <Icon name="playCircle" className="h-4 w-4" />
                        )}
                      </button>

                      {/* Time Display */}
                      <span className="text-xs min-w-[80px]">
                        {formatTime(currentTime)} / {formatTime(duration)}
                      </span>

                      {/* Progress Bar */}
                      <input
                        type="range"
                        min={0}
                        max={duration || 100}
                        value={currentTime}
                        onChange={handleSeek}
                        className="flex-grow h-1 bg-muted rounded-full appearance-none cursor-pointer"
                      />

                      {/* Volume Control */}
                      <div className="relative" ref={volumeRef}>
                        <button 
                          className="focus:outline-none hover:opacity-80"
                          onClick={toggleMute}
                          onMouseEnter={() => setShowVolumeSlider(true)}
                        >
                          <Icon 
                            name={getVolumeIcon()} 
                            className="h-4 w-4" 
                          />
                        </button>

                        {/* Volume Slider */}
                        {showVolumeSlider && (
                          <div 
                            className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 bg-popover rounded-lg shadow-lg px-0.5 py-1"
                            onMouseLeave={() => setShowVolumeSlider(false)}
                          >
                            <div className="h-16 flex items-center justify-center">
                              <input
                                type="range"
                                min="0"
                                max="1"
                                step="0.01"
                                value={isMuted ? 0 : volume}
                                onChange={handleVolumeChange}
                                className="w-12 -rotate-90 origin-center cursor-pointer
                                  appearance-none bg-transparent
                                  [&::-webkit-slider-runnable-track]:h-[2px]
                                  [&::-webkit-slider-runnable-track]:rounded-full
                                  [&::-webkit-slider-runnable-track]:bg-muted
                                  [&::-webkit-slider-thumb]:appearance-none
                                  [&::-webkit-slider-thumb]:h-2
                                  [&::-webkit-slider-thumb]:w-2
                                  [&::-webkit-slider-thumb]:rounded-full
                                  [&::-webkit-slider-thumb]:bg-primary
                                  [&::-webkit-slider-thumb]:mt-[-3px]
                                  hover:[&::-webkit-slider-thumb]:bg-primary/80"
                              />
                            </div>
                          </div>
                        )}
                      </div>

                      {/* Options Menu */}
                      <div className="relative" ref={optionsRef}>
                        <button 
                          onClick={() => {
                            setShowOptions(!showOptions);
                            setShowSpeedOptions(false);
                          }}
                          className="focus:outline-none"
                        >
                          <Icon name="moreHorizontal" className="h-4 w-4" />
                        </button>

                        {/* Options Popup */}
                        {showOptions && !showSpeedOptions && (
                          <div className="absolute bottom-full right-0 mb-2 w-48 bg-popover rounded-md shadow-lg">
                            <div className="py-1">
                              <button
                                onClick={handleDownload}
                                className="flex items-center w-full px-3 py-1.5 text-xs hover:bg-accent"
                              >
                                <Icon name="download" className="h-3 w-3 mr-2" />
                                Download
                              </button>
                              <button
                                onClick={() => setShowSpeedOptions(true)}
                                className="flex items-center w-full px-3 py-1.5 text-xs hover:bg-accent"
                              >
                                <Icon name="settings" className="h-3 w-3 mr-2" />
                                Playback speed
                              </button>
                            </div>
                          </div>
                        )}

                        {/* Speed Options Popup */}
                        {showSpeedOptions && (
                          <div className="absolute bottom-full right-0 mb-2 w-48 bg-popover rounded-md shadow-lg">
                            <div className="py-1">
                              {[0.5, 0.75, 1, 1.25, 1.5].map((speed) => (
                                <button
                                  key={speed}
                                  onClick={() => {
                                    handleSpeedChange(speed);
                                    setShowOptions(false);
                                    setShowSpeedOptions(false);
                                  }}
                                  className="flex items-center w-full px-3 py-1.5 text-xs hover:bg-accent"
                                >
                                  {speed === 1 ? 'Normal' : `${speed}x`}
                                  {speed === playbackSpeed && (
                                    <Icon name="check" className="h-3 w-3 ml-auto" />
                                  )}
                                </button>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          </div>
        ) : (
          <div className="h-full flex items-center justify-center text-muted-foreground">
            <div className="text-center space-y-2">
              <Icon name="history" className="h-10 w-10 mx-auto opacity-50" />
              <p className="text-sm">Select a call to view details</p>
            </div>
          </div>
        )}
      </div>
          </div>
        </TabsContent>

        <TabsContent value="individual-calls" className="space-y-4">
          {/* Individual Calls Filters */}
          <Card>
            <CardContent className="pt-6 p-3">
              <div className="flex flex-wrap gap-4">
                <div className="flex-1 min-w-[200px]">
                  <Input
                    placeholder="Search by customer phone number..."
                    value={individualCallsSearchTerm}
                    onChange={(e) => setIndividualCallsSearchTerm(e.target.value)}
                    className="w-full"
                  />
                </div>
                <Select value={individualCallsStatusFilter} onValueChange={setIndividualCallsStatusFilter}>
                  <SelectTrigger className="w-[140px]">
                    <SelectValue placeholder="Call Type" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Status</SelectItem>
                    <SelectItem value="completed">Answered</SelectItem>
                    <SelectItem value="failed">Failed</SelectItem>
                    <SelectItem value="pending">Pending</SelectItem>
                    <SelectItem value="in_progress">In Progress</SelectItem>
                    <SelectItem value="cancelled">Cancelled</SelectItem>
                  </SelectContent>
                </Select>
                <Select value={individualCallsDateFilter} onValueChange={setIndividualCallsDateFilter}>
                  <SelectTrigger className="w-[140px]">
                    <SelectValue placeholder="Date Range" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Dates</SelectItem>
                    <SelectItem value="today">Today</SelectItem>
                    <SelectItem value="week">This Week</SelectItem>
                    <SelectItem value="month">This Month</SelectItem>
                  </SelectContent>
                </Select>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    setIndividualCallsSearchTerm("");
                    setIndividualCallsStatusFilter("all");
                    setIndividualCallsDateFilter("all");
                  }}
                >
                  <Icon name="x" className="h-4 w-4 mr-2" />
                  Clear Filters
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* Individual Calls Table */}
          <Card>
            <CardContent className="pt-6 p-1">
              {isLoadingAllContacts ? (
                <div className="flex items-center justify-center h-96">
                  <Icon name="spinner" className="h-8 w-8 animate-spin" />
                </div>
              ) : filteredIndividualCalls.length === 0 ? (
                <div className="text-center p-6">
                  <Icon
                    name="phone-call"
                    className="h-12 w-12 mx-auto text-muted-foreground mb-4"
                  />
                  <h3 className="text-lg font-medium mb-2">
                    {allContacts.length === 0 ? "No conversation history found" : "No calls match your current filters"}
                  </h3>
                  <p className="text-muted-foreground">
                    {allContacts.length === 0
                      ? "Start making calls to see conversation history here."
                      : "Try adjusting your search or filter criteria."}
                  </p>
                </div>
              ) : (
                <>
                  <div className="mb-4 text-sm text-muted-foreground px-4">
                    Showing {filteredIndividualCalls.length} of {allContacts.length} conversations
                  </div>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Customer</TableHead>
                        <TableHead>Assistant Name</TableHead>
                        <TableHead>Call Type</TableHead>
                        <TableHead>Created At</TableHead>
                        <TableHead>Duration</TableHead>
                        <TableHead>Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filteredIndividualCalls.map((contact) => (
                        <TableRow key={contact.contact_id}>
                          <TableCell>
                            <div>
                              <div className="font-medium">
                                {contact.contact_name || "Unknown"}
                              </div>
                              <div className="text-sm text-muted-foreground font-mono">
                                {contact.contact_phone}
                              </div>
                              {contact.contact_email && (
                                <div className="text-sm text-muted-foreground">
                                  {contact.contact_email}
                                </div>
                              )}
                            </div>
                          </TableCell>
                          <TableCell>
                            <div>
                              <div className="font-medium">
                                {(contact as any).call_campaigns?.bot_name || "Unknown Bot"}
                              </div>
                              <div className="text-sm text-muted-foreground">
                                {(contact as any).call_campaigns?.campaign_name || "Unknown Campaign"}
                              </div>
                            </div>
                          </TableCell>
                          <TableCell>
                            {contact?.ai_processed_answers ?  Object.values(contact?.ai_processed_answers || {}).find((answer: any) => {
                              return answer?.answer?.toLowerCase().includes("voicemail")
                            }) ? getStatusBadge("unjoined") : getStatusBadge(contact.call_status) : getStatusBadge(contact.call_status)}
                          </TableCell>
                          <TableCell className="text-sm">
                            {contact.completed_at
                              ? formatDateShort(contact.completed_at, "MMM dd, HH:mm")
                              : contact.started_at
                                ? formatDateShort(contact.started_at, "MMM dd, HH:mm")
                                : contact.created_at
                                  ? formatDateShort(contact.created_at, "MMM dd, HH:mm")
                                  : "Unknown"}
                          </TableCell>
                          <TableCell>
                            {formatCallDuration(contact.call_duration || 0)}
                          </TableCell>
                          <TableCell>
                            <div className="flex items-center gap-2">
                              {contact.call_summary || contact.call_notes ? (
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => {
                                    setSelectedCall({ callId: contact.ultravox_call_id || '', botId: (contact as any).call_campaigns?.bot_id || '' });
                                    setIsPromptDialogOpen(true);
                                  }}
                                  title="View call summary"
                                >
                                  <Icon name="file-text" className="h-4 w-4" />
                                </Button>
                              ) : null}
                              {contact.ultravox_call_id ? (
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => {
                                    setSelectedCall({ callId: contact.ultravox_call_id || '', botId: (contact as any).call_campaigns?.bot_id || '' });
                                    setIsTranscriptDialogOpen(true);
                                    setTimeout(() => {
                                      setIsTranscriptOpen(true);
                                      handleTranscriptToggle(true);
                                    }, 100);
                                  }}
                                  title="View transcript"
                                >
                                  <Icon name="messages-square" className="h-4 w-4" />
                                </Button>
                              ) : null}
                            </div>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
