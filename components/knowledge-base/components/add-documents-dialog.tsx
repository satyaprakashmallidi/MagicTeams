'use client';

import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Icon } from '@/components/ui/icons';
import { AddUrlDialog } from './add-url-dialog';
import { AddTextDialog } from './add-text-dialog';
import { useToast } from '@/hooks/use-toast';
import { useKnowledgeBase } from '@/hooks/use-knowledge-base';
import { useUser } from '@/hooks/use-user';
import { useKnowledgeBaseLogger } from '../hooks/use-knowledge-base-logger';
import { uploadFileToStorage, uploadTextToStorage, deleteFileFromStorage } from '@/lib/storage-utils';
import { LoadingSpinner } from '@/components/ui/loading-spinner';
import { DocumentSource } from '@/types/knowledge-base';

interface AddDocumentsDialogProps {
  isOpen: boolean;
  onClose: () => void;
  formData: {
    name: string;
    description: string;
  };
}

export function AddDocumentsDialog({ isOpen, onClose, formData }: AddDocumentsDialogProps) {
  const [showUrlDialog, setShowUrlDialog] = useState(false);
  const [showTextDialog, setShowTextDialog] = useState(false);
  const [documents, setDocuments] = useState<DocumentSource[]>([]);
  const [isUploading, setIsUploading] = useState(false);
  const { toast } = useToast();
  const { createKnowledgeBase } = useKnowledgeBase();
  const { user } = useUser();
  const logger = useKnowledgeBaseLogger('AddDocumentsDialog');

  const handleFileSelect = async () => {
    const input = document.createElement('input');
    input.type = 'file';
    input.multiple = true;
    input.accept = '.txt,.pdf,.doc,.docx,.md';

    input.onchange = async (e) => {
      const files = (e.target as HTMLInputElement).files;
      if (files) {
        setIsUploading(true);
        console.log('📂 Starting batch file upload:', { 
          fileCount: files.length,
          totalSize: Array.from(files).reduce((sum, f) => sum + f.size, 0)
        });
        
        logger.info('Starting file upload', { fileCount: files.length });
        
        try {
          const uploadPromises = Array.from(files).map(async (file) => {
            console.log('📄 Processing file:', { 
              name: file.name,
              type: file.type,
              size: file.size 
            });
            
            const uploadResult = await uploadFileToStorage(file);
            
            console.log('✅ File processed:', { 
              name: file.name,
              url: uploadResult.url 
            });
            
            return {
              type: 'file' as const,
              name: file.name,
              url: uploadResult.url
            };
          });

          const uploadedDocs = await Promise.all(uploadPromises);
          console.log('📚 All files processed:', { 
            count: uploadedDocs.length,
            urls: uploadedDocs.map(d => d.url)
          });
          
          setDocuments(prev => [...prev, ...uploadedDocs]);
          
          toast({
            title: 'Success',
            description: 'Files uploaded successfully',
          });
        } catch (error) {
          console.error('❌ Batch upload error:', error);
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

  const handleAddUrl = (url: string) => {
    console.log('🔗 Adding URL:', { url });
    const urlObj = new URL(url);
    setDocuments(prev => [...prev, { 
      type: 'url',
      name: urlObj.hostname,
      url: url
    }]);
    setShowUrlDialog(false);
  };

  const handleAddText = async (text: string) => {
    const textNumber = documents.filter(doc => doc.type === 'text').length + 1;
    const name = `Text Document ${textNumber}.txt`;
    
    console.log('📝 Adding text document:', { 
      name,
      textLength: text.length 
    });
    
    setIsUploading(true);

    try {
      const uploadResult = await uploadTextToStorage(text, name);
      
      console.log('✅ Text document uploaded:', { 
        name,
        url: uploadResult.url 
      });

      setDocuments(prev => [...prev, { 
        type: 'text',
        name: name,
        url: uploadResult.url
      }]);
      
      toast({
        title: 'Success',
        description: 'Text document added successfully',
      });
    } catch (error) {
      console.error('❌ Text upload error:', error);
      logger.error('Failed to upload text document', { error });
      toast({
        title: 'Error',
        description: 'Failed to add text document',
        variant: 'destructive',
      });
    } finally {
      setIsUploading(false);
      setShowTextDialog(false);
    }
  };

  const handleRemoveFile = async (doc: DocumentSource) => {
    try {
      logger.info(`Removing file: ${doc.name}`);
      await deleteFileFromStorage(doc.url);
      setDocuments(docs => docs.filter(d => d.url !== doc.url));
      logger.info(`File removed successfully: ${doc.name}`);
    } catch (error) {
      logger.error('Error removing file:', error);
      toast({
        title: 'Error',
        description: 'Failed to remove file. Please try again.',
        variant: 'destructive',
      });
    }
  };

  const handleCreate = async () => {
    // Validate required fields
    if (!formData.name.trim()) {
      toast({
        title: 'Error',
        description: 'Please enter a name for the knowledge base',
        variant: 'destructive',
      });
      return;
    }

    if (!user?.id) {
      console.error('❌ No user ID found for knowledge base creation');
      return;
    }

    if (documents.length === 0) {
      toast({
        title: 'Error',
        description: 'Please add at least one document',
        variant: 'destructive',
      });
      return;
    }

    // Get array of valid URLs
    const urls = documents
      .map(doc => doc.url?.trim())
      .filter((url): url is string => !!url);

    if (urls.length === 0) {
      toast({
        title: 'Error',
        description: 'Please add at least one valid URL',
        variant: 'destructive',
      });
      return;
    }

    const request = {
      name: formData.name.trim(),
      description: formData.description.trim(),
      user_id: user.id,
      urls
    };

    console.log('🏗️ Creating knowledge base:', request);

    try {
      await createKnowledgeBase(request);
      console.log('✅ Knowledge base created successfully');
      toast({
        title: 'Success',
        description: 'Knowledge base created successfully',
      });
      onClose();
    } catch (error) {
      console.error('❌ Knowledge base creation error:', error);
      toast({
        title: 'Error',
        description: error instanceof Error ? error.message : 'Failed to create knowledge base',
        variant: 'destructive',
      });
    }
  };

  return (
    <>
      <Dialog open={isOpen} onOpenChange={onClose}>
        <DialogContent className="sm:max-w-[700px] h-[80vh] flex flex-col bg-white">
          <DialogHeader className="border-b pb-4">
            <DialogTitle>Add Documents</DialogTitle>
          </DialogHeader>
          
          <div className="grid gap-4 py-4">
            <div className="grid grid-cols-3 gap-4">
              <Button
                onClick={() => setShowUrlDialog(true)}
                variant="outline"
                className="flex items-center gap-2 justify-center h-24 flex-col"
                disabled={isUploading}
              >
                <Icon name="link" className="h-8 w-8" />
                <span>Add URL</span>
              </Button>

              <Button
                onClick={handleFileSelect}
                variant="outline"
                className="flex items-center gap-2 justify-center h-24 flex-col relative"
                disabled={isUploading}
              >
                {isUploading ? (
                  <LoadingSpinner className="h-8 w-8" />
                ) : (
                  <Icon name="file" className="h-8 w-8" />
                )}
                <span>{isUploading ? 'Uploading...' : 'Upload Files'}</span>
              </Button>

              <Button
                onClick={() => setShowTextDialog(true)}
                variant="outline"
                className="flex items-center gap-2 justify-center h-24 flex-col"
                disabled={isUploading}
              >
                <Icon name="text" className="h-8 w-8" />
                <span>Add Text</span>
              </Button>
            </div>
          </div>

          {documents.length > 0 && (
            <div className="border rounded-lg p-4 space-y-2 flex-1 overflow-y-auto">
              <h3 className="font-medium text-lg sticky top-0 bg-white pb-2 border-b">Added Documents</h3>
              <div className="space-y-2 pt-2">
                {documents.map((doc) => (
                  <div 
                    key={doc.url} 
                    className="flex items-center justify-between p-2 bg-muted rounded-md"
                  >
                    <div className="flex items-center gap-2">
                      <Icon 
                        name={doc.type === 'url' ? 'link' : doc.type === 'text' ? 'text' : 'file'} 
                        className="h-4 w-4"
                      />
                      <span className="text-sm truncate max-w-[200px]">{doc.name}</span>
                    </div>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8"
                      onClick={() => handleRemoveFile(doc)}
                    >
                      <Icon name="x" className="h-4 w-4" />
                    </Button>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="flex justify-end gap-2 pt-4 border-t mt-auto">
            <Button variant="outline" onClick={onClose} disabled={isUploading}>
              Cancel
            </Button>
            <Button 
              onClick={handleCreate} 
              disabled={documents.length === 0 || isUploading}
            >
              {isUploading ? 'Uploading...' : 'Create Knowledge Base'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <AddUrlDialog
        isOpen={showUrlDialog}
        onClose={() => setShowUrlDialog(false)}
        onAdd={handleAddUrl}
      />

      <AddTextDialog
        isOpen={showTextDialog}
        onClose={() => setShowTextDialog(false)}
        onAdd={handleAddText}
      />
    </>
  );
}
