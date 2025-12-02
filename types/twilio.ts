// TypeScript types for Twilio credentials

export interface TwilioPhoneNumber {
  id?: string;
  account_id: string;
  phone_number: string;
  friendly_name: string;
  is_active: boolean;
  created_at?: string;
  updated_at?: string;
  bot_id: string | null;
}

export interface TwilioCredentials {
  id: string;
  user_id: string;
  account_name: string;
  account_sid: string;
  auth_token: string;
  is_active: boolean;
  created_at?: string;
  updated_at?: string;
  phone_numbers: TwilioPhoneNumber[];
}
