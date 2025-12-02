'use client';

import { useState, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/hooks/use-toast';
import { useUser } from '@/hooks/use-user';
import { useKnowledgeBase } from '@/hooks/use-knowledge-base';
import { Icon } from '@/components/ui/icons';
import { uploadFileToStorage, deleteFileFromStorage } from '@/lib/storage-utils';
import { LoadingSpinner } from '@/components/ui/loading-spinner';
import { DocumentSource, KnowledgeBase } from '@/types/knowledge-base';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';

interface CreateKnowledgeBaseDialogProps {
  isOpen: boolean;
  onClose: (newKnowledgeBase?: KnowledgeBase) => void;
}

export function CreateKnowledgeBaseDialog({ onClose }: CreateKnowledgeBaseDialogProps) {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [isUploading, setIsUploading] = useState(false);
  const [documents, setDocuments] = useState<DocumentSource[]>([]);
  const [currentUrl, setCurrentUrl] = useState('');
  const [urlError, setUrlError] = useState('');
  const [activeTab, setActiveTab] = useState('files');
  
  const { toast } = useToast();
  const { user } = useUser();
  const { createKnowledgeBase } = useKnowledgeBase();

  // Handle file uploads
  const handleFileSelect = useCallback(async () => {
    const input = document.createElement('input');
    input.type = 'file';
    input.multiple = true;
    input.accept = '.txt,.pdf,.doc,.docx,.md';

    input.onchange = async (e) => {
      const files = (e.target as HTMLInputElement).files;
      if (!files || files.length === 0) return;
      
      setIsUploading(true);
      console.log('📂 Starting batch file upload:', { 
        fileCount: files.length,
        totalSize: Array.from(files).reduce((sum, f) => sum + f.size, 0)
      });
      
      try {
        const uploadPromises = Array.from(files).map(async (file) => {
          console.log('📄 Processing file:', { name: file.name, size: file.size });
          const uploadResult = await uploadFileToStorage(file);
          
          return {
            type: 'file' as const,
            name: file.name,
            url: uploadResult.url
          };
        });

        const uploadedDocs = await Promise.all(uploadPromises);
        setDocuments(prev => [...prev, ...uploadedDocs]);
        
        toast({
          title: 'Success',
          description: `${uploadedDocs.length} file(s) uploaded successfully`,
        });
      } catch (error) {
        console.error('❌ Batch upload error:', error);
        toast({
          title: 'Error',
          description: 'Failed to upload files',
          variant: 'destructive',
        });
      } finally {
        setIsUploading(false);
      }
    };

    input.click();
  }, [toast]);

  // Handle URL addition
  const handleAddUrl = useCallback(() => {
    if (!currentUrl.trim()) return;
    
    try {
      // Validate URL
      new URL(currentUrl);
      
      // Add URL to documents
      setDocuments(prev => [...prev, {
        type: 'url',
        name: new URL(currentUrl).hostname,
        url: currentUrl
      }]);
      
      // Reset input and error
      setCurrentUrl('');
      setUrlError('');
    } catch (error) {
      setUrlError('Please enter a valid URL');
    }
  }, [currentUrl]);

  // Handle document removal
  const handleRemoveDocument = useCallback(async (doc: DocumentSource) => {
    try {
      console.log(`🗑️ Removing document: ${doc.name}`);
      
      // For files, we need to delete from storage
      if (doc.type === 'file') {
        await deleteFileFromStorage(doc.url);
      }
      
      // Remove from documents list
      setDocuments(prev => prev.filter(d => d.url !== doc.url));
      
      toast({
        title: 'Success',
        description: `${doc.name} removed successfully`,
      });
    } catch (error) {
      console.error('❌ Error removing document:', error);
      toast({
        title: 'Error',
        description: 'Failed to remove document',
        variant: 'destructive',
      });
    }
  }, [toast]);

  // Handle form submission
  const handleSubmit = useCallback(async (e: React.FormEvent) => {
    e.preventDefault();

    if (!user?.id) {
      toast({
        title: 'Error',
        description: 'User ID is required',
        variant: 'destructive',
      });
      return;
    }

    if (!name.trim()) {
      toast({
        title: 'Error',
        description: 'Name is required',
        variant: 'destructive',
      });
      return;
    }

    if (documents.length === 0) {
      toast({
        title: 'Error',
        description: 'Please add at least one document or URL',
        variant: 'destructive',
      });
      return;
    }

    // Extract all URLs from documents
    const urls = documents.map(doc => doc.url).filter(Boolean);

    try {
      console.log('🏗️ Creating knowledge base with:', { 
        name, 
        description, 
        documentCount: documents.length 
      });
      
      await createKnowledgeBase({
        urls,
        userId: user.id,
        name,
        description
      });

      toast({
        title: 'Success',
        description: 'Knowledge base created successfully',
      });
      
      // Close the dialog without passing a specific knowledge base
      // The parent component will refresh the list as needed
      onClose();
    } catch (error) {
      console.error('❌ Knowledge base creation error:', error);
      toast({
        title: 'Error',
        description: 'Failed to create knowledge base',
        variant: 'destructive',
      });
    }
  }, [name, description, documents, user?.id, createKnowledgeBase, onClose, toast]);

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <div className="space-y-4">
        <div>
          <Label htmlFor="name">Name</Label>
          <Input
            id="name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Enter knowledge base name"
          />
        </div>

        <div>
          <Label htmlFor="description">Description (Optional)</Label>
          <Textarea
            id="description"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Enter description"
            className="h-20"
          />
        </div>
      </div>

      <Separator />
      
      <div className="space-y-4">
        <Label>Content</Label>
        
        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList className="grid grid-cols-2 mb-4">
            <TabsTrigger value="files" className="flex items-center gap-2">
              <Icon name="file" className="h-4 w-4" />
              Files
              {documents.filter(d => d.type === 'file').length > 0 && (
                <Badge variant="secondary" className="ml-1">
                  {documents.filter(d => d.type === 'file').length}
                </Badge>
              )}
            </TabsTrigger>
            <TabsTrigger value="urls" className="flex items-center gap-2">
              <Icon name="link" className="h-4 w-4" />
              URLs
              {documents.filter(d => d.type === 'url').length > 0 && (
                <Badge variant="secondary" className="ml-1">
                  {documents.filter(d => d.type === 'url').length}
                </Badge>
              )}
            </TabsTrigger>
          </TabsList>
          
          <TabsContent value="files" className="mt-0">
            <div
              onClick={!isUploading ? handleFileSelect : undefined}
              className={`flex justify-center rounded-lg border-2 border-dashed border-gray-300 px-6 py-10 cursor-pointer hover:border-gray-400 ${isUploading ? 'opacity-50 cursor-not-allowed' : ''}`}
            >
              <div className="text-center">
                {isUploading ? (
                  <LoadingSpinner className="mx-auto h-12 w-12 text-gray-400" />
                ) : (
                  <Icon name="upload" className="mx-auto h-12 w-12 text-gray-400" />
                )}
                <div className="mt-4 flex text-sm leading-6 text-gray-600 justify-center">
                  <span className="font-semibold text-primary">
                    {isUploading ? 'Uploading...' : 'Upload files'}
                  </span>
                  {!isUploading && <p className="pl-1">or drag and drop</p>}
                </div>
                <p className="text-xs text-gray-500 mt-2">
                  PDF, TXT, DOC, DOCX, MD up to 10MB
                </p>
                <p className="text-xs text-primary mt-1">Multiple files supported</p>
              </div>
            </div>
          </TabsContent>
          
          <TabsContent value="urls" className="mt-0">
            <div className="space-y-4">
              <div className="flex gap-2 items-center">
                <Input
                  value={currentUrl}
                  onChange={(e) => {
                    setCurrentUrl(e.target.value);
                    if (urlError) setUrlError('');
                  }}
                  placeholder="Enter URL (e.g., https://example.com)"
                  className="flex-1"
                />
                <Button 
                  type="button" 
                  onClick={handleAddUrl}
                  disabled={!currentUrl.trim()}
                >
                  Add URL
                </Button>
              </div>
              
              {urlError && <p className="text-sm text-red-500">{urlError}</p>}
              
              <p className="text-xs text-gray-500">
                Add URLs to websites or direct links to documents
              </p>
            </div>
          </TabsContent>
        </Tabs>
      </div>

      {/* Document List */}
      {documents.length > 0 && (
        <div className="border rounded-lg p-4 max-h-[300px] overflow-y-auto">
          <h3 className="font-medium mb-3 flex items-center gap-2">
            <Icon name="layers" className="h-4 w-4" />
            Added Content ({documents.length})
          </h3>
          
          <div className="space-y-2">
            {documents.map((doc) => (
              <div 
                key={doc.url} 
                className="flex items-center justify-between p-2 bg-muted rounded-md overflow-hidden"
              >
                <div className="flex items-center gap-2 flex-1 min-w-0 overflow-hidden">
                  <Icon 
                    name={
                      doc.type === 'url' ? 'link' : 
                      doc.name.toLowerCase().endsWith('.pdf') ? 'file-text' : 'file'
                    } 
                    className={`h-4 w-4 flex-shrink-0 ${
                      doc.type === 'url' ? 'text-blue-500' : 'text-orange-500'
                    }`}
                  />
                  <div className="flex-1 min-w-0 overflow-hidden">
                    <span className="text-sm font-medium truncate block">
                      {doc.name}
                    </span>
                    <span className="text-xs text-gray-500 block overflow-hidden text-ellipsis break-all">
                      {doc.type === 'url' ? doc.url : doc.type.charAt(0).toUpperCase() + doc.type.slice(1)}
                    </span>
                  </div>
                </div>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="h-8 w-8 p-0 flex-shrink-0"
                  onClick={() => handleRemoveDocument(doc)}
                >
                  <Icon name="x" className="h-4 w-4" />
                  <span className="sr-only">Remove</span>
                </Button>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="flex justify-end gap-3 pt-4 border-t">
        <Button 
          type="button" 
          variant="outline" 
          onClick={() => onClose()}
          disabled={isUploading}
        >
          Cancel
        </Button>
        <Button 
          type="submit" 
          disabled={!name || documents.length === 0 || isUploading}
          className="gap-2"
        >
          {isUploading ? (
            <>
              <LoadingSpinner className="h-4 w-4" />
              <span>Processing...</span>
            </>
          ) : (
            <>
              <Icon name="plus-circle" className="h-4 w-4" />
              <span>Create Knowledge Base</span>
            </>
          )}
        </Button>
      </div>
    </form>
  );
}
