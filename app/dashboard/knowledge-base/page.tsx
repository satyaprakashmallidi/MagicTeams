'use client';

import { useState, useEffect, ReactNode, useCallback, useMemo, memo, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { Icon } from '@/components/ui/icons';
import { CreateKnowledgeBaseDialog } from '@/components/knowledge-base/components/create-knowledge-base-dialog';
import { useKnowledgeBase } from '@/hooks/use-knowledge-base';
import { useUser } from '@/hooks/use-user';
import { Card } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { useToast } from '@/hooks/use-toast';
import { AlertDialog, AlertDialogContent, AlertDialogHeader, AlertDialogTitle, AlertDialogDescription, AlertDialogFooter, AlertDialogCancel, AlertDialogAction } from '@/components/ui/alert-dialog';
import { Badge } from '@/components/ui/badge';
import { KnowledgeBase } from '@/types/knowledge-base';
import { UpdateKnowledgeBaseDialog } from '@/components/knowledge-base/components/update-knowledge-base-dialog';

type StatusInfo = {
  label: string;
  bgClass: string;
  textClass: string;
  dotClass: string;
  badgeVariant: 'default' | 'secondary' | 'destructive' | 'outline';
};

// Memoized sidebar component
const Sidebar = memo(({
  isLoading,
  knowledgeBases,
  selectedBaseId,
  onSelect,
  onCreateClick,
  showCreateDialog,
  onCloseCreateDialog
}: {
  isLoading: boolean;
  knowledgeBases: KnowledgeBase[];
  selectedBaseId: string | null;
  onSelect: (id: string) => void;
  onCreateClick: () => void;
  showCreateDialog: boolean;
  onCloseCreateDialog: (newKnowledgeBase?: KnowledgeBase) => void;
}) => {
  return (
    <div className="w-72 border-r border-border bg-background p-4 overflow-y-auto">
      <Dialog open={showCreateDialog} onOpenChange={onCreateClick}>
        <Button className="w-full flex items-center gap-2 mb-4" onClick={onCreateClick}>
          <Icon name="plus" className="h-4 w-4" />
          New Knowledge Base
        </Button>
        <DialogContent>
          <CreateKnowledgeBaseDialog
            isOpen={showCreateDialog}
            onClose={onCloseCreateDialog}
          />
        </DialogContent>
      </Dialog>

      {/* Section Title */}
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-sm font-medium text-foreground">Your Knowledge Bases</h2>
        {isLoading && <Icon name="loader-2" className="h-4 w-4 text-muted-foreground animate-spin" />}
      </div>

      {/* Knowledge Base List */}
      <div className="space-y-3">
        {isLoading ? (
          // Loading skeletons
          Array(3).fill(0).map((_, i) => (
            <Card key={i} className="p-3">
              <div className="flex items-center gap-3">
                <Skeleton className="h-8 w-8 rounded-full" />
                <div className="flex-1">
                  <Skeleton className="h-4 w-3/4 mb-2" />
                  <Skeleton className="h-3 w-1/2" />
                </div>
              </div>
            </Card>
          ))
        ) : knowledgeBases.length > 0 ? (
          knowledgeBases.map((kb) => (
            <KnowledgeBaseCard
              key={kb.corpus_id}
              kb={kb}
              isSelected={selectedBaseId === kb.corpus_id}
              onSelect={onSelect}
            />
          ))
        ) : (
          <div className="text-center py-6 text-muted-foreground bg-muted rounded-lg">
            <Icon name="inbox" className="mx-auto h-8 w-8 text-muted-foreground" />
            <h3 className="mt-2 text-sm font-medium text-foreground">No knowledge bases</h3>
            <p className="mt-1 text-xs text-muted-foreground">Get started by creating a new knowledge base</p>
          </div>
        )}
      </div>
    </div>
  );
});

Sidebar.displayName = 'Sidebar';

// Memoized knowledge base card component
const KnowledgeBaseCard = memo(({
  kb,
  isSelected,
  onSelect
}: {
  kb: KnowledgeBase;
  isSelected: boolean;
  onSelect: (id: string) => void
}) => {
  const fileUrl = kb.knowledgebase_sources?.[0]?.source_urls?.[0];
  const filename = fileUrl ? decodeURIComponent(fileUrl.split('/').pop() || '') : '';
  const extension = filename.split('.').pop()?.toLowerCase() || '';
  const isPDF = extension === 'pdf';
  const isText = ['txt', 'md', 'doc', 'docx'].includes(extension);

  const handleClick = useCallback(() => {
    onSelect(kb.corpus_id);
  }, [kb.corpus_id, onSelect]);

  return (
    <Card
      className={`p-3 cursor-pointer transition-all hover:shadow ${isSelected ? 'border-primary shadow-sm' : ''
        }`}
      onClick={handleClick}
    >
      <div className="flex flex-col gap-2">
        <div className="flex items-center gap-3">
          <div className={`w-8 h-8 rounded-full flex items-center justify-center ${isSelected ? 'bg-primary/10' : 'bg-muted'
            }`}>
            <Icon
              name={isPDF ? 'file-text' : isText ? 'file' : 'book-open'}
              className={`h-4 w-4 ${isSelected ? 'text-primary' : 'text-muted-foreground'}`}
            />
          </div>
          <div className="flex-1 min-w-0">
            <h3 className="font-medium text-sm truncate">{kb.name}</h3>

          </div>
        </div>
      </div>
    </Card>
  );
});

KnowledgeBaseCard.displayName = 'KnowledgeBaseCard';

// Memoized status section component
const StatusSection = memo(({
  knowledgeBase,
  onRefresh,
  isRefreshing,
  getStatusDisplay
}: {
  knowledgeBase: KnowledgeBase;
  onRefresh: () => void;
  isRefreshing: boolean;
  getStatusDisplay: (status: string | undefined) => StatusInfo;
}) => {
  console.log('🔍 StatusSection rendering with data:', {
    hasKnowledgeBase: !!knowledgeBase,
    hasCorpusDetails: !!knowledgeBase?.corpus_details,
    status: knowledgeBase?.corpus_details?.stats?.status
  });
  
  // Provide default empty data if corpus_details is missing
  const corpusDetails = knowledgeBase.corpus_details || { 
    stats: { 
      status: 'CORPUS_STATUS_INITIALIZING', 
      numDocs: 0, 
      numChunks: 0, 
      numVectors: 0, 
      lastUpdated: new Date().toISOString() 
    } 
  };
  const statusInfo = getStatusDisplay(corpusDetails.stats?.status);
  const isReady = statusInfo.label === 'Ready';

  return (
    <Card className="p-6">
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
            <Icon name="activity" className="h-4 w-4" />
            Corpus Status
          </div>
          <Button
            size="sm"
            variant="outline"
            onClick={onRefresh}
            disabled={isRefreshing}
            className="flex items-center gap-1"
          >
            <Icon name="refresh-cw" className={`h-3 w-3 ${isRefreshing ? 'animate-spin' : ''}`} />
            {isRefreshing ? 'Refreshing...' : 'Refresh Status'}
          </Button>
        </div>

        <div className="space-y-4">
          <div className="p-4 bg-muted rounded-lg">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <Badge
                  variant={statusInfo.badgeVariant}
                  className={`px-3 py-1 text-sm ${statusInfo.label === 'Ready' ? 'bg-green-100 text-green-800 hover:bg-green-100' :
                      statusInfo.label === 'Initializing' ? 'bg-yellow-100 text-yellow-800 hover:bg-yellow-100' :
                        statusInfo.label === 'Updating' ? 'bg-blue-100 text-blue-800 hover:bg-blue-100' :
                          statusInfo.label === 'Empty' ? 'bg-orange-100 text-orange-800 hover:bg-orange-100' :
                            statusInfo.label === 'Not Ready' ? 'bg-red-100 text-red-800 hover:bg-red-100' : ''
                    }`}
                >
                  {statusInfo.label}
                </Badge>
                <div className="text-sm text-foreground font-medium">
                  {corpusDetails.stats?.status || 'Initializing'}
                </div>
              </div>
              <div className="text-sm text-muted-foreground">
                Last updated: {corpusDetails.stats && 'lastUpdated' in corpusDetails.stats ?
                  new Date(corpusDetails.stats.lastUpdated as string).toLocaleString() :
                  'Unknown'}
              </div>
            </div>

            <div className="grid grid-cols-3 gap-4 mt-3">
              <div>
                <div className="flex items-center gap-2">
                  <Icon name="book-open" className="h-4 w-4 text-muted-foreground" />
                  <span className="text-xs text-muted-foreground">Documents</span>
                </div>
                <p className="text-lg font-semibold mt-1">{corpusDetails.stats?.numDocs || 0}</p>
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <Icon name="layers" className="h-4 w-4 text-muted-foreground" />
                  <span className="text-xs text-muted-foreground">Chunks</span>
                </div>
                <p className="text-lg font-semibold mt-1">{corpusDetails.stats?.numChunks || 0}</p>
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <Icon name="scatter-chart" className="h-4 w-4 text-muted-foreground" />
                  <span className="text-xs text-muted-foreground">Vectors</span>
                </div>
                <p className="text-lg font-semibold mt-1">{corpusDetails.stats?.numVectors || 0}</p>
              </div>
            </div>
          </div>

          {!isReady && (
            <div className="p-4 bg-amber-50 border border-amber-200 rounded-md">
              <div className="flex gap-2">
                <Icon name="alert-circle" className="h-5 w-5 text-amber-500 flex-shrink-0" />
                <div>
                  <h4 className="text-sm font-medium text-amber-800">Knowledge Base Not Ready</h4>
                  <p className="text-sm text-amber-700 mt-1">
                    This knowledge base is still being processed and is not ready for use yet.
                    Processing time depends on the size and complexity of your documents.
                    Check back later or click the Refresh Status button to update.
                  </p>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </Card>
  );
});

StatusSection.displayName = 'StatusSection';

// Memoized file display component
const FileDisplay = memo(({ knowledgeBase }: { knowledgeBase: KnowledgeBase }) => {
  // Check if there are any source URLs
  const sourceUrls = knowledgeBase.knowledgebase_sources?.[0]?.source_urls || [];
  
  if (sourceUrls.length === 0) {
    return (
      <div className="text-center py-6 bg-muted rounded-lg">
        <Icon name="file" className="mx-auto h-8 w-8 text-muted-foreground" />
        <h3 className="mt-2 text-sm font-medium text-foreground">No file uploaded</h3>
        <p className="mt-1 text-sm text-muted-foreground">This knowledge base doesn't have a file yet</p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex justify-between items-center mb-2">
        <span className="text-sm text-muted-foreground font-medium">{sourceUrls.length} file{sourceUrls.length !== 1 && 's'}</span>
      </div>
      
      {sourceUrls.map((fileUrl, index) => {
        const filename = decodeURIComponent(fileUrl.split('/').pop() || '');
        const extension = filename.split('.').pop()?.toLowerCase() || '';
        const isPDF = extension === 'pdf';
        const isText = ['txt', 'md', 'doc', 'docx'].includes(extension);
        const isUrl = fileUrl.startsWith('http') && !filename.includes('.');
        
        return (
          <div key={index} className="flex items-start gap-4 bg-muted rounded-lg p-4 border border-border">
            <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${
              isPDF ? 'bg-red-100 dark:bg-red-900/20' :
              isText ? 'bg-green-100 dark:bg-green-900/20' :
              isUrl ? 'bg-blue-100 dark:bg-blue-900/20' : 'bg-muted'
            }`}>
              <Icon
                name={
                  isPDF ? 'file-text' : 
                  isText ? 'file' : 
                  isUrl ? 'globe' : 'file'
                }
                className={`h-5 w-5 ${
                  isPDF ? 'text-red-600 dark:text-red-400' :
                  isText ? 'text-green-600 dark:text-green-400' :
                  isUrl ? 'text-blue-600 dark:text-blue-400' : 'text-muted-foreground'
                }`}
              />
            </div>
            <div className="flex-1 overflow-hidden">
              <h3 className="text-sm font-medium text-foreground truncate">
                {isUrl ? new URL(fileUrl).hostname : filename}
              </h3>
              <div className="mt-1 flex items-center gap-3">
                <span className="text-xs text-muted-foreground">
                  Added {new Date(knowledgeBase.created_at).toLocaleDateString()}
                </span>
                {!isUrl && (
                  <span className="text-xs text-muted-foreground">
                    Type: {extension.toUpperCase()}
                  </span>
                )}
                {isUrl && (
                  <a 
                    href={fileUrl} 
                    target="_blank" 
                    rel="noopener noreferrer"
                    className="text-xs text-blue-600 dark:text-blue-400 hover:underline flex items-center gap-1"
                  >
                    <Icon name="external-link" className="h-3 w-3" />
                    Visit
                  </a>
                )}
              </div>
              {isUrl && (
                <p className="text-xs text-muted-foreground truncate mt-1">
                  {fileUrl}
                </p>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
});

FileDisplay.displayName = 'FileDisplay';

// Main component
export default function KnowledgeBasePage() {
  // Component state management
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [selectedBaseId, setSelectedBaseId] = useState<string | null>(null);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isMainContentLoading, setIsMainContentLoading] = useState(false);
  const [isSidebarLoading, setIsSidebarLoading] = useState(true);
  const [allKnowledgeBases, setAllKnowledgeBases] = useState<KnowledgeBase[]>([]);
  const [isFetched, setIsFetched] = useState(false);
  const [isFetchInProgress, setIsFetchInProgress] = useState(false);
  const [showUpdateDialog, setShowUpdateDialog] = useState(false);
  // Track which knowledge bases we've already tried to fetch details for
  const [fetchedDetailsIds, setFetchedDetailsIds] = useState<string[]>([]);

  // Hooks
  const { isLoading: isHookLoading, fetchKnowledgeBases, deleteKnowledgeBase, getKnowledgeBaseById } = useKnowledgeBase();
  const { user } = useUser();
  const { toast } = useToast();

  // Log on component render (this will help debug render cycles)
  console.log('🔄 KnowledgeBasePage render', {
    kbCount: allKnowledgeBases.length,
    selected: selectedBaseId,
    isLoading: isMainContentLoading || isSidebarLoading,
    isFetched
  });

  // Initial data fetching - only fetch once
  useEffect(() => {
    // Skip if already fetched, already in progress, or no user ID
    if (isFetched || isFetchInProgress || !user?.id) {
      return;
    }

    const fetchData = async () => {
      setIsFetchInProgress(true);
      setIsSidebarLoading(true);

      try {
        console.log('🔄 Fetching all knowledge bases...');
        const result = await fetchKnowledgeBases();

        if (result) {
          console.log(`✅ Fetched ${result.length} knowledge bases`);
          setAllKnowledgeBases(result);
          setIsFetched(true);

          // Auto-select the first knowledge base if none is selected
          if (result.length > 0 && !selectedBaseId) {
            setSelectedBaseId(result[0].corpus_id);
          }
        }
      } catch (error) {
        console.error('❌ Error fetching knowledge bases:', error);
        toast({
          title: "Error",
          description: "Failed to load knowledge bases",
          variant: "destructive"
        });
      } finally {
        setIsSidebarLoading(false);
        setIsFetchInProgress(false);
      }
    };

    fetchData();
  }, [user?.id, fetchKnowledgeBases, isFetched, isFetchInProgress, selectedBaseId, toast]);

  // Memoized selected knowledge base
  const selectedKnowledgeBase = useMemo(() =>
    allKnowledgeBases?.find(kb => kb.corpus_id === selectedBaseId),
    [allKnowledgeBases, selectedBaseId]
  );

  // Create a throttled refresh function
  const lastRefreshAttempt = useRef<number>(0);
  const REFRESH_COOLDOWN_MS = 5000; // 5 seconds between refreshes

  const handleRefreshStatus = useCallback(() => {
    if (!selectedBaseId || !user?.id) return;
    
    const now = Date.now();
    if (now - lastRefreshAttempt.current < REFRESH_COOLDOWN_MS) {
      console.log('🛑 Refresh throttled - too soon since last refresh');
      return;
    }
    
    lastRefreshAttempt.current = now;
    setIsRefreshing(true);
    console.log('🔄 Refreshing knowledge base status:', selectedBaseId);

    getKnowledgeBaseById(selectedBaseId)
      .then(result => {
        if (result) {
          console.log('✅ Knowledge base refreshed:', result.name);
          // Update only the refreshed knowledge base in the local state
          setAllKnowledgeBases(prevBases =>
            prevBases.map(kb =>
              kb.corpus_id === selectedBaseId ? { ...kb, ...result } : kb
            )
          );

          toast({
            title: "Status Updated",
            description: `${result.name} has been refreshed`,
          });
        }
      })
      .catch(error => {
        console.error('❌ Error refreshing knowledge base:', error);
        toast({
          title: "Refresh Failed",
          description: "Unable to refresh knowledge base status",
          variant: "destructive"
        });
      })
      .finally(() => {
        setIsRefreshing(false);
      });
  }, [selectedBaseId, user?.id, getKnowledgeBaseById, toast]);

  // Add a separate effect to fetch details for the selected knowledge base
  useEffect(() => {
    // Only proceed if we have a selected base ID and user ID
    if (!selectedBaseId || !user?.id || !isFetched) {
      console.log('⏭️ Skipping details fetch - prerequisites not met:', {
        hasSelectedBaseId: !!selectedBaseId,
        hasUser: !!user?.id,
        isFetched
      });
      return;
    }

    // Check if we already have detailed data for this knowledge base
    const selectedBase = allKnowledgeBases.find(kb => kb.corpus_id === selectedBaseId);
    const hasFullDetails = selectedBase && selectedBase.corpus_details;
    
    // Check if we've already attempted to fetch details for this knowledge base
    const alreadyFetchedDetails = fetchedDetailsIds.includes(selectedBaseId);
    
    console.log('🔍 Checking if details are needed:', {
      selectedBaseId,
      hasSelectedBase: !!selectedBase, 
      hasFullDetails,
      alreadyFetchedDetails,
      detailsStatus: selectedBase?.corpus_details?.stats?.status
    });

    // Only fetch details if we don't have them yet AND we haven't already tried
    if (!hasFullDetails && !alreadyFetchedDetails) {
      setIsMainContentLoading(true);
      console.log('🔄 Fetching details for initially selected knowledge base:', selectedBaseId);

      getKnowledgeBaseById(selectedBaseId)
        .then(result => {
          if (result) {
            console.log('✅ Details fetched for initially selected:', {
              name: result.name,
              hasCorpusDetails: !!result.corpus_details,
              status: result.corpus_details?.stats?.status
            });
            // Update the knowledge base in the local state
            setAllKnowledgeBases(prevBases =>
              prevBases.map(kb =>
                kb.corpus_id === selectedBaseId ? { ...kb, ...result } : kb
              )
            );
          }
          // Mark this ID as having been fetched to prevent infinite fetching
          setFetchedDetailsIds(prev => [...prev, selectedBaseId]);
        })
        .catch(error => {
          console.error('❌ Error fetching initial knowledge base details:', error);
          toast({
            title: "Error",
            description: "Failed to load knowledge base details",
            variant: "destructive"
          });
          // Still mark as fetched to prevent repeated attempts
          setFetchedDetailsIds(prev => [...prev, selectedBaseId]);
        })
        .finally(() => {
          setIsMainContentLoading(false);
        });
    }
  }, [selectedBaseId, isFetched, user?.id, allKnowledgeBases, getKnowledgeBaseById, toast, fetchedDetailsIds]);

  // Memoized status display function
  const getStatusDisplay = useCallback((status: string | undefined): StatusInfo => {
    if (!status) return {
      label: 'Unknown',
      bgClass: 'bg-gray-100',
      textClass: 'text-gray-800',
      dotClass: 'bg-gray-500',
      badgeVariant: 'outline'
    };

    switch (status) {
      case 'CORPUS_STATUS_READY':
        return {
          label: 'Ready',
          bgClass: 'bg-green-100',
          textClass: 'text-green-800',
          dotClass: 'bg-green-500',
          badgeVariant: 'default'
        };
      case 'CORPUS_STATUS_INITIALIZING':
        return {
          label: 'Initializing',
          bgClass: 'bg-yellow-100',
          textClass: 'text-yellow-800',
          dotClass: 'bg-yellow-500',
          badgeVariant: 'secondary'
        };
      case 'CORPUS_STATUS_UPDATING':
        return {
          label: 'Updating',
          bgClass: 'bg-blue-100',
          textClass: 'text-blue-800',
          dotClass: 'bg-blue-500',
          badgeVariant: 'secondary'
        };
      case 'CORPUS_STATUS_EMPTY':
        return {
          label: 'Empty',
          bgClass: 'bg-orange-100',
          textClass: 'text-orange-800',
          dotClass: 'bg-orange-500',
          badgeVariant: 'outline'
        };
      default:
        return {
          label: 'Not Ready',
          bgClass: 'bg-red-100',
          textClass: 'text-red-800',
          dotClass: 'bg-red-500',
          badgeVariant: 'destructive'
        };
    }
  }, []);

  // Function to handle knowledge base selection with useCallback
  const handleKnowledgeBaseSelect = useCallback((id: string) => {
    // Don't reload if the same knowledge base is selected
    if (id === selectedBaseId) {
      console.log('ℹ️ Same knowledge base selected, skipping reload');
      return;
    }

    console.log('📋 Selected knowledge base ID:', id);
    setSelectedBaseId(id);

    // Check if we already have detailed data for this knowledge base
    const selectedBase = allKnowledgeBases.find(kb => kb.corpus_id === id);
    const hasFullDetails = selectedBase && selectedBase.corpus_details;

    // Only fetch details if we don't have them yet
    if (!hasFullDetails && user?.id) {
      setIsMainContentLoading(true);
      console.log('🔍 Fetching details for knowledge base:', id);

      getKnowledgeBaseById(id)
        .then(result => {
          if (result) {
            console.log('✅ Details fetched for:', result.name);
            // Update the knowledge base in the local state
            setAllKnowledgeBases(prevBases =>
              prevBases.map(kb =>
                kb.corpus_id === id ? { ...kb, ...result } : kb
              )
            );
          }
        })
        .catch(error => {
          console.error('❌ Error fetching knowledge base details:', error);
          toast({
            title: "Error",
            description: "Failed to load knowledge base details",
            variant: "destructive"
          });
        })
        .finally(() => {
          setIsMainContentLoading(false);
        });
    } else {
      console.log('ℹ️ Using cached details for:', selectedBase?.name);
    }
  }, [selectedBaseId, allKnowledgeBases, user?.id, getKnowledgeBaseById, toast]);

  // Toggle dialog state
  const handleToggleCreateDialog = useCallback(() => {
    setShowCreateDialog(prev => !prev);
  }, []);

  // Handle dialog closing with useCallback
  const handleCloseCreateDialog = useCallback((newKnowledgeBase?: KnowledgeBase) => {
    setShowCreateDialog(false);

    // If we received a new knowledge base directly, use it
    if (newKnowledgeBase) {
      console.log('✅ Adding new knowledge base to state:', newKnowledgeBase.name);

      // Add the new knowledge base to the state
      setAllKnowledgeBases(prev => [...prev, newKnowledgeBase]);

      // Auto-select the newly created knowledge base
      setSelectedBaseId(newKnowledgeBase.corpus_id);

      toast({
        title: "Success",
        description: `Knowledge base "${newKnowledgeBase.name}" created successfully`
      });
      return;
    }

    // Only fetch if we don't have the new knowledge base data
    if (user?.id) {
      console.log('🔄 Refreshing knowledge bases after creation');
      setIsSidebarLoading(true);

      fetchKnowledgeBases()
        .then(result => {
          if (result) {
            console.log(`✅ Updated knowledge bases after creation: ${result.length} bases`);
            setAllKnowledgeBases(result);

            // If there's a new knowledge base (more than before), select it
            if (result.length > allKnowledgeBases.length) {
              const newBases = result.filter(
                newKb => !allKnowledgeBases.some(
                  oldKb => oldKb.corpus_id === newKb.corpus_id
                )
              );

              if (newBases.length > 0) {
                setSelectedBaseId(newBases[0].corpus_id);
              }
            }
          }
        })
        .catch(error => {
          console.error('❌ Error updating knowledge bases after creation:', error);
        })
        .finally(() => {
          setIsSidebarLoading(false);
        });
    }
  }, [fetchKnowledgeBases, user?.id, allKnowledgeBases, toast]);

  // Handle delete confirmation with useCallback
  const handleConfirmDelete = useCallback(async () => {
    if (!selectedBaseId || !user?.id) {
      toast({
        title: "Error",
        description: "Missing required information",
        variant: "destructive"
      });
      return;
    }

    try {
      // The hook handles passing the user ID internally
      await deleteKnowledgeBase(selectedBaseId);
      toast({
        title: "Success",
        description: "Knowledge base deleted successfully"
      });

      // Update the list by removing the deleted item
      setAllKnowledgeBases(prev => prev.filter(kb => kb.corpus_id !== selectedBaseId));

      setShowDeleteDialog(false);
      setSelectedBaseId(null);
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to delete knowledge base",
        variant: "destructive"
      });
    }
  }, [selectedBaseId, user?.id, deleteKnowledgeBase, toast]);

  // Handle update dialog
  const handleToggleUpdateDialog = useCallback(() => {
    setShowUpdateDialog(prev => !prev);
  }, []);

  const handleCloseUpdateDialog = useCallback((updatedKnowledgeBase?: KnowledgeBase) => {
    setShowUpdateDialog(false);

    if (updatedKnowledgeBase) {
      console.log('✅ Knowledge base updated:', updatedKnowledgeBase.name);

      // Update the knowledge base in the state
      setAllKnowledgeBases(prev =>
        prev.map(kb => kb.corpus_id === updatedKnowledgeBase.corpus_id ? updatedKnowledgeBase : kb)
      );

      toast({
        title: "Success",
        description: `Knowledge base "${updatedKnowledgeBase.name}" updated successfully`
      });
    }
  }, [toast]);

  // Memoized loading state component
  const LoadingState = useMemo(() => (
    <div className="flex h-full items-center justify-center">
      <div className="text-center">
        <div className="h-16 w-16 mx-auto flex items-center justify-center">
          <Icon name="loader-2" className="h-10 w-10 text-primary animate-spin" />
        </div>
        <h3 className="mt-4 text-sm font-medium text-foreground">Loading Knowledge Base...</h3>
        <p className="mt-1 text-sm text-muted-foreground">Please wait while we fetch the details</p>
      </div>
    </div>
  ), []);

  // Memoized refreshing state component
  const RefreshingState = useMemo(() => (
    <div className="flex h-full items-center justify-center">
      <div className="text-center">
        <div className="h-16 w-16 mx-auto flex items-center justify-center">
          <Icon name="refresh-cw" className="h-10 w-10 text-primary animate-spin" />
        </div>
        <h3 className="mt-4 text-sm font-medium text-foreground">Refreshing Knowledge Base...</h3>
        <p className="mt-1 text-sm text-muted-foreground">Please wait while we update the status</p>
      </div>
    </div>
  ), []);

  // Memoized empty state component
  const EmptyState = useMemo(() => (
    <div className="flex h-full items-center justify-center">
      <div className="text-center">
        <Icon name="book-open" className="mx-auto h-12 w-12 text-muted-foreground" />
        <h3 className="mt-2 text-sm font-medium text-foreground">No Knowledge Base Selected</h3>
        <p className="mt-1 text-sm text-muted-foreground">Select a knowledge base from the list to view its details</p>
      </div>
    </div>
  ), []);

  // Memoized main content renderer
  const renderMainContent = useCallback(() => {
    if (isMainContentLoading) {
      return LoadingState;
    }

    if (isRefreshing) {
      return RefreshingState;
    }

    if (!selectedBaseId || !selectedKnowledgeBase) {
      return EmptyState;
    }

    console.log('🔍 Rendering main content with knowledge base:', {
      name: selectedKnowledgeBase.name,
      hasCorpusDetails: !!selectedKnowledgeBase.corpus_details,
      status: selectedKnowledgeBase.corpus_details?.stats?.status
    });

    const statusInfo = getStatusDisplay(selectedKnowledgeBase.corpus_details?.stats?.status);

    return (
      <div className="space-y-6">
        {/* Header with Status Badge and Delete Button */}
        <div className="flex justify-between items-start">
          <div className="space-y-2">
            <h2 className="text-2xl font-bold text-foreground flex items-center gap-2">
              {selectedKnowledgeBase.name}
              {selectedKnowledgeBase.corpus_details?.stats?.status && (
                <Badge
                  variant={statusInfo.badgeVariant}
                  className={`ml-2 text-sm ${statusInfo.label === 'Ready'
                      ? 'bg-green-100 text-green-800 hover:bg-green-100' :
                      statusInfo.label === 'Initializing'
                        ? 'bg-yellow-100 text-yellow-800 hover:bg-yellow-100' :
                        statusInfo.label === 'Updating'
                          ? 'bg-blue-100 text-blue-800 hover:bg-blue-100' :
                          statusInfo.label === 'Empty'
                            ? 'bg-orange-100 text-orange-800 hover:bg-orange-100' :
                            statusInfo.label === 'Not Ready'
                              ? 'bg-red-100 text-red-800 hover:bg-red-100' : ''
                    }`}
                >
                  <div className="flex items-center gap-1.5">
                    <div className={`w-2 h-2 rounded-full ${statusInfo.dotClass}`} />
                    {statusInfo.label}
                  </div>
                </Badge>
              )}
            </h2>
          </div>
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              className="flex items-center gap-1.5 border-border hover:bg-accent"
              onClick={handleToggleUpdateDialog}
            >
              <Icon name="edit-2" className="h-4 w-4" />
              Edit
            </Button>
            <Button
              variant="outline"
              size="sm"
              className="flex items-center gap-1.5 border-red-200 dark:border-red-800 hover:bg-red-50 dark:hover:bg-red-950 text-red-600 dark:text-red-400 hover:text-red-700 dark:hover:text-red-300"
              onClick={() => setShowDeleteDialog(true)}
            >
              <Icon name="trash-2" className="h-4 w-4" />
              Delete
            </Button>
          </div>
        </div>

        {/* Status Section */}
        <StatusSection
          knowledgeBase={selectedKnowledgeBase}
          onRefresh={handleRefreshStatus}
          isRefreshing={isRefreshing}
          getStatusDisplay={getStatusDisplay}
        />

        {/* Description Section */}
        <Card className="p-6">
          <div className="space-y-2">
            <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
              <Icon name="align-left" className="h-4 w-4" />
              Description
            </div>
            {selectedKnowledgeBase.description ? (
              <p className="text-foreground">{selectedKnowledgeBase.description}</p>
            ) : (
              <p className="text-muted-foreground italic">No description provided</p>
            )}
          </div>
        </Card>

        {/* File Section */}
        <Card className="p-6">
          <div className="space-y-4">
            <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
              <Icon name="file" className="h-4 w-4" />
              Uploaded File
            </div>
            <FileDisplay knowledgeBase={selectedKnowledgeBase} />
          </div>
        </Card>
      </div>
    );
  }, [
    isMainContentLoading,
    isRefreshing,
    selectedBaseId,
    selectedKnowledgeBase,
    LoadingState,
    RefreshingState,
    EmptyState,
    getStatusDisplay,
    handleRefreshStatus,
    handleToggleUpdateDialog
  ]);

  // Add renderCount for debugging
  const renderCount = useRef(0);
  useEffect(() => {
    renderCount.current += 1;
    console.log(`🔢 KnowledgeBasePage render count: ${renderCount.current}`);
  }, []);

  return (
    <div className="flex h-full">
      {/* Left Sidebar - Complete memoized component to prevent rerenders */}
      <Sidebar
        isLoading={isSidebarLoading}
        knowledgeBases={allKnowledgeBases}
        selectedBaseId={selectedBaseId}
        onSelect={handleKnowledgeBaseSelect}
        onCreateClick={handleToggleCreateDialog}
        showCreateDialog={showCreateDialog}
        onCloseCreateDialog={handleCloseCreateDialog}
      />

      {/* Main Area */}
      <div className="flex-1 p-6 bg-muted/30 overflow-y-auto h-full">
        <div className="max-w-4xl mx-auto">
          {renderMainContent()}
        </div>
      </div>

      {/* Update Knowledge Base Dialog */}
      {selectedKnowledgeBase && (
        <UpdateKnowledgeBaseDialog
          isOpen={showUpdateDialog}
          onClose={handleCloseUpdateDialog}
          knowledgeBase={selectedKnowledgeBase}
        />
      )}

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Knowledge Base</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete this knowledge base? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleConfirmDelete}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
