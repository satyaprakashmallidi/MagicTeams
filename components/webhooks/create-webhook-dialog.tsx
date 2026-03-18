"use client";

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Icon } from '@/components/ui/icons';
import { useToast } from '@/hooks/use-toast';
import { useWebhooks } from '@/hooks/use-webhooks';
import { useBots } from '@/hooks/use-bots';
import { CreateWebhookRequest, WEBHOOK_EVENTS, WebhookEvent } from '@/types/webhooks';

interface CreateWebhookDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function CreateWebhookDialog({ open, onOpenChange }: CreateWebhookDialogProps) {
  const [url, setUrl] = useState('');
  const [selectedEvents, setSelectedEvents] = useState<WebhookEvent[]>([]);
  const [selectedBotId, setSelectedBotId] = useState<string>('global');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errors, setErrors] = useState<{ [key: string]: string }>({});

  const { toast } = useToast();
  const { createWebhook } = useWebhooks();
  const { bots } = useBots();

  const validateForm = () => {
    const newErrors: { [key: string]: string } = {};

    // Validate URL
    if (!url.trim()) {
      newErrors.url = 'URL is required';
    } else {
      try {
        new URL(url);
      } catch {
        newErrors.url = 'Invalid URL format';
      }
    }

    // Validate events
    if (selectedEvents.length === 0) {
      newErrors.events = 'At least one event must be selected';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleEventToggle = (event: WebhookEvent) => {
    setSelectedEvents(prev => 
      prev.includes(event)
        ? prev.filter(e => e !== event)
        : [...prev, event]
    );
  };

  const handleSubmit = async () => {
    if (!validateForm()) {
      return;
    }

    setIsSubmitting(true);

    try {
      const selectedBot = selectedBotId === 'global'
        ? null
        : bots.find(bot => bot.id === selectedBotId) || null;

      if (selectedBot && !selectedBot.ultravox_agent_id) {
        toast({
          title: "Error",
          description: "Selected bot is not synced to Ultravox. Please sync the bot first.",
          variant: "destructive",
        });
        return;
      }

      const request: CreateWebhookRequest = {
        url: url.trim(),
        events: selectedEvents,
        agentId: selectedBot?.ultravox_agent_id || null,
        agent_id: selectedBot?.id || null,
      };

      await createWebhook(request);
      
      toast({
        title: "Success",
        description: "Webhook created successfully",
      });

      // Reset form
      setUrl('');
      setSelectedEvents([]);
      setSelectedBotId('global');
      setErrors({});
      onOpenChange(false);

    } catch (error) {
      console.error('Error creating webhook:', error);
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to create webhook",
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Icon name="webhook" className="h-5 w-5" />
            Create New Webhook
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {/* URL Input */}
          <div className="space-y-2">
            <Label htmlFor="webhook-url">Webhook URL *</Label>
            <Input
              id="webhook-url"
              type="url"
              placeholder="https://your-domain.com/webhook"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              className={errors.url ? 'border-red-500' : ''}
            />
            {errors.url && (
              <Alert variant="destructive">
                <AlertDescription className="text-sm">{errors.url}</AlertDescription>
              </Alert>
            )}
          </div>

          {/* Events Selection */}
          <div className="space-y-2">
            <Label>Webhook Events *</Label>
            <div className="space-y-3">
              {WEBHOOK_EVENTS.map((event) => (
                <div key={event.value} className="flex items-start space-x-3">
                  <Checkbox
                    id={event.value}
                    checked={selectedEvents.includes(event.value)}
                    onCheckedChange={() => handleEventToggle(event.value)}
                  />
                  <div className="grid gap-1.5 leading-none">
                    <label
                      htmlFor={event.value}
                      className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
                    >
                      {event.label}
                    </label>
                    <p className="text-xs text-muted-foreground">
                      {event.description}
                    </p>
                  </div>
                </div>
              ))}
            </div>
            {errors.events && (
              <Alert variant="destructive">
                <AlertDescription className="text-sm">{errors.events}</AlertDescription>
              </Alert>
            )}
          </div>

          {/* Scope Selection */}
          <div className="space-y-2">
            <Label htmlFor="scope-select">Scope</Label>
            <Select value={selectedBotId} onValueChange={setSelectedBotId}>
              <SelectTrigger>
                <SelectValue placeholder="Select scope" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="global">Global (All Bots)</SelectItem>
                {bots.filter(bot => !bot.is_deleted).map((bot) => (
                  <SelectItem key={bot.id} value={bot.id}>
                    {bot.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Info Alert */}
          <Alert>
            <Icon name="info" className="h-4 w-4" />
            <AlertDescription className="text-sm">
              Webhooks will receive HTTP POST requests when the selected events occur. 
              A webhook secret will be automatically generated for security.
            </AlertDescription>
          </Alert>

          {/* Actions */}
          <div className="flex justify-end gap-3">
            <Button
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={isSubmitting}
            >
              Cancel
            </Button>
            <Button
              onClick={handleSubmit}
              disabled={isSubmitting}
              className="flex items-center gap-2"
            >
              {isSubmitting && <Icon name="loader" className="h-4 w-4 animate-spin" />}
              Create Webhook
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
