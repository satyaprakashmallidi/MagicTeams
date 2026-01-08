import { UltravoxSession } from "ultravox-client";
import { CallConfig, JoinUrlResponse, KnownParamEnum, ParameterLocation, SelectedTool, TwilioConfig } from "@/lib/types";
import { makeCall as twilioMakeCall } from "../actions/twilio-actions";
import { SupabaseService } from "./supabase.service";
import { parseSystemPrompt } from "../prompt-parser";
import { Bot } from "@/types/database";
import { usePricingToolsStore } from "@/store/use-pricing-store";
import { env } from "../env/getEnvVars";
import { supabase } from "../supabase";

// Update the template to remove appointment types and business hours
const getAppointmentBookingTemplate = (userSystemPrompt: string): string => {
  const currentDate = new Date();
  const formattedDate = currentDate.toLocaleDateString('en-US', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  });

  return `### Virtual Assistant Prompt — Healthcare Voice Agent for Natural Appointment Booking

### ASSISTANT ROLE AND CONTEXT
${userSystemPrompt}

You are a voice-based healthcare assistant helping users schedule appointments efficiently. Your goal is to collect accurate user information without causing frustration or being overly repetitive. Be friendly, calm, and confident in your tone — like a helpful front-desk assistant, not a robot.

### CURRENT DATE
Today's date is ${formattedDate}. Use it when interpreting relative dates like "tomorrow" or "next Monday" — but do NOT mention you're calculating it.

### PRIMARY OBJECTIVE

- Collect accurate information  
- Confirm key details once (spell-once logic)  
- Stay natural and efficient  
- Avoid tech-talk or repeating questions  
- Never irritate the user

### CONVERSATION PRINCIPLES

- Always maintain a calm, helpful, friendly tone.  
- Use short, simple sentences.  
- Be efficient — don't overtalk or confirm too often.  
- Only ask for confirmation if something is unclear or non-standard.  
- Always collect ONE piece of information at a time.  
- Do not repeat questions once user corrects or confirms.  
- Never mention technical processes like "storing," "checking," "API," etc.

### SPELL-ONCE STRATEGY (Mandatory for Voice UX)

### Call Transfer Rules (WHEN AVAILABLE):
   - Recognize situations that require human assistance:
     * Complex inquiries beyond your capabilities
     * Technical issues you cannot resolve
     * Explicit requests to speak with a human or transfer to specific number
     * Highly dissatisfied or frustrated customers

   - Transfer process (FOLLOW EXACTLY - DO NOT SKIP STEPS):
     1. Acknowledge: "I'll transfer you."
     2. ASK FOR NUMBER: "What phone number should I connect you to? Please say it slowly, digit by digit, starting with plus and the country code."
     3. LISTEN carefully as user says number digit by digit
     4. REPEAT BACK: "Let me confirm - I heard plus [repeat each digit]. Is that correct?"
     5. IF USER SAYS NO: "Let me try again. Please say the number slowly, one digit at a time."
     6. IF USER SAYS YES: "Perfect. Transferring you now." Then IMMEDIATELY call transferCall tool
     7. DO NOT say "okay" or "goodbye" without calling the tool first

   - Phone Number Collection Strategy:
     * Ask user to say "plus" then country code, then remaining digits
     * Example guidance: "Say it like: plus, nine, one, nine, eight, seven, six... one digit at a time"
     * Listen for: "plus one two zero two five five five one two three four"
     * Convert to: +12025551234
     * Common patterns:
       - India: +91 then 10 digits (e.g., +919876543210)
       - US: +1 then 10 digits (e.g., +12025551234)

   - CRITICAL - After Getting Correct Number:
     * You MUST call the transferCall tool immediately after user confirms
     * DO NOT end the call before calling transferCall
     * DO NOT say "okay" or "goodbye" without actually transferring
     * The call should ONLY end after you successfully invoke transferCall

   - NEVER:
     * End the call after getting the number without calling transferCall
     * Make up or use placeholder phone numbers
     * Skip the confirmation step
     * Say "okay" and hang up - you must actually transfer!

   - Urgency levels:
     * Low: General inquiries, non-time-sensitive issues
     * Medium: Issues requiring timely resolution but not urgent
     * High: Urgent matters requiring immediate human assistance

### Required Parameters (MUST COLLECT ALL BEFORE BOOKING)
1. First Name
2. Last Name
3. Email Address (must be confirmed)
4. Preferred Date 
5. TimeZone
6. Preferred Time
7. Appointment Type
8. Appointment Duration

Use this for First Name, Last Name, and Email.

- After collecting each of these fields, spell back once:
  - "Is that spelled A-N-J-A-L-I?" or
  - "Let me make sure: A-N-J-A-L-I at Gmail dot com. Is that correct?"

- If the user says **Yes** → Accept and immediately move to the next question. Do **not** spell again or restate it.

- If the user says **No** or corrects → Say:
  - "Thanks, could you please spell it slowly?"
  - Accept correction and continue.
  - Do not reconfirm after correction is complete.

- Do NOT:
  - Confirm it again after a "Yes"
  - Spell the same field more than once
  - Rephrase or repeat the confirmation
  - Echo the spelling again after a confirmed response


#### Email Format Validation

- Must contain '@' symbol  
- Must have characters before and after '@'  
- Must include a domain (e.g., gmail.com)

If the email is invalid:
- Say: "Hmm, that doesnot seem like a valid email. Could you please repeat or spell it for me?"
- Repeat until valid format is received

Once confirmed:
- Say: "Great! I will send a confirmation to [spelled email]."

### STATE MANAGEMENT (INTERNAL - DO NOT MENTION TO USER)

- Use session metadata to store:
  - First name
  - Last name
  - Email
  - Date and time
  - Time zone
  - Appointment type
  - Duration

- Always include callId in state updates.  
- Update state after each piece of confirmed data.  
- Do NOT mention state, metadata, or backend to the user.

### ORDER OF INFORMATION COLLECTION

1. First Name  
2. Last Name  
3. Email Address  
4. Preferred Appointment Date (Accept relative dates like "tomorrow")  
5. Preferred Time  
6. Timezone  
7. Appointment Type (e.g., consultation, follow-up)  
8. Appointment Duration (30 min, 45 min, 60 min)

Only call the bookAppointment tool after all 8 fields are collected and confirmed.

### DATE AND TIME RULES

- Interpret relative dates using today: ${formattedDate}  
- Never mention you're calculating or looking up the date  
- State final interpreted date confidently

Valid examples:
- "I can book it for Friday, April 4. Does that work?"

Invalid phrases (never use):
- "Let me check the date..."  
- "That would be..."  
- "By tomorrow, you mean..."  
- "Let me calculate that..."

### TOOL USAGE AND BOOKING RULES

- Call bookAppointment tool ONLY after all 8 required fields are collected:
  1. First Name  
  2. Last Name  
  3. Email Address (confirmed)  
  4. Preferred Date  
  5. Preferred Time  
  6. Time Zone  
  7. Appointment Type  
  8. Duration  

- Tool rules:
  - Never call before all details are gathered  
  - Never retry the booking unless new info is provided  
  - Call tool only ONCE per appointment  
  - Handle tool response silently  
  - Never say "booking tool" or expose process to user

### FINAL CONFIRMATION (Compact and Clear)

Once all fields are collected:

- Say: "Perfect! I have  scheduled your 30-minute consultation for Friday, April 4 at 2 PM IST. You will get a confirmation email at jhonsmith@gmail.com."

Do NOT:
- Spell the name or email during the final confirmation
- Repeat or reconfirm anything already confirmed
- Ask "Is that correct?" again


### ABSOLUTE NOs

❌ Ask the same question more than once
❌ Spell anything twice
❌ Mention backend processes (storing, calculating, API, etc.)
❌ Use filler phrases like "I'm checking", "Let me update"
❌ Say "Can you say that again?" more than once
❌ Spell the email at final confirmation
❌ Re-confirm previously confirmed fields
❌ Say "I'm not sure I got that email"
❌ Say "Let me store that info for you"
❌ Say "Retrying the booking..."
❌ Say "API error"
❌ Say "Let me check session data..."

### EXAMPLE IDEAL FLOW

USER: I want to book an appointment
AGENT: Sure! What is your first name?
USER: Jhon
AGENT: Is that spelled J-H-O-N?
USER: Yes
AGENT: Great. And your last name?
USER: Smith
AGENT: Is that S-M-I-T-H?
USER: Yes
AGENT: Thanks! What is your email address?
USER: jhonsmith@gmail.com
AGENT: Let me confirm: jhonsmith@gmail.com j-h-o-n-s-m-i-t-h at gmail dot com. Is that right?
USER: Yes
AGENT: When would you like to book the appointment?
USER: Tomorrow at 2 PM
AGENT: Got it. That's Friday, April 4 at 2 PM. What time zone are you in?
USER: IST
AGENT: And what type of appointment is this?
USER: Consultation
AGENT: How long would you like the consultation to be — 30, 45, or 60 minutes?
USER: 30
AGENT: Perfect! Your 30-minute consultation is scheduled for Friday, April 4 at 2 PM IST. You will get a confirmation email shortly at jhonsmith@gmail.com. Anything else I can help you with?


### Best Practices
- Collect information one at a time
- Wait for confirmation before proceeding
- Keep conversation unhurried and natural
- Confirm each detail by spelling it out very slowly and clearly
- Handle all errors silently
- Never mention technical processes
- Focus on user experience
- Maintain conversation context even if tools fail
- Validate API responses thoroughly
- Only confirm after successful validation
- Update state asynchronously without stopping conversation
- Call bookAppointment only after collecting ALL details
- Never attempt booking with incomplete information
- Calculate relative dates silently without explanation
- Present only final calculated dates to user
- Keep date confirmations natural and conversational
- Store all collected information in session metadata
- Use session metadata as source of truth for appointment details
- Always include callId in state updates
- Never proceed without email confirmation

NEVER USE THESE RESPONSES:
❌ "Let me check the current date..."
❌ "Having trouble updating state..."
❌ "Error getting current date..."
❌ "Need to store your information..."
❌ "API returned an error..."
❌ "Let me update the date..."
❌ "Let me try booking that for you..."
❌ "By tomorrow, you mean..."
❌ "When you say next week..."
❌ "Let me calculate that date..."
❌ "That would be..."
❌ Any technical or error-related messages
❌ "I didn't catch that email address..."
❌ "Could you spell that email?"
❌ "Let me update your email..."
❌ "I'll store that email..."
❌ Any mention of state updates or technical processes
❌ Asking multiple questions at once
❌ Rushing through information collection
❌ Not waiting for confirmation
❌ Explaining calculations or technical processes
❌ Not spelling out email addresses clearly
❌ Rushing through email confirmation
`;

};

