'use client';

import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import { supabase } from '@/lib/supabase';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/hooks/use-toast';
import { useUser } from '@/hooks/use-user';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

const formSchema = z.object({
  name: z.string().min(1, "Tool name is required"),
  description: z.string().optional(),
  appointment_duration: z.number().min(1, "Duration must be at least 1 minute"),
  location: z.string().optional(),
  business_hours: z.object({
    monday: z.object({
      is_open: z.boolean(),
      slots: z.array(z.object({
        start: z.string(),
        end: z.string()
      }))
    }),
    tuesday: z.object({
      is_open: z.boolean(),
      slots: z.array(z.object({
        start: z.string(),
        end: z.string()
      }))
    }),
    wednesday: z.object({
      is_open: z.boolean(),
      slots: z.array(z.object({
        start: z.string(),
        end: z.string()
      }))
    }),
    thursday: z.object({
      is_open: z.boolean(),
      slots: z.array(z.object({
        start: z.string(),
        end: z.string()
      }))
    }),
    friday: z.object({
      is_open: z.boolean(),
      slots: z.array(z.object({
        start: z.string(),
        end: z.string()
      }))
    }),
    saturday: z.object({
      is_open: z.boolean(),
      slots: z.array(z.object({
        start: z.string(),
        end: z.string()
      }))
    }),
    sunday: z.object({
      is_open: z.boolean(),
      slots: z.array(z.object({
        start: z.string(),
        end: z.string()
      }))
    })
  })
});

type FormData = z.infer<typeof formSchema>;

interface CreateAppointmentToolProps {
  onClose: () => void;
}

export function CreateAppointmentTool({ onClose }: CreateAppointmentToolProps) {
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();
  const { user } = useUser();

  const { register, handleSubmit, formState: { errors } } = useForm<FormData>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      business_hours: {
        monday: { is_open: true, slots: [{ start: '09:00', end: '17:00' }] },
        tuesday: { is_open: true, slots: [{ start: '09:00', end: '17:00' }] },
        wednesday: { is_open: true, slots: [{ start: '09:00', end: '17:00' }] },
        thursday: { is_open: true, slots: [{ start: '09:00', end: '17:00' }] },
        friday: { is_open: true, slots: [{ start: '09:00', end: '17:00' }] },
        saturday: { is_open: false, slots: [] },
        sunday: { is_open: false, slots: [] }
      }
    }
  });

  const onSubmit = async (data: FormData) => {
    if (!user?.id) return;
    setLoading(true);

    try {
      const { error } = await supabase
        .from('appointment_tools')
        .insert([{
          ...data,
          user_id: user.id
        }]);

      if (error) throw error;

      toast({
        title: "Success",
        description: "Appointment tool created successfully",
      });

      onClose();
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to create appointment tool",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
      <div>
        <Label htmlFor="name">Tool Name</Label>
        <Input
          id="name"
          {...register('name')}
          placeholder="e.g., Dental Appointments"
        />
        {errors.name && (
          <p className="text-sm text-red-500">{errors.name.message}</p>
        )}
      </div>

      <div>
        <Label htmlFor="description">Description</Label>
        <Textarea
          id="description"
          {...register('description')}
          placeholder="Describe what this appointment tool is for..."
        />
      </div>

      <div>
        <Label htmlFor="appointment_duration">Appointment Duration (minutes)</Label>
        <Input
          id="appointment_duration"
          type="number"
          {...register('appointment_duration', { valueAsNumber: true })}
          defaultValue={30}
        />
        {errors.appointment_duration && (
          <p className="text-sm text-red-500">{errors.appointment_duration.message}</p>
        )}
      </div>

      <div>
        <Label htmlFor="location">Location (optional)</Label>
        <Input
          id="location"
          {...register('location')}
          placeholder="e.g., 123 Business St, Suite 100"
        />
      </div>

      <div className="flex justify-end gap-2">
        <Button
          type="button"
          variant="outline"
          onClick={onClose}
          disabled={loading}
        >
          Cancel
        </Button>
        <Button type="submit" disabled={loading}>
          {loading ? 'Creating...' : 'Create Tool'}
        </Button>
      </div>
    </form>
  );
}
