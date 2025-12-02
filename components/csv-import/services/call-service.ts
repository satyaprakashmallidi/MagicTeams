import { startBulkCalls, fetchCallSummary } from '@/lib/callFunctions';
import { CSVFile } from '../types';
import { JoinUrlResponse } from '@/lib/types';
import { campaignsService, CreateCampaignPayload, CampaignScheduling } from './campaigns-service';

export const getCallSummary = async (callId: string, rowIndex: number, updateRowData: (rowIndex: number, data: any) => void) => {
  const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));
  
  // Wait for 40 seconds before first attempt
  await delay(60*1000);
  
  while (true) {
    try {
      const summary = await fetchCallSummary(callId);
      
      // Update the row with call summary
      updateRowData(rowIndex, {
        call_status: 'completed',
        call_notes: summary
      });
      
      break; // Exit loop on success
    } catch (error) {
      console.log('summary still not found');
      // Wait 2 seconds before retrying
      await delay(2000);
    }
  }
};

export const makeCall = async (
  row: Record<string, string>,
  rowIndex: number,
  twilioPhoneNumber: string,
  botId: string,
  updateRowData: (rowIndex: number, data: any) => void
) => {
  try {
    const phoneNumber = row.phone || row.phone_number;
    const name = row.name || row.contact_name;

    // Make API call to initiate the call
    const response: JoinUrlResponse = await startBulkCalls(twilioPhoneNumber, botId, phoneNumber || "", name || "");
    const { callId } = response;

    // Update the row with call ID and status
    updateRowData(rowIndex, {
      Call_ID: callId,
      call_status: 'pending'
    });

    // Start polling for call summary
    getCallSummary(callId, rowIndex, updateRowData);

    return callId;
  } catch (error) {
    console.error('Error initiating call:', error);
    // Update row status to failed
    updateRowData(rowIndex, {
      call_status: 'failed',
      call_notes: 'Failed to initiate call'
    });
    return null;
  }
};

/**
 * Create and start a bulk calling campaign
 */
export const createBulkCallCampaign = async (
  campaignName: string,
  contacts: any[],
  botId: string,
  botName: string,
  twilioPhoneNumbers: string[], // Changed to array
  systemPrompt: string,
  voiceSettings: any,
  fieldMappings: any,
  userId: string,
  notes?: string,
  scheduling?: CampaignScheduling,
  campaignSettings?: any
): Promise<{ campaign_id: string; status: string; message: string }> => {
  try {

    console.log(campaignSettings ,"heh")
    const payload: CreateCampaignPayload = {
      campaign_name: campaignName,
      bot_id: botId,
      bot_name: botName,
      twilio_phone_number: twilioPhoneNumbers[0], // First number for backward compatibility
      twilio_phone_numbers: twilioPhoneNumbers, // Array of numbers
      system_prompt: systemPrompt,
      voice_settings: voiceSettings,
      field_mappings: fieldMappings,
      contacts,
      notes,
      user_id: userId,
      scheduling,
      campaign_settings: campaignSettings
    };

    // Create the campaign
    const createResult = await campaignsService.createCampaign(payload);
    
    if (createResult.status === 'success') {
      // Only start immediately if no scheduling or if not auto-start
      const shouldStartNow = !scheduling?.scheduled_start_time || !scheduling?.auto_start;
      
      if (shouldStartNow) {
        const startResult = await campaignsService.startCampaign(createResult.campaign_id);
        return {
          campaign_id: createResult.campaign_id,
          status: startResult.status,
          message: startResult.message
        };
      } else {
        return {
          campaign_id: createResult.campaign_id,
          status: 'success',
          message: `Campaign scheduled to start at ${new Date(scheduling.scheduled_start_time).toLocaleString()}`
        };
      }
    } else {
      throw new Error(createResult.message);
    }
  } catch (error) {
    console.error('Error creating bulk call campaign:', error);
    throw error;
  }
};

/**
 * Monitor campaign progress and update UI
 */
export const monitorCampaignProgress = async (
  campaignId: string,
  onProgressUpdate: (stats: any, contacts: any[]) => void,
  intervalMs: number = 5000
): Promise<void> => {
  const poll = async () => {
    try {
      const [statsResult, campaignResult] = await Promise.all([
        campaignsService.getCampaignStats(campaignId),
        campaignsService.getCampaign(campaignId)
      ]);

      onProgressUpdate(statsResult.stats, campaignResult.contacts);

      // Continue polling if campaign is still active
      if (['pending', 'in_progress'].includes(campaignResult.campaign.status)) {
        setTimeout(poll, intervalMs);
      }
    } catch (error) {
      console.error('Error monitoring campaign progress:', error);
      // Stop polling on error
    }
  };

  poll();
};
