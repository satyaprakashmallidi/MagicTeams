'use client';

import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Icon } from '@/components/ui/icons';
import { AddUrlDialog } from './add-url-dialog';
import { AddTextDialog } from './add-text-dialog';
import { useToast } from '@/hooks/use-toast';
import { useKnowledgeBaseLogger } from '../hooks/use-knowledge-base-logger';
import { uploadFileToStorage, uploadTextToStorage } from '@/lib/storage-utils';
import { LoadingSpinner } from '@/components/ui/loading-spinner';
import { KnowledgeBase } from '@/types/knowledge-base';

interface EditDocumentsDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onAddUrls: (urls: string[]) => void;
  knowledgeBase: KnowledgeBase;
}

export function EditDocumentsDialog({ isOpen, onClose, onAddUrls, knowledgeBase }: EditDocumentsDialogProps) {
  const [showUrlDialog, setShowUrlDialog] = useState(false);
  const [showTextDialog, setShowTextDialog] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const { toast } = useToast();
  const logger = useKnowledgeBaseLogger('EditDocumentsDialog');

  const handleFileSelect = async () => {
    const input = document.createElement('input');
    input.type = 'file';
    input.multiple = true;
    input.accept = '.txt,.pdf,.doc,.docx,.md';

    input.onchange = async (e) => {
      const files = (e.target as HTMLInputElement).files;
      if (files) {
        setIsUploading(true);
        logger.info('Starting file upload', { fileCount: files.length });
        
        try {
          const uploadPromises = Array.from(files).map(async (file) => {
            const uploadResult = await uploadFileToStorage(file);
            return uploadResult.url;
          });

          const uploadedUrls = await Promise.all(uploadPromises);
          
          // Instead of updating knowledge base directly, call onAddUrls
          onAddUrls(uploadedUrls);
          
          toast({
            title: 'Success',
            description: 'Files uploaded successfully',
          });
          
          onClose();
        } catch (error) {
          logger.error('Error uploading files', { error });
          toast({
            title: 'Error',
            description: 'Failed to upload files',
            variant: 'destructive',
          });
        } finally {
          setIsUploading(false);
        }
      }
    };

    input.click();
  };

  const handleAddUrl = async (url: string) => {
    onAddUrls([url]);
    setShowUrlDialog(false);
  };

  const handleAddText = async (text: string) => {
    try {
      const uploadResult = await uploadTextToStorage(text);
      onAddUrls([uploadResult.url]);
      setShowTextDialog(false);
      onClose();
    } catch (error) {
      logger.error('Error uploading text', { error });
      toast({
        title: 'Error',
        description: 'Failed to upload text',
        variant: 'destructive',
      });
    }
  };

  return (
    <>
      <Dialog open={isOpen} onOpenChange={onClose}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle>Add Documents</DialogTitle>
          </DialogHeader>
          
          <div className="grid gap-4 py-4">
            <Button
              onClick={handleFileSelect}
              className="flex items-center gap-2"
              disabled={isUploading}
            >
              {isUploading ? (
                <LoadingSpinner className="h-4 w-4" />
              ) : (
                <Icon name="upload" className="h-4 w-4" />
              )}
              Upload Files
            </Button>
            
            <Button
              onClick={() => setShowUrlDialog(true)}
              variant="outline"
              className="flex items-center gap-2"
              disabled={isUploading}
            >
              <Icon name="link" className="h-4 w-4" />
              Add URL
            </Button>
            
            <Button
              onClick={() => setShowTextDialog(true)}
              variant="outline"
              className="flex items-center gap-2"
              disabled={isUploading}
            >
              <Icon name="file-text" className="h-4 w-4" />
              Add Text
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <AddUrlDialog
        isOpen={showUrlDialog}
        onClose={() => setShowUrlDialog(false)}
        onSubmit={handleAddUrl}
      />

      <AddTextDialog
        isOpen={showTextDialog}
        onClose={() => setShowTextDialog(false)}
        onSubmit={handleAddText}
      />
    </>
  );
}
