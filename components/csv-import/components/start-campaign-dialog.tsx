'use client';

import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from '@/components/ui/checkbox';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { CSVFile } from '../types';
import { useBots } from '@/hooks/use-bots';
import { useVoices } from '@/hooks/use-voices';
import { usePricing } from '@/hooks/use-pricing';
import { useEffect, useState } from 'react';
import { TwilioPhoneNumber } from '@/types/twilio';
import { FieldsDialog } from './fields-dialog';

interface CampaignSettings {
  enableNumberLocking: boolean;
}

interface StartCampaignDialogProps {
  showDialog: boolean;
  setShowDialog: (show: boolean) => void;
  activeFile: CSVFile | undefined;
  currentCallIndex: number;
  callNotes: string;
  setCallNotes: (notes: string) => void;
  onStartCampaign: (
    botId: string, 
    twilioPhoneNumbers: string[], 
    mappedFields: Record<string, string>,
    campaignSettings: CampaignSettings
  ) => void;
}

export function StartCampaignDialog({
  showDialog,
  setShowDialog,
  activeFile,
  currentCallIndex,
  callNotes,
  setCallNotes,
  onStartCampaign,
}: StartCampaignDialogProps) {
  const { bots : botss } = useBots();
  const bots = botss.filter(bot => !bot.is_deleted);
  const { twilioInfo: twilioNumbers } = useVoices();
  const { time } = usePricing();
  const [validationError, setValidationError] = useState<string | null>(null);
  const [showFieldsDialog, setShowFieldsDialog] = useState(false);
  const [currentStep, setCurrentStep] = useState(1);

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
  const [botId, setBotId] = useState(bots[0]?.id);
  const [campaignSettings, setCampaignSettings] = useState<CampaignSettings>({
    enableNumberLocking: false
  });

  useEffect(() => {
    if (showDialog && activeFile) {
      setValidationError(null);
      setCurrentStep(1);
      setSelectedPhoneNumbers([]);
      setCampaignSettings({ enableNumberLocking: false });
    }
  }, [showDialog, activeFile]);

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
    const estimatedCallsCount = activeFile?.data?.length || 0;
    const averageCallDuration = 120; // 2 minutes average
    const estimatedTotalDuration = estimatedCallsCount * averageCallDuration;
    
    if (estimatedTotalDuration > time) {
      setValidationError(`Insufficient credits. You need approximately ${Math.ceil(estimatedTotalDuration / 60)} minutes but only have ${Math.floor(time / 60)} minutes remaining.`);
      return false;
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
    onStartCampaign(botId, selectedPhoneNumbers, mappedFields, campaignSettings);
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
              {activeFile && (
                <div className="text-xs text-muted-foreground mt-1">
                  Estimated usage: ~{Math.ceil((activeFile.data?.length || 0) * 2)} minutes for {activeFile.data?.length || 0} contacts
                </div>
              )}
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
            <DialogTitle>Start Campaign Now (1/2)</DialogTitle>
          </DialogHeader>
          
          {renderStepContent()}
          
          {validationError && (
            <div className="text-red-500 text-sm mt-2">
              {validationError}
            </div>
          )}
          
          <DialogFooter>
            <div className="flex justify-between w-full">
              <Button variant="outline" onClick={() => setShowDialog(false)}>
                Cancel
              </Button>
              <Button onClick={handleNext}>
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