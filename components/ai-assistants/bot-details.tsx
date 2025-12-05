'use client';

import { useState, useEffect, useRef, useCallback } from "react";
import { useForm, Controller } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { supabase } from "@/lib/supabase";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { Icon } from "@/components/ui/icons";
import { TranscriptView } from "../dashboard/transcript-view";
import { CopyButton } from "@/components/ui/copy-button";
import { VoiceBar } from "./voice-bar"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Slider } from "@/components/ui/slider";
import { startCall, endCall, startTwilioCall } from "@/lib/callFunctions";
import { Transcript, UltravoxSessionStatus } from "ultravox-client";
import { CallConfig, TwilioConfig } from "@/lib/types";
import { BotToggle } from "./bot-toggle";
import { BotSettingsDialog } from "./bot-settings-dialog";
import { useVoices } from "@/hooks/use-voices";
import { useBots } from "@/hooks/use-bots";
import { usePricing } from "@/hooks/use-pricing";
import { TwilioCredentials, TwilioPhoneNumber } from "@/types/twilio";
import { useKnowledgeBase } from '@/hooks/use-knowledge-base';
import { getAllTools } from '@/components/tools/toolsService';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Checkbox } from "@/components/ui/checkbox";
import { Bot, CustomQuestion, RealtimeCaptureField } from "@/types/database";
import { useUser } from "@/hooks/use-user";
import { agentService } from "@/lib/services/agent.service";
import { logBotOperation, logAgentSync } from "@/lib/utils/api-logger";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { useAppointmentTools } from '@/hooks/use-appointments';



const formSchema = z.object({
  name: z.string().min(1, "Bot name is required"),
  phone_number: z.string().optional(),
  voice: z.string().min(1, "Please select a voice"),
  system_prompt: z.string().min(1, "System prompt is required"),
  knowledge_base_id: z.string().optional(),
  selected_tools: z.array(z.string()).default([]),
  temperature: z.number().min(0).max(10).default(0.7),
  twilio_phone_number: z.string().optional(),
  model: z.enum(["ultravox-v0.7"]).default("ultravox-v0.7"),
  first_speaker: z.enum(["FIRST_SPEAKER_AGENT", "FIRST_SPEAKER_USER"]).default("FIRST_SPEAKER_AGENT"),
  is_appointment_booking_allowed: z.boolean().default(false),
  appointment_tool_id: z.string().optional(),
  is_call_transfer_allowed: z.boolean().default(false),
  call_transfer_number: z.string().optional(),
});

type FormData = z.infer<typeof formSchema>;

