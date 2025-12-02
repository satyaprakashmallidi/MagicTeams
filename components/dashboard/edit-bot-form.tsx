'use client';

import { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import { supabase } from '@/lib/supabase';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/hooks/use-toast';
import { Bot } from '@/types/database';

const formSchema = z.object({
  system_prompt: z.string().min(1, 'System prompt is required'),
});

type FormData = z.infer<typeof formSchema>;

interface EditBotFormProps {
  botId: string;
  onClose: () => void;
}

export function EditBotForm({ botId, onClose }: EditBotFormProps) {
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();
  const { register, handleSubmit, setValue, formState: { errors } } = useForm<FormData>({
    resolver: zodResolver(formSchema),
  });

  useEffect(() => {
    const fetchBot = async () => {
      const { data, error } = await supabase
        .from('bots')
        .select('*')
        .eq('id', botId)
        .single();

      if (error) {
        toast({
          title: 'Error',
          description: 'Failed to fetch bot details',
          variant: 'destructive',
        });
        return;
      }

      if (data) {
        setValue('system_prompt', data.system_prompt);
      }
    };

    fetchBot();
  }, [botId, setValue, toast]);

  const onSubmit = async (data: FormData) => {
    setLoading(true);
    try {
      const { error } = await supabase
        .from('bots')
        .update({ system_prompt: data.system_prompt })
        .eq('id', botId);

      if (error) {
        toast({
          title: 'Error updating bot',
          description: error.message,
          variant: 'destructive',
        });
        throw error;
      }

      toast({
        title: 'Success',
        description: 'Bot updated successfully',
      });

      onClose();
    } catch (error) {
      console.error('Error updating bot:', error);
      toast({
        title: 'Error',
        description: error instanceof Error ? error.message : 'Failed to update bot',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
      <div>
        <Label htmlFor="system_prompt">System Prompt</Label>
        <Textarea
          id="system_prompt"
          {...register('system_prompt')}
          placeholder="Enter the system prompt..."
          className="h-32"
        />
        {errors.system_prompt && (
          <p className="text-sm text-red-500">{errors.system_prompt.message}</p>
        )}
      </div>

      <div className="flex gap-2">
        <Button type="submit" disabled={loading}>
          {loading ? 'Updating...' : 'Update Bot'}
        </Button>
        <Button type="button" variant="outline" onClick={onClose}>
          Cancel
        </Button>
      </div>
    </form>
  );
}
