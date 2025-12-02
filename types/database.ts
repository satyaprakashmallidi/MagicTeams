export interface CustomQuestion {
  id: string;
  question: string;
  enabled: boolean;
}

export interface RealtimeCaptureField {
  id: string;
  name: string;
  type: 'text' | 'number' | 'enum' | 'boolean';
  description: string;
  required: boolean;
  enum_values?: string[]; // only used when type is "enum"
}

export interface Bot {
  id: string;
  created_at: string;
  name: string;
  phone_number: string;
  voice: string;
  system_prompt: string;
  user_id: string;
  is_appointment_booking_allowed: boolean;
  appointment_tool_id?: string;
  is_deleted: boolean;
  knowledge_base_id?: string;
  temperature: number;
  twilio_phone_number?: string;
  is_call_transfer_allowed : boolean;
  call_transfer_number?: string;
  model: string;
  custom_questions?: CustomQuestion[];
  selected_tools?: string[];
  is_realtime_capture_enabled?: boolean;
  realtime_capture_fields?: RealtimeCaptureField[];
  first_speaker: "FIRST_SPEAKER_AGENT" | "FIRST_SPEAKER_USER";
}

export interface Transcript {
  id: string;
  created_at: string;
  bot_id: string;
  content: string;
}