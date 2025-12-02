import { CallConfig, JoinUrlResponse, TwilioConfig } from "@/lib/types";
import { CallService } from "./services/call.service";
import { SupabaseService } from "./services/supabase.service";
import { env } from "./env/getEnvVars";
import { UltravoxSession } from "ultravox-client";
import { logAPICall, logCallOperation } from "./utils/api-logger";

let ultravoxSession: UltravoxSession | null = null;
const debugMessages: Set<string> = new Set(["debug"]);

export async function startCall(
  callConfig: CallConfig,
  statusCallback: (status: string | undefined) => void,
  transcriptCallback: (transcript: any[] | undefined) => void,
  showDebugMessages?: boolean
) {
  try {
    logCallOperation("DEMO", "INITIATE", {
      botId: callConfig.botId,
      voice: callConfig.voice,
      model: callConfig.model,
    });

    const userId = await SupabaseService.getInstance().getUserId();
    if (!userId) {
      throw new Error("User not authenticated");
    }

    callConfig.systemPrompt = "The present date is " + new Date().toDateString().split('T')[0] + " and the present time is " + new Date().toLocaleTimeString() + ". " + callConfig.systemPrompt;

    // Check if bot is enabled
    if (callConfig.botId) {
      const bot = await SupabaseService.getInstance().getBotData(callConfig.botId);
      if (bot && bot.is_enabled === false) {
        throw new Error("This agent is currently inactive. Please enable it to make calls.");
      }
    }

    // Check if bot is enabled
    if (callConfig.botId) {
      const bot = await SupabaseService.getInstance().getBotData(callConfig.botId);
      if (bot && bot.is_enabled === false) {
        throw new Error("This agent is currently inactive. Please enable it to make calls.");
      }
    }

    // Configure all necessary tools first
    const callService = CallService.getInstance();

    // Use the public method to configure all tools
    await callService.configureTools(callConfig);

    const hangUpTool = callConfig.tools?.find((tool) => tool.toolName === "hangUp");
    if (!hangUpTool) {
      callConfig.tools?.push({
        toolName: "hangUp"
      });
    }

    const requestBody = {
      systemPrompt: callConfig.systemPrompt,
      voice: callConfig.voice,
      selectedTools: callConfig.tools,
      temperature: (callConfig.temperature || 0) / 10,
      recordingEnabled: true,
      maxDuration: "600s",
      firstSpeaker: callConfig.firstSpeaker,
      metadata: {
        botId: callConfig.botId,
        userId: userId,
        transfer_to: callConfig.transfer_to,
        from_number: callConfig.from_number,
        to_number: callConfig.to_number,
        ...callConfig.metadata
      },
      model: callConfig.model
    };

    logAPICall({
      method: "POST",
      endpoint: `${env.NEXT_PUBLIC_BACKEND_URL_WORKER}/api/ultravox/createcall`,
      body: requestBody,
      context: "DEMO_CALL_CREATE",
    });

    // First, create an Ultravox call directly without using Next.js route
    const response = await fetch(`${env.NEXT_PUBLIC_BACKEND_URL_WORKER}/api/ultravox/createcall`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(requestBody),
    });

    if (!response.ok) {
      const errorText = await response.text();
      logAPICall({
        method: "POST",
        endpoint: `${env.NEXT_PUBLIC_BACKEND_URL_WORKER}/api/ultravox/createcall`,
        error: new Error(`Failed to create call: ${errorText}`),
        context: "DEMO_CALL_CREATE",
      });
      throw new Error(`Failed to create call: ${errorText}`);
    }

    const data = await response.json();

    logAPICall({
      method: "POST",
      endpoint: `${env.NEXT_PUBLIC_BACKEND_URL_WORKER}/api/ultravox/createcall`,
      response: data,
      context: "DEMO_CALL_CREATE",
    });
    const callData = data.data as JoinUrlResponse;

    // if (!callData.joinUrl) {
    //   throw new Error("Join URL is required");
    // }


    callData.botId = callConfig.botId || callConfig?.metadata?.botId;


    CallService.getInstance().startCall(callData, {
      onStatusChange: statusCallback,
      onTranscriptChange: transcriptCallback
    }, showDebugMessages);

    return "success";

    // Initialize Ultravox session
    ultravoxSession = new UltravoxSession({
      experimentalMessages: debugMessages,
    });

    // Set up event listeners
    ultravoxSession.addEventListener("status", () => {
      statusCallback(ultravoxSession?.status);
      const status = ultravoxSession?.status;

      // Update call status in the store
      const setCallActive = CallService.getInstance().setCallActive;
      if (status === "connecting") {
        setCallActive(true);
      }
      if (status === "disconnected" || status === "disconnecting") {
        setCallActive(false);
      }
    });

    ultravoxSession.addEventListener("transcripts", () => {
      transcriptCallback(ultravoxSession?.transcripts);
    });

    if (showDebugMessages) {
      ultravoxSession.addEventListener("experimental_message", (msg: any) => {
        console.log("Debug message:", msg);
      });
    }

    // Join the call
    ultravoxSession.joinCall(callData.joinUrl);

    // Save call to database
    await SupabaseService.getInstance().insertCallData(callData.callId, callConfig.botId || "");

    return "success";
  } catch (error) {
    console.error("Error starting call:", error);
    return "error";
  }
}

