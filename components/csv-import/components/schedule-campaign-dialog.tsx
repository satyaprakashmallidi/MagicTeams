'use client';

import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { Icon } from "@/components/ui/icons";
import { CSVFile } from '../types';
import { useBots } from '@/hooks/use-bots';
import { useVoices } from '@/hooks/use-voices';
import { useEffect, useState } from 'react';
import { TwilioPhoneNumber } from '@/types/twilio';
import { FieldsDialog } from './fields-dialog';
import { CampaignScheduling } from '../components/campaign-scheduling';
import { CampaignScheduling as CampaignSchedulingType } from '../services/campaigns-service';

interface ScheduleCampaignDialogProps {
  showDialog: boolean;
  setShowDialog: (show: boolean) => void;
  activeFile: CSVFile | undefined;
  currentCallIndex: number;
  callNotes: string;
  setCallNotes: (notes: string) => void;
  onScheduleCampaign: (botId: string, twilioPhoneNumbers: string[], mappedFields: Record<string, string>, scheduling: CampaignSchedulingType) => void;
}

export function ScheduleCampaignDialog({
  showDialog,
  setShowDialog,
  activeFile,
  currentCallIndex,
  callNotes,
  setCallNotes,
  onScheduleCampaign,
}: ScheduleCampaignDialogProps) {
  const { bots } = useBots();
  const { twilioInfo: twilioNumbers } = useVoices();
  const [validationError, setValidationError] = useState<string | null>(null);
  const [scheduling, setScheduling] = useState<CampaignSchedulingType>({
    timezone: Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC",
    is_recurring: false,
    recurring_type: "none",
    recurring_interval: 1,
    auto_start: true // Set to true for scheduled campaigns
  });
  const [showFieldsDialog, setShowFieldsDialog] = useState(false);

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
  const [botId, setBotId] = useState(bots.filter(bot => !bot.is_deleted)[0]?.id);

  useEffect(() => {
    if (showDialog && activeFile) {
      setValidationError(null);
    }
  }, [showDialog, activeFile]);

  const validateAndGoNext = () => {
    setValidationError(null);
    if (!botId) {
      setValidationError("Please select a bot");
      return;
    }
    if (selectedPhoneNumbers.length === 0) {
      setValidationError("Please select at least one Twilio phone number");
      return;
    }
    if (!scheduling.scheduled_start_time) {
      setValidationError("Please select a scheduled start time");
      return;
    }
    setShowFieldsDialog(true);
  };

  const handleFieldsMapped = (mappedFields: Record<string, string>) => {
    setShowFieldsDialog(false);
    onScheduleCampaign(botId, selectedPhoneNumbers, mappedFields, scheduling);
  };

  const handlePhoneNumberToggle = (phoneNumber: string, checked: boolean) => {
    if (checked) {
      setSelectedPhoneNumbers(prev => [...prev, phoneNumber]);
    } else {
      setSelectedPhoneNumbers(prev => prev.filter(num => num !== phoneNumber));
    }
    setValidationError(null);
  };

  const toggleSelectAll = () => {
    if (selectedPhoneNumbers.length === uniquePhoneNumbers.length) {
      setSelectedPhoneNumbers([]);
    } else {
      setSelectedPhoneNumbers(uniquePhoneNumbers.map(num => num.phone_number));
    }
    setValidationError(null);
  };

  return (
    <>
      <Dialog open={showDialog && !showFieldsDialog} onOpenChange={setShowDialog}>
        <DialogContent className="sm:max-w-[600px] max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Schedule Campaign</DialogTitle>
          </DialogHeader>
          <div className="grid gap-4 py-4">
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
                  {bots.filter(bot => !bot.is_deleted).map((bot) => (
                    <SelectItem key={bot.id} value={bot.id}>{bot.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <label className="text-sm font-medium">Select Twilio Numbers</label>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={toggleSelectAll}
                >
                  {selectedPhoneNumbers.length === uniquePhoneNumbers.length ? (
                    <>
                      <Icon name="x" className="h-4 w-4 mr-1" />
                      Deselect All
                    </>
                  ) : (
                    <>
                      <Icon name="check" className="h-4 w-4 mr-1" />
                      Select All
                    </>
                  )}
                </Button>
              </div>
              
              {selectedPhoneNumbers.length > 0 && (
                <div className="flex flex-wrap gap-1 mb-2">
                  {selectedPhoneNumbers.map((phoneNumber) => {
                    const numberInfo = uniquePhoneNumbers.find(n => n.phone_number === phoneNumber);
                    return (
                      <Badge key={phoneNumber} variant="secondary" className="text-xs">
                        {numberInfo?.friendly_name || phoneNumber}
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          className="h-auto p-0 ml-1"
                          onClick={() => handlePhoneNumberToggle(phoneNumber, false)}
                        >
                          <Icon name="x" className="h-3 w-3" />
                        </Button>
                      </Badge>
                    );
                  })}
                </div>
              )}
              
              <div className="border rounded-md p-3 max-h-48 overflow-y-auto space-y-2">
                {uniquePhoneNumbers.map((number) => (
                  <div key={number.phone_number} className="flex items-center space-x-2">
                    <Checkbox
                      id={`phone-${number.phone_number}`}
                      checked={selectedPhoneNumbers.includes(number.phone_number)}
                      onCheckedChange={(checked) => 
                        handlePhoneNumberToggle(number.phone_number, checked as boolean)
                      }
                    />
                    <label 
                      htmlFor={`phone-${number.phone_number}`}
                      className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 cursor-pointer flex-1"
                    >
                      <div className="flex justify-between items-center">
                        <span>{number.friendly_name}</span>
                        <span className="text-xs text-muted-foreground font-mono">
                          {number.phone_number}
                        </span>
                      </div>
                    </label>
                  </div>
                ))}
              </div>
              
              <div className="bg-blue-50 p-3 rounded-lg">
                <div className="flex items-start gap-2">
                  <Icon name="info" className="h-4 w-4 text-blue-600 mt-0.5" />
                  <div className="text-xs text-blue-800">
                    <div className="font-medium mb-1">Smart Number Selection</div>
                    <div>
                      When multiple numbers are selected, the system will automatically choose the nearest number based on the customer's timezone for optimal call timing and response rates.
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Campaign Scheduling */}
            <div className="mt-4">
              <CampaignScheduling
                initialScheduling={scheduling}
                onSchedulingChange={setScheduling}
              />
            </div>
            
            {validationError && (
              <div className="text-red-500 text-sm mt-2">
                {validationError}
              </div>
            )}
          </div>
          <DialogFooter>
            <div className="flex justify-between w-full">
              <Button variant="outline" onClick={() => setShowDialog(false)}>
                Cancel
              </Button>
              <Button onClick={validateAndGoNext}>
                Next
              </Button>
            </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <FieldsDialog
        showDialog={showDialog && showFieldsDialog}
        setShowDialog={setShowFieldsDialog}
        activeFile={activeFile}
        botId={botId}
        onBack={() => setShowFieldsDialog(false)}
        onStartCalls={handleFieldsMapped}
      />
    </>
  );
}