export function BotDetails() {
  const [loading, setLoading] = useState(false);
  const [loadingTwilioNumbers, setLoadingTwilioNumbers] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [isCallActive, setIsCallActive] = useState(false);
  const [agentStatus, setAgentStatus] = useState<string>("off");
  const [callTranscript, setCallTranscript] = useState<Transcript[] | null>(
    null
  );
  const transcriptContainerRef = useRef<HTMLDivElement>(null);
  const [isPromptDialogOpen, setIsPromptDialogOpen] = useState(false);
  const [isDuplicating, setIsDuplicating] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);
  const [isSettingsDialogOpen, setIsSettingsDialogOpen] = useState(false);
  const { toast } = useToast();
  const {
    register,
    handleSubmit,
    setValue,
    watch,
    control,
    formState,
  } = useForm<FormData>({
    resolver: zodResolver(formSchema),
    mode: 'onChange',
  });
  const { errors } = formState;

  const handleSync = async (e: React.MouseEvent<HTMLButtonElement>) => {
    e.preventDefault();
    if (!botId) return;

    setIsSyncing(true);
    logAgentSync(botId, { action: "SYNC_BUTTON_CLICK" });

    try {
      const response = await agentService.syncAgent(botId);
      // Update local state with the synced data
      updateBot(botId, response.data);

      toast({
        title: "Agent Synced",
        description: "The bot is now synced with the agent service.",
      });
      logAgentSync(botId, { action: "SYNC_SUCCESS" });
    } catch (error: any) {
      console.error("Error syncing agent:", error);
      toast({
        title: "Sync Failed",
        description: error.message || "Could not sync the agent. Please try again.",
        variant: "destructive",
      });
      logAgentSync(botId, { action: "SYNC_ERROR", error: error.message });
    } finally {
      setIsSyncing(false);
    }
  };

  const formatLastSynced = (dateString: string | null) => {
    if (!dateString) return 'Never';

    const date = new Date(dateString);

    const day = String(date.getDate()).padStart(2, '0');
    const month = String(date.getMonth() + 1).padStart(2, '0'); // Months are 0-indexed
    const year = date.getFullYear();

    const formattedDate = `${day}-${month}-${year}`;

    const formattedTime = date.toLocaleTimeString('en-US', {
      hour: 'numeric',
      minute: '2-digit',
      hour12: true,
    });

    return `${formattedDate} ${formattedTime}`;
  };


  const { isTwilioAllowed: twilioAllowed, setCallStarted, callStarted, time } = usePricing();
  const { voices, error: voicesError, isLoading: voicesLoading, twilioInfo: twilioNumbers = [] } = useVoices();
  const { selectedBotId: botId, bots, updateBot, duplicateBot } = useBots();
  const { tools: appointmentTools } = useAppointmentTools();
  const selectedVoice = watch("voice");
  const selectedTwilioNumber = watch("twilio_phone_number");
  const isAppointmentBookingAllowed = watch('is_appointment_booking_allowed');
  const isCallTransferAllowed = watch('is_call_transfer_allowed');
  const { knowledgeBases } = useKnowledgeBase();
  const { user } = useUser();
  const [selectedKnowledgeBase, setSelectedKnowledgeBase] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [availableTools, setAvailableTools] = useState<any[]>([]);
  const [selectedTools, setSelectedTools] = useState<string[]>([]);
  const [originalSelectedTools, setOriginalSelectedTools] = useState<string[]>([]);
  const [toolsLoading, setToolsLoading] = useState(false);
    const [isToolsDropdownOpen, setIsToolsDropdownOpen] = useState(false);
  
    // Close dropdown when clicking outside
    useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (isToolsDropdownOpen && !(event.target as Element).closest('.tools-dropdown')) {
        setIsToolsDropdownOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isToolsDropdownOpen]);

  // Reset tools to original state
  const resetTools = () => {
    setSelectedTools(originalSelectedTools);
  };

  useEffect(() => {
    if (transcriptContainerRef.current) {
      transcriptContainerRef.current.scrollTop =
        transcriptContainerRef.current.scrollHeight;
    }
  }, [callTranscript]);

  // Fetch available tools
  useEffect(() => {
    const fetchTools = async () => {
      if (!user?.id) return;

      setToolsLoading(true);
      try {
        const response = await getAllTools(user.id);
        setAvailableTools(response.tools?.results || []);
      } catch (error) {
        console.error('Error fetching tools:', error);
        toast({
          title: "Error",
          description: "Failed to fetch tools",
          variant: "destructive",
        });
      } finally {
        setToolsLoading(false);
      }
    };

    fetchTools();
  }, [user?.id, toast]);

  useEffect(() => {
    if (time <= 0 && !callStarted) {
      toast({
        title: "No credits left",
        description: "Please top up your account to continue using the assistant",
        variant: "destructive",
      });
    }

    // this means the call has been ended by the user
    if (isCallActive && !callStarted) {
      setIsCallActive(false);
      toast({
        title: "The Call has been Ended",
        variant: "destructive",
      })
    }
  }, [time, callStarted]);

  // Get current bot and check if it's enabled
  const currentBot = bots.find((bot) => bot.id === botId);
  const isBotEnabled = currentBot?.is_enabled !== false;

  useEffect(() => {
    const bot = bots.find((bot) => bot.id === botId);

    if (!bot) {
      toast({
        title: "Error",
        description: "Bot not found",
        variant: "destructive",
      });
      return;
    }

    // Only set voice if voices are loaded and bot has a voice
    if (!voicesLoading && voices.length > 0 && bot.voice) {
      setValue("voice", bot.voice);
    }

    // Only set knowledge base if knowledgeBases are loaded
    if (knowledgeBases && knowledgeBases.length > 0) {
      if (bot.knowledge_base_id) {
        setValue("knowledge_base_id", bot.knowledge_base_id);
        setSelectedKnowledgeBase(bot.knowledge_base_id);
      } else {
        setValue("knowledge_base_id", '');
        setSelectedKnowledgeBase('none');
      }
    }

    // Set other values that don't depend on async data
    setValue("name", bot.name || '');
    setValue("phone_number", bot.phone_number || '');
    setValue("system_prompt", bot.system_prompt || '');
    setValue("temperature", bot.temperature || 0);
    setValue("twilio_phone_number", bot.twilio_phone_number || '');
    setValue("model", 'ultravox-v0.7'); // Force model to the currently allowed valid enum value
    setValue("first_speaker", bot.first_speaker || 'FIRST_SPEAKER_AGENT');
    
    // Set appointment and call transfer settings
    setValue("is_appointment_booking_allowed", bot.is_appointment_booking_allowed || false);
    setValue("appointment_tool_id", bot.appointment_tool_id || undefined);
    setValue("is_call_transfer_allowed", bot.is_call_transfer_allowed || false);
    setValue("call_transfer_number", bot.call_transfer_number || '');


    // Set selected tools, filtering out the system 'hangUp' tool from the user-facing selection
    const botSelectedTools = ((bot as any).selected_tools || []).filter((toolId: string) => toolId !== 'hangUp');
    setValue("selected_tools", botSelectedTools);
    setSelectedTools(botSelectedTools);
    setOriginalSelectedTools(botSelectedTools);
  }, [botId, bots, voices, voicesLoading, knowledgeBases, setValue]);

  const handleDuplicateBot = async () => {
    if (!botId) return;

    try {
      setIsDuplicating(true);
      const duplicatedBot = await duplicateBot(botId);

      if (duplicatedBot) {
        toast({
          title: "Bot duplicated",
          description: `Successfully created a copy: "${duplicatedBot.name}". You are now editing the duplicate.`
        });
      }
    } catch (error: any) {
      console.error('Error duplicating bot:', error);
      toast({
        title: "Error",
        description: error.message || "Failed to duplicate the bot. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsDuplicating(false);
    }
  };

  const handleToggleEnabled = async (value: boolean) => {
    if (!botId) return;

    try {
      const { error } = await supabase
        .from('bots')
        .update({ is_enabled: value })
        .eq('id', botId);

      if (error) throw error;

      // Update local state
      const currentBot = bots.find((bot) => bot.id === botId);
      if (currentBot) {
        await updateBot(botId, { ...currentBot, is_enabled: value });
      }

      toast({
        title: value ? "Bot enabled" : "Bot disabled",
        description: value
          ? "Bot is now active and can receive/make calls."
          : "Bot is disabled and cannot make or receive calls.",
      });
    } catch (error) {
      console.error('Error toggling bot:', error);
      toast({
        title: "Error",
        description: "Failed to update bot status. Please try again.",
        variant: "destructive",
      });
    }
  };

  const onSubmit = async (data: FormData) => {
    // Sync the selected tools to form state before submission
    setValue("selected_tools", selectedTools);

    setLoading(true);
    if (!botId) {
      toast({
        title: "Error",
        description: "Bot ID is missing",
        variant: "destructive",
      });
      setLoading(false);
      return;
    }

    try {
      logBotOperation("UPDATE_FORM_SUBMIT", {
        bot_id: botId,
        changes: data,
      });

      const bot = bots.find((b) => b.id === botId);

      // Step 1: Update agent via Worker API
      await agentService.updateAgent({
        id: botId,
        name: data.name,
        voice_id: data.voice,
        system_prompt: data.system_prompt,
        twilio_from_number: data.twilio_phone_number,
        model: "ultravox-v0.7",
        temperature: data.temperature,
        first_speaker: data.first_speaker,
        selected_tools: selectedTools,
        knowledge_base_id: data.knowledge_base_id || undefined,
        is_appointment_booking_allowed: data.is_appointment_booking_allowed,
        appointment_tool_id: data.appointment_tool_id,
        is_call_transfer_allowed: data.is_call_transfer_allowed,
        call_transfer_number: data.call_transfer_number,
      });

      // Prepare the update data for Supabase
      const updateData = {
        name: data.name,
        phone_number: data.phone_number || "",
        voice: data.voice,
        system_prompt: data.system_prompt,
        knowledge_base_id: data.knowledge_base_id || "",
        temperature: data.temperature || 0,
        twilio_phone_number: data.twilio_phone_number || "",
        model: "ultravox-v0.7",
        first_speaker: data.first_speaker,
        is_appointment_booking_allowed: data.is_appointment_booking_allowed,
        appointment_tool_id: data.appointment_tool_id,
        is_call_transfer_allowed: data.is_call_transfer_allowed,
        call_transfer_number: data.call_transfer_number,
        selected_tools: selectedTools,
      };

      // Also update Supabase for local consistency
      const { error: supabaseError } = await supabase
        .from("bots")
        .update(updateData)
        .eq("id", botId);

      if (supabaseError) {
        console.warn("Supabase update warning:", supabaseError);
      }

      // Update local state
      updateBot(botId, {
        ...bots.find(b => b.id === botId),
        ...updateData,
      } as Bot);

      // Update original tools after successful save
      setOriginalSelectedTools(selectedTools);

      localStorage.setItem(`SelectedTwilioPhoneNumbers_${botId}`, JSON.stringify(selectedTwilioNumber));

      toast({
        title: "Success",
        description: "Bot updated successfully",
      });

      logBotOperation("UPDATE_SUCCESS", { bot_id: botId });
    } catch (error: any) {
      console.error("Error updating bot:", error);

      logBotOperation("UPDATE_ERROR", {
        bot_id: botId,
        error: error.message,
        stack: error.stack,
      });

      toast({
        title: "Error updating bot",
        description: error.message || "Failed to update bot",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleStatusChange = useCallback(
    (status: UltravoxSessionStatus | string | undefined) => {
      if (status) {
        setAgentStatus(status);
      } else {
        setAgentStatus("off");
      }
    },
    []
  );

  const handleTranscriptChange = useCallback(
    (transcripts: Transcript[] | undefined) => {
      if (transcripts) {
        setCallTranscript([...transcripts]);
      }
    },
    []
  );

  const buildCallTools = () => {
    const isUuid = (str: string) => /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/.test(str);
    
    // Map selected tool IDs to tool objects
    let tools = selectedTools.map(toolIdentifier => {
      // If the identifier is for the selected knowledge base, transform it into a queryCorpus tool.
      if (selectedKnowledgeBase && toolIdentifier === selectedKnowledgeBase) {
        return {
            toolName: 'queryCorpus',
            parameterOverrides: {
              corpus_id: selectedKnowledgeBase,
              max_results: 20
            }
          };
      }

      // For all other identifiers, create the tool object with the correct key.
      const key = isUuid(toolIdentifier) ? 'toolId' : 'toolName';
      return { [key]: toolIdentifier };
    });

    return tools;
  };

  const initiateCall = async () => {
    setIsLoading(true);
    if (time <= 0) {
      toast({
        title: "No credits left",
        description: "Please top up your account to continue using the assistant",
        variant: "destructive",
      });
      setIsLoading(false);
      return;
    }

    if (!selectedVoice) {
      toast({
        title: "Missing Voice",
        description: "Please select a voice before starting the demo call",
        variant: "destructive",
      });
      setIsLoading(false);
      return;
    }

    if (!watch("system_prompt")) {
      toast({
        title: "Missing System Prompt",
        description: "Please enter a system prompt before starting the demo call",
        variant: "destructive",
      });
      setIsLoading(false);
      return;
    }

    setIsCallActive(true);
    setCallTranscript([]);

    const bot = bots.find((bot) => bot.id === botId);
    const selectedKB = knowledgeBases?.find(kb => kb.corpus_id === selectedKnowledgeBase);

    // Add knowledge base tool if selected
    const toolIds = [];
    let systemPrompt = watch("system_prompt");


    if (selectedKB) {
      systemPrompt = `${systemPrompt}\n\nYou have access to a knowledge base about "${selectedKB.name}". Use the queryCorpus tool to search this knowledge base when answering questions.`;
    }

    const isCallTransferEnabled = bot?.is_call_transfer_allowed;
    const transferNumber = isCallTransferEnabled ? bot?.call_transfer_number : null;

    // Use updated tools logic
    const toolsForCall = buildCallTools();

    // Add transfer tool for demo call when call transfer is enabled
    if (isCallTransferEnabled && transferNumber) {
      toolsForCall.push({ toolName: "transferCall" });
    }

    const isAppointmentEnabled = bot?.is_appointment_booking_allowed;

    // Configure knowledge base tool if selected
    const selectedTools = [{
      toolName: "hangUp"
    }];

    const callConfig: CallConfig = {
      systemPrompt: systemPrompt,
      voice: watch("voice"),
      botId: botId || "",
      tools: toolsForCall,
      temperature: watch("temperature"),
      transfer_to: transferNumber || undefined,
      model: "ultravox-v0.7", // Force ultravox-v0.7
      firstSpeaker: watch("first_speaker") || "FIRST_SPEAKER_AGENT",
      metadata: {},
    };

    console.log("callConfig before metadata === ", callConfig);

    if (isAppointmentEnabled) {
      if (!callConfig.metadata) callConfig.metadata = {};
      console.log("isAppointmentEnabled ===  started setting metadata", isAppointmentEnabled);
      if (!callConfig.metadata) {
        callConfig.metadata = {};
      }
      const appointmentToolId = bot?.appointment_tool_id || localStorage.getItem(`bookingAppointmentToolId_${botId}`);
      if (appointmentToolId) {
        console.log("appointmentToolId === ", appointmentToolId);
        callConfig.metadata.appointmentToolId = appointmentToolId;
      }
    }
    if (bot?.knowledge_base_id) {
      if (!callConfig.metadata) callConfig.metadata = {};

      console.log("bot?.knowledge_base_id === ", bot?.knowledge_base_id);

      if (!callConfig.metadata) {
        callConfig.metadata = {};
      }
      callConfig.metadata.knowledgeBaseId = bot.knowledge_base_id;
    }
    try {
      const response = await startCall(callConfig, handleStatusChange, handleTranscriptChange);
      //@ts-ignore
      if (response === "success") {
        setIsLoading(false);
        setCallStarted(true);
        toast({
          title: "Success",
          description: "Demo call started successfully",
        });
      }
    } catch (error: any) {
      setIsLoading(false);
      setIsCallActive(false);
      toast({
        title: "Error",
        description: error.message || "Failed to start demo call",
        variant: "destructive",
      });
    }
  };

  const handleCall = async () => {
    setIsLoading(true);
    if (!twilioAllowed) {
      toast({
        title: "Twilio Not Configured",
        description: "Please configure Twilio integration before making calls",
        variant: "destructive",
      });
      setIsLoading(false);
      return;
    }
    if (!selectedTwilioNumber) {
      toast({
        title: "Missing Twilio Number",
        description: "Please select a Twilio phone number to make the call",
        variant: "destructive",
      });
      setIsLoading(false);
      return;
    }
    if (!watch("phone_number")) {
      toast({
        title: "Missing Phone Number",
        description: "Please enter a phone number to call",
        variant: "destructive",
      });
      setIsLoading(false);
      return;
    }
    if (!selectedVoice) {
      toast({
        title: "Missing Voice",
        description: "Please select a voice before starting the call",
        variant: "destructive",
      });
      setIsLoading(false);
      return;
    }
    if (!watch("system_prompt")) {
      toast({
        title: "Missing System Prompt",
        description: "Please enter a system prompt before starting the call",
        variant: "destructive",
      });
      setIsLoading(false);
      return;
    }
    const bot = bots.find((bot) => bot.id === botId);
    const isCallTransferEnabled = bot?.is_call_transfer_allowed;
    // TEMPORARY: Hardcode transfer number for testing
    const transferNumber = bot?.call_transfer_number; // Replace with your actual number

    console.log("=== BOT TRANSFER SETTINGS ===");
    console.log("Bot ID:", botId);
    console.log("is_call_transfer_allowed:", bot?.is_call_transfer_allowed);
    console.log("call_transfer_number:", bot?.call_transfer_number);
    console.log("isCallTransferEnabled:", isCallTransferEnabled);
    console.log("transferNumber:", transferNumber);

    let systemPrompt = watch("system_prompt");

    const selectedKB = knowledgeBases?.find(kb => kb.corpus_id === selectedKnowledgeBase);

    const selectedTools = selectedKB
      ? [
        {
          toolName: "queryCorpus",
          parameterOverrides: {
            corpus_id: selectedKB.corpus_id,
            max_results: 5
          }
        },
        {
          toolName: "hangUp"
        }
      ]
      : [];

    if (selectedKB) {
      systemPrompt = `${systemPrompt}\n\nYou have access to a knowledge base about \"${selectedKB.name}\". Use the queryCorpus tool to search this knowledge base when answering questions.`;
    }
    // Use updated tools logic
    const toolsForCall = buildCallTools();
    const isAppointmentEnabled = bot?.is_appointment_booking_allowed;
    const callConfig: CallConfig = {
      systemPrompt: systemPrompt,
      voice: watch("voice"),
      temperature: watch("temperature"),
      medium: {
        twilio: {},
      },
      botId: botId,
      tools: toolsForCall,
      transfer_to: transferNumber || undefined,
      from_number: watch("twilio_phone_number"),
      to_number: watch("phone_number"),
      model: "ultravox-v0.7", // Force ultravox-v0.7
      metadata: {
        botId: botId || "",
      },
    };
    if (isAppointmentEnabled) {
      if (!callConfig.metadata) callConfig.metadata = {};
      callConfig.metadata.appointmentToolId = bot?.appointment_tool_id || "";
    }


    const twilioAccount: TwilioCredentials | undefined = twilioNumbers.find(
      (account) => account.phone_numbers?.find(
        (number) => number.phone_number === selectedTwilioNumber
      )
    );
    const twilioNumber: TwilioPhoneNumber | undefined = twilioAccount?.phone_numbers?.find(
      (number) => number.phone_number === selectedTwilioNumber
    );
    if (!twilioNumber || !twilioAccount) {
      toast({
        title: "Invalid Configuration",
        description: "Invalid Twilio phone number configuration",
        variant: "destructive",
      });
      setIsLoading(false);
      return;
    }
    const twilioConfig: TwilioConfig = {
      account_sid: twilioAccount?.account_sid!!,
      auth_token: twilioAccount?.auth_token!!,
      from_number: twilioNumber?.phone_number!!,
      to_number: watch("phone_number"),
    };
    try {
      await startTwilioCall(
        twilioConfig,
        callConfig,
        handleStatusChange,
        handleTranscriptChange
      );
      setIsLoading(false);
      toast({
        title: "Success",
        description: "Call initiated successfully",
      });
    } catch (error: any) {
      console.error("Error starting call:", error);
      toast({
        title: "Error",
        description: error.message || "Failed to start Twilio call",
        variant: "destructive",
      });
      setIsLoading(false);
    }
  };

  const terminateCall = async () => {
    setIsCallActive(false);
    try {
      await endCall();
    } catch (error) {
      console.error("Error ending call:", error);
    }
  };

  const handleToggleMute = () => {
    setIsMuted(!isMuted);
    toast({
      title: isMuted ? "Bot unmuted" : "Bot muted",
      description: `The bot has been ${isMuted ? "unmuted" : "muted"}.`,
    });
  };

  const flattenedPhoneNumbers = (twilioNumbers || []).reduce((acc, account) => {
    return acc.concat(
      (account.phone_numbers || []).map(number => ({
        ...number,
        accountSid: account.account_sid
      }))
    );
  }, [] as (TwilioPhoneNumber & { accountSid: string })[]);

  // Remove duplicates based on phone number
  const uniquePhoneNumbers = Array.from(
    new Map(flattenedPhoneNumbers.map(item => [item.phone_number, item])).values()
  );

  return (
    <div className="flex h-full gap-6 pb-4">
      {/* Left Panel - Bot Configuration */}
      <div className="w-1/2 space-y-6">
        <div className="bg-card p-6 rounded-lg shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold">Bot Configuration</h2>
            <div className="flex items-center gap-2">
              {botId && bots.find(b => b.id === botId) && (
                <BotToggle bot={bots.find(b => b.id === botId)!} />
              )}
              <Button
                variant="outline"
                size="sm"
                onClick={() => setIsSettingsDialogOpen(true)}
                className="flex items-center gap-2"
              >
                <Icon name="settings" className="h-4 w-4" />
                Settings
              </Button>
            </div>
          </div>
          {currentBot?.is_agent && (
            <div className="text-sm text-muted-foreground mb-4">
              Last Synced: {formatLastSynced(currentBot.last_synced_at)}
            </div>
          )}
          <form
            onSubmit={handleSubmit(onSubmit)}
            className="space-y-4"
            onKeyDown={(e) => {
              // Only prevent Enter if it's not in a textarea
              if (e.key === 'Enter' && e.target instanceof HTMLInputElement) {
                e.preventDefault();
              }
            }}
          >
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="name">Bot Name</Label>
                <Input
                  id="name"
                  {...register("name")}
                  placeholder="My Assistant"
                />
                {errors.name && (
                  <p className="text-sm text-red-500">{errors.name.message}</p>
                )}
              </div>

              <div className="flex flex-col gap-2"> {/* Added flex-col to match the input's structure */}
                <Label>Bot ID</Label> {/* Added Label for consistency */}
                <div className="flex items-center justify-between text-sm text-muted-foreground bg-muted p-2 rounded-md h-10"> {/* Added h-10 for height consistency */}
                  <div className="flex items-center gap-2">
                    <Icon name="id" className="h-4 w-4" />
                    <span className="text-xs">{botId}</span> {/* Reduced font size */} {/* Removed "Bot ID:" as Label is now above */}
                  </div>
                </div>
              </div>
            </div>



            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="phone_number">Phone Number (Optional)</Label>
                <Input
                  id="phone_number"
                  {...register("phone_number")}
                  placeholder="+1234567890"
                />
                {errors.phone_number && (
                  <p className="text-sm text-red-500">
                    {errors.phone_number.message}
                  </p>
                )}
              </div>

              <div>
                <Label htmlFor="twilio_phone_number">Twilio Phone Number</Label>
                {loadingTwilioNumbers ? (
                  <div className="text-sm text-muted-foreground">
                    Loading phone numbers...
                  </div>
                ) : twilioNumbers.length === 0 ? (
                  <div className="text-sm text-red-500">
                    Please add your Twilio integration first.
                  </div>
                ) : (
                  <Select
                    onValueChange={(value) => {
                      setValue("twilio_phone_number", value);
                    }}
                    value={watch("twilio_phone_number") || ""}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select a phone number" />
                    </SelectTrigger>
                    <SelectContent>
                      {uniquePhoneNumbers.map((number) => (
                        <SelectItem
                          key={`${number.accountSid}-${number.phone_number}`}
                          value={number.phone_number}
                        >
                          {number.friendly_name || number.phone_number}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              </div>

              <div>
                <Label htmlFor="first_speaker">First Speaker</Label>
                <Select
                  onValueChange={(value) => setValue("first_speaker", value as "FIRST_SPEAKER_AGENT" | "FIRST_SPEAKER_USER")}
                  value={watch("first_speaker")}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select a first speaker" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="FIRST_SPEAKER_AGENT">Agent</SelectItem>
                    <SelectItem value="FIRST_SPEAKER_USER">User</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label htmlFor="voice">Voice</Label>
                <Select
                  onValueChange={(value) => setValue("voice", value)}
                  value={selectedVoice}
                >
                  <SelectTrigger disabled={voicesLoading}>
                    <SelectValue placeholder={voicesLoading ? "Loading voices..." : "Select a voice"} />
                  </SelectTrigger>
                  <SelectContent>
                    {voices.map((voice) => (
                      <SelectItem key={voice.voiceId} value={voice.voiceId}>
                        {voice.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {errors.voice && (
                  <p className="text-sm text-red-500">{errors.voice.message}</p>
                )}
              </div>
            </div>

            <div className="space-y-4"> {/* Use space-y-4 for vertical rhythm within the form */}
              <div className="flex items-start justify-between gap-4">
                <div className="w-1/2 flex flex-col gap-2">
                  <Label>Knowledge Base</Label>
                  <Select
                    value={selectedKnowledgeBase || 'none'}
                    onValueChange={(value) => {
                      const kbId = value === 'none' ? null : value;
                      setSelectedKnowledgeBase(kbId);
                      setValue("knowledge_base_id", kbId || undefined);
                    }}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select a knowledge base" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">None</SelectItem>
                      {knowledgeBases?.map((kb) => (kb?.ultravox_details?.stats?.status === "CORPUS_STATUS_READY" &&
                        <SelectItem key={kb.corpus_id} value={kb.corpus_id}>
                          {kb.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <p className="text-sm text-muted-foreground">
                    {knowledgeBases?.length === 0
                      ? "No knowledge bases available."
                      : "Select a knowledge base for the bot."
                    }
                  </p>
                </div>
                <div className="w-1/2 flex flex-col gap-2">
                  <div className="flex items-center gap-2">
                    <Label>Tools</Label>
                  </div>

                  <Popover open={isToolsDropdownOpen} onOpenChange={setIsToolsDropdownOpen}>
                    <PopoverTrigger asChild>
                      <Button
                        type="button"
                        variant="outline"
                        role="combobox"
                        aria-expanded={isToolsDropdownOpen}
                        className="w-full justify-between h-10"
                        onClick={(e) => { e.preventDefault(); setIsToolsDropdownOpen(!isToolsDropdownOpen); }}
                      >
                        <div className="flex items-center gap-2">
                          <Icon name="wrench" className="h-4 w-4 text-muted-foreground" />
                          <span className="text-sm font-medium">
                            {selectedTools.length > 0 ? `${selectedTools.length} tool(s) selected` : 'Select tools'}
                          </span>
                        </div>
                        <Icon name="chevrons-up-down" className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-[--radix-popover-trigger-width] p-0">
                        <div className="p-2">
                          {toolsLoading ? (
                            <div className="p-2 text-sm text-muted-foreground text-center">Loading...</div>
                          ) : availableTools.length === 0 ? (
                            <div className="p-2 text-sm text-muted-foreground text-center">
                              No tools available.
                            </div>
                          ) : (
                            <div className="mt-1 space-y-1 max-h-48 overflow-y-auto">
                              {availableTools.map((tool) => (
                                <div
                                  key={tool.toolId}
                                  className="flex items-center px-2 py-1.5 hover:bg-accent rounded-md cursor-pointer"
                                  onClick={() => {
                                    const newSelectedTools = selectedTools.includes(tool.toolId)
                                      ? selectedTools.filter(id => id !== tool.toolId)
                                      : [...selectedTools, tool.toolId];
                                    setSelectedTools(newSelectedTools);
                                  }}
                                >
                                  <Checkbox
                                    checked={selectedTools.includes(tool.toolId)}
                                    readOnly
                                    className="mr-2"
                                  />
                                  <span className="text-sm text-foreground">
                                    {tool.name}
                                  </span>
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                    </PopoverContent>
                  </Popover>

                  <p className="text-sm text-muted-foreground">
                    Select tools this bot can use.
                  </p>
                </div>
              </div>
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label htmlFor="temperature">Temperature</Label>
                <span className="text-sm text-muted-foreground">
                  {watch("temperature") / 10}
                </span>
              </div>
              <Slider
                value={[watch("temperature")]}
                max={10}
                min={0}
                step={1}
                onValueChange={(value) => setValue("temperature", value[0])}
                className="w-full h-4"
              />
              {errors.temperature && (
                <p className="text-sm text-red-500">
                  {errors.temperature.message}
                </p>
              )}
            </div>

            <div>
              <div className="flex items-center justify-between mb-2">
                <Label htmlFor="system_prompt">System Prompt</Label>
                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    className="flex items-center gap-2"
                    onClick={(e) => { e.preventDefault(); setIsPromptDialogOpen(true) }}
                  >
                    <Icon name="expand" className="h-4 w-4" />
                    <span>Expand</span>
                  </Button>
                </div>
              </div>
              <Textarea
                id="system_prompt"
                {...register("system_prompt")}
                placeholder="Enter the system prompt..."
                className="h-40 resize-none"
              />
              {errors.system_prompt && (
                <p className="text-sm text-red-500">
                  {errors.system_prompt.message}
                </p>
              )}

              <Dialog open={isPromptDialogOpen} onOpenChange={setIsPromptDialogOpen}>
                <DialogContent className="max-w-[1200px] h-[80vh]">
                  <DialogHeader>
                    <DialogTitle>System Prompt</DialogTitle>
                  </DialogHeader>
                  <div className="flex flex-col">
                    <Textarea
                      value={watch("system_prompt")}
                      onChange={(e) => setValue("system_prompt", e.target.value)}
                      className="min-h-[70vh] text-base resize-none"
                      placeholder="Enter the system prompt..."
                    />
                  </div>
                </DialogContent>
              </Dialog>
            </div>

            <div className="flex items-center gap-2">
              <Button type="submit" disabled={loading || isSyncing}>
                {loading ? "Saving..." : "Save Changes"}
              </Button>
              {currentBot && (!currentBot.is_agent || !currentBot.last_synced_at) && (
                <Button variant="outline" onClick={handleSync} disabled={isSyncing}>
                  {isSyncing ? "Syncing..." : "Sync Agent"}
                </Button>
              )}
            </div>
          </form>
        </div>

      </div>

      {/* Right Panel - Actions & Transcripts */}
      <div className="w-1/2 space-y-6">



        {/* Appointment & Transfer Settings */}
        <div className="bg-card p-6 rounded-lg shadow-sm grid grid-cols-2 gap-6">
            <div className="space-y-4"> {/* Left Column: Appointment Booking */}
                <div className="flex items-center justify-between">
                    <div>
                        <Label>Appointment Booking</Label>
                        <p className="text-sm text-gray-500">
                        Allow the bot to book appointments.
                        </p>
                    </div>
                    <Controller
                        name="is_appointment_booking_allowed"
                        control={control}
                        render={({ field }) => (
                            <Switch
                            checked={field.value}
                            onCheckedChange={field.onChange}
                            />
                        )}
                    />
                </div>

                {isAppointmentBookingAllowed && (
                <div className="space-y-4 pt-4">
                    <div>
                    <Label>Select Appointment Tool</Label>
                    <Controller
                        name="appointment_tool_id"
                        control={control}
                        render={({ field }) => (
                            <Select
                                value={field.value}
                                onValueChange={field.onChange}
                                disabled={loading}
                            >
                                <SelectTrigger>
                                <SelectValue placeholder="Choose a tool"  />
                                </SelectTrigger>
                                <SelectContent>
                                {appointmentTools.length === 0 ? (
                                    <div className="text-sm p-2 max-w-sm text-center">
                                    No tools available.
                                    </div>
                                ) : 
                                (
                                    appointmentTools.map((tool) => (
                                    <SelectItem key={tool.id} value={tool.id}>
                                        {tool.name}
                                    </SelectItem>
                                    ))
                                )}
                                </SelectContent>
                            </Select>
                        )}
                    />
                    </div>
                </div>
                )}
            </div>
            
            <div className='space-y-4'> {/* Right Column: Call Transfer */}
                <div className="flex items-center justify-between">
                    <div>
                    <Label>Call Transfer</Label>
                    <p className="text-sm text-gray-500">
                        Enable call transfer.
                    </p>
                    </div>
                    <Controller
                        name="is_call_transfer_allowed"
                        control={control}
                        render={({ field }) => (
                            <Switch
                            checked={field.value}
                            onCheckedChange={field.onChange}
                            />
                        )}
                    />
                </div>
                
                {isCallTransferAllowed && (
                    <div className='pt-4'>
                    <Label htmlFor="call_transfer_number">Transfer Phone Number</Label>
                     <Controller
                        name="call_transfer_number"
                        control={control}
                        render={({ field }) => (
                            <Input
                                {...field}
                                id="call_transfer_number"
                                placeholder="+1234567890"
                                className="mt-1"
                            />
                        )}
                    />
                    </div>
                )}
            </div>
        </div>

        {/* Actions Section */}
        <div className="bg-card p-6 rounded-lg shadow-sm space-y-4 mt-auto">
          <h2 className="text-lg font-semibold">Actions</h2>
          <div className="flex flex-wrap gap-2">
            <Button
              className="flex-1 items-center justify-center gap-2"
              onClick={handleCall}
              disabled={isLoading || !twilioAllowed || isCallActive || !isBotEnabled}
            >
              <Icon name="phone-call" className="h-4 w-4" />
              Start Call
              {!twilioAllowed && (
                <span className="text-xs text-red-500">
                  (Twilio not configured)
                </span>
              )}
              {!isBotEnabled && (
                <span className="text-xs text-red-500">
                  (Bot inactive)
                </span>
              )}
            </Button>

            <Button
              variant={isMuted ? "destructive" : "outline"}
              className="flex-1 items-center justify-center gap-2"
              disabled={isLoading || !isBotEnabled}
              onClick={handleToggleMute}
            >
              <Icon
                name={isMuted ? "volume-mute" : "volume-up"}
                className="h-4 w-4"
              />
              {isMuted ? "Unmute" : "Mute"}
            </Button>

            <Button
              variant={isCallActive ? "destructive" : "default"}
              className="flex-1 items-center justify-center gap-2"
              onClick={isCallActive ? terminateCall : initiateCall}
              disabled={isLoading || (!isCallActive && !isBotEnabled)}
            >
              <Icon name="phone-call" className="h-4 w-4" />
              {isCallActive ? "End Call" : "Demo Call"}
            </Button>
          </div>
        </div>

        {isCallActive && (
          <>
            <VoiceBar
              agentStatus={agentStatus}
              transcripts={callTranscript}
            />
            <div
              className="bg-card p-4 rounded-lg shadow-sm flex-1"
            >
              <TranscriptView botId={botId || ""} initialTranscripts={callTranscript} />
            </div>
          </>
        )}

        <BotSettingsDialog
          isOpen={isSettingsDialogOpen}
          onOpenChange={setIsSettingsDialogOpen}
          initialSettings={{
            is_realtime_capture_enabled: bots.find((bot) => bot.id === botId)?.is_realtime_capture_enabled,
            realtime_capture_fields: bots.find((bot) => bot.id === botId)?.realtime_capture_fields,
            custom_questions: bots.find((bot) => bot.id === botId)?.custom_questions,
          }}
          onSave={async (settings) => {
            if (!botId) return;

            try {
              const { error: updateError } = await supabase
                .from("bots")
                .update({
                  is_realtime_capture_enabled: settings.is_realtime_capture_enabled,
                  realtime_capture_fields: settings.realtime_capture_fields,
                  custom_questions: settings.custom_questions,
                })
                .eq("id", botId);

              if (updateError) {
                throw updateError;
              }

              // Update local state
              const currentBot = bots.find(b => b.id === botId);
              if (currentBot) {
                updateBot(botId, {
                  ...currentBot,
                  is_realtime_capture_enabled: settings.is_realtime_capture_enabled,
                  realtime_capture_fields: settings.realtime_capture_fields,
                  custom_questions: settings.custom_questions,
                } as Bot);
              }
            } catch (error) {
              console.error('Error saving settings:', error);
              throw error;
            }
          }}
        />
      </div>
    </div>
  );
}