export async function startTwilioCall(
  twilioConfig: TwilioConfig,
  callConfig: CallConfig,
  statusCallback: (status: string | undefined) => void,
  transcriptCallback: (transcript: any[] | undefined) => void,
  showDebugMessages?: boolean
) {
  try {
    logCallOperation("TWILIO", "INITIATE", {
      botId: callConfig.botId,
      to_number: twilioConfig.to_number,
      from_number: twilioConfig.from_number,
    });

    // Get user ID
    const userId = await SupabaseService.getInstance().getUserId();
    if (!userId) {
      throw new Error("User not authenticated");
    }

    callConfig.systemPrompt = "The present date is " + new Date().toDateString().split('T')[0] + " and the present time is " + new Date().toLocaleTimeString() + ". " + callConfig.systemPrompt;

    // Check if bot is enabled
    if (callConfig.botId) {
      const bot = await SupabaseService.getInstance().getBotData(callConfig.botId);
      if (bot && bot.is_enabled === false) {
        throw new Error("This agent is currently inactive. Please enable it to make calls.");
      }
    }


    if (!callConfig.metadata) {
      callConfig.metadata = {};
    }

    callConfig.metadata.userId = userId;
    callConfig.metadata.botId = callConfig.botId || "";

    // Configure all necessary tools first
    const callService = CallService.getInstance();

    // Use the public method to configure all tools
    await callService.configureTools(callConfig);

    console.log("Configured tools for Twilio call:", callConfig.tools);

    //searchFor hangUp tool in callConfig.tools
    const hangUpTool = callConfig.tools?.find((tool) => tool.toolName === "hangUp");
    if (!hangUpTool) {
      callConfig.tools?.push({
        toolName: "hangUp"
      });
    }

    console.log("=== FRONTEND: Preparing to call backend ===");
    console.log("callConfig.transfer_to:", callConfig.transfer_to);
    console.log("callConfig.botId:", callConfig.botId);
    console.log("twilioConfig.to_number:", twilioConfig.to_number);
    console.log("twilioConfig.from_number:", twilioConfig.from_number);

    const requestBody = {
      callConfig: {
        systemPrompt: callConfig.systemPrompt,
        voice: callConfig.voice,
        recordingEnabled: true,
        maxDuration: "600s",
        temperature: (callConfig.temperature || 0) / 10,
        metadata: callConfig.metadata,
        model: callConfig.model
      },
      bot_id: callConfig.botId || "",
      to_number: twilioConfig.to_number,
      from_number: twilioConfig.from_number,
      user_id: userId,
      placeholders: callConfig.placeholders,
      tools: callConfig.tools || [],
      transfer_to: callConfig.transfer_to
    };

    console.log("Request body transfer_to:", requestBody.transfer_to);
    console.log("Full request body:", JSON.stringify(requestBody, null, 2));

    logAPICall({
      method: "POST",
      endpoint: `${env.NEXT_PUBLIC_BACKEND_URL_WORKER}/api/twilio/call`,
      body: requestBody,
      context: "TWILIO_CALL_CREATE",
    });

    // First create the Ultravox call to get joinUrl
    const createResponse = await fetch(`${env.NEXT_PUBLIC_BACKEND_URL_WORKER}/api/twilio/call`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(requestBody),
    });

    if (!createResponse.ok) {
      const errorText = await createResponse.text();
      logAPICall({
        method: "POST",
        endpoint: `${env.NEXT_PUBLIC_BACKEND_URL_WORKER}/api/twilio/call`,
        error: new Error(`Failed to create call: ${errorText}`),
        context: "TWILIO_CALL_CREATE",
      });
      throw new Error(`Failed to create call: ${errorText}`);
    }

    const responseData = await createResponse.json();
    logAPICall({
      method: "POST",
      endpoint: `${env.NEXT_PUBLIC_BACKEND_URL_WORKER}/api/twilio/call`,
      response: responseData,
      context: "TWILIO_CALL_CREATE",
    });

    // if (!callData.joinUrl) {
    //   throw new Error("Join URL is required");
    // }

    // Call the Jenny Turbo Workers API
    // const response = await fetch(`${env.NEXT_PUBLIC_BACKEND_URL_WORKER}/api/twilio/call`, {
    //   method: "POST",
    //   headers: {
    //     "Content-Type": "application/json",
    //   },
    //   body: JSON.stringify({
    //     callConfig,
    //     bot_id: callConfig.botId,
    //     to_number: twilioConfig.to_number,
    //     from_number: twilioConfig.from_number,
    //     user_id: userId,
    //     placeholders: {},
    //     // Send the complete tool object structures, not just IDs
    //     tools: callConfig.tools || [],
    //     transfer_to: callConfig.transfer_to,
    //     is_single_twilio_account: false,
    //     joinUrl: callData.joinUrl
    //   }),
    // });

    // if (!response.ok) {
    //   const errorText = await response.text();
    //   throw new Error(`Failed to initiate Twilio call: ${errorText}`);
    // }

    if (responseData.status !== 'success') {
      throw new Error(responseData.message || "Unknown error occurred");
    }

    return { ...responseData.data, callId: responseData.data.callId };
  } catch (error) {
    console.error("Error starting Twilio call:", error);
    throw error;
  }
}


