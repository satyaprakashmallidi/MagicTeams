import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";

async function createCall(
  TWILIO_ACCOUNT_SID: string,
  TWILIO_AUTH_TOKEN: string,
  joinUrl: string,
  phoneNumber: string,
  from: string
) {
  try {
    console.log("Making Twilio API call to create call:");
    console.log(`- From: ${from}`);
    console.log(`- To: ${phoneNumber}`);
    console.log(`- Join URL length: ${joinUrl.length} characters`);

    const twilioEndpoint = `https://api.twilio.com/2010-04-01/Accounts/${TWILIO_ACCOUNT_SID}/Calls.json`;
    console.log(`- Twilio API endpoint: ${twilioEndpoint}`);

    const authorization = Buffer.from(
      `${TWILIO_ACCOUNT_SID}:${TWILIO_AUTH_TOKEN}`
    ).toString("base64");

    const twilioResponse = await fetch(
      twilioEndpoint,
      {
        method: "POST",
        headers: {
          Authorization: `Basic ${authorization}`,
          "Content-Type": "application/x-www-form-urlencoded",
        },
        body: new URLSearchParams({
          Twiml: `<Response><Connect><Stream url="${joinUrl}" /></Connect></Response>`,
          From: from,
          To: phoneNumber,
        }).toString(),
      }
    );

    if (!twilioResponse.ok) {
      const errorText = await twilioResponse.text();
      try {
        // Try to parse the error as JSON for more details
        const errorJson = JSON.parse(errorText);
        throw new Error(`Twilio API error: ${JSON.stringify(errorJson)}`);
      } catch (parseError) {
        // If parsing fails, just use the raw error text
        throw new Error(`Twilio API error (${twilioResponse.status}): ${errorText}`);
      }
    }

    const data = await twilioResponse.json();
    console.log("Twilio API response:", data);

    return data;
  } catch (error) {
    console.error("Failed to create twilio call:", error);
    throw error;
  }
}

export async function POST(request: NextRequest) {
  try {
    if (!request.body) {
      return NextResponse.json(
        { error: "Request body is required" },
        { status: 400 }
      );
    }

    const { accountSid, authToken, fromNumber, to, joinUrl } =
      await request.json();

    // Add detailed debugging (redacting sensitive information)
    console.log("Twilio Call Request:", {
      accountSid: accountSid ? `${accountSid.substring(0, 5)}...${accountSid.substring(accountSid.length - 5)}` : null,
      authTokenProvided: !!authToken,
      fromNumber,
      to: to ? `${to.substring(0, 3)}...${to.substring(to.length - 3)}` : null,
      joinUrlProvided: !!joinUrl
    });

    if (!accountSid || !authToken || !fromNumber || !to || !joinUrl) {
      return NextResponse.json(
        { error: "Missing required parameters" },
        { status: 400 }
      );
    }

    // Validate phone number format
    if (!fromNumber.startsWith('+')) {
      console.warn("Warning: fromNumber may not be in E.164 format (should start with +):", fromNumber);
    }

    if (!to.startsWith('+')) {
      console.warn("Warning: to number may not be in E.164 format (should start with +):", to);
    }

    const result = await createCall(
      accountSid,
      authToken,
      joinUrl,
      to,
      fromNumber
    );

    console.log("Twilio API response:", result);

    return NextResponse.json({
      success: true,
      data: result,
    });
  } catch (error) {
    console.error("Error in /api/twilio/call:", error);
    return NextResponse.json(
      {
        success: false,
        error:
          error instanceof Error ? error.message : "Unknown error occurred",
      },
      { status: 500 }
    );
  }
}
