// /api/incoming

import { env } from "@/lib/env/getEnvVars";
import { NextResponse } from "next/server";

export const runtime = "nodejs";

export async function POST(_request: Request) {
  try {
    const response = await fetch("https://api.ultravox.ai/api/calls", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-API-Key": env.ULTRAVOX_API_KEY || "",
      },
      body: JSON.stringify({
        systemPrompt: `Hey you are lisa, representative of Atlas Dentic, 
        you are a helpful assistant and solves doubts of all people. Atlas Dentic specializes in managing the entire patient acquisition process for clinics like yours.
        We know that targeting the right patients is crucial for a clinic's success, which is why we focus on creating, managing, and optimizing high-performing ad campaigns tailored to attract international/local patients who are ready to commit. 
        Our campaigns don't just generate leads, they bring you qualified patients, reducing acquisition costs while increasing revenue.
        With real-time performance tracking and data-driven adjustments, we ensure your clinic stays competitive and visible to the right audience. For example, one of our partner clinics experienced $75,000 worth of veneer treatments sold in just 90 days (see screenshots attached).
        In addition to our campaigns, we use advanced AI tools to streamline operations and patient engagement. Our 24/7 voice agents seamlessly handle patient inquiries and bookings, eliminating the need for traditional call centers.
        Our chatbots maintain engagement with patients through follow-ups via email or messaging, significantly reducing no-shows and improving retention through multiple touchpoints.`,
        medium: {
          twilio: {}
        },
        voice: "ab4eaa72-5cf3-40c1-a921-bca62a884bb4"
      })
    });

    const data = await response.json();
    const twiml = `<Response><Connect><Stream url="${data.joinUrl}" /></Connect></Response>`;

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
