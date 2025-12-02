'use client';

import { useState } from 'react';
import { useKnowledgeBase } from '@/hooks/use-knowledge-base';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Icon } from '@/components/ui/icons';
import { useToast } from '@/hooks/use-toast';
import { useUser } from '@/hooks/use-user';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

interface KnowledgeBaseDetailsProps {
  baseId: string;
}

export function KnowledgeBaseDetails({ baseId }: KnowledgeBaseDetailsProps) {
  const { bases, updateKnowledgeBase, deleteKnowledgeBase, isLoading } = useKnowledgeBase();
  const { toast } = useToast();
  const { user } = useUser();
  const [isEditing, setIsEditing] = useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [editForm, setEditForm] = useState({
    name: '',
    description: '',
    urls: [] as string[]
  });
  const [currentUrl, setCurrentUrl] = useState('');

  const base = bases.find(b => b.corpus_id === baseId);

  if (!base) {
    return (
      <div className="flex items-center justify-center h-full">
        <p className="text-gray-500">Knowledge base not found</p>
      </div>
    );
  }

  const handleEdit = () => {
    setEditForm({
      name: base.name,
      description: base.description || '',
      urls: base.knowledgebase_sources[0]?.source_urls || []
    });
    setIsEditing(true);
  };

  const handleUpdate = async () => {
    if (!user?.id) return;
    try {
      await updateKnowledgeBase(baseId, {
        ...editForm,
        user_id: user.id
      });
      setIsEditing(false);
      toast({
        title: 'Success',
        description: 'Knowledge base updated successfully',
      });
    } catch (error) {
      toast({
        title: 'Error',
        description: 'Failed to update knowledge base',
        variant: 'destructive',
      });
    }
  };

  const handleDelete = async () => {
    if (!user?.id) return;
    try {
      await deleteKnowledgeBase(baseId, user.id);
      toast({
        title: 'Success',
        description: 'Knowledge base deleted successfully',
      });
    } catch (error) {
      toast({
        title: 'Error',
        description: 'Failed to delete knowledge base',
        variant: 'destructive',
      });
    }
  };

  const addUrl = () => {
    if (currentUrl && !editForm.urls.includes(currentUrl)) {
      setEditForm(prev => ({
        ...prev,
        urls: [...prev.urls, currentUrl]
      }));
      setCurrentUrl('');
    }
  };

  const removeUrl = (url: string) => {
    setEditForm(prev => ({
      ...prev,
      urls: prev.urls.filter(u => u !== url)
    }));
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-semibold text-gray-900">{base.name}</h2>
        <div className="flex gap-2">
          {!isEditing && (
            <>
              <Button
                variant="outline"
                onClick={handleEdit}
                disabled={isLoading}
                className="flex items-center gap-2"
              >
                <Icon name="edit" className="h-4 w-4" />
                Edit
              </Button>
              <Button
                variant="destructive"
                onClick={() => setShowDeleteDialog(true)}
                disabled={isLoading}
                className="flex items-center gap-2"
              >
                <Icon name="trash" className="h-4 w-4" />
                Delete
              </Button>
            </>
          )}
        </div>
      </div>

      <Card className="p-6">
        {isEditing ? (
          <div className="space-y-4">
            <div>
              <Label htmlFor="name">Name</Label>
              <Input
                id="name"
                value={editForm.name}
                onChange={(e) => setEditForm(prev => ({ ...prev, name: e.target.value }))}
              />
            </div>

            <div>
              <Label htmlFor="description">Description</Label>
              <Textarea
                id="description"
                value={editForm.description}
                onChange={(e) => setEditForm(prev => ({ ...prev, description: e.target.value }))}
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
              <div className="space-y-2">
                {editForm.urls.map((url, index) => (
                  <div key={index} className="flex items-center gap-2 bg-gray-50 p-2 rounded">
                    <span className="text-sm flex-1 truncate">{url}</span>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => removeUrl(url)}
                    >
                      Remove
                    </Button>
                  </div>
                ))}
              </div>
            </div>

            <div className="flex justify-end gap-2">
              <Button
                variant="outline"
                onClick={() => setIsEditing(false)}
                disabled={isLoading}
              >
                Cancel
              </Button>
              <Button
                onClick={handleUpdate}
                disabled={isLoading || !editForm.name || editForm.urls.length === 0}
              >
                {isLoading ? 'Saving...' : 'Save Changes'}
              </Button>
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            <div>
              <h3 className="text-sm font-medium text-gray-500">Description</h3>
              <p className="mt-1 text-sm text-gray-900">
                {base.description || 'No description provided'}
              </p>
            </div>

            <div>
              <h3 className="text-sm font-medium text-gray-500">Status</h3>
              <div className="mt-1 flex items-center gap-2">
                <span className={`text-sm px-2 py-1 rounded-full ${
                  base.knowledgebase_sources[0]?.status === 'ready' 
                    ? 'bg-green-100 text-green-700'
                    : base.knowledgebase_sources[0]?.status === 'processing'
                    ? 'bg-yellow-100 text-yellow-700'
                    : 'bg-red-100 text-red-700'
                }`}>
                  {base.knowledgebase_sources[0]?.status}
                </span>
                <span className="text-sm text-gray-500">
                  {base.knowledgebase_sources[0]?.totalDocuments} documents
                </span>
              </div>
            </div>

            <div>
              <h3 className="text-sm font-medium text-gray-500">Source URLs</h3>
              <div className="mt-1 space-y-1">
                {base.knowledgebase_sources[0]?.source_urls.map((url, index) => (
                  <div key={index} className="text-sm text-blue-600 hover:underline truncate">
                    <a href={url} target="_blank" rel="noopener noreferrer">{url}</a>
                  </div>
                ))}
              </div>
            </div>

            <div>
              <h3 className="text-sm font-medium text-gray-500">Last Updated</h3>
              <p className="mt-1 text-sm text-gray-900">
                {new Date(base.knowledgebase_sources[0]?.lastUpdated).toLocaleString()}
              </p>
            </div>
          </div>
        )}
      </Card>

      <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Are you sure?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete the knowledge base and all its associated data.
              This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="bg-red-600 hover:bg-red-700">
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
