'use client';

import { useState, useEffect, useRef, useCallback } from "react";
import { useForm } from "react-hook-form";
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
import { BotAppointmentConfig } from "./bot-appointment-config";
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
import { Checkbox } from "@/components/ui/checkbox";
import { Bot, CustomQuestion, RealtimeCaptureField } from "@/types/database";
import { useUser } from "@/hooks/use-user";
import { agentService } from "@/lib/services/agent.service";
import { logBotOperation, logAgentSync } from "@/lib/utils/api-logger";



const formSchema = z.object({
  name: z.string().min(1, "Bot name is required"),
  phone_number: z.string().optional(),
  voice: z.string().min(1, "Please select a voice"),
  system_prompt: z.string().min(1, "System prompt is required"),
  knowledge_base_id: z.string().optional(),
  selected_tools: z.array(z.string()).default([]),
  temperature: z.number().min(0).max(10).default(0.7),
  twilio_phone_number: z.string().optional(),
  model: z.enum(["fixie-ai/ultravox", "fixie-ai/ultravox-gemma3-27b-preview", "fixie-ai/ultravox-llama3.3-70b", "fixie-ai/ultravox-qwen3-32b-preview" , "fixie-ai/ultravox-glm4.5-355b-preview"]).default("fixie-ai/ultravox"),
  first_speaker: z.enum(["FIRST_SPEAKER_AGENT", "FIRST_SPEAKER_USER"]).default("FIRST_SPEAKER_AGENT"),
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
  const [isSettingsDialogOpen, setIsSettingsDialogOpen] = useState(false);
  const { toast } = useToast();
  const {
    register,
    handleSubmit,
    setValue,
    watch,
    formState: { errors },
  } = useForm<FormData>({
    resolver: zodResolver(formSchema),
  });

  const { isTwilioAllowed: twilioAllowed, setCallStarted, callStarted, time } = usePricing();
  const { voices, error: voicesError, isLoading: voicesLoading, twilioInfo: twilioNumbers = [] } = useVoices();
  const { selectedBotId: botId, bots, updateBot, duplicateBot } = useBots();
  const selectedVoice = watch("voice");
  const selectedTwilioNumber = watch("twilio_phone_number");
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
    setValue("model", (bot.model as "fixie-ai/ultravox" | "fixie-ai/ultravox-gemma3-27b-preview" | "fixie-ai/ultravox-llama3.3-70b" | "fixie-ai/ultravox-glm4.5-355b-preview" | "fixie-ai/ultravox-qwen3-32b-preview") || 'fixie-ai/ultravox');
    setValue("first_speaker", bot.first_speaker || 'FIRST_SPEAKER_AGENT');


    // Set selected tools
    const botSelectedTools = (bot as any).selected_tools || [];
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

  const onSubmit = async (data: FormData) => {
    console.log("Form submitted! This should only happen when Save Changes is clicked.");
    console.log("Submit triggered by:", new Error().stack);

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

      // Prepare the update data
      const updateData = {
        name: data.name,
        phone_number: data.phone_number || "",
        voice: data.voice,
        system_prompt: data.system_prompt,
        knowledge_base_id: data.knowledge_base_id || "",
        temperature: data.temperature || 0,
        twilio_phone_number: data.twilio_phone_number || "",
        model: data.model,
        first_speaker: data.first_speaker,
      };

      // ALL BOTS NOW USE AGENT API
      logBotOperation("UPDATE_VIA_AGENT_API", { bot_id: botId });

      const bot = bots.find((b) => b.id === botId);

      // Step 1: Update agent via Worker API
      await agentService.updateAgent({
        id: botId,
        name: data.name,
        voice_id: data.voice,
        system_prompt: data.system_prompt,
        twilio_from_number: data.twilio_phone_number,
        // Additional fields
        model: data.model,
        temperature: data.temperature,
        first_speaker: data.first_speaker,
        selected_tools: selectedTools,
        knowledge_base_id: data.knowledge_base_id || undefined,
        is_appointment_booking_allowed: bot?.is_appointment_booking_allowed,
        appointment_tool_id: bot?.appointment_tool_id,
        is_call_transfer_allowed: bot?.is_call_transfer_allowed,
        call_transfer_number: bot?.call_transfer_number,
      });

      // Also update Supabase for local consistency
      const { error: supabaseError } = await supabase
        .from("bots")
        .update({
          ...updateData,
          selected_tools: selectedTools,
        })
        .eq("id", botId);

      if (supabaseError) {
        console.warn("Supabase update warning:", supabaseError);
      }

      // Update local state
      updateBot(botId, {
        ...bots.find(b => b.id === botId),
        ...updateData,
        selected_tools: selectedTools,
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
    // Map selected tool IDs to tool objects; fallback to just toolName
    let tools = selectedTools.map(toolId => {
      // If it's the KB tool, and KB is selected, add queryCorpus with overrides
      if (
        selectedKnowledgeBase &&
        knowledgeBases &&
        toolId === selectedKnowledgeBase
      ) {
        const kb = knowledgeBases.find(kb => kb.corpus_id === toolId);
        return kb
          ? {
              toolName: 'queryCorpus',
              parameterOverrides: {
                corpus_id: kb.corpus_id,
                max_results: 20
              }
            }
          : { toolName: toolId };
      }
      // Otherwise just simple toolName
      return { toolName: toolId };
    });
    // Always allow hangUp
    if (!tools.some(t => t.toolName === 'hangUp')) {
      tools.push({ toolName: 'hangUp' });
    }
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
      model: watch("model") || "fixie-ai/ultravox",
      firstSpeaker: watch("first_speaker") || "FIRST_SPEAKER_AGENT",
      metadata: {},
    };

    console.log("callConfig before metadata === ", callConfig);

    if(isAppointmentEnabled){
      if (!callConfig.metadata) callConfig.metadata = {};
      console.log("isAppointmentEnabled ===  started setting metadata", isAppointmentEnabled);
      if (!callConfig.metadata) {
        callConfig.metadata = {};
      }
      const appointmentToolId = bot?.appointment_tool_id || localStorage.getItem(`bookingAppointmentToolId_${botId}`);
      if(appointmentToolId){
        console.log("appointmentToolId === ", appointmentToolId);
        callConfig.metadata.appointmentToolId = appointmentToolId;
      }
    }
    if(bot?.knowledge_base_id){
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
      model: watch("model") || "fixie-ai/ultravox",
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

            <div className="flex items-center justify-between text-sm text-muted-foreground bg-muted p-2 rounded-md">
              <div className="flex items-center gap-2">
                <Icon name="id" className="h-4 w-4" />
                <span>Bot ID: {botId}</span>
              </div>
              <CopyButton value={botId || ''} label="Bot ID" />
            </div>

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
                <Label htmlFor="phone_number">Twilio Phone Number</Label>
                {loadingTwilioNumbers ? (
                  <div className="text-sm text-muted-foreground">
                    Loading phone numbers...
                  </div>
                ) : twilioNumbers.length === 0 ? (
                  <div className="text-sm text-red-500">
                    Please add your Twilio integration first to get available
                    phone numbers.
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

              <div>
                <Label htmlFor="model">Model</Label>
                <Select
                  onValueChange={(value: "fixie-ai/ultravox" | "fixie-ai/ultravox-gemma3-27b-preview" | "fixie-ai/ultravox-llama3.3-70b" | "fixie-ai/ultravox-glm4.5-355b-preview" | "fixie-ai/ultravox-qwen3-32b-preview") => setValue("model", value)}
                  value={watch("model")}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select a model" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="fixie-ai/ultravox">Default</SelectItem>
                    <SelectItem value="fixie-ai/ultravox-gemma3-27b-preview">Gemma3-27b-Preview</SelectItem>
                    <SelectItem value="fixie-ai/ultravox-llama3.3-70b">Llama3.3-70b</SelectItem>
                    <SelectItem value="fixie-ai/ultravox-qwen3-32b-preview">Qwen3-32b-Preview</SelectItem>
                    <SelectItem value="fixie-ai/ultravox-glm4.5-355b-preview">GLM4.5-355b-Preview</SelectItem>
                  </SelectContent>
                </Select>
              </div>
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
                className="h-32"
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
                  <div className="flex flex-col gap-4">
                    <div className="flex justify-end">
                      <Select
                        onValueChange={(value) => {
                          if (value === "healthcare") {
                            setValue("system_prompt", `# HealthCare Appointment Assistant

## About MedCare Clinic
- Specialties: General Medicine, Cardiology, Orthopedics, Pediatrics
- Location: 123 Medical Drive, Healthcare City
- Website: www.medcareclinic.example

## Your Role
- You are a friendly and professional appointment scheduler for MedCare Clinic
- Your primary responsibility is booking appointments with the right specialist
- Gather all necessary information for scheduling
- Handle emergency situations with care and urgency
- Maintain patient confidentiality

## Special Instructions
- For chest pain, shortness of breath, or stroke symptoms, direct patients to call emergency services
- Ask about insurance details but reassure patients we accept most major insurance plans
- Children under 18 must be accompanied by a guardian
- For new patients, request they arrive 15 minutes early to complete paperwork
- Inform patients about our 24-hour cancellation policy

For further assistance, direct patients to contact our main desk at (555) 123-4567.`);
                          } else if (value === "legal") {
                            setValue("system_prompt", `# Legal Consultation Scheduler

## About Smith & Associates Law Firm
- Practice Areas: Family Law, Estate Planning, Corporate Law, Real Estate Law
- Location: 456 Legal Avenue, Downtown
- Website: www.smithlawfirm.example

## Your Role
- You are the professional consultation scheduler for Smith & Associates
- Your job is to match clients with appropriate attorneys based on their legal needs
- Gather case-specific information for efficient consultations
- Maintain strict client confidentiality
- Provide basic information about our services

## Special Instructions
- Ask about the nature of legal matter to assign the right attorney
- Clarify if they have any deadlines or court dates already scheduled
- Inform new clients about required identification and documentation
- Mention our payment options and retainer requirements
- For urgent legal matters (e.g., imminent court dates), prioritize scheduling

For billing questions or urgent legal matters, please direct clients to call our office manager at (555) 987-6543.`);
                          } else if (value === "salon") {
                            setValue("system_prompt", `# Beauty Salon Appointment Assistant

## About Elegance Beauty Salon
- Services: Haircuts, Coloring, Styling, Manicures, Pedicures, Facials, Makeup
- Location: 789 Style Street, Fashion District
- Website: www.elegancebeauty.example

## Your Role
- You are the friendly appointment coordinator for Elegance Beauty Salon
- Help clients book the right services with appropriate stylists
- Provide accurate timing and pricing information
- Handle special requests with care
- Maintain a welcoming and professional demeanor

## Special Instructions
- Ask about previous experience with our salon and preferred stylists
- For color services, ask about current hair color and desired result
- Inform about cancellation policy (24-hour notice required)
- For bridal or special event bookings, recommend scheduling a consultation first
- Mention current promotions where appropriate

For product questions or after-hours emergencies, direct clients to contact our manager at (555) 765-4321.`);
                          }
                        }}
                      >
                        <SelectTrigger className="w-[240px]">
                          <SelectValue placeholder="Insert Example Prompt" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="healthcare">Healthcare Clinic</SelectItem>
                          <SelectItem value="legal">Legal Consultation</SelectItem>
                          <SelectItem value="salon">Beauty Salon</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <Textarea
                      value={watch("system_prompt")}
                      onChange={(e) => setValue("system_prompt", e.target.value)}
                      className="min-h-[60vh] text-base"
                      placeholder="Enter the system prompt..."
                    />
                  </div>
                </DialogContent>
              </Dialog>
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

            {/* Knowledge Base Selection */}
            <div className="flex items-center justify-between gap-4">
              <div className="w-1/2 flex flex-col gap-2 align-start">
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
                {
                  (knowledgeBases?.length > 0 && knowledgeBases?.find((kb) => kb?.ultravox_details?.stats?.status !== "CORPUS_STATUS_READY")) ? (
                    <p className="text-sm text-muted-foreground ">
                      We can use any knowledge base only if it's status is ready.
                    </p>
                  ) :
                    (
                      <p className="text-sm text-muted-foreground ">
                        This assistant will use the selected knowledge base to answer questions.
                      </p>
                    )
                }
                {
                  knowledgeBases?.length === 0 && (
                    <p className="text-sm text-muted-foreground ">
                      We can't find any knowledge bases for this assistant. Please create a knowledge base first.
                    </p>
                  )
                }
              </div>
              <div className="w-1/2 flex flex-col gap-2 align-start">
                <div className="flex items-center gap-2">
                  <Label>Tools</Label>
                  {JSON.stringify(selectedTools.sort()) !== JSON.stringify(originalSelectedTools.sort()) && (
                    <span className="text-xs text-orange-600 bg-orange-100 px-2 py-1 rounded-full">
                      Modified
                    </span>
                  )}
                </div>

                {/* Tools Dropdown */}
                <div
                  className="relative tools-dropdown"
                  onMouseDown={(e) => e.preventDefault()}
                  onSubmit={(e) => e.preventDefault()}
                >
                  <button
                    type="button"
                    onMouseDown={(e) => e.preventDefault()}
                    onClick={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      console.log("Dropdown button clicked, preventing form submission");
                      setIsToolsDropdownOpen(!isToolsDropdownOpen);
                    }}
                    className={`
                    inline-flex items-center gap-2 px-4 py-2.5 
                    bg-background rounded-lg border border-border
                    hover:bg-accent active:bg-accent/80
                    focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2
                    transition-all duration-200 w-full justify-between
                    ${isToolsDropdownOpen ? 'bg-accent ring-2 ring-primary' : ''}
                  `}
                  >
                    <div className="flex items-center gap-2">
                      <Icon name="wrench" className="w-4 h-4 text-muted-foreground" />
                      <span className="text-sm font-medium text-foreground">
                        {selectedTools.length > 0 ? `${selectedTools.length} tool(s) selected` : 'Select tools'}
                      </span>
                    </div>
                    <Icon
                      name={isToolsDropdownOpen ? "chevron-up" : "chevron-down"}
                      className="w-4 h-4 text-muted-foreground"
                    />
                  </button>

                  {/* Dropdown Panel */}
                  {isToolsDropdownOpen && (
                    <div
                      className="absolute left-0 mt-2 w-full bg-popover rounded-lg shadow-xl border border-border z-50"
                      onMouseDown={(e) => e.preventDefault()}
                      onSubmit={(e) => e.preventDefault()}
                    >
                      <div className="p-3">
                        <div className="flex items-center justify-between pb-2 border-b border-border">
                          <span className="text-sm font-semibold text-foreground">Available Tools</span>
                          <span className="text-xs text-muted-foreground">{selectedTools.length} selected</span>
                        </div>

                        {toolsLoading ? (
                          <div className="p-3 text-sm text-muted-foreground text-center">Loading tools...</div>
                        ) : availableTools.length === 0 ? (
                          <div className="p-3 text-sm text-muted-foreground text-center">
                            No tools available. Create tools first to use them with bots.
                          </div>
                        ) : (
                          <div className="mt-2 space-y-1 max-h-48 overflow-y-auto">
                            {availableTools.map((tool) => (
                              <div
                                key={tool.toolId}
                                className="flex items-center px-3 py-2 hover:bg-accent rounded-md cursor-pointer"
                                onMouseDown={(e) => e.preventDefault()}
                                onClick={(e) => {
                                  e.preventDefault();
                                  e.stopPropagation();
                                  console.log("Tool item clicked, preventing form submission");
                                  const newSelectedTools = selectedTools.includes(tool.toolId)
                                    ? selectedTools.filter(id => id !== tool.toolId)
                                    : [...selectedTools, tool.toolId];
                                  setSelectedTools(newSelectedTools);
                                  // Don't update form state until save is clicked
                                }}
                              >
                                <input
                                  type="checkbox"
                                  checked={selectedTools.includes(tool.toolId)}
                                  onChange={() => { }} // Handle change through parent div click
                                  onMouseDown={(e) => e.preventDefault()}
                                  className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                                />
                                <span className="ml-3 text-sm text-foreground">
                                  {tool.name}
                                </span>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                </div>

                {/* Selected Tools Display */}
                {/* {selectedTools.length > 0 && (
                <div className="mt-3">
                  <div className="text-sm font-medium text-foreground mb-2">Selected Tools:</div>
                  <div className="space-y-1 max-h-32 overflow-y-auto border rounded-md p-2">
                    {selectedTools.map((toolId) => {
                      const tool = availableTools.find(t => t.toolId === toolId);
                      return (
                        <div key={toolId} className="flex items-center justify-between bg-muted p-2 rounded text-sm">
                          <span className="text-foreground">{tool?.name || toolId}</span>
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            onClick={(e) => {
                              e.preventDefault();
                              e.stopPropagation();
                              const newSelectedTools = selectedTools.filter(id => id !== toolId);
                              setSelectedTools(newSelectedTools);
                              // Don't update form state until save is clicked
                            }}
                            className="h-6 w-6 p-0 hover:bg-muted/80"
                          >
                            <Icon name="x" className="h-3 w-3" />
                          </Button>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )} */}

                <div className="text-sm text-muted-foreground mb-2">
                  Select tools that this bot can use during calls
                </div>
              </div>
            </div>


            <Button type="submit" disabled={loading}>
              {loading ? "Saving..." : "Save Changes"}
            </Button>
          </form>
        </div>
      </div>

      {/* Right Panel - Actions & Transcripts */}
      <div className="w-1/2 space-y-6">
        {/* Appointment Configuratio */}
        {!isCallActive && <BotAppointmentConfig />}


        {/* Actions Section */}
        <div className="bg-card p-6 rounded-lg shadow-sm space-y-4 mt-auto">
          <h2 className="text-lg font-semibold">Actions</h2>
          <div className="flex flex-wrap gap-2">
            <Button
              className="flex-1 items-center justify-center gap-2"
              onClick={handleCall}
              disabled={isLoading || !twilioAllowed || isCallActive}
            >
              <Icon name="phone-call" className="h-4 w-4" />
              Start Call
              {!twilioAllowed && (
                <span className="text-xs text-red-500">
                  (Twilio not configured)
                </span>
              )}
            </Button>

            <Button
              variant={isMuted ? "destructive" : "outline"}
              className="flex-1 items-center justify-center gap-2"
              disabled={isLoading}
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
              disabled={isLoading}
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
