import { NextRequest, NextResponse } from "next/server";
import twilio from 'twilio';

export const runtime = "nodejs";

async function transferCall(
  TWILIO_ACCOUNT_SID: string,
  TWILIO_AUTH_TOKEN: string,
  callSid: string,
  transferTo: string
) {
  try {
    console.log("=== TRANSFER CALL OPERATION STARTED ===");
    console.log(`Call SID: ${callSid}`);
    console.log(`Transfer to number: ${transferTo}`);
    console.log(`Account SID: ${TWILIO_ACCOUNT_SID.substring(0, 5)}...${TWILIO_ACCOUNT_SID.substring(TWILIO_ACCOUNT_SID.length - 5)}`);
    
    const client = twilio(TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN);
    const twiml = new twilio.twiml.VoiceResponse();
    twiml.dial().number(transferTo);

    console.log(`Generated TwiML: ${twiml.toString()}`);
    
    console.log("Making Twilio API request to update call with transfer instructions...");
    const twilioEndpoint = `https://api.twilio.com/2010-04-01/Accounts/${TWILIO_ACCOUNT_SID}/Calls/${callSid}.json`;
    console.log(`Twilio API endpoint: ${twilioEndpoint}`);
    
    const updatedCall = await client.calls(callSid).update({
      twiml: twiml.toString()
    });

    console.log("=== TWILIO TRANSFER API RESPONSE ===");
    console.log(JSON.stringify({
      sid: updatedCall.sid,
      status: updatedCall.status,
      direction: updatedCall.direction,
      duration: updatedCall.duration,
      updated: true,
      transferInProgress: true
    }, null, 2));
    console.log("=== TRANSFER CALL OPERATION COMPLETED ===");
    
    return updatedCall;
  } catch (error) {
    console.error("=== TRANSFER CALL OPERATION FAILED ===");
    console.error("Error details:", error);
    if (error instanceof Error) {
      console.error("Error message:", error.message);
      console.error("Error stack:", error.stack);
    }
    throw error;
  }
}

export async function POST(request: NextRequest) {
  console.log("=== TRANSFER CALL API ENDPOINT INVOKED ===");
  try {
    if (!request.body) {
      console.error("Request body is missing");
      return NextResponse.json(
        { error: "Request body is required" },
        { status: 400 }
      );
    }

    const requestData = await request.json();
    const { accountSid, authToken, callSid, transferTo, transferReason, urgencyLevel } = requestData;

    // Log the request details (excluding sensitive information)
    console.log("Transfer Call Request Details:");
    console.log(JSON.stringify({
      accountSidProvided: !!accountSid,
      authTokenProvided: !!authToken,
      callSid: callSid || 'not provided',
      transferTo: transferTo || 'not provided', 
      transferReason: transferReason || 'not provided',
      urgencyLevel: urgencyLevel || 'not provided',
      timestamp: new Date().toISOString()
    }, null, 2));

    if (!accountSid || !authToken || !callSid || !transferTo) {
      console.error("Missing required parameters:", {
        accountSidMissing: !accountSid,
        authTokenMissing: !authToken,
        callSidMissing: !callSid,
        transferToMissing: !transferTo
      });
      return NextResponse.json(
        { error: "Missing required parameters" },
        { status: 400 }
      );
    }

    // Validate phone number format
    if (!transferTo.startsWith('+')) {
      console.warn(`Warning: transferTo number ${transferTo} may not be in E.164 format (should start with +)`);
    }

    console.log(`Initiating transfer for call ${callSid} to ${transferTo}`);
    console.log(`Reason: ${transferReason}, Urgency: ${urgencyLevel}`);
    
    const result = await transferCall(
      accountSid,
      authToken,
      callSid,
      transferTo
    );

    console.log("Transfer call successful, preparing response");
    const response = {
      success: true,
      data: {
        status: 'transferring',
        callSid: callSid,
        transferTo: transferTo,
        transferReason,
        urgencyLevel,
        message: 'Call transfer initiated successfully',
        timestamp: new Date().toISOString()
      }
    };
    console.log("Response data:", JSON.stringify(response, null, 2));
    console.log("=== TRANSFER CALL API ENDPOINT COMPLETED ===");

    return NextResponse.json(response);
  } catch (error) {
    console.error("=== TRANSFER CALL API ENDPOINT ERROR ===");
    console.error("Error details:", error);
    if (error instanceof Error) {
      console.error("Error message:", error.message);
      console.error("Error stack:", error.stack);
    }
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error occurred",
        timestamp: new Date().toISOString()
      },
      { status: 500 }
    );
  }
} 