export class CallService {
  private static instance: CallService;
  private ultravoxSession: UltravoxSession | null = null;
  private debugMessages: Set<string> = new Set(["debug"]);
  private supabaseService: SupabaseService;
  private callActive = usePricingToolsStore.getState().callStarted;
  private _setCallActive = usePricingToolsStore.getState().setCallStarted;
  private time = usePricingToolsStore.getState().time;
  private currentCallId: string | null = null;
  private callStartTime: number | null = null; // Track call duration

  private constructor() {
    this.supabaseService = SupabaseService.getInstance();
  }

  public static getInstance(): CallService {
    if (!CallService.instance) {
      CallService.instance = new CallService();
    }
    return CallService.instance;
  }

  public get setCallActive() {
    return this._setCallActive;
  }

  public async configureTools(callConfig: CallConfig) {
    try {
      console.log("=== CONFIGURING TOOLS FOR CALL ===");
      if (callConfig.metadata?.appointmentToolId) {
        await this.configureAppointments(callConfig);
      }
      console.log("callConfig.metadata?.knowledgeBaseId", callConfig.metadata)

      if (callConfig.metadata?.knowledgeBaseId) {
        console.log("callConfig.metadata?.knowledgeBaseId", callConfig.metadata?.knowledgeBaseId)
        await this.configureKnowledgeBase(callConfig);
      }

      console.log(`Total tools configured: ${callConfig.tools?.length || 0}`, callConfig.tools);
      console.log("=== TOOL CONFIGURATION COMPLETED ===");

      return callConfig;
    } catch (error) {
      console.error("=== TOOL CONFIGURATION ERROR ===");
      console.error("Error details:", error);
      throw error;
    }
  }

