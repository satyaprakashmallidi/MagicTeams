'use client';

import { useState } from 'react';
import { Bot, Appointment } from '@/lib/types';
import { Button } from '@/components/ui/button';
import { Icon } from '@/components/ui/icons';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { supabase } from '@/lib/supabase';
import { useToast } from '@/hooks/use-toast';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

interface AppointmentManagerProps {
  bot: Bot;
  onUpdate: () => void;
}

export function AppointmentManager({ bot, onUpdate }: AppointmentManagerProps) {
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const { toast } = useToast();

  const toggleAppointments = async () => {
    try {
      const { error } = await supabase
        .from('bots')
        .update({ allows_appointments: !bot.allows_appointments })
        .eq('id', bot.id);

      if (error) throw error;

      toast({
        title: "Settings updated",
        description: `Appointments ${!bot.allows_appointments ? 'enabled' : 'disabled'} successfully.`,
      });

      onUpdate();
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to update appointment settings.",
        variant: "destructive",
      });
    }
  };

  return (
    <div className="bg-background p-6 rounded-lg shadow-sm space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-medium">Appointment Settings</h3>
          <p className="text-sm text-muted-foreground">Configure appointment booking for this bot</p>
        </div>
        <div className="flex items-center gap-2">
          <Switch
            checked={bot.allows_appointments}
            onCheckedChange={toggleAppointments}
          />
          <Label>Allow Appointments</Label>
        </div>
      </div>

      {bot.allows_appointments && (
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label>Available Days</Label>
              <Select>
                <SelectTrigger>
                  <SelectValue placeholder="Select days" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="weekdays">Weekdays</SelectItem>
                  <SelectItem value="weekends">Weekends</SelectItem>
                  <SelectItem value="all">All Days</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Business Hours</Label>
              <div className="flex gap-2">
                <Select>
                  <SelectTrigger>
                    <SelectValue placeholder="Start time" />
                  </SelectTrigger>
                  <SelectContent>
                    {Array.from({ length: 24 }).map((_, i) => (
                      <SelectItem key={i} value={`${i}:00`}>
                        {`${i}:00`}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Select>
                  <SelectTrigger>
                    <SelectValue placeholder="End time" />
                  </SelectTrigger>
                  <SelectContent>
                    {Array.from({ length: 24 }).map((_, i) => (
                      <SelectItem key={i} value={`${i}:00`}>
                        {`${i}:00`}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>

          <div>
            <h4 className="font-medium mb-2">Upcoming Appointments</h4>
            {appointments.length > 0 ? (
              <div className="space-y-2">
                {appointments.map((appointment) => (
                  <div
                    key={appointment.id}
                    className="flex items-center justify-between p-3 bg-gray-50 rounded-lg"
                  >
                    <div>
                      <p className="font-medium">{appointment.customer_name}</p>
                      <p className="text-sm text-gray-500">
                        {new Date(appointment.date).toLocaleDateString()} at {appointment.time}
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <Button
                        variant="ghost"
                        size="sm"
                        className="text-green-600"
                        onClick={() => {/* Implement confirm handler */}}
                      >
                        <Icon name="check" className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="text-red-600"
                        onClick={() => {/* Implement cancel handler */}}
                      >
                        <Icon name="x" className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-4 text-gray-500 text-sm">
                No upcoming appointments
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
