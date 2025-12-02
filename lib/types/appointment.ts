export interface AppointmentTool {
  id: string;
  name: string;
  description?: string;
  business_hours: BusinessHours;
  appointment_duration: number; // in minutes
  location?: string;
  created_at: string;
  user_id: string;
  calendar_email: string;
  calendar_account_id: string;
  ghl_calendar_id?: string; 
  staffid_ghl?: string; 
  is_ghl?: boolean; 
  is_deleted?: boolean;
}

export interface BusinessHours {
  monday?: DaySchedule;
  tuesday?: DaySchedule;
  wednesday?: DaySchedule;
  thursday?: DaySchedule;
  friday?: DaySchedule;
  saturday?: DaySchedule;
  sunday?: DaySchedule;
}

export interface DaySchedule {
  is_open: boolean;
  slots: TimeSlot[];
}

export interface TimeSlot {
  start: string; // HH:mm format
  end: string;   // HH:mm format
}

export interface AppointmentBooking {
  id: string;
  tool_id: string;
  customer_name: string;
  customer_phone: string;
  date: string;
  time_slot: TimeSlot;
  status: 'pending' | 'confirmed' | 'cancelled' | 'completed';
  notes?: string;
  created_at: string;
}

export interface BotAppointmentConfig {
  id: string;
  bot_id: string;
  tool_id: string;
  custom_prompt?: string;
  auto_confirm: boolean;
  reminder_enabled: boolean;
  reminder_hours_before: number;
  created_at: string;
}