  async createCall(
    callConfig: CallConfig,
    showDebugMessages?: boolean
  ): Promise<JoinUrlResponse | { error: string }> {
    try {
      if (this.time <= 0 && !this.callActive) {
        return { error: "No credits left. Please top up." };
      }
      console.log("=== CREATE CALL STARTED ===");
      console.log("Call configuration received:", {
        voiceProvided: !!callConfig.voice,
        systemPromptLength: callConfig.systemPrompt?.length || 0,
        botId: callConfig.botId || 'not provided',
        hasTransferConfig: !!callConfig.transfer_to
      });

      const botId = callConfig.botId;
      const transferTo = callConfig.transfer_to; // Store in local variable
      let bot: Bot | null = null;

      if (transferTo) {
        console.log(`Call transfer feature enabled for number: ${transferTo}`);
      }

      // Check if bot is active
      if (botId) {
        bot = await this.supabaseService.getLatestBotData(botId);
        if (bot && bot.is_enabled === false) {
          console.warn(`[CallService] Blocked call for inactive bot: ${botId}`);
          return { error: "This agent is currently inactive. Please enable it to make calls." };
        }
      }

      // New Agent-based call logic
      if (bot && bot.is_agent && bot.ultravox_agent_id) {
        console.log(`[CallService] Using Agent-based call for bot: ${botId}`);
        console.log(`[CallService] Agent ID: ${bot.ultravox_agent_id}`);

        const agentCallConfig: Partial<AgentCallConfig> = {
          agent_id: bot.ultravox_agent_id,
          override_voice: callConfig.voice,
          to_number: callConfig.to_number,
          from_number: callConfig.from_number,
          override_variables: callConfig.placeholders,
        };

        console.log("Making API request to create agent-based call...", agentCallConfig);
        const response = await fetch(env.NEXT_PUBLIC_BACKEND_URL_WORKER + `/api/ultravox/createcall`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify(agentCallConfig),
        });

        if (!response.ok) {
          const errorText = await response.text();
          console.error("API Error Response:", {
            status: response.status,
            statusText: response.statusText,
            body: errorText.substring(0, 1000) // Truncate if too long
          });
          throw new Error(
            `HTTP error! status: ${response.status}, message: ${errorText}`
          );
        }

        const data = await response.json();
        console.log("API Response:", {
          success: true,
          callId: data.data.callId,
          joinUrlProvided: !!data.data.joinUrl
        });

        await this.supabaseService.saveToCallRecord({
          callId: data.data.callId,
          botId: botId || ""
        });

        this.saveCalltoDB({
          callId: data.data.callId,
          botId: botId || ""
        });

        console.log(`Call created successfully, ID: ${data.data.callId}`);
        console.log("=== CREATE CALL COMPLETED ===");
        return data.data;

      } else {
        console.log(`[CallService] Using legacy call creation for bot: ${botId}`);
        // Fallback to legacy call creation
        const user_id = (await this.supabaseService.getUserId()) || "error-getting-user-id";

        if (showDebugMessages) {
          console.log("user_id", user_id);
        }

        callConfig.metadata = {
          "user_id": user_id,
          "bot_id": botId || "error-getting-bot-id"
        };

        // Add transferTo to metadata if available
        if (transferTo) {
          console.log(`Adding transfer number to call metadata: ${transferTo}`);
          callConfig.metadata["transferTo"] = transferTo;
        }

        if (showDebugMessages) {
          console.log(`Using model ${callConfig.model}`);
        }
        console.log("Call configuration:", {
          modelProvided: !!callConfig.model,
          voiceProvided: !!callConfig.voice,
          metadata: callConfig.metadata,
          hasTransferTo: !!transferTo
        });

        callConfig.tools = callConfig.tools || [];

        // Wrap the user's system prompt with the appointment booking template
        if (callConfig.systemPrompt) {
          console.log("Enhancing system prompt with appointment booking template...");
          const originalLength = callConfig.systemPrompt.length;
          callConfig.systemPrompt = getAppointmentBookingTemplate(callConfig.systemPrompt);
          console.log(`System prompt enhanced (length: ${originalLength} → ${callConfig.systemPrompt.length})`);
        }

        // Always configure transfer tool (user will provide number dynamically during call)
        console.log("Configuring dynamic transfer tool...");
        await this.configureTransferTool(callConfig);
        console.log("Original system prompt:", callConfig.systemPrompt);
        // callConfig.systemPrompt = getAppointmentBookingTemplate(callConfig.systemPrompt);
        console.log("Enhanced system prompt with template applied");

        await this.configureAppointments(callConfig);
        // await this.configureKnowledgeBase(callConfig); this is not needed anymore it is coming form the froned already
        await this.configureEndCallTool(callConfig);
        // await this.configureConversationStateTool(callConfig);

        if (callConfig.tools) {
          console.log(`Total tools configured: ${callConfig.tools.length}`);
          console.log("Tool names:", callConfig.tools.map(tool =>
            tool.toolName || tool.temporaryTool?.modelToolName || 'unnamed tool'
          ));
        }

        callConfig.experimentalSettings = {
          backSeatDriver: true
        }

        callConfig.recordingEnabled = true;
        callConfig.maxDuration = "600s";

        console.log("Final call configuration prepared:", {
          recordingEnabled: callConfig.recordingEnabled,
          maxDuration: callConfig.maxDuration,
          toolsCount: callConfig.tools?.length || 0,
          transferEnabled: !!transferTo
        });

        callConfig.temperature = (callConfig.temperature || 0) / 10;

        // Remove properties not accepted by the Ultravox API
        delete callConfig.botId;
        if (transferTo) {
          console.log("Removing transferTo from API request (will only be passed in metadata)");
          delete callConfig.transfer_to; // Remove before sending to API
        }

        console.log("Making API request to create call...");
        const response = await fetch(env.NEXT_PUBLIC_BACKEND_URL_WORKER + `/api/ultravox/createcall`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify(callConfig),
        });

        if (!response.ok) {
          const errorText = await response.text();
          console.error("API Error Response:", {
            status: response.status,
            statusText: response.statusText,
            body: errorText.substring(0, 1000) // Truncate if too long
          });
          throw new Error(
            `HTTP error! status: ${response.status}, message: ${errorText}`
          );
        }

        const data = await response.json();
        console.log("API Response:", {
          success: true,
          callId: data.data.callId,
          joinUrlProvided: !!data.data.joinUrl
        });

        await this.supabaseService.saveToCallRecord({
          callId: data.data.callId,
          botId: botId || ""
        });

        this.saveCalltoDB({
          callId: data.data.callId,
          botId: botId || ""
        });

        console.log(`Call created successfully, ID: ${data.data.callId}`);
        console.log("=== CREATE CALL COMPLETED ===");
        return data.data;
      }
    } catch (error) {
      console.error("=== CREATE CALL ERROR ===");
      console.error("Error details:", error);
      if (error instanceof Error) {
        console.error("Error message:", error.message);
        console.error("Error stack:", error.stack);
      }
      throw error;
    }
  }

  async saveCalltoDB({ callId, botId }: { callId: string, botId: string }): Promise<void> {
    try {
      await this.supabaseService.insertCallData(callId, botId);
    }
    catch (error) {
      console.error("Error in saveCalltoDB:", error);
      throw error;
    }
  }

  private async configureAppointments(callConfig: CallConfig): Promise<void> {
    try {
      let bot = await this.supabaseService.getLatestBotData(callConfig.botId || "");
      if (!bot?.appointment_tool_id) {
        const { data, error } = await supabase
          .from('bots')
          .select('*')
          .eq('id', callConfig?.metadata.botId || "")
          .single();

        if (error) {
          console.error("❌ Error fetching bot:", error);
          return;
        }

        if (data) {
          bot = data;
        }
      }

      const isAppointmentsEnabled = bot?.is_appointment_booking_allowed;
      const appointmentId = bot?.appointment_tool_id;
      console.log("isAppointmentsEnabled", isAppointmentsEnabled);
      console.log("appointmentId", appointmentId);

      if (isAppointmentsEnabled && appointmentId) {
        await this.setupAppointmentTool(bot as Bot, appointmentId, callConfig);
        console.log("✅ Successfully configured appointment booking tool");
      } else {
        console.log("⚠️ Appointment booking not enabled or no appointment ID found");
      }
    } catch (error) {
      console.error("❌ Error configuring appointment tool:", error);
      // Don't throw the error - allow call to continue without appointment tool
    }
  }

  async startCall(
    callData: any,
    callbacks: {
      onStatusChange: (status: string | undefined) => void;
      onTranscriptChange: (transcript: any[] | undefined) => void;
      onDebugMessage?: (msg: any) => void;
    },
    showDebugMessages?: boolean
  ): Promise<string> {
    try {

      console.log("response", callData)

      if ('error' in callData) {
        console.error("Error in startCall:", callData.error);
        return "error";
      }

      if (!callData.joinUrl) {
        throw new Error("Join URL is required");
      }

      await this.supabaseService.saveToCallRecord({
        callId: callData.callId,
        botId: callData.botId || ""
      });

      // Store the callId immediately after successful call creation
      this.currentCallId = callData.callId;
      console.log("Stored callId:", this.currentCallId);

      // Track call start time for duration calculation
      this.callStartTime = Date.now();
      console.log("[CallService] Call started at:", new Date(this.callStartTime).toISOString());

      // Initialize the session with the callId
      this.initializeUltravoxSession(callbacks, showDebugMessages);
      this.ultravoxSession?.joinCall(callData.joinUrl);

      console.log("i have joined the call");
      return "success";
    } catch (error) {
      console.error("Error starting call:", error);
      return "error";
    }
  }
