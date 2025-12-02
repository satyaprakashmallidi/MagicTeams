"use client";

import { useState, useEffect } from 'react';
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
import { Webhook, UpdateWebhookRequest, WEBHOOK_EVENTS, WebhookEvent } from '@/types/webhooks';

interface UpdateWebhookDialogProps {
  webhook: Webhook | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function UpdateWebhookDialog({ webhook, open, onOpenChange }: UpdateWebhookDialogProps) {
  const [url, setUrl] = useState('');
  const [selectedEvents, setSelectedEvents] = useState<WebhookEvent[]>([]);
  const [agentId, setAgentId] = useState<string>('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errors, setErrors] = useState<{ [key: string]: string }>({});

  const { toast } = useToast();
  const { updateWebhook } = useWebhooks();
  const { bots } = useBots();

  // Reset form when webhook changes
  useEffect(() => {
    if (webhook && open) {
      setUrl(webhook.url);
      setSelectedEvents(webhook.events);
      setAgentId(webhook.agentId || '');
      setErrors({});
    }
  }, [webhook, open]);

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
    if (!webhook || !validateForm()) {
      return;
    }

    setIsSubmitting(true);

    try {
      const request: UpdateWebhookRequest = {
        url: url.trim(),
        events: selectedEvents,
        agentId: agentId || null,
      };

      await updateWebhook(webhook.webhook_id, request);
      
      toast({
        title: "Success",
        description: "Webhook updated successfully",
      });

      onOpenChange(false);

    } catch (error) {
      console.error('Error updating webhook:', error);
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to update webhook",
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!webhook) {
    return null;
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Icon name="webhook" className="h-5 w-5" />
            Update Webhook
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {/* Webhook ID Display */}
          <div className="space-y-2">
            <Label>Webhook ID</Label>
            <div className="flex items-center gap-2 p-2 bg-muted rounded">
              <code className="text-sm text-muted-foreground">{webhook.webhook_id}</code>
            </div>
          </div>

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

          {/* Agent/Bot Selection */}
          {/* <div className="space-y-2">
            <Label htmlFor="agent-select">Associate with Agent (Optional)</Label>
            <Select value={agentId} onValueChange={setAgentId}>
              <SelectTrigger>
                <SelectValue placeholder="Select an agent (optional)" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="">No specific agent</SelectItem>
                {bots.map((bot) => (
                  <SelectItem key={bot.id} value={bot.id}>
                    {bot.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div> */}

          {/* Status Display */}
          <div className="space-y-2">
            <Label>Current Status</Label>
            <div className="flex items-center gap-2">
              <div className={`w-2 h-2 rounded-full ${
                webhook.status === 'normal' ? 'bg-green-500' : 'bg-red-500'
              }`} />
              <span className="text-sm capitalize">{webhook.status}</span>
              {webhook.lastStatusChange && (
                <span className="text-xs text-muted-foreground">
                  (Changed: {new Date(webhook.lastStatusChange).toLocaleDateString()})
                </span>
              )}
            </div>
          </div>

          {/* Recent Failures */}
          {webhook.recentFailures && webhook.recentFailures.length > 0 && (
            <Alert variant="destructive">
              <Icon name="alertTriangle" className="h-4 w-4" />
              <AlertDescription className="text-sm">
                This webhook has {webhook.recentFailures.length} recent failure(s). 
                Check your webhook endpoint.
              </AlertDescription>
            </Alert>
          )}

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
              Update Webhook
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}