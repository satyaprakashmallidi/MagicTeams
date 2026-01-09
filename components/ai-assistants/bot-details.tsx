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
import { getAllTools, createTool } from '@/components/tools/toolsService';
import InlineToolCreate from '@/components/tools/inline-tool-create';
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { useWebhooks } from '@/hooks/use-webhooks';
import { WEBHOOK_EVENTS, WebhookEvent } from '@/types/webhooks';
import { BotKnowledgeBase } from './bot-knowledge-base';



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
  call_transfer_sip_uri: z.string().optional(),
  call_transfer_type: z.enum(["coldTransfer", "warmTransfer"]).default("coldTransfer"),
  knowledge_base_usage_guide: z.string().optional(),
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

  // Collapsible states for Call Configuration tab
  const [phoneNumberOpen, setPhoneNumberOpen] = useState(true);
  const [modelOpen, setModelOpen] = useState(false);
  const [appointmentToolsOpen, setAppointmentToolsOpen] = useState(false);
  const [webhooksOpen, setWebhooksOpen] = useState(false);
  const [toolsOpen, setToolsOpen] = useState(false);

  // Inline webhook creation form state
  const [showInlineWebhookForm, setShowInlineWebhookForm] = useState(false);
  const [newWebhookUrl, setNewWebhookUrl] = useState('');
  const [newWebhookEvents, setNewWebhookEvents] = useState<string[]>([]);
  const [webhookFormErrors, setWebhookFormErrors] = useState<{ [key: string]: string }>({});

  // Inline tool creation state
  const [showInlineToolForm, setShowInlineToolForm] = useState(false);

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

  // Webhook management
  const { webhooks, isLoading: webhooksLoading, createWebhook } = useWebhooks();
  const [selectedWebhooks, setSelectedWebhooks] = useState<string[]>([]);
  const [originalSelectedWebhooks, setOriginalSelectedWebhooks] = useState<string[]>([]);
  const [isWebhooksDropdownOpen, setIsWebhooksDropdownOpen] = useState(false);

  // Close dropdown when clicking outside


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

  // Handle inline webhook creation```
  const handleCreateInlineWebhook = async () => {
    // Validate form
    const errors: { [key: string]: string } = {};

    if (!newWebhookUrl.trim()) {
      errors.url = 'URL is required';
    } else {
      try {
        new URL(newWebhookUrl);
      } catch {
        errors.url = 'Invalid URL format';
      }
    }

    if (newWebhookEvents.length === 0) {
      errors.events = 'At least one event must be selected';
    }

    setWebhookFormErrors(errors);

    if (Object.keys(errors).length > 0) {
      return;
    }

    try {
      await createWebhook({
        url: newWebhookUrl.trim(),
        events: newWebhookEvents as WebhookEvent[],
      });

      toast({
        title: "Success",
        description: "Webhook created successfully",
      });

      // Reset form
      setNewWebhookUrl('');
      setNewWebhookEvents([]);
      setWebhookFormErrors({});
      setShowInlineWebhookForm(false);
    } catch (error) {
      console.error('Error creating webhook:', error);
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to create webhook",
        variant: "destructive",
      });
    }
  };

  // Handle inline tool creation
  const handleInlineToolSave = async (tool: { name: string, definition: any }) => {
    if (!user?.id) return;

    try {
      const response = await createTool(user.id, "", {
        name: tool.name,
        definition: tool.definition
      });

      toast({
        title: "Success",
        description: "Tool created successfully",
      });

      // Auto-select the newly created tool
      if (response.tool?.toolId) {
        setSelectedTools(prev => [...prev, response.tool.toolId]);
      }

      // Refresh tools list
      await refreshTools();

      setShowInlineToolForm(false);
    } catch (error) {
      console.error('Error creating tool:', error);
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to create tool",
        variant: "destructive",
      });
    }
  };

  // Refresh tools list handler
  const refreshTools = useCallback(async () => {
    if (!user?.id) return;

    setToolsLoading(true);
    try {
      const response = await getAllTools(user.id);
      setAvailableTools(response.tools?.results || []);
    } catch (error) {
      console.error('Error fetching tools:', error);
    } finally {
      setToolsLoading(false);
    }
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
    setValue("call_transfer_sip_uri", (bot as any).call_transfer_sip_uri || '');
    setValue("call_transfer_type", bot.call_transfer_type || 'coldTransfer');
    setValue("knowledge_base_usage_guide", bot.knowledge_base_usage_guide || '');


    // Set selected tools, filtering out the system 'hangUp' tool from the user-facing selection
    const botSelectedTools = ((bot as any).selected_tools || []).filter((toolId: string) => toolId !== 'hangUp');
    setValue("selected_tools", botSelectedTools);
    setSelectedTools(botSelectedTools);
    setOriginalSelectedTools(botSelectedTools);

    // Set selected webhooks
    const botSelectedWebhooks = (bot as any).selected_webhooks || [];
    setSelectedWebhooks(botSelectedWebhooks);
    setOriginalSelectedWebhooks(botSelectedWebhooks);
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
        call_transfer_sip_uri: data.call_transfer_sip_uri,
        call_transfer_type: data.call_transfer_type,
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
        call_transfer_sip_uri: data.call_transfer_sip_uri,
        call_transfer_type: data.call_transfer_type,
        selected_tools: selectedTools,
        selected_webhooks: selectedWebhooks,
        knowledge_base_usage_guide: data.knowledge_base_usage_guide,
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
      if (!user?.id) return;
      setToolsLoading(true);
      try {
        const res = await getAllTools(user.id);
        setAvailableTools(res.tools?.results || []);
      } catch (e) {
        console.error('Error fetching tools:', e);
        toast({
          title: "Error loading tools",
          description: String(e),
          variant: "destructive"
        });
      } finally {
        setToolsLoading(false);
      }
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
      let kbPrompt = `\n\nYou have access to a knowledge base about "${selectedKB.name}". Use the queryCorpus tool to search this knowledge base when answering questions.`;
      const usageGuide = watch('knowledge_base_usage_guide');
      if (usageGuide) {
        kbPrompt += `\n\nInstructions for using the knowledge base: ${usageGuide}`;
      }
      systemPrompt = `${systemPrompt}${kbPrompt}`;
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
    <div className="h-full">
      <div className="bg-card rounded-lg shadow-sm">
        <div className="flex items-center justify-between p-6 border-b">
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
          <div className="text-sm text-muted-foreground px-6 pt-4">
            Last Synced: {formatLastSynced(currentBot.last_synced_at)}
          </div>
        )}

        <Tabs defaultValue="assistant" className="w-full">
          <TabsList className="w-full grid grid-cols-3 bg-muted h-auto p-1">
            <TabsTrigger
              value="assistant"
              className="data-[state=active]:bg-primary data-[state=active]:text-primary-foreground"
            >
              Assistant Details
            </TabsTrigger>
            <TabsTrigger
              value="configuration"
              className="data-[state=active]:bg-primary data-[state=active]:text-primary-foreground"
            >
              Call Configurations
            </TabsTrigger>
            <TabsTrigger
              value="knowledge"
              className="data-[state=active]:bg-primary data-[state=active]:text-primary-foreground"
            >
              Knowledge Base
            </TabsTrigger>
          </TabsList>

          {/* Assistant Details Tab */}
          <TabsContent value="assistant" className="p-6 space-y-6">
            <form
              onSubmit={handleSubmit(onSubmit)}
              className="space-y-4"
              onKeyDown={(e) => {
                if (e.key === 'Enter' && e.target instanceof HTMLInputElement) {
                  e.preventDefault();
                }
              }}
            >
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

              <div className="flex flex-col gap-2">
                <Label>Bot ID</Label>
                <div className="flex items-center justify-between text-sm text-muted-foreground bg-muted p-2 rounded-md">
                  <div className="flex items-center gap-2">
                    <Icon name="id" className="h-4 w-4" />
                    <span className="text-xs">{botId}</span>
                  </div>
                  <CopyButton value={botId || ""} />
                </div>
              </div>

              <div>
                <div className="flex items-center justify-between mb-2">
                  <Label htmlFor="system_prompt">System Prompt</Label>
                  <Button
                    variant="outline"
                    size="sm"
                    className="flex items-center gap-2"
                    onClick={(e) => { e.preventDefault(); setIsPromptDialogOpen(true) }}
                  >
                    <Icon name="expand" className="h-4 w-4" />
                    Expand
                  </Button>
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

              {/* Call Control Buttons */}
              <div className="pt-4 border-t">
                <div className="flex flex-wrap gap-2">
                  <Button
                    type="button"
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
                    type="button"
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
                    type="button"
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

              <div className="flex items-center gap-2">
                <Button type="submit" disabled={loading || isSyncing}>
                  {loading ? "Saving..." : "Save"}
                </Button>
                {currentBot && (!currentBot.is_agent || !currentBot.last_synced_at) && (
                  <Button variant="outline" onClick={handleSync} disabled={isSyncing}>
                    {isSyncing ? "Syncing..." : "Sync Agent"}
                  </Button>
                )}
              </div>
            </form>

            {/* Transcript View (shown when call is active) */}
            {isCallActive && (
              <div className="space-y-4 pt-4 border-t">
                <VoiceBar
                  agentStatus={agentStatus}
                  transcripts={callTranscript}
                />
                <div className="bg-card p-4 rounded-lg shadow-sm">
                  <TranscriptView botId={botId || ""} initialTranscripts={callTranscript} />
                </div>
              </div>
            )}
          </TabsContent>

          {/* Call Configuration Tab */}
          <TabsContent value="configuration" className="p-6 space-y-4">
            <form
              onSubmit={handleSubmit(onSubmit)}
              className="space-y-4"
              onKeyDown={(e) => {
                if (e.key === 'Enter' && e.target instanceof HTMLInputElement) {
                  e.preventDefault();
                }
              }}
            >
              {/* Phone Number Section */}
              <Collapsible open={phoneNumberOpen} onOpenChange={setPhoneNumberOpen}>
                <div className="border rounded-lg">
                  <CollapsibleTrigger className="flex items-center justify-between w-full p-4 hover:bg-muted/50 transition-colors">
                    <span className="font-medium">Phone Number</span>
                    <Icon
                      name={phoneNumberOpen ? "chevron-up" : "chevron-down"}
                      className="h-4 w-4"
                    />
                  </CollapsibleTrigger>
                  <CollapsibleContent>
                    <div className="p-4 pt-0 space-y-4">
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

                      <div className="grid grid-cols-2 gap-4">
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
                              <SelectValue placeholder="Select first speaker" />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="FIRST_SPEAKER_AGENT">Agent</SelectItem>
                              <SelectItem value="FIRST_SPEAKER_USER">User</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                      </div>

                      <div className="space-y-4">
                        <div className="flex items-center justify-between">
                          <div>
                            <Label>Call Transfer</Label>
                            <p className="text-sm text-muted-foreground">
                              Enable transferring calls to human agents
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
                          <div className="space-y-4">
                            {/* Transfer Type Selection - FIRST */}
                            <div>
                              <Label htmlFor="call_transfer_type">TRANSFER TYPE</Label>
                              <Controller
                                name="call_transfer_type"
                                control={control}
                                render={({ field }) => (
                                  <Select
                                    value={field.value}
                                    onValueChange={field.onChange}
                                  >
                                    <SelectTrigger className="mt-1">
                                      <SelectValue placeholder="Select transfer type" />
                                    </SelectTrigger>
                                    <SelectContent>
                                      <SelectItem value="coldTransfer">
                                        Cold Transfer (Immediate)
                                      </SelectItem>
                                      <SelectItem value="warmTransfer">
                                        Warm Transfer (With Context)
                                      </SelectItem>
                                    </SelectContent>
                                  </Select>
                                )}
                              />
                              <p className="text-sm text-muted-foreground mt-1">
                                Cold: Caller is transferred immediately. Warm: Agent briefs the human operator before connecting.
                              </p>
                            </div>

                            {/* Phone Number input - used for both Cold and Warm transfer */}
                            <div>
                              <Label htmlFor="call_transfer_number">TRANSFER PHONE NUMBER</Label>
                              <Controller
                                name="call_transfer_number"
                                control={control}
                                rules={{
                                  pattern: {
                                    value: /^\+[1-9]\d{1,14}$/,
                                    message: "Please enter a valid phone number in E.164 format (e.g., +15551234567)"
                                  }
                                }}
                                render={({ field, fieldState }) => (
                                  <>
                                    <Input
                                      {...field}
                                      id="call_transfer_number"
                                      placeholder="+15551234567"
                                      className={`mt-1 ${fieldState.error ? 'border-red-500' : ''}`}
                                    />
                                    {fieldState.error && (
                                      <p className="text-sm text-red-500 mt-1">
                                        {fieldState.error.message}
                                      </p>
                                    )}
                                  </>
                                )}
                              />
                              <p className="text-sm text-muted-foreground mt-1">
                                {watch("call_transfer_type") === "warmTransfer"
                                  ? "The human agent's phone number. They will receive a call with context before connecting."
                                  : "Enter phone number in E.164 format (include country code, e.g., +15551234567)"
                                }
                              </p>
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  </CollapsibleContent>
                </div>
              </Collapsible>

              {/* Model Section */}
              <Collapsible open={modelOpen} onOpenChange={setModelOpen}>
                <div className="border rounded-lg">
                  <CollapsibleTrigger className="flex items-center justify-between w-full p-4 hover:bg-muted/50 transition-colors">
                    <span className="font-medium">Model</span>
                    <Icon
                      name={modelOpen ? "chevron-up" : "chevron-down"}
                      className="h-4 w-4"
                    />
                  </CollapsibleTrigger>
                  <CollapsibleContent>
                    <div className="p-4 pt-0 space-y-4">
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
                          className="w-full"
                        />
                        {errors.temperature && (
                          <p className="text-sm text-red-500">
                            {errors.temperature.message}
                          </p>
                        )}
                      </div>
                    </div>
                  </CollapsibleContent>
                </div>
              </Collapsible>

              {/* Appointment Tools Section */}
              <Collapsible open={appointmentToolsOpen} onOpenChange={setAppointmentToolsOpen}>
                <div className="border rounded-lg">
                  <CollapsibleTrigger className="flex items-center justify-between w-full p-4 hover:bg-muted/50 transition-colors">
                    <span className="font-medium">Appointment Tools</span>
                    <Icon
                      name={appointmentToolsOpen ? "chevron-up" : "chevron-down"}
                      className="h-4 w-4"
                    />
                  </CollapsibleTrigger>
                  <CollapsibleContent>
                    <div className="p-4 pt-0 space-y-4">
                      <div className="flex items-center justify-between">
                        <div>
                          <Label>Appointment Settings</Label>
                          <p className="text-sm text-muted-foreground">
                            Allow the bot to book appointments
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
                        <div>
                          <Label>SELECT APPOINTMENT TOOL</Label>
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
                                  <SelectValue placeholder="Choose a tool" />
                                </SelectTrigger>
                                <SelectContent>
                                  {appointmentTools.length === 0 ? (
                                    <div className="text-sm p-2 text-center">
                                      No tools available.
                                    </div>
                                  ) : (
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
                          <div className="flex items-center gap-2 mt-2 text-sm text-muted-foreground">
                            <Icon name="calendar" className="h-4 w-4" />
                            <span>No calendar connected</span>
                          </div>
                        </div>
                      )}
                    </div>
                  </CollapsibleContent>
                </div>
              </Collapsible>

              {/* Webhooks Section */}
              <Collapsible open={webhooksOpen} onOpenChange={setWebhooksOpen}>
                <div className="border rounded-lg">
                  <CollapsibleTrigger className="flex items-center justify-between w-full p-4 hover:bg-muted/50 transition-colors">
                    <span className="font-medium">Webhooks</span>
                    <Icon
                      name={webhooksOpen ? "chevron-up" : "chevron-down"}
                      className="h-4 w-4"
                    />
                  </CollapsibleTrigger>
                  <CollapsibleContent>
                    <div className="p-4 pt-0 space-y-4">
                      <Popover open={isWebhooksDropdownOpen} onOpenChange={setIsWebhooksDropdownOpen}>
                        <PopoverTrigger asChild>
                          <Button
                            type="button"
                            variant="outline"
                            role="combobox"
                            aria-expanded={isWebhooksDropdownOpen}
                            className="w-full justify-between h-10"
                            onClick={(e) => { e.preventDefault(); setIsWebhooksDropdownOpen(!isWebhooksDropdownOpen); }}
                          >
                            <div className="flex items-center gap-2">
                              <Icon name="webhook" className="h-4 w-4 text-muted-foreground" />
                              <span className="text-sm font-medium">
                                {selectedWebhooks.length > 0 ? `${selectedWebhooks.length} webhook(s) selected` : 'Select webhooks'}
                              </span>
                            </div>
                            <Icon name="chevrons-up-down" className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                          </Button>
                        </PopoverTrigger>
                        <PopoverContent className="w-[--radix-popover-trigger-width] p-0">
                          <div className="p-2">
                            {webhooksLoading ? (
                              <div className="p-2 text-sm text-muted-foreground text-center">Loading...</div>
                            ) : webhooks.length === 0 ? (
                              <div className="p-2 text-sm text-muted-foreground text-center">
                                No webhooks available.
                              </div>
                            ) : (
                              <div className="mt-1 space-y-1 max-h-48 overflow-y-auto">
                                {webhooks.map((webhook) => (
                                  <div
                                    key={webhook.webhook_id}
                                    className="flex items-center px-2 py-1.5 hover:bg-accent rounded-md cursor-pointer"
                                    onClick={() => {
                                      const newSelectedWebhooks = selectedWebhooks.includes(webhook.webhook_id)
                                        ? selectedWebhooks.filter(id => id !== webhook.webhook_id)
                                        : [...selectedWebhooks, webhook.webhook_id];
                                      setSelectedWebhooks(newSelectedWebhooks);
                                    }}
                                  >
                                    <Checkbox
                                      checked={selectedWebhooks.includes(webhook.webhook_id)}
                                      className="mr-2"
                                    />
                                    <div className="flex-1">
                                      <span className="text-sm text-foreground truncate block">
                                        {webhook.url}
                                      </span>
                                    </div>
                                  </div>
                                ))}
                              </div>
                            )}
                          </div>
                        </PopoverContent>
                      </Popover>

                      {/* Inline Webhook Creation Form */}
                      {!showInlineWebhookForm ? (
                        <Button
                          type="button"
                          variant="outline"
                          className="w-full flex items-center gap-2"
                          onClick={(e) => {
                            e.preventDefault();
                            setShowInlineWebhookForm(true);
                          }}
                        >
                          <Icon name="plus" className="h-4 w-4" />
                          Create New Webhook
                        </Button>
                      ) : (
                        <div className="border rounded-lg p-4 space-y-4 bg-muted/30">
                          <div className="flex items-center justify-between">
                            <h4 className="font-medium text-sm">Create New Webhook</h4>
                            <Button
                              type="button"
                              variant="ghost"
                              size="sm"
                              onClick={(e) => {
                                e.preventDefault();
                                setShowInlineWebhookForm(false);
                                setNewWebhookUrl('');
                                setNewWebhookEvents([]);
                                setWebhookFormErrors({});
                              }}
                            >
                              <Icon name="x" className="h-4 w-4" />
                            </Button>
                          </div>

                          {/* URL Input */}
                          <div className="space-y-2">
                            <Label htmlFor="inline-webhook-url">Webhook URL *</Label>
                            <Input
                              id="inline-webhook-url"
                              type="url"
                              placeholder="https://your-domain.com/webhook"
                              value={newWebhookUrl}
                              onChange={(e) => setNewWebhookUrl(e.target.value)}
                              className={webhookFormErrors.url ? 'border-red-500' : ''}
                            />
                            {webhookFormErrors.url && (
                              <p className="text-sm text-red-500">{webhookFormErrors.url}</p>
                            )}
                          </div>

                          {/* Events Selection */}
                          <div className="space-y-2">
                            <Label>Webhook Events *</Label>
                            <div className="space-y-2">
                              {WEBHOOK_EVENTS.map((event) => (
                                <div key={event.value} className="flex items-start space-x-3">
                                  <Checkbox
                                    id={`inline-${event.value}`}
                                    checked={newWebhookEvents.includes(event.value)}
                                    onCheckedChange={(checked) => {
                                      if (checked) {
                                        setNewWebhookEvents([...newWebhookEvents, event.value]);
                                      } else {
                                        setNewWebhookEvents(newWebhookEvents.filter(e => e !== event.value));
                                      }
                                    }}
                                  />
                                  <div className="grid gap-1.5 leading-none">
                                    <label
                                      htmlFor={`inline-${event.value}`}
                                      className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
                                    >
                                      {event.label}
                                    </label>
                                    <p className="text-xs text-muted-foreground">
                                      {event.description}
                                    </p>
                                  </div>
                                </div>
                              ))}
                            </div>
                            {webhookFormErrors.events && (
                              <p className="text-sm text-red-500">{webhookFormErrors.events}</p>
                            )}
                          </div>

                          {/* Action Buttons */}
                          <div className="flex justify-end gap-2">
                            <Button
                              type="button"
                              variant="outline"
                              onClick={(e) => {
                                e.preventDefault();
                                setShowInlineWebhookForm(false);
                                setNewWebhookUrl('');
                                setNewWebhookEvents([]);
                                setWebhookFormErrors({});
                              }}
                            >
                              Cancel
                            </Button>
                            <Button
                              type="button"
                              onClick={(e) => {
                                e.preventDefault();
                                handleCreateInlineWebhook();
                              }}
                            >
                              Create Webhook
                            </Button>
                          </div>
                        </div>
                      )}

                      <p className="text-sm text-muted-foreground">
                        Select webhooks to receive real-time notifications for this bot.
                      </p>
                    </div>
                  </CollapsibleContent>
                </div>
              </Collapsible>



              {/* Tools Section */}
              <Collapsible open={toolsOpen} onOpenChange={setToolsOpen}>
                <div className="border rounded-lg">
                  <CollapsibleTrigger className="flex items-center justify-between w-full p-4 hover:bg-muted/50 transition-colors">
                    <span className="font-medium">Tools</span>
                    <Icon
                      name={toolsOpen ? "chevron-up" : "chevron-down"}
                      className="h-4 w-4"
                    />
                  </CollapsibleTrigger>
                  <CollapsibleContent>
                    <div className="p-4 pt-0 space-y-4">
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
                                      onCheckedChange={() => {
                                        const newSelectedTools = selectedTools.includes(tool.toolId)
                                          ? selectedTools.filter(id => id !== tool.toolId)
                                          : [...selectedTools, tool.toolId];
                                        setSelectedTools(newSelectedTools);
                                      }}
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

                      {/* Inline Tool Creation */}
                      {!showInlineToolForm ? (
                        <Button
                          type="button"
                          variant="outline"
                          className="w-full flex items-center gap-2"
                          onClick={(e) => {
                            e.preventDefault();
                            setShowInlineToolForm(true);
                          }}
                        >
                          <Icon name="plus" className="h-4 w-4" />
                          Create New Tool
                        </Button>
                      ) : (
                        <InlineToolCreate
                          onSave={handleInlineToolSave}
                          onCancel={() => setShowInlineToolForm(false)}
                        />
                      )}

                      <p className="text-sm text-muted-foreground">
                        Select tools this bot can use.
                      </p>
                    </div>
                  </CollapsibleContent>
                </div>
              </Collapsible>

              <div className="flex items-center gap-2 pt-4">
                <Button type="submit" disabled={loading || isSyncing}>
                  {loading ? "Saving..." : "Save Changes"}
                </Button>
              </div>
            </form>
          </TabsContent>

          {/* Knowledge Base Tab */}
          <TabsContent value="knowledge" className="p-6">
            {botId && (
              <BotKnowledgeBase
                botId={botId}
                botName={watch('name')}
                knowledgeBaseId={watch('knowledge_base_id')}
                onUpdateBot={(updates) => {
                  // Update form value if KB ID changes
                  if (updates.knowledge_base_id) {
                    setValue('knowledge_base_id', updates.knowledge_base_id);
                    setSelectedKnowledgeBase(updates.knowledge_base_id);
                  }

                  // Update local bot state
                  const currentBot = bots.find(b => b.id === botId);
                  if (currentBot) {
                    updateBot(botId, { ...currentBot, ...updates });
                  }
                }}
                knowledgeBaseUsageGuide={watch('knowledge_base_usage_guide')}
                onUpdateUsageGuide={(guide) => setValue('knowledge_base_usage_guide', guide)}
              />
            )}
          </TabsContent>
        </Tabs>
      </div>

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
  );
}
