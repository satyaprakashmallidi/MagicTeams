'use client';

import { useState, useEffect } from 'react';
import { AppointmentTool, type BotAppointmentConfig as AppointmentConfig } from '@/lib/types/appointment';
import { supabase } from '@/lib/supabase';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { useToast } from '@/hooks/use-toast';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useBots } from '@/hooks/use-bots';
import { useAppointmentTools } from '@/hooks/use-appointments';


export function BotAppointmentConfig() {
  const [loading, setLoading] = useState(false);
  const [config, setConfig] = useState<AppointmentConfig | null>(null);
  const [isAppointmentEnabled, setIsAppointmentEnabled] = useState(false);
  const [isCallTransferEnabled, setIsCallTransferEnabled] = useState(false);
  const [transferNumber, setTransferNumber] = useState('');
  const { toast } = useToast();

  const { selectedBotId: botId , updateBot , bots } = useBots();

  const {  tools } = useAppointmentTools();


  useEffect(() => {
    if(botId && bots){
      const isAppointmentEnabled = bots.find((bot) => bot.id === botId)?.is_appointment_booking_allowed;
      setIsAppointmentEnabled(isAppointmentEnabled || false);
      
      const isCallTransferEnabled = bots.find((bot) => bot.id === botId)?.is_call_transfer_allowed;
      console.log("isCallTransferEnabled -     ----", isCallTransferEnabled)
      setIsCallTransferEnabled(isCallTransferEnabled || false);
      
      const transferNumber = bots.find((bot) => bot.id === botId)?.call_transfer_number;
      console.log("transferNumber -     ---- asdas", transferNumber)
      if (transferNumber) {
        setTransferNumber(transferNumber);
      }

      const asyncnc = async () => {
        try {
          // bot-data
          const { data: botData, error: botError } = await supabase
            .from('bots')
            .select('appointment_tool_id')
            .eq('id', botId)
            .single();
          
          if (botError) {
            console.error('Error fetching bot data:', botError);
            return;
          }
          
          // checking if the bot has any appointment_tool,
          if (botData?.appointment_tool_id) {
            const { data: configData, error: configError } = await supabase
              .from('bot_appointment_configs')
              .select('*')
              .eq('bot_id', botId)
              .eq('tool_id', botData.appointment_tool_id)
              .single();
            
            if (!configError && configData) {
              console.log("Found config for tool_id:", botData.appointment_tool_id, configData);
              setConfig(configData);
              return;
            }
          }
          
          // else :  get any configs for this bot
          const { data: configs, error } = await supabase
            .from('bot_appointment_configs')
            .select('*')
            .eq('bot_id', botId);
      
          if (error) {
            console.error('Error fetching config:', error);
            return;
          }

          console.log("configs for bot", configs);

          // If we have configs, use the first one
          if (configs && configs.length > 0) {
            setConfig(configs[0]);
          }
        } catch (error) {
          console.error('Error in fetchConfig:', error);
        }

        console.log(config);

        if (config && Array.isArray(config) && config.length > 0) {
          setConfig(config[0] as AppointmentConfig);
        }
      }

      asyncnc();
    }
  }, [botId, bots]);



  const handleToolSelect = async (toolId: string) => {
    console.log("-------------> handleToolSelect", toolId);
    try {
      setLoading(true);

      // First fetch the selected tool's calendar email
      const { data: selectedTool, error: toolFetchError } = await supabase
        .from('appointment_tools')
        .select('calendar_email')
        .eq('id', toolId)
        .single();

      if (toolFetchError) throw toolFetchError;

      localStorage.setItem(`bookingAppointmentToolId_${botId}` , toolId);
      // Update the bot's appointment tool ID
      const { error: botUpdateError } = await supabase
        .from('bots')
        .update({ appointment_tool_id: toolId })
        .eq('id', botId)
        .single();

      if (botUpdateError) {
        console.log(botUpdateError)
        throw botUpdateError;
      }

      // Update local bot state to include the new appointment_tool_id
      const currentBot = bots.find((bot) => bot.id === botId);
      if (currentBot && botId) {
        updateBot(botId, { ...currentBot, appointment_tool_id: toolId });
      }

      // First check if a configuration already exists for this bot and tool
      const { data: existingConfig, error: fetchError } = await supabase
        .from('bot_appointment_configs')
        .select('*')
        .eq('bot_id', botId)
        .eq('tool_id', toolId)
        .single();

      if (fetchError && fetchError.code !== 'PGRST116') { // PGRST116 is "not found" error
        throw fetchError;
      }

      if (existingConfig) {
        // Update existing config
        setConfig(existingConfig as AppointmentConfig);
      } else {
        // Create new config if it doesn't exist
        const { data: newConfig, error: createError } = await supabase
          .from('bot_appointment_configs')
          .insert([{
            bot_id: botId,
            tool_id: toolId,
            auto_confirm: false,
            reminder_enabled: true,
            reminder_hours_before: 24
          }])
          .select()
          .single();

        if (createError) throw createError;
        
        // Update local state with the new config
        if (newConfig) {
          setConfig(newConfig as AppointmentConfig);
        }
      }

      toast({
        title: "Success",
        description: "Appointment configuration updated successfully",
      });
    } catch (error) {
      console.error('Error updating appointment config:', error);
      toast({
        title: "Error",
        description: "Failed to update appointment configuration",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleToggle = async (field: keyof AppointmentConfig, value: boolean) => {
    if (!config) return;

    try {
      const { error } = await supabase
        .from('bot_appointment_configs')
        .update({ [field]: value })
        .eq('id', config.id);

      if (error) throw error;

      setConfig({ ...config, [field]: value });

      toast({
        title: "Success",
        description: "Settings updated successfully",
      });
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to update settings",
        variant: "destructive",
      });
    }
  };

  const handleAppointmentToggle = async (value: boolean) => {
    try {
      localStorage.setItem(`is_appointment_booking_allowed_${botId}`, value.toString());
      console.log('appointment toggle toggled', value, localStorage.getItem(`is_appointment_booking_allowed_${botId}`))
      const { error } = await supabase
        .from('bots')
        .update({ is_appointment_booking_allowed: value })
        .eq('id', botId);

      if (error) throw error;

      // Update local bot state
      const currentBot = bots.find((bot) => bot.id === botId);
      if (currentBot && botId) {
        updateBot(botId, { ...currentBot, is_appointment_booking_allowed: value });
      }

      setIsAppointmentEnabled(value); 

      toast({
        title: "Success",
        description: "Settings updated successfully",
      });
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to update settings",
        variant: "destructive",
      });
    }
  };
  
  const handleCallTransferToggle = async (value: boolean) => {
    console.log(`Setting call transfer to: ${value} for bot ${botId}`);
    
    if (botId) {
      setIsCallTransferEnabled(value);

      const { error } = await supabase
        .from('bots')
        .update({ is_call_transfer_allowed: value })
        .eq('id', botId);

      if (error) throw error;

      // Update local bot state
      const currentBot = bots.find((bot) => bot.id === botId);
      if (currentBot && botId) {
        updateBot(botId, { ...currentBot, is_call_transfer_allowed: value });
      }
      
      toast({
        title: "Success",
        description: `Call transfer ${value ? 'enabled' : 'disabled'} successfully`,
      });
    } else {
      console.error("Cannot toggle call transfer, botId is missing");
      toast({
        title: "Error",
        description: "Could not save call transfer setting",
        variant: "destructive",
      });
    }
  };
  
  const handleTransferNumberChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const number = e.target.value;
    setTransferNumber(number);
    if (botId) {
      const { error } = await supabase
        .from('bots')
        .update({ call_transfer_number: number })
        .eq('id', botId);

      if (error) throw error;

      // Update local bot state
      const currentBot = bots.find((bot) => bot.id === botId);
      if (currentBot && botId) {
        updateBot(botId, { ...currentBot, call_transfer_number: number });
      }
    }
  };

  return (
    <div className="bg-card p-6 rounded-lg shadow-sm space-y-6">
      <div>

        <h3 className="text-lg font-medium mb-4">Appointment Settings <Switch className='ml-4 ' checked={isAppointmentEnabled} onCheckedChange={handleAppointmentToggle} /> </h3>

        <div className="space-y-4">
          <div>
            <Label>Select Appointment Tool</Label>
            <Select
              value={config?.tool_id}
              onValueChange={handleToolSelect}
              disabled={loading || !isAppointmentEnabled}
            >
              <SelectTrigger>
                <SelectValue placeholder="Choose a tool"  />
              </SelectTrigger>
              <SelectContent>
                {tools.length == 0 ? (
                  <div className="text-sm p-2 max-w-sm text-center">
                    No tools available. Please add a tool from the Appointments section to proceed.
                  </div>
                ) : 
                (
                  tools.map((tool) => (
                    <SelectItem key={tool.id} value={tool.id}>
                      {tool.name}
                    </SelectItem>
                  ))
                )}
              </SelectContent>
            </Select>
          </div>
          
          <div className="flex items-center justify-between">
            <div>
              <Label>Call Transfer</Label>
              <p className="text-sm text-gray-500">
                Enable call transfer to a specified phone number
              </p>
            </div>
            <Switch
              checked={isCallTransferEnabled}
              onCheckedChange={handleCallTransferToggle}
            />
          </div>
          
          {isCallTransferEnabled && (
            <div>
              <Label htmlFor="transferNumber">Transfer Phone Number</Label>
              <Input
                id="transferNumber"
                value={transferNumber}
                onChange={handleTransferNumberChange}
                placeholder="+1234567890"
                disabled={!isCallTransferEnabled}
                className="mt-1"
              />
              <p className="text-sm text-gray-500 mt-1">
                Enter the phone number where calls should be transferred (include country code)
              </p>
            </div>
          )}

          {false && config && (
            <>
              <div className="flex items-center justify-between">
                <div>
                  <Label>Auto-confirm Appointments</Label>
                  <p className="text-sm text-gray-500">
                    Automatically confirm appointments without review
                  </p>
                </div>
                <Switch
                  checked={config?.auto_confirm || false}
                  onCheckedChange={(value) => handleToggle('auto_confirm', value)}
                />
              </div>

              <div className="flex items-center justify-between">
                <div>
                  <Label>Send Reminders</Label>
                  <p className="text-sm text-gray-500">
                    Call customers to remind them of upcoming appointments
                  </p>
                </div>
                <Switch
                  checked={config?.reminder_enabled || false}
                  onCheckedChange={(value) => handleToggle('reminder_enabled', value)}
                />
              </div>

              {config?.reminder_enabled && (
                <div>
                  <Label>Reminder Hours Before</Label>
                  <Select
                    value={config?.reminder_hours_before?.toString() || ''}
                    onValueChange={(value) => handleToggle('reminder_hours_before', parseInt(value))}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select hours" />
                    </SelectTrigger>
                    <SelectContent>
                      {[2, 4, 8, 12, 24, 48].map((hours) => (
                        <SelectItem key={hours} value={hours.toString()}>
                          {hours} hours
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}

              <div>
                <Label>Custom Prompt (Optional)</Label>
                <Textarea
                  value={config?.custom_prompt || ''}
                  onChange={async (e) => {
                    if (config) {
                      const { error } = await supabase
                        .from('bot_appointment_configs')
                        .update({ custom_prompt: e.target.value })
                        .eq('id', config.id);

                      if (!error) {
                        setConfig({ ...config, custom_prompt: e.target.value });
                      }
                    }
                  }}
                  placeholder="Custom prompt for the bot when handling appointments..."
                  className="mt-1"
                />
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
