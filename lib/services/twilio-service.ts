interface TwilioAccountData {
  accountSid: string;
  friendlyName: string;
  status: string;
}

interface TwilioPhoneData {
  phoneNumber: string;
  countryCode: string;
  carrier?: {
    name?: string;
    type?: string;
  };
}

interface TwilioPurchasedNumber {
  id: string;
  phone_number: string;
  friendly_name: string;
  region: string;
  capabilities: {
    voice: boolean;
    SMS: boolean;
    MMS: boolean;
  };
  status: string;
}

interface TwilioVerificationResponse {
  success: boolean;
  error?: string;
  data?: TwilioAccountData | TwilioPhoneData | TwilioPurchasedNumber[];
}

export async function verifyTwilioCredentials(accountSid: string, authToken: string): Promise<TwilioVerificationResponse> {
  try {
    // Try to fetch account info from Twilio to verify credentials
    const response = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${accountSid}.json`, {
      headers: {
        'Authorization': 'Basic ' + Buffer.from(`${accountSid}:${authToken}`).toString('base64'),
      },
    });

    const data = await response.json();
    
    if (!response.ok) {
      return {
        success: false,
        error: data.message || 'Invalid Twilio credentials',
      };
    }

    return {
      success: true,
      data: {
        // Return minimal account info
        accountSid: data.sid,
        friendlyName: data.friendly_name,
        status: data.status
      }
    };
  } catch (error: any) {
    return {
      success: false,
      error: error.message || 'Failed to verify Twilio credentials',
    };
  }
}

export async function listPurchasedNumbers(
  accountSid: string,
  authToken: string
): Promise<TwilioVerificationResponse> {
  try {
    const response = await fetch(
      `https://api.twilio.com/2010-04-01/Accounts/${accountSid}/IncomingPhoneNumbers.json`, 
      {
        headers: {
          'Authorization': 'Basic ' + Buffer.from(`${accountSid}:${authToken}`).toString('base64'),
        },
      }
    );

    const data = await response.json();
    
    if (!response.ok) {
      return {
        success: false,
        error: data.message || 'Failed to fetch purchased numbers',
      };
    }

    const purchasedNumbers = data.incoming_phone_numbers.map((number: any) => ({
      id: number.sid,
      phone_number: number.phone_number,
      friendly_name: number.friendly_name || number.phone_number,
      region: number.region || number.address_requirements || 'Unknown',
      capabilities: {
        voice: number.capabilities.voice,
        SMS: number.capabilities.sms,
        MMS: number.capabilities.mms,
      },
      status: number.status || 'active'
    }));

    return {
      success: true,
      data: purchasedNumbers
    };
  } catch (error: any) {
    return {
      success: false,
      error: error.message || 'Failed to fetch purchased numbers',
    };
  }
}

export async function updatePhoneWebhook(
  accountSid: string,
  authToken: string,
  phoneNumberSid: string,
  webhookUrl: string
): Promise<TwilioVerificationResponse> {
  try {
    const response = await fetch(
      `${process.env.NEXT_PUBLIC_BACKEND_URL_WORKER}/api/set-twilio-webhook`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          'voice_url': webhookUrl,
          'account_sid': accountSid,
          'auth_token': authToken,
          'phone_number_sid': phoneNumberSid,
        })
      }
    );

    const data = (await response.json()).data;
    
    if (!response.ok) {
      return {
        success: false,
        error: data.message || 'Failed to update webhook URL',
      };
    }

    return {
      success: true,
      data: {
        phoneNumber: data.phone_number,
        friendlyName: data.friendly_name,
        region: data.region || data.address_requirements || 'Unknown',
        capabilities: {
          voice: data.capabilities.voice,
          SMS: data.capabilities.sms,
          MMS: data.capabilities.mms,
        },
        status: data.status || 'active'
      }
    };
  } catch (error: any) {
    return {
      success: false,
      error: error.message || 'Failed to update webhook URL',
    };
  }
}

export async function lookupPhoneNumber(
  accountSid: string, 
  authToken: string, 
  phoneNumber: string
): Promise<TwilioVerificationResponse> {
  try {
    // Use Twilio's Lookup API to validate and get phone number info
    const response = await fetch(
      `https://lookups.twilio.com/v2/PhoneNumbers/${encodeURIComponent(phoneNumber)}?Fields=carrier`, 
      {
        headers: {
          'Authorization': 'Basic ' + Buffer.from(`${accountSid}:${authToken}`).toString('base64'),
        },
      }
    );

    const data = await response.json();
    
    if (!response.ok) {
      return {
        success: false,
        error: data.message || 'Invalid phone number',
      };
    }

    return {
      success: true,
      data: {
        phoneNumber: data.phone_number,
        countryCode: data.country_code,
        carrier: data.carrier ? {
          name: data.carrier.name,
          type: data.carrier.type
        } : undefined
      }
    };
  } catch (error: any) {
    return {
      success: false,
      error: error.message || 'Failed to lookup phone number',
    };
  }
}
