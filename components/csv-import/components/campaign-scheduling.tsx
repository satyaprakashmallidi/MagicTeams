"use client";

import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Calendar, Clock, Repeat, Play, Settings, Timer } from "lucide-react";
import { CampaignScheduling, TimeWindow } from "../services/campaigns-service";

interface CampaignSchedulingProps {
  initialScheduling?: CampaignScheduling;
  onSchedulingChange: (scheduling: CampaignScheduling) => void;
  disabled?: boolean;
}

const timezones = [
  { value: "UTC", label: "UTC" },
  // North America
  { value: "America/New_York", label: "Eastern Time (US)" },
  { value: "America/Chicago", label: "Central Time (US)" },
  { value: "America/Denver", label: "Mountain Time (US)" },
  { value: "America/Los_Angeles", label: "Pacific Time (US)" },
  { value: "America/Phoenix", label: "Arizona" },
  { value: "America/Anchorage", label: "Alaska" },
  { value: "Pacific/Honolulu", label: "Hawaii" },
  { value: "America/Toronto", label: "Toronto" },
  { value: "America/Vancouver", label: "Vancouver" },
  { value: "America/Mexico_City", label: "Mexico City" },
  // Europe
  { value: "Europe/London", label: "London (GMT)" },
  { value: "Europe/Paris", label: "Paris (CET)" },
  { value: "Europe/Berlin", label: "Berlin (CET)" },
  { value: "Europe/Rome", label: "Rome (CET)" },
  { value: "Europe/Madrid", label: "Madrid (CET)" },
  { value: "Europe/Amsterdam", label: "Amsterdam (CET)" },
  { value: "Europe/Stockholm", label: "Stockholm (CET)" },
  { value: "Europe/Helsinki", label: "Helsinki (EET)" },
  { value: "Europe/Athens", label: "Athens (EET)" },
  { value: "Europe/Moscow", label: "Moscow (MSK)" },
  // Asia
  { value: "Asia/Tokyo", label: "Tokyo (JST)" },
  { value: "Asia/Shanghai", label: "Shanghai (CST)" },
  { value: "Asia/Hong_Kong", label: "Hong Kong (HKT)" },
  { value: "Asia/Singapore", label: "Singapore (SGT)" },
  { value: "Asia/Seoul", label: "Seoul (KST)" },
  { value: "Asia/Taipei", label: "Taipei (CST)" },
  { value: "Asia/Bangkok", label: "Bangkok (ICT)" },
  { value: "Asia/Jakarta", label: "Jakarta (WIB)" },
  { value: "Asia/Manila", label: "Manila (PST)" },
  { value: "Asia/Mumbai", label: "Mumbai (IST)" },
  { value: "Asia/Kolkata", label: "Kolkata (IST)" },
  { value: "Asia/Dubai", label: "Dubai (GST)" },
  { value: "Asia/Riyadh", label: "Riyadh (AST)" },
  // Australia & Pacific
  { value: "Australia/Sydney", label: "Sydney (AEST)" },
  { value: "Australia/Melbourne", label: "Melbourne (AEST)" },
  { value: "Australia/Brisbane", label: "Brisbane (AEST)" },
  { value: "Australia/Perth", label: "Perth (AWST)" },
  { value: "Australia/Adelaide", label: "Adelaide (ACST)" },
  { value: "Pacific/Auckland", label: "Auckland (NZST)" },
  // South America
  { value: "America/Sao_Paulo", label: "São Paulo (BRT)" },
  { value: "America/Buenos_Aires", label: "Buenos Aires (ART)" },
  { value: "America/Lima", label: "Lima (PET)" },
  { value: "America/Bogota", label: "Bogotá (COT)" },
  { value: "America/Santiago", label: "Santiago (CLT)" },
  // Africa
  { value: "Africa/Cairo", label: "Cairo (EET)" },
  { value: "Africa/Lagos", label: "Lagos (WAT)" },
  { value: "Africa/Johannesburg", label: "Johannesburg (SAST)" },
  { value: "Africa/Nairobi", label: "Nairobi (EAT)" },
];

