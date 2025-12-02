import { User } from '@supabase/supabase-js';
import { createClient } from '@/utils/supabase/client';
import { AppointmentTool } from '../types/appointment';
import { Bot } from '@/types/database';
import { CalendarAccount } from '../types';
import { useBotStore } from '@/store/use-bot-store';
import { useAppointmentsToolsStore } from '@/store/use-appointments-store';
import { useCallRecordsStore } from '@/store/use-call-records-store';
import { useVoiceStore } from '@/store/use-voice-store';
import { useAuthStore } from '@/hooks/use-auth';
import { TwilioCredentials } from '@/types/twilio';
import { env } from '../env/getEnvVars';

export class SupabaseService {
  private static instance: SupabaseService;
  private supabase;
  private appointmentTools: AppointmentTool[] | null = null;
  private bots: Bot[] | null = null;
  private calendarAccounts: CalendarAccount[] | null = null;
  private twilioCredentials: TwilioCredentials[] | null  = null;
  private user: User | null = null;

  private constructor() {
    // Use the Next.js auth helper client for better session handling
    this.supabase = createClient();
  }

  public static getInstance(): SupabaseService {
    if (!SupabaseService.instance) {
      SupabaseService.instance = new SupabaseService();
    }
    return SupabaseService.instance;
  }

  async getCurrentUser(): Promise<User | null> {
    try {
      console.log("Fetching current user");
      const { data: { session } } = await this.supabase.auth.getSession();
      
      if (!session) {
        console.log("No active session found");
        return null;
      }

      this.user = session.user;
      console.log("Current user", this.user);
      return this.user;
    } catch (error) {
      console.error("Error in getCurrentUser:", error);
      throw error;
    }
    return null;
  }

  async getUserId(): Promise<string | undefined> {
    const user = await this.getCurrentUser();
    return user?.id;
  }

  async saveToCallRecord({
    callId,
    botId,
  }: {
    callId: string;
    botId: string;
  }): Promise<void> {
    try {
      await useCallRecordsStore.getState().addCallRecord({
        call_id: callId,
        bot_id: botId,
        additional_data: {}
      });
    } catch (error) {
      console.error("Error in saveToCallRecord:", error);
      throw error;
    }
  }

  async insertCallData(callId: string, botId: string): Promise<any> {
    try {
      const userId = await useAuthStore.getState().getUserId();
      
      if(!userId){
        throw new Error('User not authenticated');
      }

      console.log("savong to db , callId" , callId, "userID " , userId , "botId" , botId)

      const response = await fetch(env.NEXT_PUBLIC_BACKEND_URL_WORKER + `/api/add-call-to-db`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ call_id: callId, bot_id: botId, user_id: userId }),
      });
      
      if (!response.ok) {
        throw new Error('Failed to insert call data');
      }

      return await response.json();
    } catch (error) {
      console.error("Error in insertCallData:", error);
      throw error;
    }
  }

  async getUserCalendarAccount(userId: string): Promise<CalendarAccount | null> {
    if(!this.calendarAccounts){
      const { data , error } = await this.supabase
        .from("user_calendar_accounts")
        .select("*")
        .eq("user_id", userId);
        
      if(!data || error){
        console.error('Error fetching calendar accounts:', error);
        return null;
      } 

      this.calendarAccounts = data;
    }
    
    const account = this.calendarAccounts.find((account) => account.user_id === userId);
    return account || null;
  }

  public async getBotData(botId: string): Promise<Bot | undefined> {
    if(!this.bots){
      const bots = useBotStore.getState().bots;
      
      if(bots.length > 0){
        this.bots = bots;
      } else {
        const fetchedBots = await useBotStore.getState().fetchBots();
        this.bots = fetchedBots;
        useBotStore.getState().setBots(fetchedBots);
      }
    }

    return this.bots.find((bot) => bot.id === botId);
  }

  public async getLatestBotData(id: string): Promise<Bot | undefined> {
    const bots = useBotStore.getState().bots;
    
    if(!bots || bots.length === 0){
      const fetchedBots = await useBotStore.getState().fetchBots();
      this.bots = fetchedBots;
      useBotStore.getState().setBots(fetchedBots);
    } else {
      this.bots = bots;
    }

    return this.bots?.find((bot: Bot) => bot.id === id);
  }

  public async getLastestAppointmentTool(appointmentId: string): Promise<AppointmentTool | undefined> {
    this.appointmentTools = useAppointmentsToolsStore.getState().tools;
    
    if(!this.appointmentTools || this.appointmentTools.length === 0){
      const appointmentTools = await useAppointmentsToolsStore.getState().fetchAppointmentsTools();
      useAppointmentsToolsStore.getState().setTools(appointmentTools);
      this.appointmentTools = appointmentTools;
    }

    return this.appointmentTools.find((tool: AppointmentTool) => tool.id === appointmentId);
  }

  public async getAppointmentTool(appointmentId: string): Promise<AppointmentTool | undefined> {
    if(!this.appointmentTools){
      const appointmentTools = useAppointmentsToolsStore.getState().tools;
      
      if(appointmentTools){
        this.appointmentTools = appointmentTools;      
      }else{
        this.appointmentTools = await useAppointmentsToolsStore.getState().fetchAppointmentsTools();
        useAppointmentsToolsStore.getState().setTools(this.appointmentTools);
      }
    }

    return this.appointmentTools.find((tool) => tool.id === appointmentId);
  }

  public async getTwilioConfigFromPhoneNumber(twilioPhoneNumber: string): Promise<TwilioCredentials | undefined> {
    if(!this.twilioCredentials){
      const twilioCredentials = useVoiceStore.getState().twilioInfo;
        
      if(!twilioCredentials){
        const fetchTwilioCredentials = await useVoiceStore.getState().loadTwilioInfo();

        if(!fetchTwilioCredentials){
          return undefined;
        }

        this.twilioCredentials = fetchTwilioCredentials;
        useVoiceStore.getState().setTwilioInfo(this.twilioCredentials);
      }else{
        this.twilioCredentials = twilioCredentials;
      }
    }

    return this.twilioCredentials.find((cred) => 
      cred.phone_numbers?.some((phone) => phone.phone_number === twilioPhoneNumber)
    );
  }

  public async getCalendarAccount(calendarAccountId: string): Promise<CalendarAccount | null> {
    const { data, error } = await this.supabase
      .from("user_calendar_accounts")
      .select("*")
      .eq("id", calendarAccountId)
      .single();

    if(error){
      console.error('Error fetching calendar account:', error);
      return null;
    }

    return data;
  }
}
