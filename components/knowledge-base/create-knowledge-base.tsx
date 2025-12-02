'use client';

import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { useToast } from '@/hooks/use-toast';
import { useUser } from '@/hooks/use-user';
import { useKnowledgeBase } from '@/hooks/use-knowledge-base';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Card } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';

interface CreateKnowledgeBaseProps {
  onClose: () => void;
}

const urlRegex = /^(https?:\/\/)?([\da-z.-]+)\.([a-z.]{2,6})([/\w .-]*)*\/?$/;

const formSchema = z.object({
  name: z.string().min(1, 'Name is required'),
  description: z.string().optional().default(''),
  urls: z.array(z.string().regex(urlRegex, 'Invalid URL format')).min(1, 'At least one URL is required'),
});

type FormData = z.infer<typeof formSchema>;

export function CreateKnowledgeBase({ onClose }: CreateKnowledgeBaseProps) {
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();
  const { user } = useUser();
  const { createKnowledgeBase } = useKnowledgeBase();
  const [urls, setUrls] = useState<string[]>([]);
  const [currentUrl, setCurrentUrl] = useState('');

  const { register, handleSubmit, formState: { errors } } = useForm<FormData>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      description: '',
      urls: []
    }
  });

  const addUrl = () => {
    if (currentUrl && urlRegex.test(currentUrl)) {
      setUrls([...urls, currentUrl]);
      setCurrentUrl('');
    }
  };

  const removeUrl = (index: number) => {
    setUrls(urls.filter((_, i) => i !== index));
  };

  const onSubmit = async (data: Omit<FormData, 'urls'>) => {
    if (!user?.id) return;
    setLoading(true);

    try {
      await createKnowledgeBase({
        name: data.name,
        description: data.description || '', // Ensure description is always a string
        user_id: user.id,
        urls
      });

      toast({
        title: 'Success',
        description: 'Knowledge base created successfully',
      });
      onClose();
    } catch (error) {
      console.error('Error creating knowledge base:', error);
      toast({
        title: 'Error',
        description: 'Failed to create knowledge base',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Card className="p-4">
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
        <div>
          <Label htmlFor="name">Name</Label>
          <Input
            id="name"
            {...register('name')}
            placeholder="Enter knowledge base name"
          />
          {errors.name && (
            <p className="text-sm text-red-500">{errors.name.message}</p>
          )}
        </div>

        <div>
          <Label htmlFor="description">Description (Optional)</Label>
          <Textarea
            id="description"
            {...register('description')}
            placeholder="Enter description"
            className="h-20"
          />
        </div>

        <div>
          <Label>URLs</Label>
          <div className="flex gap-2 mb-2">
            <Input
              value={currentUrl}
              onChange={(e) => setCurrentUrl(e.target.value)}
              placeholder="Enter URL"
              type="url"
            />
            <Button type="button" onClick={addUrl} variant="secondary">
              Add
            </Button>
          </div>
          {urls.length > 0 ? (
            <div className="space-y-2">
              {urls.map((url, index) => (
                <div key={index} className="flex items-center gap-2 bg-gray-50 p-2 rounded">
                  <span className="text-sm flex-1 truncate">{url}</span>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => removeUrl(index)}
                  >
                    Remove
                  </Button>
                </div>
              ))}
            </div>
          ) : (
            <Alert>
              <AlertDescription>
                Add at least one URL to create a knowledge base
              </AlertDescription>
            </Alert>
          )}
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
          <Button type="submit" disabled={loading || urls.length === 0}>
            {loading ? 'Creating...' : 'Create Knowledge Base'}
          </Button>
        </div>
      </form>
    </Card>
  );
}
