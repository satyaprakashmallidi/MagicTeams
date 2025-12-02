'use client';

import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { CSVFile } from '../types';
import { useEffect, useState } from 'react';
import { SupabaseService } from '@/lib/services/supabase.service';

interface FieldsDialogProps {
  showDialog: boolean;
  setShowDialog: (show: boolean) => void;
  activeFile: CSVFile | undefined;
  botId: string;
  onBack: () => void;
  onStartCalls: (mappedFields: Record<string, string>) => void;
}

export function FieldsDialog({
  showDialog,
  setShowDialog,
  activeFile,
  botId,
  onBack,
  onStartCalls,
}: FieldsDialogProps) {
  const [systemPrompt, setSystemPrompt] = useState<string>('');
  const [placeholders, setPlaceholders] = useState<string[]>([]);
  const [mappedFields, setMappedFields] = useState<Record<string, string>>({});
  const [isLoading, setIsLoading] = useState<boolean>(false);


  useEffect(() => {
    if (showDialog && botId) {
      const fetchBotData = async () => {
        setIsLoading(true);
        try {
          const bot = await SupabaseService.getInstance().getBotData(botId);
          if (bot?.system_prompt) {
            setSystemPrompt(bot.system_prompt);
            
            //todo: need to fix this for dynamic pattern.,
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
              initialMapping[placeholder] = '';
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
  }, [showDialog, botId]);

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

  return (
    <Dialog open={showDialog} onOpenChange={setShowDialog}>
      <DialogContent className="sm:max-w-[600px]">
        <DialogHeader>
          <DialogTitle>Choose the Right Fields (2/2)</DialogTitle>
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
              Please select the matching field from your CSV file for each one. Below are the fields defined in your system prompt.
              </p>
              
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
                      {activeFile?.headers.map(header => (
                        <SelectItem key={header} value={header}>
                          {header.split(' ').map(word => word.charAt(0).toUpperCase() + word.slice(1)).join(' ')}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              ))}
            </>
          )}
        </div>
        <DialogFooter>
          <div className="flex justify-between w-full">
            <Button variant="outline" onClick={onBack}>
              Back
            </Button>
            <Button onClick={handleFieldsMapped}>
              Start Calls
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}