// this is for twilio call
  async startTwilioCall(
    twilioConfig: TwilioConfig,
    callConfig: CallConfig,
    callbacks: {
      onStatusChange: (status: string | undefined) => void;
      onTranscriptChange: (transcript: any[] | undefined) => void;
      onDebugMessage?: (msg: any) => void;
    },
    showDebugMessages?: boolean
  ): Promise<any> {
    try {
      // First, configure all the tools needed
      const botId = callConfig.botId;

      // Always configure dynamic transfer tool (user provides number during call)
      console.log("Configuring dynamic transfer tool for Twilio call...");
      await this.configureTransferTool(callConfig);

      await this.configureAppointments(callConfig);

      await this.configureKnowledgeBase(callConfig);

      await this.configureEndCallTool(callConfig);

      const callData = await this.createCall(callConfig);

      if ('error' in callData) {
        console.error("Error in startTwilioCall:", callData.error);
        throw new Error(`Failed to create call: ${callData.error}`);
      }

      if (!callData.joinUrl || !twilioConfig.to_number) {
        throw new Error("Join URL and Twilio number are required");
      }

      const userId = await this.supabaseService.getUserId();

      if (!userId) {
        throw new Error("User ID is required");
      }

      this.configureTools(callConfig);

      console.log("Configured tools:", callConfig.tools);

      const response = await fetch(`${env.NEXT_PUBLIC_BACKEND_URL_WORKER}/api/twilio/call`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          callConfig,
          bot_id: callConfig.botId,
          to_number: twilioConfig.to_number,
          from_number: twilioConfig.from_number,
          user_id: userId,
          placeholders: {},
          tools: callConfig.tools,
          transfer_to: callConfig.transfer_to,
          is_single_twilio_account: false,
          joinUrl: callData.joinUrl // Pass the join URL to the worker
        }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Failed to initiate Twilio call: ${errorText}`);
      }

      const result = await response.json();

      if (!result.status || result.status !== 'success') {
        throw new Error(`Failed to initiate Twilio call: ${result.message || 'Unknown error'}`);
      }

      return callData;
    } catch (error) {
      console.error("Error starting Twilio call:", error);
      throw error;
    }
  }

  endCall(): void {
    if (this.ultravoxSession) {
      this.ultravoxSession.leaveCall();
      this.ultravoxSession = null;
    }
  }

  private initializeUltravoxSession(
    callbacks: {
      onStatusChange: (status: string | undefined) => void;
      onTranscriptChange: (transcript: any[] | undefined) => void;
      onDebugMessage?: (msg: any) => void;
    },
    showDebugMessages?: boolean
  ): void {
    if (!this.currentCallId) {
      console.error("No callId available for session initialization");
      return;
    }

    this.ultravoxSession = new UltravoxSession({
      experimentalMessages: this.debugMessages,
    });

    this.setupEventListeners(callbacks, showDebugMessages);
  }


  private setupEventListeners(
    callbacks: {
      onStatusChange: (status: string | undefined) => void;
      onTranscriptChange: (transcript: any[] | undefined) => void;
      onDebugMessage?: (msg: any) => void;
    },
    showDebugMessages?: boolean
  ): void {
    console.log("trying to setup event listeners");
    if (!this.ultravoxSession) return;
    console.log("i think i set the event listeners  ");


    this.ultravoxSession.addEventListener("status", async () => {
      callbacks.onStatusChange(this.ultravoxSession?.status);
      const status = this.ultravoxSession?.status;
      if (status === "connecting") {
        this._setCallActive(true);
        // Also track start time here as backup
        if (!this.callStartTime) {
          this.callStartTime = Date.now();
          console.log("[CallService] Call connecting - tracking start time");
        }
      }
      if (status === "disconnected" || status === "disconnecting") {
        this._setCallActive(false);

        // ⭐ CRITICAL: Deduct minutes when call ends
        if (this.callStartTime) {
          const callEndTime = Date.now();
          const durationMs = callEndTime - this.callStartTime;
          const durationSeconds = Math.floor(durationMs / 1000);

          console.log("[CallService] ========================================");
          console.log("[CallService] 📞 Call Ended - Processing Minute Deduction");
          console.log("[CallService] Start Time:", new Date(this.callStartTime).toISOString());
          console.log("[CallService] End Time:", new Date(callEndTime).toISOString());
          console.log("[CallService] Duration:", durationSeconds, "seconds");
          console.log("[CallService] ========================================");

          try {
            // Call the pricing store to deduct minutes
            await usePricingToolsStore.getState().updateTimeRemaining(durationSeconds);
            console.log("[CallService] ✅ Minutes deducted successfully");
          } catch (error) {
            console.error("[CallService] ❌ Failed to deduct minutes:", error);
            // Don't throw - allow call to complete even if deduction fails
          }

          // Reset start time
          this.callStartTime = null;
        } else {
          console.warn("[CallService] ⚠️ Call ended but no start time recorded");
        }
      }
    });

    this.ultravoxSession.addEventListener("transcripts", () => {
      console.log("this.ultravoxSession?.transcripts", this.ultravoxSession?.transcripts);
      callbacks.onTranscriptChange(this.ultravoxSession?.transcripts);
    });

    this.ultravoxSession.addEventListener("experimental_message", (msg: any) => {
      if (showDebugMessages) {
        callbacks.onDebugMessage?.(msg);
      }
    });
  }

  private async setupAppointmentTool(bot: Bot, appointmentId: string, callConfig: CallConfig) {
    try {
      // This should be implemented based on your appointment tools implementation
      console.log("Setting up appointment tool...");

      const calendarAccount = await this.supabaseService.getUserCalendarAccount(bot.user_id);

      const appointmentTool = await this.supabaseService.getLastestAppointmentTool(appointmentId);

      const actualCalendarAccount = await this.supabaseService.getCalendarAccount(appointmentTool?.calendar_account_id || "");
      console.log("==========================> appointmentTool", appointmentTool);
      console.log("==========================> actualCalendarAccount", actualCalendarAccount);

      if (!actualCalendarAccount) {
        console.error("❌ Calendar account not found for appointment tool");
        return;
      }

      if (!calendarAccount) {
        console.error("❌ User calendar account not found");
        return;
      }

      if (!appointmentTool) {
        console.error("❌ Appointment tool not found");
        return;
      }

      let accessToken = actualCalendarAccount?.access_token;
      let refreshToken = actualCalendarAccount?.refresh_token;

      if (accessToken == null || refreshToken == null) {
        console.log("Using fallback calendar account tokens");
        accessToken = calendarAccount?.access_token;
        refreshToken = calendarAccount?.refresh_token;
      }

      if (!accessToken || !refreshToken) {
        console.error("❌ No access or refresh tokens found");
        return;
      }

      const systemPrompt = parseSystemPrompt(appointmentTool?.description || "", bot);

      // Get appointment types from the tool configuration
      let appointmentTypes: { name: string, duration: number }[] = [];
      try {
        if ((appointmentTool as any).appointment_types) {
          // Handle string parsing if needed (depending on how it's stored)
          if (typeof (appointmentTool as any).appointment_types === 'string') {
            appointmentTypes = JSON.parse((appointmentTool as any).appointment_types);
          } else {
            appointmentTypes = (appointmentTool as any).appointment_types;
          }
          console.log(`Found ${appointmentTypes.length} appointment types in tool configuration`);

          // Create a mapping of appointment type IDs to durations 
          const appointmentDurationMap: Record<string, number> = {};
          appointmentTypes.forEach(type => {
            const typeId = type.name.toLowerCase().replace(/\s+/g, '_');
            appointmentDurationMap[typeId] = type.duration;
          });

          console.log("Appointment type to duration mapping:", appointmentDurationMap);
        } else {
          console.warn("No appointment types found in tool configuration, using defaults");
          appointmentTypes = [
            { name: "consultation", duration: 60 },
            { name: "follow_up", duration: 30 },
            { name: "general", duration: 45 }
          ];
        }
      } catch (error) {
        console.error("Error parsing appointment types:", error);
        // Use defaults
        appointmentTypes = [
          { name: "consultation", duration: 60 },
          { name: "follow_up", duration: 30 },
          { name: "general", duration: 45 }
        ];
      }

      const bookingTool: SelectedTool = {
        temporaryTool: {
          modelToolName: "bookAppointment",
          description: systemPrompt + `The current date is ${new Date().toDateString().split('T')[0]} \n\nIMPORTANT: Our appointment types have specific default durations, but we can be flexible if needed.\n- ${appointmentTypes.map(type => `${type.name}: ${type.duration} minutes`).join('\n- ')}\n\nIf a caller specifically requests a different duration, you should accommodate their request when possible. Always confirm the appointment type AND duration with the caller before booking.\n\nCRITICAL RESPONSE VALIDATION INSTRUCTIONS:\n1. After calling bookAppointment, carefully check the response:\n   - Look for "success": true in the response\n   - Verify the response contains appointment details\n   - Check for any error messages\n   - Only proceed if the response indicates a successful booking\n\n2. For successful bookings (when response has success: true):\n   - Immediately confirm the booking to the user\n   - Share the appointment details (date, time, type)\n   - Do NOT mention any technical details or API responses\n   - Do NOT ask for additional confirmation\n   - Do NOT retry the booking\n\n3. For failed bookings:\n   - Check the specific error message\n   - Handle common errors (past date, timezone, etc.)\n   - Only retry if the error is recoverable\n   - After 2 failed attempts, suggest trying again later\n\n4. NEVER:\n   - Ignore a successful response\n   - Retry after a successful booking\n   - Show technical error messages to the user\n   - Ask for confirmation after a successful booking\n   - Mention API responses or technical details\n\n5. Example successful response handling:\n   If response is: { "success": true, "appointment": { ... } }\n   Say: "Perfect! I've booked your appointment for [date] at [time]."\n\n6. Example error handling:\n   If response has error: "Cannot book appointments in the past"\n   Say: "I'm sorry, but that date has already passed. Could you choose a future date?"\n\n7. Response Validation Steps:\n   a. Check success status first\n   b. If success is true, confirm booking immediately\n   c. If success is false, check error message\n   d. Handle error appropriately\n   e. Only retry if error is recoverable\n   f. After 2 failures, suggest trying again later\n\n8. Success Confirmation Format:\n   ✓ "Perfect! I've booked your [appointment type] for [date] at [time]."\n   ✓ "Great! Your appointment is confirmed for [date] at [time]."\n   ✓ "I've scheduled your [appointment type] for [date] at [time]."\n\n9. Error Response Format:\n   ✓ "I'm sorry, but [user-friendly error explanation]. Let me try again."\n   ✓ "I'm having trouble booking that time. Would you like to try a different time?"\n   ✓ "I'm unable to book the appointment right now. Please try again later."\n\n10. NEVER use these responses:\n    ❌ "The API returned an error..."\n    ❌ "Let me try booking that again..."\n    ❌ "The system is having issues..."\n    ❌ "There was a problem with the booking..."\n    ❌ Any technical error messages or API details`,
          dynamicParameters: [
            {
              name: "appointmentDetails",
              location: ParameterLocation.BODY,
              schema: {
                type: "object",
                properties: {
                  appointmentType: {
                    type: "string",
                    enum: appointmentTypes.map(type => type.name.toLowerCase().replace(/\s+/g, '_')),
                  },
                  preferredDate: {
                    type: "string",
                    format: "YYYY-MM-DD",
                  },
                  preferredTime: {
                    type: "string",
                    pattern: "^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$",
                  },
                  firstName: {
                    type: "string",
                  },
                  lastName: {
                    type: "string",
                  },
                  email: {
                    type: "string",
                    format: "email",
                  },
                  timezone: {
                    type: "string",
                    description: "The caller's timezone in IANA format (e.g., 'America/New_York') or common format (e.g., 'EST', 'PST')",
                  },
                  notes: {
                    type: "string",
                  },
                  appointmentDuration: {
                    type: "string",
                    description: "Duration of the appointment in minutes. Default durations by type: " + appointmentTypes.map(type => `${type.name.toLowerCase().replace(/\s+/g, '_')}: ${type.duration}`).join(', ') + ". Can be customized based on caller request.",
                  },
                },
                required: [
                  "appointmentType",
                  "preferredDate",
                  "preferredTime",
                  "firstName",
                  "lastName",
                  "email",
                  "timezone",
                  "appointmentDuration",
                ],
              },
              required: true,
            },
          ],
          http: {
            baseUrlPattern: `${env.NEXT_PUBLIC_APP_URL}/api/bookAppointment`,
            httpMethod: "POST",
          },
          staticParameters: [
            {
              name: "access_token",
              location: ParameterLocation.QUERY,
              value: accessToken || "not_found",
            },
            {
              name: "refresh_token",
              location: ParameterLocation.QUERY,
              value: refreshToken || "not_found",
            },
            {
              name: "calendar_id",
              location: ParameterLocation.QUERY,
              value: actualCalendarAccount?.id || "",
            }
          ]
        }
      };

      console.log("✅ Successfully created appointment tool configuration");
      console.log("🔧 Tool config:", JSON.stringify(bookingTool, null, 2));

      // Ensure tools array exists before pushing
      if (!callConfig.tools) {
        callConfig.tools = [];
      }

      callConfig.tools.push(bookingTool);
      console.log(`✅ Added bookAppointment tool to tools (total tools: ${callConfig.tools?.length})`);

      const rescheduleTool: SelectedTool = {
        temporaryTool: {
          modelToolName: "rescheduleAppointment",
          description: "To reschedule an existing appointment, you need to get the eventId first. Use the lookup tool to confirm them and get the eventId first, then call this tool with the eventId, new date, and new time.",
          dynamicParameters: [
            {
              name: "eventId",
              location: ParameterLocation.BODY,
              schema: { type: "string", description: "The eventId of the appointment to reschedule, obtained from the lookup endpoint." },
              required: true
            },
            {
              name: "newDate",
              location: ParameterLocation.BODY,
              schema: { type: "string", format: "YYYY-MM-DD", description: "The new date for the appointment." },
              required: true
            },
            {
              name: "newTime",
              location: ParameterLocation.BODY,
              schema: { type: "string", pattern: "^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$", description: "The new time for the appointment." },
              required: true
            },
            {
              name: "timezone",
              location: ParameterLocation.BODY,
              schema: { type: "string", description: "The timezone for the new appointment time (IANA format, e.g., 'America/New_York')." },
              required: true
            }
          ],
          http: {
            baseUrlPattern: `${env.NEXT_PUBLIC_APP_URL}/api/appointments/reschedule`,
            httpMethod: "POST"
          },
          staticParameters: [
            {
              name: "access_token",
              location: ParameterLocation.QUERY,
              value: accessToken || "not_found",
            }, {
              name: "refresh_token",
              location: ParameterLocation.QUERY,
              value: refreshToken || "not_found",
            },
            {
              name: "calendar_id",
              location: ParameterLocation.QUERY,
              value: actualCalendarAccount?.id || "",
            }
          ]
        }
      };

      const cancelTool: SelectedTool = {
        temporaryTool: {
          modelToolName: "cancelAppointment",
          description: "Cancel an existing appointment. Always ask for the user's name, email, the slot they booked (date, time, and timezone). Use the /api/appointments/lookup endpoint to get the eventId first, then call this tool with the eventId.",
          dynamicParameters: [
            {
              name: "eventId",
              location: ParameterLocation.BODY,
              schema: { type: "string", description: "The eventId of the appointment to cancel, obtained from the lookup endpoint." },
              required: true
            }
          ],
          http: {
            baseUrlPattern: `${env.NEXT_PUBLIC_APP_URL}/api/appointments/cancel`,
            httpMethod: "POST"
          },
          staticParameters: [
            {
              name: "access_token",
              location: ParameterLocation.QUERY,
              value: accessToken || "not_found",
            },
            {
              name: "refresh_token",
              location: ParameterLocation.QUERY,
              value: refreshToken || "not_found",
            },
            {
              name: "calendar_id",
              location: ParameterLocation.QUERY,
              value: actualCalendarAccount?.id || "",
            }
          ]
        }
      };

      callConfig.tools.push(rescheduleTool);
      callConfig.tools.push(cancelTool);

      const lookupTool: SelectedTool = {
        temporaryTool: {
          modelToolName: "lookupAppointment",
          description: "Look up an existing appointment in Google Calendar. Always use this tool first to confirm the user's appointment details and obtain the eventId before attempting to cancel or reschedule. Provide the user's name, email, the slot they booked (date, time, and timezone), and their Google Calendar access token. remeber the present date is " + new Date().toDateString().split('T')[0] + " and the present time is " + new Date().toLocaleTimeString(),
          dynamicParameters: [
            {
              name: "name",
              location: ParameterLocation.BODY,
              schema: { type: "string", description: "The name used to book the appointment." },
              required: true
            },
            {
              name: "email",
              location: ParameterLocation.BODY,
              schema: { type: "string", format: "email", description: "The email used to book the appointment." },
              required: true
            },
            {
              name: "date",
              location: ParameterLocation.BODY,
              schema: { type: "string", format: "YYYY-MM-DD", description: "The appointment date." },
              required: true
            },
            {
              name: "time",
              location: ParameterLocation.BODY,
              schema: { type: "string", pattern: "^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$", description: "The appointment time." },
              required: true
            },
            {
              name: "timezone",
              location: ParameterLocation.BODY,
              schema: { type: "string", description: "The timezone the appointment was booked in (IANA format, e.g., 'America/New_York')." },
              required: true
            },
          ],
          http: {
            baseUrlPattern: `${env.NEXT_PUBLIC_APP_URL}/api/appointments/lookup`,
            httpMethod: "POST"
          },
          staticParameters: [
            {
              name: "access_token",
              location: ParameterLocation.QUERY,
              value: accessToken || "not_found",
            },
            {
              name: "refresh_token",
              location: ParameterLocation.QUERY,
              value: refreshToken || "not_found",
            },
            {
              name: "calendar_id",
              location: ParameterLocation.QUERY,
              value: actualCalendarAccount?.id || "",
            }
          ]
        }
      };

      callConfig.tools.push(lookupTool);
    } catch (error) {
      console.error("❌ Error in setupAppointmentTool:", error);
    }
  }

  private async configureEndCallTool(callConfig: CallConfig) {
    const endCallTool: SelectedTool = {
      toolName: "hangUp"
    }

    callConfig.tools?.push(endCallTool);
  }

  private async configureKnowledgeBase(callConfig: CallConfig): Promise<void> {
    const bot = await this.supabaseService.getLatestBotData(callConfig.botId || "");

    if (!bot?.knowledge_base_id) {
      return;
    }

    const knowledgeBaseTool: SelectedTool = {
      toolName: "queryCorpus",
      parameterOverrides: {
        corpus_id: bot.knowledge_base_id,
        max_results: 20
      }
    };

    callConfig.tools?.push(knowledgeBaseTool);
  }

  private async configureConversationStateTool(callConfig: CallConfig) {
    try {
      console.log("Setting up conversation state tool...");

      const conversationStateTool: SelectedTool = {
        temporaryTool: {
          modelToolName: "manageConversationState",
          description: "Use this tool to store and retrieve conversation state during the call. This helps track collected information without repeating confirmations. The callId is REQUIRED for all state management operations.",
          dynamicParameters: [
            {
              name: "action",
              location: ParameterLocation.BODY,
              schema: {
                type: "string",
                enum: ["get", "update", "clear"],
                description: "The action to perform on the conversation state"
              },
              required: true
            },
            {
              name: "data",
              location: ParameterLocation.BODY,
              schema: {
                type: "object",
                properties: {
                  callId: {
                    type: "string",
                    description: "The current call ID. This is REQUIRED for all state management operations."
                  },
                  firstName: { type: "string" },
                  lastName: { type: "string" },
                  email: { type: "string" },
                  appointmentType: { type: "string" },
                  preferredDate: { type: "string" },
                  preferredTime: { type: "string" },
                  timezone: { type: "string" },
                  appointmentDuration: { type: "string" },
                  notes: { type: "string" },
                  confirmedFields: {
                    type: "array",
                    items: { type: "string" }
                  },
                  currentDate: { type: "string" }
                },
                required: ["callId"] // Make callId required
              }
            }
          ],
          http: {
            baseUrlPattern: `${env.NEXT_PUBLIC_APP_URL}/api/manageConversationState`,
            httpMethod: "POST"
          }
        }
      };

      console.log("✅ Successfully created conversation state tool configuration");
      callConfig.tools?.push(conversationStateTool);
      console.log(`✅ Added manageConversationState tool to tools (total tools: ${callConfig.tools?.length})`);
    } catch (error) {
      console.error("❌ Error in configureConversationStateTool:", error);
    }
  }

  private async configureTransferTool(config: CallConfig) {
    try {
      console.log("=== CONFIGURING DYNAMIC CALL TRANSFER TOOL ===");
      console.log(`Bot ID: ${config.metadata?.bot_id || 'unknown'}`);
      console.log(`Voice ID: ${config.voice}`);

      console.log("Creating dynamic transfer tool configuration...");
      const transferTool: SelectedTool = {
        temporaryTool: {
          modelToolName: "transferCall",
          description: `Transfer the call to a phone number that the USER provides during the conversation.

CRITICAL - YOU MUST FOLLOW THIS EXACT PROCESS:
Step 1: When user requests transfer, respond: "I'll transfer you. What phone number should I connect you to? Please include the country code, like +1 for US or +91 for India."
Step 2: WAIT for user to verbally provide their phone number
Step 3: Repeat back the number to confirm: "I'll transfer you to +[number]. Is that correct?"
Step 4: WAIT for user confirmation
Step 5: ONLY THEN call this transferCall tool with the exact number user provided

NEVER:
- Make up or invent a phone number
- Use placeholder numbers like +11234567890
- Call this tool before getting the number from the user
- Skip asking the user for the number

The transferToNumber parameter MUST be the exact number the user verbally told you during THIS conversation.`,
          dynamicParameters: [
            {
              name: "transferToNumber",
              location: ParameterLocation.BODY,
              schema: {
                type: "string",
                description: "The exact phone number the user verbally provided during the conversation. Format: +[country code][number]. Example: +919876543210 (India) or +12025551234 (US). DO NOT use placeholder numbers. DO NOT invent numbers. ONLY use the number the user actually said to you in this call."
              },
              required: true
            },
            {
              name: "transferReason",
              location: ParameterLocation.BODY,
              schema: {
                type: "string",
                description: "The reason why the call is being transferred"
              },
              required: true
            },
            {
              name: "urgencyLevel",
              location: ParameterLocation.BODY,
              schema: {
                type: "string",
                enum: ["low", "medium", "high"],
                description: "The urgency level of the transfer"
              },
              required: true
            }
          ],
          automaticParameters: [
            {
              name: "call_id",
              location: ParameterLocation.QUERY,
              knownValue: KnownParamEnum.CALL_ID
            }
          ],
          http: {
            baseUrlPattern: `${env.NEXT_PUBLIC_BACKEND_URL_WORKER}/api/twilio/transfer-call`,
            httpMethod: "POST"
          }
        }
      };

      if (!config.tools) {
        config.tools = [];
      }

      config.tools.push(transferTool);

      // Log the final tool configuration
      console.log("Dynamic transfer tool configuration created successfully");
      console.log("Transfer API endpoint:", `${env.NEXT_PUBLIC_BACKEND_URL_WORKER}/api/twilio/transfer-call`);
      console.log("Transfer will use phone number provided by user during call");
      console.log("Dynamic parameters:", ["transferToNumber", "transferReason", "urgencyLevel"]);
      console.log(`Total tools configured: ${config.tools?.length || 0}`);
      console.log("=== DYNAMIC TRANSFER TOOL CONFIGURATION COMPLETED ===");
    } catch (error) {
      console.error("=== TRANSFER TOOL CONFIGURATION ERROR ===");
      console.error("Error details:", error);
      if (error instanceof Error) {
        console.error("Error message:", error.message);
        console.error("Error stack:", error.stack);
      }
    }
  }
}
