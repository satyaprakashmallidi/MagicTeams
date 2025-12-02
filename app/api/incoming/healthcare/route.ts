// /api/incoming

import {  getEnvVars } from "@/lib/env/getEnvVars";
import { supabase } from "@/lib/supabase";
import { CallConfig } from "@/lib/types";
import { NextResponse } from "next/server";

export const runtime = "nodejs";

export async function POST(_request: Request) {
  try {

    const BOT_ID = "ee6e98e7-576f-41b2-b009-d51f229906be";

    const { data: bot } = await supabase.from('bots').select('*').eq('id', BOT_ID).single();

    const knowledge_base_id = bot.knowledge_base_id;

    const callConfig: CallConfig = {
        botId: BOT_ID,
        systemPrompt: bot.system_prompt,
        selectedTools: [{
            toolName: "queryCorpus",
            parameterOverrides: {
              corpus_id: knowledge_base_id,
              max_results: 20
            }
          } , {
            toolName: 'hangUp'
          }],
        voice: bot.voice,
        userId: "c99f0ac3-a143-4be9-ad80-3f59cd04d712"
    };


    console.log("trying to calll ....")

    const botId = callConfig.botId;

    const user_id = callConfig?.userId || "error-getting-user-id";
  
    callConfig.metadata = {
      "user_id" : user_id,
      "bot_id" : botId || "error-getting-bot-id"
    };

    callConfig.selectedTools = callConfig.selectedTools || [];

    
    callConfig.experimentalSettings = {
      backSeatDriver: true
    }

    callConfig.recordingEnabled = true;
    callConfig.maxDuration = "600s";


    callConfig.temperature = (callConfig.temperature || 0) / 10;

    delete callConfig.botId;
    delete callConfig.userId;

    const ultravoxResponse = await fetch(getEnvVars().NEXT_PUBLIC_BACKEND_URL_WORKER + `/api/ultravox/createcall`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(callConfig),
    });

    const ultravoxData = await ultravoxResponse.json();

    if(!ultravoxData.data.joinUrl){
      throw new Error('join url not found after request')
    }

    // console.log("response reveivedf" , ultravoxData.data);
    const twiml = `<Response><Connect><Stream url="${ultravoxData.data.joinUrl}" /></Connect></Response>`;

    console.log(twiml);

    return new NextResponse(twiml, {
      status: 200,
      headers: {
        "Content-Type": "text/xml"
      }
    });
  } catch (error) {
    console.error('Error in Ultravox API call:', error);
    return NextResponse.json(
      { error: 'Failed to process voice call' },
      { status: 500 }
    );
  }
}