export function CampaignScheduling({
  initialScheduling,
  onSchedulingChange,
  disabled = false
}: CampaignSchedulingProps) {
  const [scheduling, setScheduling] = useState<CampaignScheduling>(
    initialScheduling || {
      timezone: Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC",
      is_recurring: false,
      recurring_type: "none",
      recurring_interval: 1,
      auto_start: false
    }
  );

  const handleSchedulingUpdate = (updates: Partial<CampaignScheduling>) => {
    const newScheduling = { ...scheduling, ...updates };
    setScheduling(newScheduling);
    onSchedulingChange(newScheduling);
  };

  const formatDateTimeLocal = (isoString?: string) => {
    if (!isoString) return "";
    
    // Simply convert the UTC time back to what the user originally entered
    // This ensures the input shows exactly what the user typed
    const date = new Date(isoString);
    const offset = date.getTimezoneOffset();
    const localDate = new Date(date.getTime() - offset * 60 * 1000);
    return localDate.toISOString().slice(0, 16);
  };

  const handleDateTimeChange = (value: string) => {
    if (!value) {
      handleSchedulingUpdate({ scheduled_start_time: undefined });
      return;
    }
    
    // Store the raw datetime string as entered by user
    // We'll add a flag to indicate this is "raw" user input
    // and needs timezone conversion on the backend
    handleSchedulingUpdate({ 
      scheduled_start_time: value, // Store raw value like "2025-08-21T15:30"
      _user_input_datetime: true // Flag to indicate this needs backend processing
    });
  };

  return (
    <Card className="w-full">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Settings className="h-5 w-5" />
          Campaign Scheduling
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Basic Scheduling */}
        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="scheduled-time" className="flex items-center gap-2">
              <Calendar className="h-4 w-4" />
              Scheduled Start Time
            </Label>
            <Input
              id="scheduled-time"
              type="datetime-local"
              value={formatDateTimeLocal(scheduling.scheduled_start_time)}
              onChange={(e) => handleDateTimeChange(e.target.value)}
              disabled={disabled}
            />
            <p className="text-sm text-muted-foreground">
              Leave empty to start immediately when campaign is created
            </p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="timezone">Timezone</Label>
            <Select
              value={scheduling.timezone}
              onValueChange={(value) => handleSchedulingUpdate({ timezone: value })}
              disabled={disabled}
            >
              <SelectTrigger>
                <SelectValue placeholder="Select timezone" />
              </SelectTrigger>
              <SelectContent>
                {timezones.map((tz) => (
                  <SelectItem key={tz.value} value={tz.value}>
                    {tz.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="flex items-center space-x-2">
            <Switch
              id="auto-start"
              checked={scheduling.auto_start}
              onCheckedChange={(checked) => handleSchedulingUpdate({ auto_start: checked })}
              disabled={disabled}
            />
            <Label htmlFor="auto-start" className="flex items-center gap-2">
              <Play className="h-4 w-4" />
              Auto-start at scheduled time
            </Label>
          </div>
          {scheduling.auto_start && (
            <p className="text-sm text-muted-foreground ml-6">
              Campaign will automatically start when the scheduled time arrives
            </p>
          )}
        </div>

        {/* Recurring Settings */}
        <div className="space-y-4 border-t pt-4">
          <div className="flex items-center space-x-2">
            <Switch
              id="is-recurring"
              checked={scheduling.is_recurring}
              onCheckedChange={(checked) => 
                handleSchedulingUpdate({ 
                  is_recurring: checked,
                  recurring_type: checked ? "daily" : "none"
                })
              }
              disabled={disabled}
            />
            <Label htmlFor="is-recurring" className="flex items-center gap-2">
              <Repeat className="h-4 w-4" />
              Recurring Campaign
            </Label>
          </div>

          {scheduling.is_recurring && (
            <div className="ml-6 space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="recurring-type">Repeat Type</Label>
                  <Select
                    value={scheduling.recurring_type}
                    onValueChange={(value: "daily" | "weekly" | "monthly") => 
                      handleSchedulingUpdate({ recurring_type: value })
                    }
                    disabled={disabled}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="daily">Daily</SelectItem>
                      <SelectItem value="weekly">Weekly</SelectItem>
                      <SelectItem value="monthly">Monthly</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="recurring-interval">Interval</Label>
                  <Input
                    id="recurring-interval"
                    type="number"
                    min="1"
                    value={scheduling.recurring_interval}
                    onChange={(e) => 
                      handleSchedulingUpdate({ recurring_interval: parseInt(e.target.value) || 1 })
                    }
                    disabled={disabled}
                  />
                  <p className="text-xs text-muted-foreground">
                    Every {scheduling.recurring_interval} {scheduling.recurring_type?.replace('ly', '')}(s)
                  </p>
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="recurring-until">End Date (Optional)</Label>
                <Input
                  id="recurring-until"
                  type="datetime-local"
                  value={formatDateTimeLocal(scheduling.recurring_until)}
                  onChange={(e) => 
                    handleSchedulingUpdate({ 
                      recurring_until: e.target.value ? new Date(e.target.value).toISOString() : undefined 
                    })
                  }
                  disabled={disabled}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="max-executions">Max Executions (Optional)</Label>
                <Input
                  id="max-executions"
                  type="number"
                  min="1"
                  value={scheduling.max_executions || ""}
                  onChange={(e) => 
                    handleSchedulingUpdate({ 
                      max_executions: e.target.value ? parseInt(e.target.value) : undefined 
                    })
                  }
                  disabled={disabled}
                  placeholder="No limit"
                />
              </div>
            </div>
          )}
        </div>

        {/* Time Window Settings */}
        <div className="space-y-4 border-t pt-4">
          <div className="flex items-center space-x-2">
            <Switch
              id="has-time-window"
              checked={!!scheduling.timeWindow}
              onCheckedChange={(checked) => 
                handleSchedulingUpdate({ 
                  timeWindow: checked ? {
                    start_hour: 9,
                    start_minute: 0,
                    end_hour: 17,
                    end_minute: 0
                  } : undefined
                })
              }
              disabled={disabled}
            />
            <Label htmlFor="has-time-window" className="flex items-center gap-2">
              <Timer className="h-4 w-4" />
              Restrict calling hours
            </Label>
          </div>
          <p className="text-sm text-muted-foreground ml-6">
            Only make calls during specific hours to respect contact preferences
          </p>

          {scheduling.timeWindow && (
            <div className="ml-6 space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="start-time">Start Time</Label>
                  <div className="flex gap-2">
                    <Select
                      value={scheduling.timeWindow.start_hour.toString()}
                      onValueChange={(value) => 
                        handleSchedulingUpdate({ 
                          timeWindow: { 
                            ...scheduling.timeWindow!, 
                            start_hour: parseInt(value) 
                          } 
                        })
                      }
                      disabled={disabled}
                    >
                      <SelectTrigger className="w-20">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {Array.from({ length: 24 }, (_, i) => (
                          <SelectItem key={i} value={i.toString()}>
                            {i.toString().padStart(2, '0')}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <span className="flex items-center">:</span>
                    <Select
                      value={scheduling.timeWindow.start_minute.toString()}
                      onValueChange={(value) => 
                        handleSchedulingUpdate({ 
                          timeWindow: { 
                            ...scheduling.timeWindow!, 
                            start_minute: parseInt(value) 
                          } 
                        })
                      }
                      disabled={disabled}
                    >
                      <SelectTrigger className="w-20">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {[0, 15, 30, 45].map(minute => (
                          <SelectItem key={minute} value={minute.toString()}>
                            {minute.toString().padStart(2, '0')}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="end-time">End Time</Label>
                  <div className="flex gap-2">
                    <Select
                      value={scheduling.timeWindow.end_hour.toString()}
                      onValueChange={(value) => 
                        handleSchedulingUpdate({ 
                          timeWindow: { 
                            ...scheduling.timeWindow!, 
                            end_hour: parseInt(value) 
                          } 
                        })
                      }
                      disabled={disabled}
                    >
                      <SelectTrigger className="w-20">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {Array.from({ length: 24 }, (_, i) => (
                          <SelectItem key={i} value={i.toString()}>
                            {i.toString().padStart(2, '0')}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <span className="flex items-center">:</span>
                    <Select
                      value={scheduling.timeWindow.end_minute.toString()}
                      onValueChange={(value) => 
                        handleSchedulingUpdate({ 
                          timeWindow: { 
                            ...scheduling.timeWindow!, 
                            end_minute: parseInt(value) 
                          } 
                        })
                      }
                      disabled={disabled}
                    >
                      <SelectTrigger className="w-20">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {[0, 15, 30, 45].map(minute => (
                          <SelectItem key={minute} value={minute.toString()}>
                            {minute.toString().padStart(2, '0')}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </div>

              <div className="space-y-2">
                <Label>Days of Week (Optional)</Label>
                <div className="flex flex-wrap gap-2">
                  {[
                    { value: 0, label: 'Sun' },
                    { value: 1, label: 'Mon' },
                    { value: 2, label: 'Tue' },
                    { value: 3, label: 'Wed' },
                    { value: 4, label: 'Thu' },
                    { value: 5, label: 'Fri' },
                    { value: 6, label: 'Sat' }
                  ].map(day => (
                    <Button
                      key={day.value}
                      type="button"
                      size="sm"
                      variant={
                        scheduling.timeWindow?.days_of_week?.includes(day.value) 
                          ? "default" 
                          : "outline"
                      }
                      onClick={() => {
                        const currentDays = scheduling.timeWindow?.days_of_week || [];
                        const newDays = currentDays.includes(day.value)
                          ? currentDays.filter(d => d !== day.value)
                          : [...currentDays, day.value];
                        
                        handleSchedulingUpdate({ 
                          timeWindow: { 
                            ...scheduling.timeWindow!, 
                            days_of_week: newDays.length > 0 ? newDays : undefined
                          } 
                        });
                      }}
                      disabled={disabled}
                    >
                      {day.label}
                    </Button>
                  ))}
                </div>
                <p className="text-xs text-muted-foreground">
                  Leave empty to allow calls on all days
                </p>
              </div>

              <div className="bg-blue-50 p-3 rounded-lg text-sm">
                <p className="font-medium text-blue-900">Time Window Preview:</p>
                <p className="text-blue-800">
                  Calls will be made from {scheduling.timeWindow.start_hour.toString().padStart(2, '0')}:
                  {scheduling.timeWindow.start_minute.toString().padStart(2, '0')} to {' '}
                  {scheduling.timeWindow.end_hour.toString().padStart(2, '0')}:
                  {scheduling.timeWindow.end_minute.toString().padStart(2, '0')}
                  {scheduling.timeWindow.days_of_week && scheduling.timeWindow.days_of_week.length > 0 && (
                    <> on {scheduling.timeWindow.days_of_week.map(d => 
                      ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'][d]
                    ).join(', ')}</>
                  )}
                </p>
              </div>
            </div>
          )}
        </div>

        {/* Preview */}
        {scheduling.scheduled_start_time && (
          <div className="bg-muted/50 p-4 rounded-lg space-y-2">
            <h4 className="font-medium flex items-center gap-2">
              <Clock className="h-4 w-4" />
              Schedule Preview
            </h4>
            <div className="text-sm space-y-1">
              <p>
                <strong>Start:</strong> {(() => {
                  // Show exactly what the user entered, without any conversion confusion
                  if (scheduling._user_input_datetime && scheduling.scheduled_start_time.includes('T')) {
                    // This is raw user input, show it directly as 24-hour time
                    const [datePart, timePart] = scheduling.scheduled_start_time.split('T');
                    const [year, month, day] = datePart.split('-');
                    const [hour, minute] = timePart.split(':');
                    return `${month}/${day}/${year}, ${hour}:${minute}:00`;
                  } else {
                    // Fallback for old format
                    return new Date(scheduling.scheduled_start_time).toLocaleString("en-US");
                  }
                })()} ({scheduling.timezone})
              </p>
              {scheduling.is_recurring && (
                <>
                  <p>
                    <strong>Repeats:</strong> Every {scheduling.recurring_interval} {scheduling.recurring_type?.replace('ly', '')}(s)
                  </p>
                  {scheduling.recurring_until && (
                    <p>
                      <strong>Until:</strong> {new Date(scheduling.recurring_until).toLocaleString("en-US", { 
                        timeZone: scheduling.timezone,
                        year: 'numeric',
                        month: '2-digit', 
                        day: '2-digit',
                        hour: '2-digit',
                        minute: '2-digit',
                        second: '2-digit'
                      })} ({scheduling.timezone})
                    </p>
                  )}
                  {scheduling.max_executions && (
                    <p>
                      <strong>Max executions:</strong> {scheduling.max_executions}
                    </p>
                  )}
                </>
              )}
              <p>
                <strong>Auto-start:</strong> {scheduling.auto_start ? "Yes" : "No"}
              </p>
              {scheduling.timeWindow && (
                <p>
                  <strong>Calling hours:</strong> {scheduling.timeWindow.start_hour.toString().padStart(2, '0')}:
                  {scheduling.timeWindow.start_minute.toString().padStart(2, '0')} - {' '}
                  {scheduling.timeWindow.end_hour.toString().padStart(2, '0')}:
                  {scheduling.timeWindow.end_minute.toString().padStart(2, '0')} ({scheduling.timezone})
                </p>
              )}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}