export async function startTwilioCallQueue(
  twilioConfig: TwilioConfig,
  callConfig: CallConfig,
  statusCallback: (status: string | undefined) => void,
  transcriptCallback: (transcript: any[] | undefined) => void,
  showDebugMessages?: boolean
) {
  try {
    // Get user ID
    const userId = await SupabaseService.getInstance().getUserId();
    if (!userId) {
      throw new Error("User not authenticated");
    }

    callConfig.systemPrompt = "The present date is " + new Date().toDateString().split('T')[0] + " and the present time is " + new Date().toLocaleTimeString() + ". " + callConfig.systemPrompt;

    // Check if bot is enabled
    if (callConfig.botId) {
      const bot = await SupabaseService.getInstance().getBotData(callConfig.botId);
      if (bot && bot.is_enabled === false) {
        throw new Error("This agent is currently inactive. Please enable it to make calls.");
      }
    }


    if (!callConfig.metadata) {
      callConfig.metadata = {};
    }

    callConfig.metadata.userId = userId;
    callConfig.metadata.botId = callConfig.botId || "";

    // Configure all necessary tools first
    const callService = CallService.getInstance();

    // Use the public method to configure all tools
    await callService.configureTools(callConfig);

    console.log("Configured tools for Twilio call:", callConfig.tools);

    //searchFor hangUp tool in callConfig.tools
    const hangUpTool = callConfig.tools?.find((tool) => tool.toolName === "hangUp");
    if (!hangUpTool) {
      callConfig.tools?.push({
        toolName: "hangUp"
      });
    }

    // First create the Ultravox call to get joinUrl
    const createResponse = await fetch(`${env.NEXT_PUBLIC_BACKEND_URL_WORKER}/api/queued-calls/queue-call`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        callConfig: {
          systemPrompt: callConfig.systemPrompt,
          voice: callConfig.voice,
          recordingEnabled: true,
          maxDuration: "600s",
          temperature: (callConfig.temperature || 0) / 10,
          metadata: callConfig.metadata,
          model: callConfig.model
        },
        bot_id: callConfig.botId || "",
        to_number: twilioConfig.to_number,
        from_number: twilioConfig.from_number,
        user_id: userId,
        placeholders: callConfig.placeholders,
        tools: callConfig.tools || [],
        transfer_to: callConfig.transfer_to
      }),
    });

    if (!createResponse.ok) {
      const errorText = await createResponse.text();
      throw new Error(`Failed to create call: ${errorText}`);
    }

    // if (!callData.joinUrl) {
    //   throw new Error("Join URL is required");
    // }

    // Call the Jenny Turbo Workers API
    // const response = await fetch(`${env.NEXT_PUBLIC_BACKEND_URL_WORKER}/api/twilio/call`, {
    //   method: "POST",
    //   headers: {
    //     "Content-Type": "application/json",
    //   },
    //   body: JSON.stringify({
    //     callConfig,
    //     bot_id: callConfig.botId,
    //     to_number: twilioConfig.to_number,
    //     from_number: twilioConfig.from_number,
    //     user_id: userId,
    //     placeholders: {},
    //     // Send the complete tool object structures, not just IDs
    //     tools: callConfig.tools || [],
    //     transfer_to: callConfig.transfer_to,
    //     is_single_twilio_account: false,
    //     joinUrl: callData.joinUrl
    //   }),
    // });

    // if (!response.ok) {
    //   const errorText = await response.text();
    //   throw new Error(`Failed to initiate Twilio call: ${errorText}`);
    // }

    const result = await createResponse.json();

    if (result.status !== 'success') {
      throw new Error(result.message || "Unknown error occurred");
    }

    return { ...result.data, callId: result.job_id };
  } catch (error) {
    console.error("Error starting Twilio call:", error);
    throw error;
  }
}

