'use client';

import { useState, useCallback, useEffect } from 'react';
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
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from '@/components/ui/card';
import { Alert, AlertTitle, AlertDescription } from '@/components/ui/alert';

interface UpdateKnowledgeBaseDialogProps {
  isOpen: boolean;
  onClose: (updatedKnowledgeBase?: KnowledgeBase) => void;
  knowledgeBase: KnowledgeBase;
}

export function UpdateKnowledgeBaseDialog({ isOpen, onClose, knowledgeBase }: UpdateKnowledgeBaseDialogProps) {
  const [isUploading, setIsUploading] = useState(false);
  const [isUpdating, setIsUpdating] = useState(false);
  const [documents, setDocuments] = useState<DocumentSource[]>([]);
  const [currentUrl, setCurrentUrl] = useState('');
  const [urlError, setUrlError] = useState('');
  const [activeTab, setActiveTab] = useState('files');
  const [processingError, setProcessingError] = useState<string | null>(null);
  
  const { toast } = useToast();
  const { user } = useUser();
  const { updateKnowledgeBase } = useKnowledgeBase();

  // Extract a user-friendly message from error
  const extractErrorMessage = (error: any): string => {
    if (typeof error === 'string') return error;
    
    if (error instanceof Error) {
      const message = error.message || '';
      // Extract specific message about processing if present
      const processingMatch = message.match(/The source is currently processing .+ documents \(started .+ minutes ago\)/);
      if (processingMatch) return processingMatch[0];
      return message;
    }
    
    if (error && typeof error === 'object') {
      if (error.message) return error.message;
      if (error.toString) return error.toString();
    }
    
    return 'An unknown error occurred';
  };

  // Initialize documents from the knowledge base
  useEffect(() => {
    if (knowledgeBase && knowledgeBase.knowledgebase_sources) {
      const existingDocs: DocumentSource[] = [];
      console.log('🔍 Loading knowledge base sources:', knowledgeBase.knowledgebase_sources);
      
      knowledgeBase.knowledgebase_sources.forEach(source => {
        if (source.source_urls && source.source_urls.length > 0) {
          console.log(`📄 Processing ${source.source_urls.length} URLs from source ${source.source_id}`);
          
          source.source_urls.forEach(url => {
            try {
              // Try to determine if this is a file or a URL
              const urlObj = new URL(url);
              const pathParts = urlObj.pathname.split('/');
              const fileName = pathParts[pathParts.length - 1];
              
              // Common file extensions to check
              const fileExtensions = ['.pdf', '.txt', '.doc', '.docx', '.md', '.csv', '.json', '.html', '.htm'];
              // Check if URL appears to be a file
              const isFileUrl = fileName && (
                // Has a file extension
                fileExtensions.some(ext => fileName.toLowerCase().endsWith(ext)) ||
                // Contains indicators of a file in the URL
                url.includes('/download/') || 
                url.includes('/files/') ||
                url.includes('/documents/') ||
                // Has query params that suggest a file download
                urlObj.search.includes('download=true') ||
                urlObj.search.includes('file=')
              );
              
              const docType = isFileUrl ? 'file' : 'url';
              const docName = isFileUrl 
                ? decodeURIComponent(fileName) 
                : urlObj.hostname;
                
              existingDocs.push({
                type: docType,
                name: docName,
                url: url
              });
              
              console.log(`✅ Added document: ${docName} (${docType})`);
            } catch (error) {
              console.error('❌ Error processing URL:', url, error);
              // Add as URL even if parsing fails to ensure all content is displayed
              existingDocs.push({
                type: 'url',
                name: url.split('/').pop() || url,
                url: url
              });
            }
          });
        }
      });
      
      console.log(`📚 Loaded ${existingDocs.length} total documents`);
      setDocuments(existingDocs);
      
      // Reset processing error when dialog is opened with new knowledge base
      setProcessingError(null);
    }
  }, [knowledgeBase]);

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
      
      // For new files and text, we also need to delete from storage
      // For existing files from the knowledge base, we don't delete them from storage yet
      const existingUrls = knowledgeBase.knowledgebase_sources?.flatMap(s => s.source_urls) || [];
      const isNewDocument = !existingUrls.includes(doc.url);
      
      if (isNewDocument && doc.type === 'file') {
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
  }, [knowledgeBase.knowledgebase_sources, toast]);

  // Handle form submission
  const handleUpdate = useCallback(async (e: React.FormEvent) => {
    e.preventDefault();

    if (!user?.id) {
      toast({
        title: 'Error',
        description: 'User ID is required',
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

    setIsUpdating(true);
    // Clear any previous processing error when attempting a new update
    setProcessingError(null);
    
    try {
      console.log('🔄 Updating knowledge base content:', { 
        id: knowledgeBase.corpus_id,
        name: knowledgeBase.name, 
        documentCount: documents.length 
      });
      
      // Call the API function with the urls parameter
      const updatedKnowledgeBase = await updateKnowledgeBase(knowledgeBase.corpus_id, {
        name: knowledgeBase.name,
        description: knowledgeBase.description,
        user_id: user.id,
        urls: urls // Pass URLs array properly
      });

      toast({
        title: 'Success',
        description: 'Knowledge base content updated successfully',
      });
      
      // Pass the updated knowledge base back to the parent component
      onClose(updatedKnowledgeBase);
    } catch (error) {
      console.error('❌ Knowledge base update error:', error);
      
      const errorMessage = extractErrorMessage(error);
      const isProcessingError = errorMessage.includes('currently processing') || 
                               errorMessage.includes('try again after');
      
      // Set processing error state if the error is about processing
      if (isProcessingError) {
        setProcessingError(errorMessage);
      }
      
      toast({
        title: isProcessingError ? 'Update Not Allowed' : 'Update Failed',
        description: errorMessage || 'Failed to update knowledge base content',
        variant: 'destructive',
      });
    } finally {
      setIsUpdating(false);
    }
  }, [documents, user?.id, knowledgeBase, updateKnowledgeBase, onClose, toast, extractErrorMessage]);

  return (
    <Dialog open={isOpen} onOpenChange={() => onClose()}>
      <DialogContent className="sm:max-w-[800px] max-h-[90vh] flex flex-col overflow-hidden bg-white">
        <DialogHeader className="pb-4 border-b">
          <DialogTitle className="text-xl font-semibold">Manage Knowledge Base Content</DialogTitle>
          <DialogDescription>
            Add or remove files and URLs for your knowledge base
          </DialogDescription>
        </DialogHeader>
        
        <div className="flex-1 overflow-y-auto py-4 pr-2">
          <form id="update-form" onSubmit={handleUpdate} className="space-y-6">
            
            {processingError && (
              <Alert className="bg-amber-50 border-amber-200 text-amber-800">
                <Icon name="alert-triangle" className="h-5 w-5 text-amber-600" />
                <AlertTitle>Knowledge Base Processing</AlertTitle>
                <AlertDescription className="text-amber-700">
                  {processingError || "This knowledge base is currently processing documents. Updates might be rejected until processing is complete. You can proceed with caution or try again later."}
                </AlertDescription>
              </Alert>
            )}
            
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-lg font-medium flex items-center justify-between">
                  <span>Content</span>
                  <Badge variant="outline" className="font-normal">
                    {documents.length} item{documents.length !== 1 && 's'}
                  </Badge>
                </CardTitle>
                <CardDescription>
                  Add or remove files and URLs to your knowledge base
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
                  <TabsList className="grid grid-cols-2 w-full">
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
                  
                  <TabsContent value="files" className="mt-4">
                    <div
                      onClick={!isUploading ? handleFileSelect : undefined}
                      className={`relative flex justify-center rounded-xl border-2 border-dashed border-gray-300 px-6 py-10 transition-all cursor-pointer hover:border-primary/50 hover:bg-primary/5 ${isUploading ? 'opacity-50 cursor-not-allowed' : ''}`}
                    >
                      <div className="text-center">
                        {isUploading ? (
                          <LoadingSpinner className="mx-auto h-12 w-12 text-primary" />
                        ) : (
                          <div className="rounded-full bg-primary/10 p-3 mx-auto mb-4 w-fit">
                            <Icon name="upload-cloud" className="h-10 w-10 text-primary" />
                          </div>
                        )}
                        <div className="mt-2 flex flex-col gap-1">
                          <span className="font-semibold text-primary text-lg">
                            {isUploading ? 'Uploading...' : 'Click to upload files'}
                          </span>
                          {!isUploading && <p className="text-sm text-gray-500">or drag and drop</p>}
                        </div>
                        <div className="mt-2 flex flex-col gap-1">
                          <p className="text-xs text-gray-500">
                            Supported formats: PDF, TXT, DOC, DOCX, MD
                          </p>
                          <p className="text-xs text-primary font-medium">
                            Multiple files supported
                          </p>
                        </div>
                      </div>
                    </div>
                  </TabsContent>
                  
                  <TabsContent value="urls" className="mt-4">
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
                          Add
                        </Button>
                      </div>
                      
                      {urlError && (
                        <div className="rounded-md bg-destructive/10 p-2 text-sm text-destructive flex items-center gap-2">
                          <Icon name="alert-circle" className="h-4 w-4" />
                          {urlError}
                        </div>
                      )}
                      
                      <div className="rounded-md bg-blue-50 border border-blue-200 p-3 text-sm text-blue-800 flex items-start gap-2">
                        <Icon name="info" className="h-5 w-5 text-blue-500 flex-shrink-0 mt-0.5" />
                        <div>
                          <p className="font-medium mb-1">Add public website URLs</p>
                          <p className="text-blue-700 text-xs">
                            You can add URLs to public websites or direct links to documents. The system will scrape and index the content from these URLs.
                          </p>
                        </div>
                      </div>
                    </div>
                  </TabsContent>
                </Tabs>

                {/* Document List */}
                {documents.length > 0 && (
                  <div className="mt-6 border rounded-xl overflow-hidden">
                    <div className="bg-gray-50 border-b p-3 flex items-center justify-between">
                      <h3 className="font-medium text-sm flex items-center gap-2">
                        <Icon name="layers" className="h-4 w-4 text-gray-500" />
                        Added Content
                      </h3>
                      
                      <div className="flex gap-2">
                        <Badge variant="outline" className="gap-1 items-center bg-white">
                          <Icon name="file" className="h-3 w-3" />
                          {documents.filter(d => d.type === 'file').length}
                        </Badge>
                        <Badge variant="outline" className="gap-1 items-center bg-white">
                          <Icon name="link" className="h-3 w-3" />
                          {documents.filter(d => d.type === 'url').length}
                        </Badge>
                      </div>
                    </div>
                    
                    <div className="divide-y max-h-[350px] overflow-y-auto">
                      {documents.length > 0 ? (
                        documents.map((doc) => (
                          <div 
                            key={doc.url} 
                            className="flex items-center justify-between p-3 hover:bg-gray-50 transition-colors"
                          >
                            <div className="flex items-center gap-3 flex-1 min-w-0">
                              <div className={`rounded-lg p-2 ${
                                doc.type === 'url' ? 'bg-blue-100' : 'bg-orange-100'
                              }`}>
                                <Icon 
                                  name={
                                    doc.type === 'url' ? 'globe' : 
                                    doc.name.toLowerCase().endsWith('.pdf') ? 'file-text' : 'file'
                                  } 
                                  className={`h-4 w-4 ${
                                    doc.type === 'url' ? 'text-blue-600' : 'text-orange-600'
                                  }`}
                                />
                              </div>
                              <div className="flex-1 min-w-0">
                                <span className="text-sm font-medium truncate block">
                                  {doc.name}
                                </span>
                                <span className="text-xs text-gray-500 truncate block">
                                  {doc.type === 'url' ? doc.url : doc.type.charAt(0).toUpperCase() + doc.type.slice(1)}
                                </span>
                              </div>
                            </div>
                            <Button
                              type="button"
                              variant="ghost"
                              size="sm"
                              className="h-8 w-8 rounded-full hover:bg-red-100 hover:text-red-600"
                              onClick={() => handleRemoveDocument(doc)}
                            >
                              <Icon name="trash-2" className="h-4 w-4" />
                              <span className="sr-only">Remove</span>
                            </Button>
                          </div>
                        ))
                      ) : (
                        <div className="p-6 text-center text-gray-500">
                          <Icon name="file-question" className="h-8 w-8 mx-auto mb-2 text-gray-400" />
                          <p>No files or URLs added yet</p>
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </CardContent>
              
              {processingError && (
                <CardFooter className="pt-2 pb-4 px-6 bg-gray-50 border-t">
                  <div className="text-xs text-amber-600 flex items-center gap-2">
                    <Icon name="clock" className="h-3.5 w-3.5" />
                    <span>Processing documents may take some time. Please be patient.</span>
                  </div>
                </CardFooter>
              )}
            </Card>
          </form>
        </div>
        
        <div className="flex justify-end gap-3 pt-4 border-t mt-2">
          <Button 
            type="button" 
            variant="outline" 
            onClick={() => onClose()}
            disabled={isUploading || isUpdating}
          >
            Cancel
          </Button>
          <Button 
            type="submit"
            form="update-form"
            disabled={documents.length === 0 || isUploading || isUpdating}
            className="gap-2"
          >
            {isUpdating ? (
              <>
                <LoadingSpinner className="h-4 w-4" />
                <span>Saving Changes...</span>
              </>
            ) : (
              <>
                <Icon name="save" className="h-4 w-4" />
                <span>Update Content</span>
              </>
            )}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
} 