'use client';

import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Icon } from '@/components/ui/icons';
import { useToast } from '@/hooks/use-toast';
import { format } from 'date-fns';

interface EventModalProps {
  event?: any;
  eventData?: any;
  calendarAccounts: any[];
  onClose: () => void;
  onSave: (event: any) => Promise<void>;
  onDelete?: (event: any) => Promise<void>;
}

export function EventModal({ event, eventData, calendarAccounts, onClose, onSave, onDelete }: EventModalProps) {
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();
  const isEditing = !!event?.id;

  const { register, handleSubmit, formState: { errors } } = useForm({
    defaultValues: {
      title: event?.title || event?.summary || '',
      description: event?.description || '',
      start: event?.start ? 
        format(new Date(event.start), "yyyy-MM-dd'T'HH:mm") :
        eventData?.start ? format(new Date(eventData.start), "yyyy-MM-dd'T'HH:mm") : '',
      end: event?.end ? 
        format(new Date(event.end), "yyyy-MM-dd'T'HH:mm") :
        eventData?.end ? format(new Date(eventData.end), "yyyy-MM-dd'T'HH:mm") : '',
      calendarId: event?.calendarId || eventData?.calendarId || calendarAccounts[0]?.id
    }
  });

  const onSubmit = async (data: any) => {
    try {
      setLoading(true);

      // Format event data
      const eventData = {
        id: event?.id,
        title: data.title,
        description: data.description,
        start: new Date(data.start),
        end: new Date(data.end),
        calendarId: data.calendarId,
      };

      await onSave(eventData);
      
      // Close modal immediately after saving
      onClose();
    } catch (error: any) {
      console.error('Error saving event:', error);
      toast({
        title: 'Error',
        description: error.message || 'Failed to save event',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{isEditing ? 'Edit Event' : 'Create Event'}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700">Calendar</label>
            <select
              {...register('calendarId', { required: true })}
              className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
              disabled={loading}
            >
              {calendarAccounts.map(account => (
                <option key={account.id} value={account.id}>
                  {account.calendar_email}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700">Title</label>
            <Input
              {...register('title', { required: true })}
              placeholder="Event title"
              disabled={loading}
            />
            {errors.title && <span className="text-red-500 text-sm">Title is required</span>}
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700">Description</label>
            <Textarea
              {...register('description')}
              placeholder="Event description"
              disabled={loading}
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700">Start</label>
              <Input
                type="datetime-local"
                {...register('start', { required: true })}
                disabled={loading}
              />
              {errors.start && <span className="text-red-500 text-sm">Start time is required</span>}
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700">End</label>
              <Input
                type="datetime-local"
                {...register('end', { required: true })}
                disabled={loading}
              />
              {errors.end && <span className="text-red-500 text-sm">End time is required</span>}
            </div>
          </div>
          <DialogFooter className="gap-2 sm:gap-0">
            <div className="flex items-center justify-between w-full">
              {isEditing && onDelete && (
                <Button
                  type="button"
                  variant="destructive"
                  onClick={async () => {
                    if (!confirm('Are you sure you want to delete this event?')) return;
                    try {
                      setLoading(true);
                      await onDelete(event);
                    } catch (error) {
                      // Error is handled in the parent component
                    } finally {
                      setLoading(false);
                    }
                  }}
                  disabled={loading}
                >
                  {loading ? (
                    <>
                      <Icon name="loader2" className="h-4 w-4 animate-spin mr-2" />
                      Deleting...
                    </>
                  ) : (
                    <>
                      <Icon name="trash" className="h-4 w-4 mr-2" />
                      Delete
                    </>
                  )}
                </Button>
              )}
              <div className="flex gap-2">
                <Button type="button" variant="outline" onClick={onClose} disabled={loading}>
                  Cancel
                </Button>
                <Button type="submit" disabled={loading}>
                  {loading ? (
                    <>
                      <Icon name="loader2" className="h-4 w-4 animate-spin mr-2" />
                      {isEditing ? 'Updating...' : 'Creating...'}
                    </>
                  ) : (
                    isEditing ? 'Update' : 'Create'
                  )}
                </Button>
              </div>
            </div>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