export async function startBulkCalls(twilioPhoneNumber: string, botId: string, toPhoneNumber: string, placeholders: Record<string, string>) {
  // const bots = useBotStore((state) => state.bots);
  // const twilioNumbers = useVoiceStore((state) => state.twilioInfo);

  const bot = await SupabaseService.getInstance().getBotData(botId);
  const twilioAccount = await SupabaseService.getInstance().getTwilioConfigFromPhoneNumber(twilioPhoneNumber);

  //todo: fix for dynamic pattern.,
  const formattedPlaceholders = {
    ...placeholders,
    left_delimeter: "<<<",
    right_delimeter: ">>>"
  };

  const parsedSystemPrompt = bot?.system_prompt?.replace(/<<<([^>]+)>>>/g, (_, p1) => placeholders[p1] || p1);


  const callConfig: CallConfig = {
    voice: bot?.voice,
    systemPrompt: parsedSystemPrompt || "",
    medium: {
      twilio: {},
    },
    botId: botId,
    placeholders: formattedPlaceholders
  };

  const from_number = twilioAccount?.phone_numbers?.find((number) => number.phone_number === twilioPhoneNumber)?.phone_number || "";
  const to_number = toPhoneNumber;
  const account_sid = twilioAccount?.account_sid || "";
  const auth_token = twilioAccount?.auth_token || "";

  if (!from_number || !to_number || !account_sid || !auth_token) {
    throw new Error("Missing required parameters");
  }

  const twilioConfig: TwilioConfig = {
    from_number: from_number,
    to_number: to_number,
    account_sid: account_sid,
    auth_token: auth_token,
  };

  const result = await startTwilioCallQueue(twilioConfig, callConfig, () => { }, () => { }, false);

  return result;

}

export interface CallSummaryResponse {
  notes: string;
  status: string;
}

export const fetchCallSummary = async (callId: string): Promise<CallSummaryResponse> => {
  const response = await fetch(env.NEXT_PUBLIC_BACKEND_URL_WORKER + `/api/queued-calls/queue-call-status?job_id=${callId}`, {
    method: 'GET',
    headers: {
      'Content-Type': 'application/json',
    },
  });

  if (!response.ok) {
    throw new Error('Failed to fetch call summary');
  }

  const data = await response.json();

  console.log("data", data)

  return data.data.summary;
};

export async function endCall() {
  CallService.getInstance().endCall();
}