'use client';

import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from '@/components/ui/checkbox';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Input } from '@/components/ui/input';
import { useBots } from '@/hooks/use-bots';
import { useVoices } from '@/hooks/use-voices';
import { usePricing } from '@/hooks/use-pricing';
import { useEffect, useState } from 'react';
import { TwilioPhoneNumber } from '@/types/twilio';
import { RecallFieldsDialog } from './recall-fields-dialog';
import { Campaign, CampaignContact } from '../services/campaigns-service';

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

interface CampaignSettings {
  enableNumberLocking: boolean;
}

interface RecallCampaignDialogProps {
  showDialog: boolean;
  setShowDialog: (show: boolean) => void;
  selectedCampaign: Campaign | null;
  selectedContacts: CampaignContact[];
  onRecallCampaign: (
    botId: string,
    twilioPhoneNumbers: string[],
    mappedFields: Record<string, string>,
    campaignSettings: CampaignSettings,
    scheduling: 'now' | 'schedule',
    scheduledDateTime?: string,
    timezone?: string
  ) => void;
}

export function RecallCampaignDialog({
  showDialog,
  setShowDialog,
  selectedCampaign,
  selectedContacts,
  onRecallCampaign,
}: RecallCampaignDialogProps) {
  const { bots: botss } = useBots();
  const bots = botss.filter(bot => !bot.is_deleted);
  const { twilioInfo: twilioNumbers } = useVoices();
  const { time } = usePricing();
  const [validationError, setValidationError] = useState<string | null>(null);
  const [showFieldsDialog, setShowFieldsDialog] = useState(false);
  const [currentStep, setCurrentStep] = useState(1);
  const [scheduling, setScheduling] = useState<'now' | 'schedule'>('now');
  const [scheduledDateTime, setScheduledDateTime] = useState<string>('');
  const [timezone, setTimezone] = useState<string>(Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC');

  // Helper function to get default scheduled time (current time)
  const getDefaultScheduledTime = () => {
    const now = new Date();
    // Format as YYYY-MM-DDTHH:mm with correct local time
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const day = String(now.getDate()).padStart(2, '0');
    const hours = String(now.getHours()).padStart(2, '0');
    const minutes = String(now.getMinutes()).padStart(2, '0');
    return `${year}-${month}-${day}T${hours}:${minutes}`;
  };

  const flattenedPhoneNumbers = (twilioNumbers || []).reduce((acc, account) => {
    return acc.concat(
      (account.phone_numbers || []).map(number => ({
        ...number,
        accountSid: account.account_sid
      }))
    );
  }, [] as (TwilioPhoneNumber & { accountSid: string })[]);
  
  const uniquePhoneNumbers = Array.from(
    new Map(flattenedPhoneNumbers.map(item => [item.phone_number, item])).values()
  );
  
  const [selectedPhoneNumbers, setSelectedPhoneNumbers] = useState<string[]>([]);
  const [botId, setBotId] = useState(selectedCampaign?.bot_id || bots[0]?.id || '');
  const [campaignSettings, setCampaignSettings] = useState<CampaignSettings>({
    enableNumberLocking: false
  });

  useEffect(() => {
    if (showDialog && selectedCampaign) {
      setValidationError(null);
      setCurrentStep(1);
      setSelectedPhoneNumbers([selectedCampaign.twilio_phone_number]);
      setBotId(selectedCampaign.bot_id);
      setCampaignSettings({ enableNumberLocking: false });
      setScheduling('now');
      setScheduledDateTime('');
      setTimezone(Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC');
    }
  }, [showDialog, selectedCampaign]);

  const validateStep1 = () => {
    setValidationError(null);
    
    // Check credits first
    if (time <= 0) {
      setValidationError("No credits left. Please top up your account to continue using campaigns.");
      return false;
    }
    
    if (!botId) {
      setValidationError("Please select a bot");
      return false;
    }
    if (selectedPhoneNumbers.length === 0) {
      setValidationError("Please select at least one Twilio phone number");
      return false;
    }
    
    // Estimate call duration and check if sufficient credits
    const estimatedCallsCount = selectedContacts.length;
    const averageCallDuration = 120; // 2 minutes average
    const estimatedTotalDuration = estimatedCallsCount * averageCallDuration;
    
    if (estimatedTotalDuration > time) {
      setValidationError(`Insufficient credits. You need approximately ${Math.ceil(estimatedTotalDuration / 60)} minutes but only have ${Math.floor(time / 60)} minutes remaining.`);
      return false;
    }

    // Validate scheduling if scheduled
    if (scheduling === 'schedule') {
      if (!scheduledDateTime) {
        setValidationError("Please select a date and time for the scheduled campaign");
        return false;
      }
      
      const scheduledDate = new Date(scheduledDateTime);
      const now = new Date();
      
      if (scheduledDate <= now) {
        setValidationError("Scheduled time must be in the future");
        return false;
      }
    }
    
    return true;
  };

  const handleNext = () => {
    if (currentStep === 1 && validateStep1()) {
      setShowFieldsDialog(true);
    }
  };

  const handlePhoneNumberToggle = (phoneNumber: string) => {
    setSelectedPhoneNumbers(prev => 
      prev.includes(phoneNumber) 
        ? prev.filter(num => num !== phoneNumber)
        : [...prev, phoneNumber]
    );
    setValidationError(null);
  };

  const handleFieldsMapped = (mappedFields: Record<string, string>) => {
    setShowFieldsDialog(false);
    onRecallCampaign(botId, selectedPhoneNumbers, mappedFields, campaignSettings, scheduling, scheduledDateTime, timezone);
  };

  const renderStepContent = () => {
    switch (currentStep) {
      case 1:
        return (
          <div className="grid gap-4 py-4">
            {/* Credits Display */}
            <div className="bg-gray-50 p-3 rounded-lg">
              <div className="flex justify-between items-center text-sm">
                <span>Available Credits:</span>
                <span className={`font-medium ${time <= 0 ? 'text-red-600' : time < 300 ? 'text-yellow-600' : 'text-green-600'}`}>
                  {Math.floor(time / 60)} minutes ({time} seconds)
                </span>
              </div>
              <div className="text-xs text-muted-foreground mt-1">
                Estimated usage: ~{Math.ceil(selectedContacts.length * 2)} minutes for {selectedContacts.length} contacts
              </div>
            </div>
            
            <div className="space-y-2">
              <label className="text-sm font-medium">Select Bot</label>
              <Select
                value={botId}
                onValueChange={(value: any) => {
                  setBotId(value);
                  setValidationError(null);
                }}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select Bot" />
                </SelectTrigger>
                <SelectContent>
                  {bots.map((bot) => (
                    <SelectItem key={bot.id} value={bot.id}>{bot.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">Select Twilio Numbers</label>
              <p className="text-xs text-gray-500">Choose one or more phone numbers for this campaign</p>
              <div className="max-h-48 overflow-y-auto space-y-2 border rounded-md p-3">
                {uniquePhoneNumbers.map((number) => (
                  <div key={number.phone_number} className="flex items-center space-x-2">
                    <Checkbox
                      id={number.phone_number}
                      checked={selectedPhoneNumbers.includes(number.phone_number)}
                      onCheckedChange={() => handlePhoneNumberToggle(number.phone_number)}
                    />
                    <Label htmlFor={number.phone_number} className="flex-1 cursor-pointer">
                      {number.friendly_name} ({number.phone_number})
                    </Label>
                  </div>
                ))}
              </div>
              {selectedPhoneNumbers.length > 0 && (
                <p className="text-sm text-green-600">
                  {selectedPhoneNumbers.length} number(s) selected
                </p>
              )}
            </div>

            <div className="space-y-4">
              <h3 className="text-sm font-medium">Campaign Settings</h3>
              
              <div className="flex items-center justify-between">
                <div className="space-y-1">
                  <Label htmlFor="number-locking">Enable Number Locking</Label>
                  <p className="text-xs text-gray-500">
                    Prevent simultaneous calls to the same number during the campaign
                  </p>
                </div>
                <Switch
                  id="number-locking"
                  checked={campaignSettings.enableNumberLocking}
                  onCheckedChange={(checked) => 
                    setCampaignSettings(prev => ({ ...prev, enableNumberLocking: checked }))
                  }
                />
              </div>
              
              {campaignSettings.enableNumberLocking && (
                <div className="bg-blue-50 border border-blue-200 rounded-md p-3">
                  <p className="text-xs text-blue-800">
                    When enabled, each phone number will be locked during a call to prevent 
                    multiple simultaneous calls to the same contact. Numbers will be unlocked 
                    automatically when calls end.
                  </p>
                  {selectedPhoneNumbers.length > 1 && (
                    <p className="text-xs text-blue-800 mt-2">
                      <strong>Smart Number Selection:</strong> The system will automatically choose 
                      the nearest phone number based on each customer's timezone for optimal call timing.
                    </p>
                  )}
                </div>
              )}
            </div>

            {/* Scheduling Options */}
            <div className="space-y-3">
              <div className="font-medium text-sm">Campaign Execution:</div>
              <RadioGroup
                value={scheduling}
                onValueChange={(value: 'now' | 'schedule') => {
                  setScheduling(value);
                  // Set default time when switching to schedule mode
                  if (value === 'schedule' && !scheduledDateTime) {
                    setScheduledDateTime(getDefaultScheduledTime());
                  }
                }}
              >
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="now" id="now" />
                  <Label htmlFor="now">Start immediately</Label>
                </div>
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="schedule" id="schedule" />
                  <Label htmlFor="schedule">Schedule for later</Label>
                </div>
              </RadioGroup>

              {scheduling === 'schedule' && (
                <div className="ml-6 space-y-3">
                  <div className="space-y-2">
                    <Label htmlFor="datetime" className="text-sm">Schedule Date & Time:</Label>
                    <div className="flex gap-2">
                      <Input
                        id="date"
                        type="date"
                        value={scheduledDateTime ? scheduledDateTime.split('T')[0] : ''}
                        onChange={(e) => {
                          const currentTime = scheduledDateTime ? scheduledDateTime.split('T')[1] : getDefaultScheduledTime().split('T')[1];
                          setScheduledDateTime(e.target.value ? `${e.target.value}T${currentTime}` : '');
                          setValidationError(null);
                        }}
                        min={new Date().toISOString().split('T')[0]}
                        className="flex-1"
                      />
                      <div className="flex items-center gap-1">
                        {/* Hour Selector */}
                        <Select
                          value={(() => {
                            if (!scheduledDateTime) return '12';
                            const time = scheduledDateTime.split('T')[1];
                            if (!time) return '12';
                            const [hours] = time.split(':');
                            const hour = parseInt(hours);
                            const displayHour = hour === 0 ? 12 : hour > 12 ? hour - 12 : hour;
                            return displayHour.toString();
                          })()}
                          onValueChange={(value) => {
                            const currentDate = scheduledDateTime ? scheduledDateTime.split('T')[0] : new Date().toISOString().split('T')[0];
                            const currentTime = scheduledDateTime ? scheduledDateTime.split('T')[1] : getDefaultScheduledTime().split('T')[1];
                            const [, minutes] = currentTime.split(':');
                            const hour = parseInt(value);
                            const hourNum = parseInt(currentTime.split(':')[0]);
                            const isCurrentlyPM = hourNum >= 12;

                            let hour24 = hour;
                            if (isCurrentlyPM && hour !== 12) hour24 += 12;
                            if (!isCurrentlyPM && hour === 12) hour24 = 0;

                            setScheduledDateTime(`${currentDate}T${hour24.toString().padStart(2, '0')}:${minutes}`);
                            setValidationError(null);
                          }}
                        >
                          <SelectTrigger className="w-[65px]">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {[12, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11].map(hour => (
                              <SelectItem key={hour} value={hour.toString()}>
                                {hour.toString().padStart(2, '0')}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>

                        <span className="text-sm font-medium">:</span>

                        {/* Minute Selector */}
                        <Select
                          value={(() => {
                            if (!scheduledDateTime) return '00';
                            const time = scheduledDateTime.split('T')[1];
                            if (!time) return '00';
                            const [, minutes] = time.split(':');
                            return minutes;
                          })()}
                          onValueChange={(value) => {
                            const currentDate = scheduledDateTime ? scheduledDateTime.split('T')[0] : new Date().toISOString().split('T')[0];
                            const currentTime = scheduledDateTime ? scheduledDateTime.split('T')[1] : getDefaultScheduledTime().split('T')[1];
                            const [hours] = currentTime.split(':');
                            setScheduledDateTime(`${currentDate}T${hours}:${value}`);
                            setValidationError(null);
                          }}
                        >
                          <SelectTrigger className="w-[65px]">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent className="max-h-[200px]">
                            {Array.from({ length: 60 }, (_, i) => {
                              const minute = i.toString().padStart(2, '0');
                              return (
                                <SelectItem key={minute} value={minute}>
                                  {minute}
                                </SelectItem>
                              );
                            })}
                          </SelectContent>
                        </Select>

                        {/* AM/PM Selector */}
                        <Select
                          value={(() => {
                            if (!scheduledDateTime) return 'AM';
                            const time = scheduledDateTime.split('T')[1];
                            if (!time) return 'AM';
                            const [hours] = time.split(':');
                            const hour = parseInt(hours);
                            return hour >= 12 ? 'PM' : 'AM';
                          })()}
                          onValueChange={(value) => {
                            const currentDate = scheduledDateTime ? scheduledDateTime.split('T')[0] : new Date().toISOString().split('T')[0];
                            const currentTime = scheduledDateTime ? scheduledDateTime.split('T')[1] : getDefaultScheduledTime().split('T')[1];
                            const [hours, minutes] = currentTime.split(':');
                            let hour = parseInt(hours);

                            // Convert current hour to 12-hour format
                            const currentHour12 = hour === 0 ? 12 : hour > 12 ? hour - 12 : hour;

                            // Convert back to 24-hour based on new AM/PM
                            let hour24 = currentHour12;
                            if (value === 'PM' && currentHour12 !== 12) hour24 = currentHour12 + 12;
                            if (value === 'AM' && currentHour12 === 12) hour24 = 0;

                            setScheduledDateTime(`${currentDate}T${hour24.toString().padStart(2, '0')}:${minutes}`);
                            setValidationError(null);
                          }}
                        >
                          <SelectTrigger className="w-[65px]">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="AM">AM</SelectItem>
                            <SelectItem value="PM">PM</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="timezone" className="text-sm">Timezone:</Label>
                    <Select
                      value={timezone}
                      onValueChange={(value) => setTimezone(value)}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select timezone" />
                      </SelectTrigger>
                      <SelectContent className="max-h-[200px]">
                        {timezones.map((tz) => (
                          <SelectItem key={tz.value} value={tz.value}>
                            {tz.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  {scheduledDateTime && (
                    <div className="bg-blue-50 border border-blue-200 rounded-md p-3">
                      <p className="text-xs text-blue-800">
                        <strong>Scheduled Time Preview:</strong><br />
                        {(() => {
                          if (scheduledDateTime) {
                            const [datePart, timePart] = scheduledDateTime.split('T');
                            const [year, month, day] = datePart.split('-');
                            const [hour24, minute] = timePart.split(':');
                            const hourNum = parseInt(hour24);
                            const ampm = hourNum >= 12 ? 'PM' : 'AM';
                            const displayHour = hourNum === 0 ? 12 : hourNum > 12 ? hourNum - 12 : hourNum;
                            return `${month}/${day}/${year}, ${displayHour}:${minute} ${ampm}`;
                          }
                          return '';
                        })()} ({timezone})
                      </p>
                    </div>
                  )}
                </div>
              )}

              <p className="text-sm text-muted-foreground">
                {scheduling === 'now' 
                  ? 'This will create a new campaign and start calling the selected contacts immediately.' 
                  : 'This will create a scheduled campaign that will start at the specified time.'}
              </p>
            </div>
          </div>
        );
      
      default:
        return null;
    }
  };

  return (
    <>
      <Dialog open={showDialog && !showFieldsDialog} onOpenChange={setShowDialog}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle>Recall Campaign Settings (1/2)</DialogTitle>
          </DialogHeader>
          
          {renderStepContent()}
          
          {validationError && (
            <div className="bg-red-50 border border-red-200 rounded-md p-3">
              <p className="text-sm text-red-800">{validationError}</p>
            </div>
          )}
          
          <DialogFooter>
            <div className="flex justify-between w-full">
              <Button variant="outline" onClick={() => setShowDialog(false)}>
                Cancel
              </Button>
              <Button onClick={handleNext}>
                Next: Field Mapping
              </Button>
            </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      
      <RecallFieldsDialog
        showDialog={showFieldsDialog}
        setShowDialog={setShowFieldsDialog}
        selectedContacts={selectedContacts}
        botId={botId}
        onBack={() => setShowFieldsDialog(false)}
        onStartCalls={handleFieldsMapped}
      />
    </>
  );
}