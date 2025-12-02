"use client";

import { useState, useEffect } from "react";
import { useSearchParams } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Icon } from "@/components/ui/icons";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/lib/supabase";
import {
  Campaign,
  CampaignContact,
} from "@/components/csv-import/services/campaigns-service";
import { useCampaigns } from "@/hooks/use-campaigns";
import { CampaignExport } from "@/components/csv-import/components/campaign-export";
import { CampaignScheduleInfo } from "@/components/csv-import/components/campaign-schedule-info";
import { RecallCampaignDialog } from "@/components/csv-import/components/recall-campaign-dialog";
import { CustomQuestion } from "@/types/database";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { campaignsService } from "@/components/csv-import/services/campaigns-service";
import { useCallTranscripts } from "@/hooks/use-callTranscripts";
import { CallMessage } from "@/store/use-call-transcripts-store";
import { usePricing } from "@/hooks/use-pricing";
import { useRouter } from "next/navigation";
import { useCallRecordsStore } from "@/store/use-call-records-store";
import { getUtcIsoStringFromLocalInput } from "@/lib/utils/timezone";
// Simple date formatter to avoid date-fns version conflicts
const formatDate = (date: string, format?: string) => {
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

interface CampaignWithContacts extends Campaign {
  contacts?: CampaignContact[];
}

export default function BulkCallHistoryPage() {
  const searchParams = useSearchParams();
  const [selectedCampaign, setSelectedCampaign] =
    useState<CampaignWithContacts | null>(null);
  const [contacts, setContacts] = useState<CampaignContact[]>([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [callStatusFilter, setCallStatusFilter] = useState<string>("all");
  const [capturedDataFilter, setCapturedDataFilter] = useState<string>("all");
  const [durationFilter, setDurationFilter] = useState<string>("all");
  const [dateFilter, setDateFilter] = useState<string>("all");
  const [capturedDataFilters, setCapturedDataFilters] = useState<Record<string, string>>({});
  const [selectedContacts, setSelectedContacts] = useState<Set<string>>(new Set());
  const [selectAll, setSelectAll] = useState(false);
  const [userId, setUserId] = useState<string | null>(null);
  const { toast } = useToast();
  const { time } = usePricing();
  const { callRecords, fetchCallRecords } = useCallRecordsStore();
  const router = useRouter();
  const [tabValue, setTabValue] = useState("campaigns");
  const [queuedContacts, setQueuedContacts] = useState<CampaignContact[]>([]);
  const [isProcessingAnswers, setIsProcessingAnswers] = useState(false);
  const [customQuestions, setCustomQuestions] = useState<CustomQuestion[]>([]);
  const [geminiApiKey, setGeminiApiKey] = useState("");
  const [hasGeminiKey, setHasGeminiKey] = useState(false);
  const [selectedContact, setSelectedContact] = useState<CampaignContact | null>(null);
  const [isContactDetailDialogOpen, setIsContactDetailDialogOpen] = useState(false);
  const [detailView, setDetailView] = useState<'summary' | 'transcript'>('summary');
  const [transcript, setTranscript] = useState<CallMessage[]>([]);
  const [isTranscriptOpen, setIsTranscriptOpen] = useState(false);
  const [isLoadingTranscript, setIsLoadingTranscript] = useState(false);
  const [transcriptPage, setTransriptPage] = useState(0);
  const [isTranscriptDialogOpen, setIsTranscriptDialogOpen] = useState(false);
  const [isLoadingMoreTranscript, setIsLoadingMoreTranscript] = useState(false);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [campaignToDelete, setCampaignToDelete] = useState<Campaign | null>(null);
  const [isDeletingCampaign, setIsDeletingCampaign] = useState(false);
  const [isRecallingContacts, setIsRecallingContacts] = useState(false);
  const [showRecallDialog, setShowRecallDialog] = useState(false);
  const [pendingCampaignId, setPendingCampaignId] = useState<string | null>(null);


  useEffect(() => {
    const fetchUserId = async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      setUserId(user?.id || null);
      
      // Load Gemini API key if user is available
      if (user?.id) {
        await loadGeminiApiKey(user.id);
      }
    };
    fetchUserId();
  }, []);

  // Fetch call records on component mount
  useEffect(() => {
    if (userId) {
      fetchCallRecords();
    }
  }, [userId, fetchCallRecords]);

  const loadGeminiApiKey = async (userId: string) => {
    try {
      const { data, error } = await supabase
        .from('user_api_keys')
        .select('encrypted_key')
        .eq('user_id', userId)
        .eq('service', 'gemini')
        .single();

      if (error && error.code !== 'PGRST116') { // PGRST116 = not found
        console.error('Error loading Gemini API key:', error);
        return;
      }

      if (data?.encrypted_key) {
        setGeminiApiKey(data.encrypted_key);
        setHasGeminiKey(true);
      } else {
        setHasGeminiKey(false);
      }
    } catch (error) {
      console.error('Error loading Gemini API key:', error);
      setHasGeminiKey(false);
    }
  };

  const {
    campaigns,
    isLoading,
    fetchCampaignDetails: fetchDetails,
    refetch,
  } = useCampaigns(userId);

  // Handle query parameters for direct navigation from campaign creation
  useEffect(() => {
    const campaignId = searchParams.get('campaignId') || searchParams.get('campaign_id');
    const tab = searchParams.get('tab');
    
    if (campaignId && userId) {
      console.log('URL Parameter - Campaign ID:', campaignId);
      
      // Fetch the campaign details
      fetchCampaignDetails(campaignId).then(() => {
        console.log('Campaign details fetched for:', campaignId);
        
        // Set the tab to details if specified, or contacts for recall redirects
        if (tab === 'details') {
          setTabValue('details');
        } else if (searchParams.get('campaign_id')) {
          // This is a redirect from recall functionality
          console.log('Setting tab to contacts for recall redirect');
          setTabValue('contacts');
          
          // Clean up the URL parameter only after the campaign is properly loaded
          // Wait longer to ensure the campaign details are fetched and UI is updated
          setTimeout(() => {
            if (selectedCampaign && selectedCampaign.campaign_id === campaignId) {
              const newUrl = new URL(window.location.href);
              newUrl.searchParams.delete('campaign_id');
              window.history.replaceState({}, '', newUrl.toString());
              console.log('Cleaned up campaign_id URL parameter after campaign loaded');
            }
          }, 5000); // Increased delay to ensure everything is loaded
        }
      }).catch(error => {
        console.error('Error fetching campaign details:', error);
      });
    }
  }, [searchParams, userId]);

  // Effect to handle pending campaign selection after campaigns are loaded/updated
  useEffect(() => {
    if (pendingCampaignId && campaigns && campaigns.length > 0) {
      const targetCampaign = campaigns.find(c => c.campaign_id === pendingCampaignId);
      if (targetCampaign) {
        console.log('Found pending campaign in updated list:', targetCampaign.campaign_name);
        setSelectedCampaign(targetCampaign);
        setTabValue('contacts');
        setPendingCampaignId(null); // Clear pending
        
        // Fetch campaign details
        fetchCampaignDetails(targetCampaign.campaign_id);
      }
    }
  }, [campaigns, pendingCampaignId]);

  const { 
    fetchTranscript, 
    loadMoreTranscript,
    isLoading: transcriptHookLoading, 
    error: transcriptError,
    transcripts,
    currentCallId,
    setCurrentCallId
  } = useCallTranscripts();

  // Fetch queued contacts waiting for their time window
  useEffect(() => {
    const fetchQueuedContacts = async () => {
      if (!userId) return;

      try {
        // Get contacts that are queued with time window restrictions
        const { data, error } = await supabase
          .from("call_campaign_contacts")
          .select(
            `
            *,
            call_campaigns(campaign_name, campaign_settings, timezone)
          `
          )
          .eq("call_status", "queued")
          .like("error_message", "%Outside time window%")
          .order("queued_at", { ascending: false });

        if (error) {
          console.error("Error fetching queued contacts:", error);
          // Set empty array on error to prevent infinite loading
          setQueuedContacts([]);
          return;
        }

        setQueuedContacts(data || []);
      } catch (error) {
        console.error("Error fetching queued contacts:", error);
        // Set empty array on error to prevent infinite loading
        setQueuedContacts([]);
      }
    };

    fetchQueuedContacts();

    // Refresh every 30 seconds
    const interval = setInterval(fetchQueuedContacts, 30000);
    return () => clearInterval(interval);
  }, [userId]);

  const fetchCampaignDetails = async (campaignId: string) => {
    const result = await fetchDetails(campaignId);
    if (result) {
      setSelectedCampaign(result.campaign);
      setContacts(result.contacts);

      // Fetch bot custom questions if bot_id is available
      if (result.campaign.bot_id) {
        try {
          const { data: bot, error } = await supabase
            .from("bots")
            .select("custom_questions")
            .eq("id", result.campaign.bot_id)
            .single();

          if (!error && bot) {
            setCustomQuestions(
              (bot.custom_questions.reverse() as CustomQuestion[]) || []
            );
          }
        } catch (error) {
          console.error("Error fetching bot custom questions:", error);
        }
      }
    }
  };

  const processCallAnswers = async () => {
    if (!selectedCampaign) {
      toast({
        title: "Error",
        description: "No campaign selected",
        variant: "destructive",
      });
      return;
    }

    if (!hasGeminiKey || !geminiApiKey.trim()) {
      toast({
        title: "Error",
        description: "Please configure your Gemini API key in Settings first",
        variant: "destructive",
      });
      return;
    }

    const enabledQuestions = customQuestions.filter((q) => q.enabled);
    if (enabledQuestions.length === 0) {
      toast({
        title: "No Questions Enabled",
        description: "Please enable at least one custom question to process",
        variant: "destructive",
      });
      return;
    }

    // Get completed contacts that don't have processed answers for the enabled questions
    const completedContacts = contacts.filter((c) => {
      if (c.call_status !== "completed") return false;

      console.log(
        "Checking contact:",
        c.contact_id,
        "AI Answers:",
        c.ai_processed_answers
      );

      // If no AI answers at all, needs processing
      if (!c.ai_processed_answers) {
        console.log("No ai_processed_answers - needs processing");
        return true;
      }

      const aiAnswers = c.ai_processed_answers as any;
      const hasAnswers = Object.keys(aiAnswers).length > 0;

      if (!hasAnswers) {
        console.log("Empty ai_processed_answers - needs processing");
        return true;
      }

      // Check if any enabled question is missing an answer
      const missingAnswers = enabledQuestions.some((question) => {
        const hasAnswer =
          aiAnswers[question.id] && aiAnswers[question.id].answer;
        console.log(`Question ${question.id}: hasAnswer = ${hasAnswer}`);
        return !hasAnswer;
      });

      console.log("Missing answers:", missingAnswers);
      return missingAnswers;
    });

    if (completedContacts.length === 0) {
      toast({
        title: "No Contacts to Process",
        description:
          "All completed calls already have processed answers or no completed calls found",
        variant: "destructive",
      });
      return;
    }

    setIsProcessingAnswers(true);

    try {
      const workerBaseUrl =
        process.env.NEXT_PUBLIC_BACKEND_URL_WORKER || "http://localhost:8787";
      const response = await fetch(`${workerBaseUrl}/api/campaigns/process-answers`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          contactIds: completedContacts.map((c) => c.contact_id),
          botId: selectedCampaign.bot_id,
          geminiApiKey: geminiApiKey.trim(),
        }),
      });

      const result = await response.json();

      if (response.ok) {
        toast({
          title: "Success",
          description: result.message,
        });

        // Refresh the campaign details to show updated answers
        await fetchCampaignDetails(selectedCampaign.campaign_id);
      } else {
        throw new Error(result.error || "Failed to process answers");
      }
    } catch (error) {
      console.error("Error processing answers:", error);
      toast({
        title: "Error",
        description:
          error instanceof Error ? error.message : "Failed to process answers",
        variant: "destructive",
      });
    } finally {
      setIsProcessingAnswers(false);
    }
  };

  const handleTranscriptToggle = async (open: boolean) => {
    console.log(`Transcript dropdown ${open ? 'opened' : 'closed'} for contact: ${selectedContact?.contact_id}`);
    setIsTranscriptOpen(open);
    
    // Reset transcript page when opening
    if (open) {
      setTransriptPage(0);
    }
    
    // Only fetch when expanding AND we have a selected contact with ultravox call id
    if (open && selectedContact && selectedContact.ultravox_call_id) {
      console.log(`Checking if transcript needs to be fetched for call: ${selectedContact.ultravox_call_id}`);
      
      setIsLoadingTranscript(true);
      try {
        console.log(`Starting transcript fetch for call: ${selectedContact.ultravox_call_id}`);
        const result = await fetchTranscript(selectedContact.ultravox_call_id);
        console.log(`Transcript fetch complete`);
        
        if (result && result.messages) {
          console.log(`Received ${result.messages.length} messages`);
          setTranscript(result.messages);
          setCurrentCallId(selectedContact.ultravox_call_id);
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

  const handleTranscriptPageChange = async (newPage: number) => {
    if (!selectedContact || !selectedContact.ultravox_call_id) return;
    
    // Don't go below 0 or above available chunks
    if (newPage < 0) return;
    
    console.log(`Navigating to transcript page ${newPage}`);
    
    // If we're moving forward and there might be more chunks to load
    if (newPage > transcriptPage && selectedContact && 
        transcripts[selectedContact.ultravox_call_id]?.hasMore &&
        newPage >= Object.keys(transcripts[selectedContact.ultravox_call_id]?.messages || {}).length / 10) {
      
      console.log(`Loading more chunks to view page ${newPage}`);
      setIsLoadingMoreTranscript(true);
      
      try {
        // Load more chunks
        const result = await loadMoreTranscript(selectedContact.ultravox_call_id);
        
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
    setTransriptPage(newPage);
  };

  // Helper to determine if a message is from the bot or user
  const isUserMessage = (role: string) => {
    return role === 'MESSAGE_ROLE_USER' || role === 'user' || role === 'USER';
  };

  // Combine loading states
  const isTranscriptLoading = isLoadingTranscript || transcriptHookLoading;

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "completed":
        return (
          <Badge variant="default" className="bg-green-100 dark:bg-green-900/20 text-green-800 dark:text-green-300">
            Answered
          </Badge>
        );
      case "in_progress":
        return (
          <Badge variant="default" className="bg-blue-100 dark:bg-blue-900/20 text-blue-800 dark:text-blue-300">
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
          <Badge variant="default" className="bg-yellow-100 dark:bg-yellow-900/20 text-yellow-800 dark:text-yellow-300">
            Queued
          </Badge>
        );
      case "unjoined":
        return <Badge variant="outline">Not Answered</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };



  const filteredCampaigns = campaigns.filter((campaign) => {
    const matchesSearch =
      campaign.campaign_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      campaign.bot_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      campaign.twilio_phone_number?.includes(searchTerm);
    const matchesStatus =
      statusFilter === "all" || campaign.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  

  const formatDuration = (seconds: number) => {
    if (!seconds) return "N/A";
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;
    return `${minutes}:${remainingSeconds.toString().padStart(2, "0")}`;
  };

  const handleStopCampaign = async (campaignId: string) => {
    try {
      await campaignsService.stopCampaign(campaignId);
      toast({
        title: "Campaign Stopped",
        description: "Campaign has been cancelled successfully",
      });
      
      // Refresh campaigns list
      await refetch();
      
      // If the stopped campaign is currently selected, refresh its details
      if (selectedCampaign && selectedCampaign.campaign_id === campaignId) {
        await fetchCampaignDetails(campaignId);
      }
    } catch (error) {
      console.error('Error stopping campaign:', error);
      toast({
        title: "Error",
        description: "Failed to stop campaign",
        variant: "destructive",
      });
    }
  };

  const handleCopyCampaignId = (campaignId: string) => {
    navigator.clipboard.writeText(campaignId).then(() => {
      toast({
        title: "Copied",
        description: "Campaign ID copied to clipboard",
      });
    }).catch((error) => {
      console.error('Error copying to clipboard:', error);
      toast({
        title: "Error",
        description: "Failed to copy campaign ID",
        variant: "destructive",
      });
    });
  };

  const handleDeleteCampaign = async () => {
    if (!campaignToDelete) return;
    
    setIsDeletingCampaign(true);
    try {
      await campaignsService.deleteCampaign(campaignToDelete.campaign_id);
      toast({
        title: "Campaign Deleted",
        description: `Campaign "${campaignToDelete.campaign_name}" has been deleted successfully`,
      });
      
      // Refresh campaigns list
      await refetch();
      
      // If the deleted campaign was selected, clear the selection
      if (selectedCampaign && selectedCampaign.campaign_id === campaignToDelete.campaign_id) {
        setSelectedCampaign(null);
        setContacts([]);
        setTabValue("campaigns");
      }
      
      // Close the dialog
      setIsDeleteDialogOpen(false);
      setCampaignToDelete(null);
    } catch (error) {
      console.error('Error deleting campaign:', error);
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to delete campaign",
        variant: "destructive",
      });
    } finally {
      setIsDeletingCampaign(false);
    }
  };

  // Handle select all functionality
  const handleSelectAll = (checked: boolean) => {
    setSelectAll(checked);
    if (checked) {
      const newSelection = new Set(filteredContacts.map(contact => contact.contact_id));
      setSelectedContacts(newSelection);
    } else {
      setSelectedContacts(new Set());
    }
  };

  // Handle individual contact selection
  const handleContactSelect = (contactId: string, checked: boolean) => {
    const newSelection = new Set(selectedContacts);
    if (checked) {
      newSelection.add(contactId);
    } else {
      newSelection.delete(contactId);
    }
    setSelectedContacts(newSelection);
    setSelectAll(newSelection.size === filteredContacts.length && filteredContacts.length > 0);
  };

  // Get all selected contacts for re-calling (allow ALL statuses including completed)
  const getRecallableContacts = () => {
    return Array.from(selectedContacts)
      .map(contactId => contacts.find(c => c.contact_id === contactId))
      .filter(Boolean) as CampaignContact[];
  };

  // Merge call records data with contacts using the existing store
  const getContactsWithCallData = () => {
    if (!contacts.length || !callRecords.length) return contacts;

    // Create a map of call_id -> additional_data from the store
    const callDataMap = new Map();
    callRecords.forEach(record => {
      callDataMap.set(record.call_id, record.additional_data);
    });

    // Merge call data with contacts
    return contacts.map(contact => ({
      ...contact,
      additional_data: contact.ultravox_call_id ? callDataMap.get(contact.ultravox_call_id) : null
    }));
  };


  // Get unique values for a captured data field
  const getUniqueFieldValues = (fieldName: string) => {
    const values = new Set<string>();
    contactsWithCallData.forEach(contact => {
      const capturedData = (contact as any).additional_data?.captured_data;
      if (capturedData && capturedData[fieldName]) {
        values.add(String(capturedData[fieldName]));
      }
    });
    return Array.from(values).sort();
  };

  // Get the bot's realtime capture fields
  const getBotCaptureFields = () => {
    if (!selectedCampaign) {
    console.log("no selected capgaisn")
      return [];
    }
    
    // Try to get from the selected bot data or parse from contacts
    let realtimeCaptureFields: any[] = [];
    
    // Get unique field names from actual captured data
    const fieldNames = new Set<string>();
    filteredContacts.forEach(contact => {
      console.log("contact", contact)
      const capturedData = (contact as any).additional_data?.captured_data;
      if (capturedData) {
        Object.keys(capturedData).forEach(key => fieldNames.add(key));
      }else {
        console.log("no captured data")
      }
    });
    
    // Convert to field objects with types inferred from data
    realtimeCaptureFields = Array.from(fieldNames).map(fieldName => {
      // Try to infer type from the data
      let fieldType = 'text';
      for (const contact of contacts) {
        const capturedData = (contact as any).additional_data?.captured_data;
        if (capturedData && capturedData[fieldName]) {
          const value = capturedData[fieldName];
          if (typeof value === 'number') {
            fieldType = 'number';
            break;
          } else if (typeof value === 'boolean') {
            fieldType = 'boolean';
            break;
          }
          // Check if it looks like an enum (limited set of values)
          const uniqueValues = getUniqueFieldValues(fieldName);
          if (uniqueValues.length <= 10 && uniqueValues.length > 1) {
            fieldType = 'enum';
            break;
          }
        }
      }
      
      return {
        name: fieldName,
        type: fieldType,
        enum_values: fieldType === 'enum' ? getUniqueFieldValues(fieldName) : undefined
      };
    });
    
    return realtimeCaptureFields;
  };

  const contactsWithCallData = getContactsWithCallData();


  const filteredContacts = contactsWithCallData.filter((contact) => {
    const contactAny = contact as any;
    
    const matchesSearch =
      contact.contact_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      contact.contact_phone.includes(searchTerm) ||
      contact.contact_email?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (contactAny.additional_data?.captured_data && 
        Object.values(contactAny.additional_data.captured_data).some((value: any) => 
          String(value).toLowerCase().includes(searchTerm.toLowerCase())
        ));
    
    const matchesStatus =
      callStatusFilter === "all" || contact.call_status === callStatusFilter;
    
    const matchesCapturedData = 
      capturedDataFilter === "all" ||
      (capturedDataFilter === "has_data" && contactAny.additional_data?.captured_data) ||
      (capturedDataFilter === "no_data" && !contactAny.additional_data?.captured_data);
    
    // Check field-specific captured data filters
    const matchesCapturedDataFilters = Object.entries(capturedDataFilters).every(([fieldName, filterValue]) => {
      if (filterValue === "all") return true;
      
      const capturedData = contactAny.additional_data?.captured_data;
      if (!capturedData) return filterValue === "no_data";
      
      const fieldValue = capturedData[fieldName];
      if (!fieldValue) return filterValue === "no_data";
      
      return String(fieldValue) === filterValue;
    });
    
    const matchesDuration = 
      durationFilter === "all" ||
      (durationFilter === "short" && (contact.call_duration || 0) < 60) ||
      (durationFilter === "medium" && (contact.call_duration || 0) >= 60 && (contact.call_duration || 0) < 300) ||
      (durationFilter === "long" && (contact.call_duration || 0) >= 300);
    
    const matchesDate = 
      dateFilter === "all" ||
      (dateFilter === "today" && contact.completed_at && 
        new Date(contact.completed_at).toDateString() === new Date().toDateString()) ||
      (dateFilter === "week" && contact.completed_at && 
        new Date(contact.completed_at) > new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)) ||
      (dateFilter === "month" && contact.completed_at && 
        new Date(contact.completed_at) > new Date(Date.now() - 30 * 24 * 60 * 60 * 1000));
    
    return matchesSearch && matchesStatus && matchesCapturedData && matchesCapturedDataFilters && matchesDuration && matchesDate;
  });

  // Handle re-calling selected contacts
  const handleRecallContacts = () => {
    if (!selectedCampaign || !userId) return;
    
    const recallableContacts = getRecallableContacts();
    if (recallableContacts.length === 0) {
      toast({
        title: "No Contacts Selected",
        description: "Please select contacts to re-call.",
        variant: "destructive",
      });
      return;
    }

    setShowRecallDialog(true);
  };

  // Smart function to consolidate retry/rerun prefixes
  const generateSmartCampaignName = (baseName: string): string => {
    // Pattern to match retry/rerun prefixes with optional counts
    const prefixPattern = /^((?:Retry(?:\(\d+\))?:\s*|Rerun(?:\s*\(\d+\))?:\s*)+)(.*)$/i;
    const match = baseName.match(prefixPattern);

    if (!match) {
      // No existing prefixes, add first retry
      return `Retry: ${baseName} (${new Date().toLocaleDateString()})`;
    }

    const prefixPart = match[1];
    const namePart = match[2];

    // Count occurrences of each type
    let retryCount = 0;
    let rerunCount = 0;

    // Match all retry patterns (including "Retry:", "Retry(n):")
    const retryMatches = prefixPart.match(/Retry(?:\((\d+)\))?:/gi) || [];
    retryMatches.forEach(retryMatch => {
      const countMatch = retryMatch.match(/\((\d+)\)/);
      if (countMatch) {
        retryCount += parseInt(countMatch[1]);
      } else {
        retryCount += 1;
      }
    });

    // Match all rerun patterns (including "Rerun:", "Rerun (n):")
    const rerunMatches = prefixPart.match(/Rerun(?:\s*\((\d+)\))?:/gi) || [];
    rerunMatches.forEach(rerunMatch => {
      const countMatch = rerunMatch.match(/\((\d+)\)/);
      if (countMatch) {
        rerunCount += parseInt(countMatch[1]);
      } else {
        rerunCount += 1;
      }
    });

    // Since we're adding a new retry, increment retry count
    retryCount += 1;

    // Build consolidated prefix
    let newPrefix = '';
    if (retryCount > 0) {
      newPrefix += retryCount > 1 ? `Retry(${retryCount}): ` : 'Retry: ';
    }
    if (rerunCount > 0) {
      newPrefix += rerunCount > 1 ? `Rerun(${rerunCount}): ` : 'Rerun: ';
    }

    return `${newPrefix}${namePart} (${new Date().toLocaleDateString()})`;
  };

  // Handle the actual recall campaign creation with enhanced settings
  const handleRecallCampaign = async (
    botId: string,
    twilioPhoneNumbers: string[],
    mappedFields: Record<string, string>,
    campaignSettings: { enableNumberLocking: boolean },
    scheduling: 'now' | 'schedule',
    scheduledDateTime?: string,
    timezone?: string
  ) => {
    if (!selectedCampaign || !userId) return;

    const recallableContacts = getRecallableContacts();
    setIsRecallingContacts(true);

    try {
      // Create a new campaign with the selected contacts using proper campaigns service
      const campaignName = generateSmartCampaignName(selectedCampaign.campaign_name);

      // Prepare contacts data for the new campaign
      // Include all contact_data fields so placeholders can be filled properly
      const contactsData = recallableContacts.map(contact => {
        // Parse contact_data if it's a string
        let contactDataFields = {};
        if (contact.contact_data) {
          try {
            contactDataFields = typeof contact.contact_data === 'string' 
              ? JSON.parse(contact.contact_data)
              : contact.contact_data;
          } catch (e) {
            console.log('Could not parse contact_data:', e);
            contactDataFields = {};
          }
        }

        return {
          name: contact.contact_name || '',
          phone: contact.contact_phone,
          email: contact.contact_email || '',
          ...contactDataFields // Spread all the original CSV fields
        };
      });

      // Create campaign using the proper campaigns service
      const schedulingOptions = scheduling === 'schedule' && scheduledDateTime ? {
        scheduled_start_time: getUtcIsoStringFromLocalInput(
          scheduledDateTime.split('T')[0],  // date part
          scheduledDateTime.split('T')[1],  // time part
          timezone || Intl.DateTimeFormat().resolvedOptions().timeZone
        ),
        timezone: timezone || Intl.DateTimeFormat().resolvedOptions().timeZone,
        auto_start: true
      } : undefined;

      const createResult = await campaignsService.createCampaign({
        campaign_name: campaignName,
        bot_id: botId,
        bot_name: selectedCampaign.bot_name,
        twilio_phone_number: twilioPhoneNumbers[0],
        twilio_phone_numbers: twilioPhoneNumbers,
        system_prompt: selectedCampaign.system_prompt || '',
        voice_settings: selectedCampaign.voice_settings,
        field_mappings: mappedFields,
        contacts: contactsData,
        notes: `Retry campaign created from ${selectedCampaign.campaign_name}`,
        user_id: userId,
        scheduling: schedulingOptions,
        campaign_settings: campaignSettings
      });

      console.log('Campaign create result:', createResult);

      if (createResult.status === 'success') {
        const campaignId = createResult.campaign_id;
        console.log('Created campaign with ID:', campaignId);
        
        // Start campaign immediately if not scheduled
        const shouldStartNow = scheduling === 'now' || (!schedulingOptions?.scheduled_start_time || !schedulingOptions?.auto_start);
        
        if (shouldStartNow) {
          try {
            const startResult = await campaignsService.startCampaign(campaignId);
            console.log('Campaign started:', startResult);
          } catch (startError) {
            console.error('Error starting campaign:', startError);
            toast({
              title: "Campaign Created",
              description: `Campaign "${campaignName}" was created but failed to start automatically. You can start it manually.`,
              variant: "destructive",
            });
          }
        }

        const scheduleMsg = scheduling === 'schedule' && scheduledDateTime
          ? ` Scheduled to start at ${new Date(scheduledDateTime).toLocaleString()}.`
          : shouldStartNow ? ' Campaign started immediately.' : ' Campaign created (manual start required).';
          
        toast({
          title: "Recall Campaign Created",
          description: `Successfully created retry campaign "${campaignName}" with ${recallableContacts.length} contacts.${scheduleMsg}`,
        });

        // Clear selections and reset dialog state
        setSelectedContacts(new Set());
        setSelectAll(false);
        setShowRecallDialog(false);
        
        // Small delay to ensure UI state is updated
        setTimeout(async () => {
          try {
            // Refresh campaigns first
            await refetch();
            
            // Set the pending campaign ID to be selected once campaigns are loaded
            setPendingCampaignId(campaignId);
            
            // Wait a bit more for campaigns to load
            setTimeout(() => {
              // Find and select the newly created campaign directly
              const newCampaign = campaigns?.find(c => c.campaign_id === campaignId);
              if (newCampaign) {
                console.log('Selecting newly created campaign:', newCampaign.campaign_name);
                setSelectedCampaign(newCampaign);
                setTabValue('contacts');
                setPendingCampaignId(null); // Clear pending
                
                // Ensure we fetch the campaign details
                fetchCampaignDetails(campaignId);
              } else {
                console.log('New campaign not found in list yet, will retry when campaigns update');
                // Don't use URL approach immediately, let the effect handle it
              }
            }, 1000);
            
          } catch (redirectError) {
            console.error('Error during redirect:', redirectError);
          }
        }, 500);
        
      } else {
        throw new Error(createResult.message || 'Failed to create campaign');
      }
      
    } catch (error) {
      console.error('Error creating recall campaign:', error);
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to create recall campaign",
        variant: "destructive",
      });
    } finally {
      setIsRecallingContacts(false);
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-96">
        <Icon name="spinner" className="h-8 w-8 animate-spin" />
      </div>
    );
  }

  return (
    <div className="container mx-auto space-y-6 p-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Bulk Call History</h1>
          <p className="text-muted-foreground">
            View and manage your bulk calling campaigns
          </p>
        </div>
        <Button onClick={refetch} variant="outline">
          <Icon name="rotate-cw" className="h-4 w-4 mr-2" />
          Refresh
        </Button>
      </div>

      <Tabs value={tabValue} onValueChange={setTabValue} className="space-y-4">
        <TabsList>
          <TabsTrigger value="campaigns">
            Campaigns ({campaigns.length})
          </TabsTrigger>
          <TabsTrigger value="queue">
            Queue Status ({queuedContacts.length})
          </TabsTrigger>
          {selectedCampaign && (
            <TabsTrigger value="details">
              Campaign Details - {selectedCampaign.campaign_name}
            </TabsTrigger>
          )}
        </TabsList>

        <TabsContent value="campaigns" className="space-y-4">
          {/* Filters */}
          <Card>
            <CardContent className="pt-6 p-3">
              <div className="flex flex-wrap gap-4">
                <div className="flex-1 min-w-[200px]">
                  <Input
                    placeholder="Search campaigns..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="w-full"
                  />
                </div>
                <Select value={statusFilter} onValueChange={setStatusFilter}>
                  <SelectTrigger className="w-[180px]">
                    <SelectValue placeholder="Filter by status" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Status</SelectItem>
                    <SelectItem value="pending">Pending</SelectItem>
                    <SelectItem value="in_progress">In Progress</SelectItem>
                    <SelectItem value="completed">Completed</SelectItem>
                    <SelectItem value="failed">Failed</SelectItem>
                    <SelectItem value="cancelled">Cancelled</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </CardContent>
          </Card>

          {/* Campaigns Table */}
          <Card>
            <CardContent className="pt-6 p-1">
              {filteredCampaigns.length === 0 ? (
                <div className="text-center p-6">
                  <Icon
                    name="phone-call"
                    className="h-12 w-12 mx-auto text-muted-foreground mb-4"
                  />
                  <h3 className="text-lg font-medium mb-2">
                    No campaigns found
                  </h3>
                  <p className="text-muted-foreground">
                    {campaigns.length === 0
                      ? "You haven't created any bulk calling campaigns yet."
                      : "No campaigns match your current filters."}
                  </p>
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Campaign Name</TableHead>
                      {/* <TableHead>Status</TableHead> */}
                      <TableHead>Bot</TableHead>
                      <TableHead>Phone Number</TableHead>
                      <TableHead>Contacts</TableHead>
                      <TableHead>Success Rate</TableHead>
                      <TableHead>Created</TableHead>
                      <TableHead>Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredCampaigns.map((campaign) => (
                      <TableRow key={campaign.campaign_id}>
                        <TableCell className="font-medium">
                          {campaign.campaign_name}
                        </TableCell>
                        {/* <TableCell>{getStatusBadge(campaign.status)}</TableCell> */}
                        <TableCell>{campaign.bot_name || "N/A"}</TableCell>
                        <TableCell className="font-mono text-sm">
                          {campaign.twilio_phone_number || "N/A"}
                        </TableCell>
                        <TableCell>
                          <div className="text-sm">
                            <div>Total: {campaign.total_contacts}</div>
                            <div className="text-green-600 dark:text-green-400">
                              ✓ {campaign.successful_calls}
                            </div>
                            <div className="text-red-600 dark:text-red-400">
                              ✗ {campaign.failed_calls}
                            </div>
                            <div className="text-muted-foreground">
                              ⏳ {campaign.pending_calls}
                            </div>
                          </div>
                        </TableCell>
                        <TableCell>
                          {campaign.total_contacts > 0 ? (
                            <div className="text-sm">
                              {Math.round(
                                (campaign.successful_calls /
                                  campaign.total_contacts) *
                                  100
                              )}
                              %
                            </div>
                          ) : (
                            "N/A"
                          )}
                        </TableCell>
                        <TableCell className="text-sm">
                          {formatDate(campaign.created_at)}
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={async () => {
                                await fetchCampaignDetails(campaign.campaign_id);
                                setTabValue("details");
                              }}
                            >
                              View Details
                            </Button>
                            {(campaign.status === 'completed' || campaign.status === 'cancelled') && (
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => {
                                  setCampaignToDelete(campaign);
                                  setIsDeleteDialogOpen(true);
                                }}
                                className="text-destructive hover:text-destructive hover:bg-destructive/10"
                              >
                                <Icon name="trash-2" className="h-4 w-4" />
                              </Button>
                            )}
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="queue" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Icon name="clock" className="h-5 w-5" />
                Queue Status - Calls Waiting for Time Window
              </CardTitle>
            </CardHeader>
            <CardContent>
              {queuedContacts.length === 0 ? (
                <div className="text-center p-6">
                  <Icon
                    name="check-circle"
                    className="h-12 w-12 mx-auto text-green-500 mb-4"
                  />
                  <h3 className="text-lg font-medium mb-2">No calls waiting</h3>
                  <p className="text-muted-foreground">
                    All calls are either completed or within their allowed time
                    windows.
                  </p>
                </div>
              ) : (
                <div className="space-y-4">
                  <div className="text-sm text-muted-foreground">
                    Showing {queuedContacts.length} contacts waiting for their
                    calling time window. These calls will be processed
                    automatically when the time window opens.
                  </div>

                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Campaign</TableHead>
                        <TableHead>Contact</TableHead>
                        <TableHead>Phone</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead>Queued At</TableHead>
                        <TableHead>Reason</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {queuedContacts.map((contact) => (
                        <TableRow key={contact.contact_id}>
                          <TableCell>
                            <div className="font-medium">
                              {contact.call_campaigns?.campaign_name ||
                                "Unknown Campaign"}
                            </div>
                          </TableCell>
                          <TableCell>
                            <div className="font-medium">
                              {contact.contact_name || "Unknown"}
                            </div>
                          </TableCell>
                          <TableCell>
                            <div className="font-mono text-sm">
                              {contact.contact_phone}
                            </div>
                          </TableCell>
                          <TableCell>
                            {getStatusBadge(contact.call_status)}
                          </TableCell>
                          <TableCell>
                            <div className="text-sm">
                              {contact.queued_at
                                ? formatDate(contact.queued_at, "MMM dd, HH:mm")
                                : "Unknown"}
                            </div>
                          </TableCell>
                          <TableCell>
                            <div
                              className="text-sm text-muted-foreground max-w-xs truncate"
                              title={contact.error_message || ""}
                            >
                              {contact.error_message ||
                                "Waiting for time window"}
                            </div>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>

                  <div className="bg-blue-50 dark:bg-blue-900/20 p-4 rounded-lg">
                    <div className="flex items-start gap-3">
                      <Icon
                        name="info"
                        className="h-5 w-5 text-blue-600 dark:text-blue-400 mt-0.5"
                      />
                      <div className="text-sm">
                        <div className="font-medium text-blue-900 dark:text-blue-100 mb-1">
                          About Time Windows
                        </div>
                        <div className="text-blue-800 dark:text-blue-200">
                          These contacts have campaigns with restricted calling
                          hours. They will automatically be processed when the
                          current time falls within their configured time
                          window. The system checks every minute and will resume
                          calling during allowed hours.
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {selectedCampaign && (
          <TabsContent value="details" className="space-y-6">
            {/* Campaign Header with Actions */}
            <Card className="bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-blue-900/20 dark:to-indigo-900/20 border-blue-200 dark:border-blue-800">
              <CardHeader className="pb-6">
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <h2 className="text-2xl font-bold text-foreground">
                        {selectedCampaign.campaign_name}
                      </h2>
                      {getStatusBadge(selectedCampaign.status)}
                    </div>
                    <p className="text-sm text-muted-foreground">
                      Campaign ID: {selectedCampaign.campaign_id}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleCopyCampaignId(selectedCampaign.campaign_id)}
                      className="bg-background hover:bg-accent"
                    >
                      <Icon name="copy" className="h-4 w-4 mr-2" />
                      Copy ID
                    </Button>
                    {(selectedCampaign.status === 'in_progress' || selectedCampaign.status === 'pending') && (
                      <Button
                        variant="destructive"
                        size="sm"
                        onClick={() => handleStopCampaign(selectedCampaign.campaign_id)}
                      >
                        <Icon name="square" className="h-4 w-4 mr-2" />
                        Stop Campaign
                      </Button>
                    )}
                    {(selectedCampaign.status === 'completed' || selectedCampaign.status === 'cancelled') && (
                      <Button
                        variant="destructive"
                        size="sm"
                        onClick={() => {
                          setCampaignToDelete(selectedCampaign);
                          setIsDeleteDialogOpen(true);
                        }}
                      >
                        <Icon name="trash-2" className="h-4 w-4 mr-2" />
                        Delete Campaign
                      </Button>
                    )}
                  </div>
                </div>
              </CardHeader>
            </Card>

            {/* Campaign Statistics */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              <Card className="p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-muted-foreground">Total Contacts</p>
                    <p className="text-2xl font-bold">{selectedCampaign.total_contacts}</p>
                  </div>
                  <Icon name="users" className="h-8 w-8 text-blue-600 dark:text-blue-400" />
                </div>
              </Card>
              <Card className="p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-muted-foreground">Successful Calls</p>
                    <p className="text-2xl font-bold text-green-600 dark:text-green-400">{selectedCampaign.successful_calls}</p>
                  </div>
                  <Icon name="check-circle" className="h-8 w-8 text-green-600 dark:text-green-400" />
                </div>
              </Card>
              <Card className="p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-muted-foreground">Failed Calls</p>
                    <p className="text-2xl font-bold text-red-600 dark:text-red-400">{selectedCampaign.failed_calls}</p>
                  </div>
                  <Icon name="x-circle" className="h-8 w-8 text-red-600 dark:text-red-400" />
                </div>
              </Card>
              <Card className="p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-muted-foreground">Success Rate</p>
                    <p className="text-2xl font-bold text-blue-600 dark:text-blue-400">
                      {selectedCampaign.total_contacts > 0
                        ? `${Math.round((selectedCampaign.successful_calls / selectedCampaign.total_contacts) * 100)}%`
                        : "N/A"}
                    </p>
                  </div>
                  <Icon name="trending-up" className="h-8 w-8 text-blue-600 dark:text-blue-400" />
                </div>
              </Card>
            </div>

            {/* Campaign Details */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Icon name="info" className="h-5 w-5" />
                  Campaign Details
                </CardTitle>
              </CardHeader>
              <CardContent className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                <div className="space-y-3">
                  <div>
                    <label className="text-sm font-semibold text-foreground">
                      Bot Used
                    </label>
                    <p className="text-sm text-muted-foreground mt-1">
                      {selectedCampaign.bot_name || "N/A"}
                    </p>
                  </div>
                  <div>
                    <label className="text-sm font-semibold text-foreground">
                      Phone Number
                    </label>
                    <p className="text-sm font-mono text-muted-foreground mt-1">
                      {selectedCampaign.twilio_phone_number || "N/A"}
                    </p>
                  </div>
                </div>
                <div className="space-y-3">
                  <div>
                    <label className="text-sm font-semibold text-foreground">
                      Created
                    </label>
                    <p className="text-sm text-muted-foreground mt-1">
                      {formatDate(selectedCampaign.created_at)}
                    </p>
                  </div>
                  {selectedCampaign.started_at && (
                    <div>
                      <label className="text-sm font-semibold text-foreground">
                        Started
                      </label>
                      <p className="text-sm text-muted-foreground mt-1">
                        {formatDate(selectedCampaign.started_at)}
                      </p>
                    </div>
                  )}
                </div>
                <div className="space-y-3">
                  {selectedCampaign.completed_at && (
                    <div>
                      <label className="text-sm font-semibold text-foreground">
                        Completed
                      </label>
                      <p className="text-sm text-muted-foreground mt-1">
                        {formatDate(selectedCampaign.completed_at)}
                      </p>
                    </div>
                  )}
                  <div>
                    <label className="text-sm font-semibold text-foreground">
                      Pending Calls
                    </label>
                    <p className="text-sm text-muted-foreground mt-1">
                      {selectedCampaign.pending_calls}
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Campaign Schedule Information */}
            <CampaignScheduleInfo campaign={selectedCampaign} />

            {/* AI Analysis Section */}
            {customQuestions.length > 0 && (
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Icon name="brain-circuit" className="h-5 w-5" />
                    AI Call Analysis
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="bg-blue-50 dark:bg-blue-900/20 p-4 rounded-lg">
                    <h4 className="font-medium text-blue-900 dark:text-blue-100 mb-2">
                      Custom Questions for Analysis
                    </h4>
                    <div className="space-y-1">
                      {customQuestions
                        .filter((q) => q.enabled)
                        .map((question, index) => (
                          <div
                            key={question.id}
                            className="text-sm text-blue-800 dark:text-blue-200"
                          >
                            {index + 1}. {question.question}
                          </div>
                        ))}
                    </div>
                  </div>

                  <div className="space-y-3">
                    {hasGeminiKey ? (
                      <div className="bg-green-50 dark:bg-green-900/20 p-4 rounded-lg">
                        <div className="flex items-start gap-3">
                          <Icon name="check-circle" className="h-5 w-5 text-green-600 dark:text-green-400 mt-0.5" />
                          <div className="text-sm">
                            <div className="font-medium text-green-900 dark:text-green-100 mb-1">
                              Gemini API Key Configured
                            </div>
                            <div className="text-green-800 dark:text-green-200">
                              Your Gemini API key is ready for AI analysis. You can update it in Settings if needed.
                            </div>
                          </div>
                        </div>
                      </div>
                    ) : (
                      <div className="bg-yellow-50 dark:bg-yellow-900/20 p-4 rounded-lg">
                        <div className="flex items-start gap-3">
                          <Icon name="alert-triangle" className="h-5 w-5 text-yellow-600 dark:text-yellow-400 mt-0.5" />
                          <div className="text-sm">
                            <div className="font-medium text-yellow-900 dark:text-yellow-100 mb-1">
                              Gemini API Key Required
                            </div>
                            <div className="text-yellow-800 dark:text-yellow-200 mb-2">
                              Please configure your Gemini API key in Settings to enable AI analysis features.
                            </div>
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => window.open('/dashboard/settings', '_blank')}
                              className="bg-background"
                            >
                              <Icon name="settings" className="h-4 w-4 mr-2" />
                              Go to Settings
                            </Button>
                          </div>
                        </div>
                      </div>
                    )}

                    <Button
                      onClick={processCallAnswers}
                      disabled={isProcessingAnswers || !hasGeminiKey}
                      className="w-full"
                    >
                      {isProcessingAnswers ? (
                        <>
                          <Icon
                            name="spinner"
                            className="h-4 w-4 mr-2 animate-spin"
                          />
                          Processing Call Analysis...
                        </>
                      ) : (
                        <>
                          <Icon name="brain-circuit" className="h-4 w-4 mr-2" />
                          Generate AI Analysis for Completed Calls
                        </>
                      )}
                    </Button>

                    <div className="text-sm text-muted-foreground">
                      This will analyze completed calls and extract answers to
                      your custom questions. Only calls without existing AI
                      analysis will be processed to avoid unnecessary API costs.
                      {contacts.filter((c) => {
                        if (c.call_status !== "completed") return false;
                        const enabledQuestions = customQuestions.filter(
                          (q) => q.enabled
                        );

                        if (!c.ai_processed_answers) return true;

                        const aiAnswers = c.ai_processed_answers as any;
                        const hasAnswers = Object.keys(aiAnswers).length > 0;

                        if (!hasAnswers) return true;

                        return enabledQuestions.some((question) => {
                          const hasAnswer =
                            aiAnswers[question.id] &&
                            aiAnswers[question.id].answer;
                          return !hasAnswer;
                        });
                      }).length > 0 && (
                        <div className="mt-2 text-blue-600 dark:text-blue-400 font-medium">
                          {
                            contacts.filter((c) => {
                              if (c.call_status !== "completed") return false;
                              const enabledQuestions = customQuestions.filter(
                                (q) => q.enabled
                              );

                              if (!c.ai_processed_answers) return true;

                              const aiAnswers = c.ai_processed_answers as any;
                              const hasAnswers =
                                Object.keys(aiAnswers).length > 0;

                              if (!hasAnswers) return true;

                              return enabledQuestions.some((question) => {
                                const hasAnswer =
                                  aiAnswers[question.id] &&
                                  aiAnswers[question.id].answer;
                                return !hasAnswer;
                              });
                            }).length
                          }{" "}
                          completed calls ready for AI analysis.
                        </div>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Contact Management */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Icon name="users" className="h-5 w-5" />
                  Contact Management & Filters
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex flex-wrap gap-4 items-center">
                  <div className="flex-1 min-w-[200px]">
                    <Input
                      placeholder="Search contacts, phone, email, or captured data..."
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                      className="w-full"
                    />
                  </div>
                  <Select
                    value={callStatusFilter}
                    onValueChange={setCallStatusFilter}
                  >
                    <SelectTrigger className="w-[140px]">
                      <SelectValue placeholder="Status" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Status</SelectItem>
                      <SelectItem value="pending">Pending</SelectItem>
                      <SelectItem value="queued">Queued</SelectItem>
                      <SelectItem value="in_progress">In Progress</SelectItem>
                      <SelectItem value="completed">Answered</SelectItem>
                      <SelectItem value="failed">Failed</SelectItem>
                      <SelectItem value="cancelled">Cancelled</SelectItem>
                      <SelectItem value="unjoined">Not Answered</SelectItem>
                    </SelectContent>
                  </Select>
                  <Select
                    value={capturedDataFilter}
                    onValueChange={setCapturedDataFilter}
                  >
                    <SelectTrigger className="w-[140px]">
                      <SelectValue placeholder="Captured Data" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Data</SelectItem>
                      <SelectItem value="has_data">Has Data</SelectItem>
                      <SelectItem value="no_data">No Data</SelectItem>
                    </SelectContent>
                  </Select>
                  
                  {/* Dynamic field-specific filters */}
                  {getBotCaptureFields().map((field) => (
                    <Select
                      key={field.name}
                      value={capturedDataFilters[field.name] || "all"}
                      onValueChange={(value) => {
                        setCapturedDataFilters(prev => ({
                          ...prev,
                          [field.name]: value
                        }));
                      }}
                    >
                      <SelectTrigger className="w-[140px]">
                        <SelectValue placeholder={field.name} />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">All {field.name}</SelectItem>
                        <SelectItem value="no_data">No {field.name}</SelectItem>
                        {field.type === 'enum' && field.enum_values ? 
                          field.enum_values.map((enumValue: string) => (
                            <SelectItem key={enumValue} value={enumValue}>
                              {enumValue}
                            </SelectItem>
                          ))
                          : getUniqueFieldValues(field.name).map((value) => (
                            <SelectItem key={value} value={value}>
                              {value}
                            </SelectItem>
                          ))
                        }
                      </SelectContent>
                    </Select>
                  ))}
                  <Select
                    value={durationFilter}
                    onValueChange={setDurationFilter}
                  >
                    <SelectTrigger className="w-[140px]">
                      <SelectValue placeholder="Duration" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Duration</SelectItem>
                      <SelectItem value="short">Short (&lt;1min)</SelectItem>
                      <SelectItem value="medium">Medium (1-5min)</SelectItem>
                      <SelectItem value="long">Long (&gt;5min)</SelectItem>
                    </SelectContent>
                  </Select>
                  <Select
                    value={dateFilter}
                    onValueChange={setDateFilter}
                  >
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
                </div>
                <div className="flex justify-between items-center pt-2">
                  <div className="text-sm text-muted-foreground">
                    Showing {filteredContacts.length} of {contacts.length} contacts
                    {selectedContacts.size > 0 && (
                      <span className="ml-2 text-blue-600 font-medium">
                        • {selectedContacts.size} selected
                      </span>
                    )}
                    {Object.keys(capturedDataFilters).filter(key => capturedDataFilters[key] !== "all").length > 0 && (
                      <span className="ml-2 text-green-600 font-medium">
                        • {Object.keys(capturedDataFilters).filter(key => capturedDataFilters[key] !== "all").length} field filters active
                      </span>
                    )}
                  </div>
                  <div className="flex gap-2">
                    {selectedContacts.size > 0 && (
                      <>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => setShowRecallDialog(true)}
                          disabled={getRecallableContacts().length === 0}
                        >
                          <Icon name="phone-call" className="h-4 w-4 mr-2" />
                          Re-call Selected ({getRecallableContacts().length})
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => {
                            setSelectedContacts(new Set());
                            setSelectAll(false);
                          }}
                        >
                          <Icon name="x" className="h-4 w-4 mr-2" />
                          Clear Selection
                        </Button>
                      </>
                    )}
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        setSearchTerm("");
                        setCallStatusFilter("all");
                        setCapturedDataFilter("all");
                        setCapturedDataFilters({});
                        setDurationFilter("all");
                        setDateFilter("all");
                        setSelectedContacts(new Set());
                        setSelectAll(false);
                      }}
                    >
                      <Icon name="x" className="h-4 w-4 mr-2" />
                      Clear Filters
                    </Button>
                    <CampaignExport
                      campaignName={selectedCampaign.campaign_name}
                      contacts={filteredContacts}
                    />
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Contacts Table */}
            <Card>
              <CardContent className="pt-6 p-1">
                {filteredContacts.length === 0 ? (
                  <div className="text-center py-8">
                    <Icon
                      name="users"
                      className="h-12 w-12 mx-auto text-muted-foreground mb-4"
                    />
                    <h3 className="text-lg font-medium mb-2">
                      No contacts found
                    </h3>
                    <p className="text-muted-foreground">
                      No contacts match your current filters.
                    </p>
                  </div>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="w-12">
                          <Checkbox
                            checked={selectAll}
                            onCheckedChange={handleSelectAll}
                            aria-label="Select all contacts"
                          />
                        </TableHead>
                        <TableHead>Contact</TableHead>
                        <TableHead>Phone Number</TableHead>
                        <TableHead>Call Status</TableHead>
                        <TableHead>Call Summary</TableHead>
                        {/* Dynamic columns for Captured Data keys */}
                        {getBotCaptureFields().map((c) => {
                          console.log(c)
                          return (
                          <TableHead key={`captured-head-${c.name}`} className="min-w-[120px]">
                            {c.name}
                          </TableHead>
                        )})}
                        {/* Dynamic columns for AI answers */}
                        {customQuestions
                          .filter((q) => q.enabled)
                          .map((question) => (
                            <TableHead
                              key={question.id}
                              className="min-w-[150px]"
                            >
                              {question.question.length > 20
                                ? `${question.question.substring(0, 20)}...`
                                : question.question}
                            </TableHead>
                          ))}
                        <TableHead>Called At</TableHead>
                        <TableHead>Duration</TableHead>
                        <TableHead>Transcript</TableHead>

                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filteredContacts.map((contact) => (
                        <TableRow key={contact.contact_id}>
                          <TableCell>
                            <Checkbox
                              checked={selectedContacts.has(contact.contact_id)}
                              onCheckedChange={(checked) => handleContactSelect(contact.contact_id, checked === true)}
                              aria-label={`Select ${contact.contact_name || contact.contact_phone}`}
                            />
                          </TableCell>
                          <TableCell>
                            <div>
                              <div className="font-medium">
                                {contact.contact_name || "Unknown"}
                              </div>
                              {contact.contact_email && (
                                <div className="text-sm text-muted-foreground">
                                  {contact.contact_email}
                                </div>
                              )}
                            </div>
                          </TableCell>
                          <TableCell className="font-mono text-sm">
                            {contact.contact_phone}
                          </TableCell>
                          <TableCell>
                            { contact?.ai_processed_answers ?  Object.values(contact?.ai_processed_answers || {}).find((answer: any) => {
                              return answer?.answer?.toLowerCase().includes("voicemail")
                            }) ? getStatusBadge("unjoined") : getStatusBadge(contact.call_status) : getStatusBadge(contact.call_status)}
                          </TableCell>
                          
                          <TableCell className="max-w-[160px]">
                            {contact.call_summary || contact.call_notes ? (
                              <div className="flex items-center justify-between">
                                <div
                                  className="text-sm truncate flex-1 cursor-pointer hover:text-blue-600"
                                  title={
                                    contact.call_summary || contact.call_notes
                                  }
                                  onClick={() => {
                                    setSelectedContact(contact);
                                    setDetailView('summary');
                                    setIsContactDetailDialogOpen(true);
                                  }}
                                >
                                  {(() => {
                                    const text = contact.call_summary || contact.call_notes || '';
                                    return text.length > 50 ? text.substring(0, 30) + '...' : text;
                                  })()}
                                </div>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  className="h-6 w-6 p-0 ml-2"
                                  onClick={() => {
                                    setSelectedContact(contact);
                                    setIsContactDetailDialogOpen(true);
                                  }}
                                >
                                  <Icon name="expand" className="h-3 w-3" />
                                </Button>
                              </div>
                            ) : (
                              <span className="text-muted-foreground">
                                No summary
                              </span>
                            )}
                          </TableCell>
                          {/* Dynamic cells for Captured Data values */}
                          {getBotCaptureFields().map((field) => {
                            const capturedData = (contact as any).additional_data?.captured_data;
                            const rawValue = capturedData ? capturedData[field.name] : undefined;
                            let displayValue: string = "";
                            if (rawValue === undefined || rawValue === null || rawValue === "") {
                              displayValue = "—";
                            } else if (typeof rawValue === "object") {
                              try {
                                displayValue = JSON.stringify(rawValue);
                              } catch {
                                displayValue = String(rawValue);
                              }
                            } else if (typeof rawValue === "boolean") {
                              displayValue = rawValue ? "Yes" : "No";
                            } else {
                              displayValue = String(rawValue);
                            }
                            const truncated = displayValue.length > 50 ? `${displayValue.substring(0, 50)}...` : displayValue;
                            return (
                              <TableCell key={`captured-cell-${field.name}-${contact.contact_id}`} className="max-w-[200px]">
                                <span className="text-sm truncate block" title={displayValue}>
                                  {truncated}
                                </span>
                              </TableCell>
                            );
                          })}
                          
                          {/* Dynamic cells for AI answers */}
                          {customQuestions
                            .filter((q) => q.enabled)
                            .map((question) => {
                              const aiAnswers =
                                contact.ai_processed_answers as any;
                              const answer = aiAnswers?.[question.id];

                              return (
                                <TableCell
                                  key={question.id}
                                  className="max-w-[200px]"
                                >
                                  {answer ? (
                                    <div className="space-y-1">
                                      <div
                                        className="text-sm truncate"
                                        title={answer.answer || (typeof answer === 'string' ? answer : 'No answer')}
                                      >
                                        {answer.answer || (typeof answer === 'string' ? answer : 'No answer')}
                                      </div>
                                      {answer.confidence && (
                                        <div className="flex items-center gap-1">
                                          <div
                                            className={`w-2 h-2 rounded-full ${
                                              answer.confidence === "high"
                                                ? "bg-green-500"
                                                : answer.confidence === "medium"
                                                  ? "bg-yellow-500"
                                                  : "bg-red-500"
                                            }`}
                                          />
                                          <span className="text-xs text-muted-foreground">
                                            {answer.confidence}
                                          </span>
                                        </div>
                                      )}
                                    </div>
                                  ) : contact.ai_answers_generated_at ? (
                                    <span className="text-xs text-muted-foreground">
                                      No answer
                                    </span>
                                  ) : (
                                    <span className="text-xs text-muted-foreground">
                                      Not analyzed
                                    </span>
                                  )}
                                </TableCell>
                              );
                            })}
                          <TableCell className="text-sm">
                            {contact.completed_at
                              ? formatDate(
                                  contact.completed_at,
                                  "MMM dd, HH:mm"
                                )
                              : contact.started_at
                                ? formatDate(
                                    contact.started_at,
                                    "MMM dd, HH:mm"
                                  )
                                : "Not called"}
                          </TableCell>
                          <TableCell>
                            {formatDuration(contact.call_duration || 0)}
                          </TableCell>
                          <TableCell>
                            {contact.ultravox_call_id ? (
                              <Button
                                variant="ghost"
                                size="sm"
                                className="h-8 w-8 p-0"
                                onClick={() => {
                                  setSelectedContact(contact);
                                  setDetailView('transcript');
                                  setIsContactDetailDialogOpen(true);
                                  // Auto-open transcript when dialog opens
                                  setTimeout(() => {
                                    setIsTranscriptOpen(true);
                                    handleTranscriptToggle(true);
                                  }, 100);
                                }}
                                title="View transcript"
                              >
                                <Icon name="expand" className="h-4 w-4" />
                              </Button>
                            ) : (
                              <span className="text-muted-foreground text-xs">
                                No transcript
                              </span>
                            )}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        )}
      </Tabs>

      {/* Contact Detail Dialog */}
      <Dialog open={isContactDetailDialogOpen} onOpenChange={setIsContactDetailDialogOpen}>
        <DialogContent className="max-w-[900px] max-h-[80vh]">
          <DialogHeader>
            <DialogTitle>
              Call Details - {selectedContact?.contact_name || "Contact"}
            </DialogTitle>
          </DialogHeader>
          <div className="flex-1 overflow-y-auto space-y-4">
            {selectedContact && (
              <>
                {detailView === 'summary' && (
                  <>
                    {/* Contact Information */}
                    <Card>
                      <CardHeader className="p-3">
                        <h3 className="text-sm font-medium">Contact Information</h3>
                      </CardHeader>
                      <CardContent className="p-3 space-y-2">
                        <div className="grid grid-cols-2 gap-4 text-sm">
                          <div>
                            <span className="font-medium">Name:</span> {selectedContact.contact_name || "Unknown"}
                          </div>
                          <div>
                            <span className="font-medium">Phone:</span> {selectedContact.contact_phone}
                          </div>
                          {selectedContact.contact_email && (
                            <div>
                              <span className="font-medium">Email:</span> {selectedContact.contact_email}
                            </div>
                          )}
                          {selectedContact.ultravox_call_id && (
                            <div className="flex justify-between items-center">
                              <span className="font-medium">Call ID:</span>
                              <div className="flex items-center space-x-2">
                                <span className="text-sm font-mono bg-muted px-2 py-1 rounded">
                                  {selectedContact.ultravox_call_id}
                                </span>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  className="h-6 w-6 p-0"
                                  onClick={() => {
                                    navigator.clipboard.writeText(selectedContact.ultravox_call_id || '');
                                    toast({
                                      title: "Copied",
                                      description: "Call ID copied to clipboard",
                                    });
                                  }}
                                  title="Copy Call ID"
                                >
                                  <Icon name="copy" className="h-3 w-3" />
                                </Button>
                              </div>
                            </div>
                          )}
                          <div>
                            <span className="font-medium">Status:</span> {getStatusBadge(selectedContact.call_status)}
                          </div>
                          <div>
                            <span className="font-medium">Duration:</span> {formatDuration(selectedContact.call_duration || 0)}
                          </div>
                        </div>
                      </CardContent>
                    </Card>

                    {/* Call Summary Only */}
                    <Card>
                      <CardHeader className="p-3">
                        <h3 className="text-sm font-medium">Call Summary</h3>
                      </CardHeader>
                      <CardContent className="p-3">
                        <div className="bg-muted rounded-lg p-3">
                          <div className="text-sm whitespace-pre-wrap">
                            {selectedContact.call_summary || selectedContact.call_notes || "No summary available"}
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  </>
                )}

                {detailView === 'transcript' && selectedContact.ultravox_call_id && (
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
                                </div>

                                <div className="bg-muted rounded-lg p-3">
                                  <div className="max-h-[40vh] overflow-y-auto space-y-2 text-sm"
                                    style={{
                                      scrollbarWidth: 'thin',
                                      scrollbarColor: 'gray-400/40 gray-100/50',
                                    }}
                                  >
                                    {transcript
                                      .slice(transcriptPage * 10, (transcriptPage + 1) * 10)
                                      .map((message, idx) => (
                                      <div 
                                        key={idx} 
                                        className={`p-2 rounded-lg ${
                                          isUserMessage(message.role) 
                                            ? "bg-background border border-border ml-6" 
                                            : "bg-accent/20 mr-6"
                                        }`}
                                      >
                                        <div className="font-medium text-xs mb-1 flex items-center justify-between">
                                          <span>{isUserMessage(message.role) ? 'USER' : 'AGENT'}</span>
                                        </div>
                                        <div className="whitespace-pre-wrap break-words">
                                          {message.text}
                                        </div>
                                      </div>
                                    ))}
                                  </div>
                                </div>
                                <div className="mt-4 flex justify-between items-center">
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
                                    {selectedContact && transcripts[selectedContact.ultravox_call_id]?.hasMore ? "+" : ""}
                                  </span>
                                  
                                  <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={() => handleTranscriptPageChange(transcriptPage + 1)}
                                    disabled={(transcriptPage + 1) * 10 >= transcript.length && (!selectedContact || !transcripts[selectedContact.ultravox_call_id]?.hasMore) || isLoadingMoreTranscript}
                                    className="flex items-center gap-1"
                                  >
                                    Next page
                                    <Icon name="chevronRight" className="h-4 w-4" />
                                  </Button>
                                </div>
                                <div className="mt-2 text-center text-xs text-muted-foreground">
                                  Showing messages {transcriptPage * 10 + 1}-{Math.min((transcriptPage + 1) * 10, transcript.length)} of {transcript.length}
                                  {selectedContact && transcripts[selectedContact.ultravox_call_id]?.hasMore ? " (more available)" : ""}
                                </div>
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
                )}
              </>
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* Enhanced Recall Campaign Dialog */}
      <RecallCampaignDialog
        showDialog={showRecallDialog}
        setShowDialog={setShowRecallDialog}
        selectedCampaign={selectedCampaign}
        selectedContacts={getRecallableContacts()}
        onRecallCampaign={handleRecallCampaign}
      />

      {/* Delete Campaign Confirmation Dialog */}
      <AlertDialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Campaign</AlertDialogTitle>
            <AlertDialogDescription className="space-y-2">
              <p>
                Are you sure you want to delete the campaign <strong>"{campaignToDelete?.campaign_name}"</strong>?
              </p>
              <p className="text-destructive font-medium">
                This action cannot be undone. This will permanently delete:
              </p>
              <ul className="list-disc list-inside space-y-1 text-sm">
                <li>The campaign and all its settings</li>
                <li>All {campaignToDelete?.total_contacts || 0} contact records</li>
                <li>All call logs and summaries</li>
                <li>All AI analysis results</li>
              </ul>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isDeletingCampaign}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteCampaign}
              disabled={isDeletingCampaign}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {isDeletingCampaign ? (
                <>
                  <Icon name="spinner" className="h-4 w-4 mr-2 animate-spin" />
                  Deleting...
                </>
              ) : (
                <>
                  <Icon name="trash-2" className="h-4 w-4 mr-2" />
                  Delete Campaign
                </>
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
