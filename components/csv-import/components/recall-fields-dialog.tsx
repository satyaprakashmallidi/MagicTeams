'use client';

import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useEffect, useState } from 'react';
import { SupabaseService } from '@/lib/services/supabase.service';
import { CampaignContact } from '../services/campaigns-service';

interface RecallFieldsDialogProps {
  showDialog: boolean;
  setShowDialog: (show: boolean) => void;
  selectedContacts: CampaignContact[];
  botId: string;
  onBack: () => void;
  onStartCalls: (mappedFields: Record<string, string>) => void;
}

export function RecallFieldsDialog({
  showDialog,
  setShowDialog,
  selectedContacts,
  botId,
  onBack,
  onStartCalls,
}: RecallFieldsDialogProps) {
  const [systemPrompt, setSystemPrompt] = useState<string>('');
  const [placeholders, setPlaceholders] = useState<string[]>([]);
  const [mappedFields, setMappedFields] = useState<Record<string, string>>({});
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [availableFields, setAvailableFields] = useState<string[]>([]);

  // Extract available fields from the selected contacts
  useEffect(() => {
    if (selectedContacts.length > 0) {
      // Get all unique fields from the selected contacts
      const fieldsSet = new Set<string>();
      
      // Standard fields that are always available
      fieldsSet.add('contact_name');
      fieldsSet.add('contact_phone');
      fieldsSet.add('contact_email');
      
      // Extract custom fields from contact data
      selectedContacts.forEach(contact => {
        if (contact.contact_data) {
          try {
            const data = typeof contact.contact_data === 'string' 
              ? JSON.parse(contact.contact_data) 
              : contact.contact_data;
            Object.keys(data).forEach(key => fieldsSet.add(key));
          } catch (e) {
            console.log('Could not parse contact data for field extraction');
          }
        }
      });
      
      setAvailableFields(Array.from(fieldsSet).sort());
    }
  }, [selectedContacts]);

  useEffect(() => {
    if (showDialog && botId) {
      const fetchBotData = async () => {
        setIsLoading(true);
        try {
          const bot = await SupabaseService.getInstance().getBotData(botId);
          if (bot?.system_prompt) {
            setSystemPrompt(bot.system_prompt);
            
            // Extract placeholders from system prompt
            const pattern = /<<<(.*?)>>>/g;
            const matches = [];
            let match;
            while ((match = pattern.exec(bot.system_prompt)) !== null) {
              matches.push(match[1]);
            }
            
            const uniquePlaceholders = Array.from(new Set(matches));
            setPlaceholders(uniquePlaceholders);
        
            const initialMapping: Record<string, string> = {};
            uniquePlaceholders.forEach(placeholder => {
              // Try to auto-match common field names
              const lowerPlaceholder = placeholder.toLowerCase();
              if (lowerPlaceholder.includes('name') && availableFields.includes('contact_name')) {
                initialMapping[placeholder] = 'contact_name';
              } else if (lowerPlaceholder.includes('phone') && availableFields.includes('contact_phone')) {
                initialMapping[placeholder] = 'contact_phone';
              } else if (lowerPlaceholder.includes('email') && availableFields.includes('contact_email')) {
                initialMapping[placeholder] = 'contact_email';
              } else {
                // Try to find an exact match
                const exactMatch = availableFields.find(field => 
                  field.toLowerCase() === lowerPlaceholder ||
                  field.toLowerCase().includes(lowerPlaceholder)
                );
                initialMapping[placeholder] = exactMatch || '';
              }
            });
            setMappedFields(initialMapping);
          }
        } catch (error) {
          console.error('Error fetching bot data:', error);
        } finally {
          setIsLoading(false);
        }
      };
      
      fetchBotData();
    }
  }, [showDialog, botId, availableFields]);

  const handleFieldChange = (placeholder: string, headerValue: string) => {
    setMappedFields(prev => ({
      ...prev,
      [placeholder]: headerValue
    }));
  };

  const handleFieldsMapped = () => {
    console.log("mappedFields", mappedFields);
    onStartCalls(mappedFields);
  };

  const formatFieldName = (field: string) => {
    return field.split('_').map(word => word.charAt(0).toUpperCase() + word.slice(1)).join(' ');
  };

  return (
    <Dialog open={showDialog} onOpenChange={setShowDialog}>
      <DialogContent className="sm:max-w-[600px]">
        <DialogHeader>
          <DialogTitle>Map Campaign Fields (2/2)</DialogTitle>
        </DialogHeader>
        <div className="grid gap-4 py-4">
          {isLoading ? (
            <div className="flex justify-center items-center h-40">
              <p>Loading system prompt...</p>
            </div>
          ) : placeholders.length === 0 ? (
            <div className="text-center py-4">
              <p>No placeholders found in the system prompt.</p>
              <p className="text-sm text-gray-500 mt-2">
                Placeholders should be in the format &lt;&lt;&lt;placeholder_name&gt;&gt;&gt;
              </p>
            </div>
          ) : (
            <>
              <p className="text-sm text-gray-500 max-w-sm">
                Please select the matching field from your contact data for each placeholder. 
                Below are the fields defined in your bot's system prompt.
              </p>
              
              <div className="bg-blue-50 border border-blue-200 rounded-md p-3 mb-4">
                <p className="text-xs text-blue-800 font-medium mb-2">Available Contact Fields:</p>
                <div className="flex flex-wrap gap-1">
                  {availableFields.map(field => (
                    <span key={field} className="bg-white px-2 py-1 rounded text-xs text-blue-700">
                      {formatFieldName(field)}
                    </span>
                  ))}
                </div>
              </div>
              
              {placeholders.map(placeholder => (
                <div key={placeholder} className="grid grid-cols-2 gap-4 items-center">
                  <div>
                    <label className="text-sm font-medium">
                      {placeholder}
                    </label>
                    <p className="text-xs text-gray-500">
                      Format: &lt;&lt;&lt;{placeholder}&gt;&gt;&gt;
                    </p>
                  </div>
                  <Select
                    value={mappedFields[placeholder]}
                    onValueChange={(value) => handleFieldChange(placeholder, value)}
                  >
                    <SelectTrigger className="h-8">
                      <SelectValue placeholder="Select field" />
                    </SelectTrigger>
                    <SelectContent className="max-h-[200px]">
                      <SelectItem value="-- No mapping --">-- No mapping --</SelectItem>
                      {availableFields.map(field => (
                        <SelectItem key={field + placeholder} value={field || '-- No mapping --'}>
                          {formatFieldName(field)}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              ))}

              {selectedContacts.length > 0 && (
                <div className="bg-gray-50 border rounded-md p-3 mt-4">
                  <p className="text-xs text-gray-600 font-medium mb-2">
                    Preview with sample contact data:
                  </p>
                  <div className="text-xs text-gray-600 space-y-1">
                    {placeholders.map(placeholder => {
                      const mappedField = mappedFields[placeholder];
                      if (!mappedField) return null;
                      
                      const sampleContact = selectedContacts[0];
                      let sampleValue = '';
                      
                      if (mappedField === 'contact_name') {
                        sampleValue = sampleContact.contact_name || '';
                      } else if (mappedField === 'contact_phone') {
                        sampleValue = sampleContact.contact_phone || '';
                      } else if (mappedField === 'contact_email') {
                        sampleValue = sampleContact.contact_email || '';
                      } else if (sampleContact.contact_data) {
                        try {
                          const data = typeof sampleContact.contact_data === 'string' 
                            ? JSON.parse(sampleContact.contact_data) 
                            : sampleContact.contact_data;
                          sampleValue = data[mappedField] || '';
                        } catch (e) {
                          sampleValue = '';
                        }
                      }
                      
                      return (
                        <div key={placeholder} className="flex justify-between">
                          <span>&lt;&lt;&lt;{placeholder}&gt;&gt;&gt;</span>
                          <span className="font-mono">"{sampleValue}"</span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </>
          )}
        </div>
        <DialogFooter>
          <div className="flex justify-between w-full">
            <Button variant="outline" onClick={onBack}>
              Back
            </Button>
            <Button onClick={handleFieldsMapped}>
              Start Recall Campaign
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}