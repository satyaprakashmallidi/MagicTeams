'use client';

import { useState, useCallback, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/hooks/use-toast';
import { Icon } from '@/components/ui/icons';
import { uploadFileToStorage, deleteFileFromStorage, listFilesFromStorage } from '@/lib/storage-utils';
import { LoadingSpinner } from '@/components/ui/loading-spinner';
import { DocumentSource, KnowledgeBase } from '@/types/knowledge-base';
import { useKnowledgeBase } from '@/hooks/use-knowledge-base';
import { useUser } from '@/hooks/use-user';
import { Card } from '@/components/ui/card';
import { Bot } from '@/types/database';
import { FileCard } from '@/components/knowledge-base/components/file-card';
import { Badge } from '@/components/ui/badge';

interface BotKnowledgeBaseProps {
    botId: string;
    botName: string;
    knowledgeBaseId?: string;
    onUpdateBot: (updates: Partial<Bot>) => void;
    knowledgeBaseUsageGuide?: string;
    onUpdateUsageGuide: (guide: string) => void;
}

export function BotKnowledgeBase({
    botId,
    botName,
    knowledgeBaseId,
    onUpdateBot,
    knowledgeBaseUsageGuide,
    onUpdateUsageGuide
}: BotKnowledgeBaseProps) {
    const [isUploading, setIsUploading] = useState(false);
    const [currentUrl, setCurrentUrl] = useState('');
    const [urlError, setUrlError] = useState('');
    const [isLoading, setIsLoading] = useState(false);

    const { toast } = useToast();
    const { user } = useUser();
    const {
        createKnowledgeBase,
        getKnowledgeBaseById,
        updateKnowledgeBase,
        fetchKnowledgeBases
    } = useKnowledgeBase();

    const [knowledgeBase, setKnowledgeBase] = useState<KnowledgeBase | null>(null);

    const [allFiles, setAllFiles] = useState<{ name: string; url: string; size?: number; date: Date; isAttached: boolean }[]>([]);

    // Fetch all files from storage and sync with KB
    const fetchAllFiles = useCallback(async () => {
        try {
            setIsLoading(true);
            const storageFiles = await listFilesFromStorage();

            // Get currently attached URLs
            const attachedUrls = knowledgeBase?.knowledgebase_sources?.[0]?.source_urls || [];

            const mergedFiles = storageFiles.map(file => {
                // Check if this file's URL is in the attached list
                // Note: storageFiles URL might be slightly different depending on how it's generated vs stored
                // But usually public URL is consistent.
                const isAttached = attachedUrls.some(url => url === file.url);

                // We use the original filename if possible, or the one from storage
                // Storage name is UUID.ext, metadata might have original name?
                // The listFilesFromStorage returns name as the file name in bucket (UUID).
                // We might lose original filename if not stored in metadata.
                // For now, let's try to use metadata or fallback to name.
                // Actually, listFilesFromStorage returns metadata.
                // Let's assume we just show the name from storage for now, or we need to store original name in metadata.
                // But wait, our uploadFileToStorage uses UUID.
                // And it returns { fileName: actualFileName } which is the original name.
                // But listFiles only gives us the object in bucket.
                // We might need to store the original filename in metadata during upload if we want to show it nicely.
                // For now, let's just use the name we get.

                return {
                    name: file.name, // This will be UUID.pdf unfortunately unless we change upload
                    url: file.url,
                    size: file.size,
                    date: new Date(file.created_at),
                    isAttached
                };
            });

            // Also add any attached URLs that are NOT in storage (e.g. external websites)
            attachedUrls.forEach(url => {
                const isUrl = url.startsWith('http') && !url.split('/').pop()?.includes('.'); // Rough check for "Website" vs "File"
                // If it's a website, add it
                if (isUrl) {
                    // We handle websites separately in the UI usually, or we can add them here?
                    // The UI has a separate "Website Knowledge Base" section but it doesn't list them there?
                    // The previous UI listed "Attached Files" including URLs.
                    // Let's add them to allFiles if they are not already there.
                    if (!mergedFiles.some(f => f.url === url)) {
                        mergedFiles.push({
                            name: new URL(url).hostname,
                            url,
                            date: new Date(), // Unknown date
                            isAttached: true,
                            size: 0
                        });
                    }
                } else {
                    // It's a file. If it wasn't found in storage (maybe deleted manually?), should we show it?
                    // If it's in KB but not storage, it's a broken link or external file.
                    // Let's show it as attached.
                    if (!mergedFiles.some(f => f.url === url)) {
                        const name = decodeURIComponent(url.split('/').pop() || 'Unknown File');
                        mergedFiles.push({
                            name,
                            url,
                            date: new Date(),
                            isAttached: true,
                            size: 0
                        });
                    }
                }
            });

            setAllFiles(mergedFiles);
        } catch (error) {
            console.error('Error fetching files:', error);
        } finally {
            setIsLoading(false);
        }
    }, [knowledgeBase]);

    // Initial fetch of files
    useEffect(() => {
        if (user?.id) {
            fetchAllFiles();
        }
    }, [user?.id, fetchAllFiles]);

    // Re-fetch when KB changes (to update attached status)
    useEffect(() => {
        if (knowledgeBase) {
            fetchAllFiles();
        }
    }, [knowledgeBase, fetchAllFiles]);

    // Fetch KB details if ID exists
    useEffect(() => {
        if (knowledgeBaseId && user?.id) {
            setIsLoading(true);
            getKnowledgeBaseById(knowledgeBaseId)
                .then(kb => {
                    if (kb) setKnowledgeBase(kb);
                })
                .catch(console.error)
                .finally(() => setIsLoading(false));
        } else {
            setKnowledgeBase(null);
        }
    }, [knowledgeBaseId, user?.id, getKnowledgeBaseById]);

    // Check if KB is processing
    const isProcessing = knowledgeBase?.corpus_details?.stats?.status === 'CORPUS_STATUS_UPDATING' ||
        knowledgeBase?.corpus_details?.stats?.status === 'CORPUS_STATUS_INITIALIZING';

    // Poll for status updates when processing
    useEffect(() => {
        if (!isProcessing || !knowledgeBaseId || !user?.id) return;

        const pollInterval = setInterval(() => {
            getKnowledgeBaseById(knowledgeBaseId)
                .then(kb => {
                    if (kb) {
                        setKnowledgeBase(kb);
                    }
                })
                .catch(console.error);
        }, 5000);

        return () => clearInterval(pollInterval);
    }, [isProcessing, knowledgeBaseId, user?.id, getKnowledgeBaseById]);

    // Helper to get current sources
    const getCurrentSources = useCallback((): DocumentSource[] => {
        if (!knowledgeBase?.knowledgebase_sources?.[0]?.source_urls) return [];

        return knowledgeBase.knowledgebase_sources[0].source_urls.map(url => {
            const isUrl = url.startsWith('http') && !url.split('/').pop()?.includes('.');
            const name = isUrl ? new URL(url).hostname : decodeURIComponent(url.split('/').pop() || '');
            return {
                type: isUrl ? 'url' : 'file',
                name,
                url
            };
        });
    }, [knowledgeBase]);

    const handleAddSource = async (newSource: { url: string, type: 'file' | 'url' }) => {
        if (!user?.id) return;

        try {
            if (!knowledgeBaseId) {
                // Create new KB
                console.log('Creating new KB for bot...');
                const newKb = await createKnowledgeBase({
                    name: `${botName} KB`,
                    description: `Knowledge base for bot ${botName}`,
                    userId: user.id,
                    urls: [newSource.url]
                });

                // We need to fetch the newly created KB to get its ID
                // Since createKnowledgeBase might not return the ID directly depending on implementation,
                // we might need to fetch all and find it, or rely on the hook to update.
                // Let's assume we refresh the list and find it.

                // Wait a bit for propagation
                await new Promise(resolve => setTimeout(resolve, 1000));
                const kbs = await fetchKnowledgeBases();
                const createdKb = kbs?.find(k => k.name === `${botName} KB`); // Simple matching

                if (createdKb) {
                    onUpdateBot({ knowledge_base_id: createdKb.corpus_id });
                    setKnowledgeBase(createdKb);
                    toast({
                        title: 'Success',
                        description: 'Knowledge Base created and linked.',
                    });
                }
            } else {
                // Update existing KB
                console.log('Updating existing KB...');
                const currentUrls = knowledgeBase?.knowledgebase_sources?.[0]?.source_urls || [];
                const newUrls = [...currentUrls, newSource.url];

                await updateKnowledgeBase(knowledgeBaseId, {
                    user_id: user.id,
                    urls: newUrls
                });

                // Refresh local state
                const updatedKb = await getKnowledgeBaseById(knowledgeBaseId);
                if (updatedKb) setKnowledgeBase(updatedKb);

                toast({
                    title: 'Success',
                    description: 'Added to Knowledge Base.',
                });
            }
        } catch (error: any) {
            console.error('Error updating KB:', error);

            // Check for processing error
            if (error?.message?.toLowerCase().includes('processing')) {
                toast({
                    title: 'Processing in Progress',
                    description: 'The Knowledge Base is currently processing files. Please wait a moment.',
                    variant: 'default', // Not destructive, just info
                });
                // Refresh to update state
                if (knowledgeBaseId) {
                    getKnowledgeBaseById(knowledgeBaseId).then(kb => kb && setKnowledgeBase(kb));
                }
            } else {
                toast({
                    title: 'Error',
                    description: error?.message || 'Failed to update Knowledge Base.',
                    variant: 'destructive'
                });
            }
        }
    };

    const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const files = e.target.files;
        if (!files || files.length === 0) return;

        setIsUploading(true);
        try {
            for (const file of Array.from(files)) {
                const uploadResult = await uploadFileToStorage(file);
                // Refresh the list
                await fetchAllFiles();
            }
        } catch (error) {
            console.error('Upload error:', error);
            toast({
                title: 'Error',
                description: 'Failed to upload file.',
                variant: 'destructive'
            });
        } finally {
            setIsUploading(false);
            // Reset input
            e.target.value = '';
        }
    };

    const handleUrlSubmit = async () => {
        if (!currentUrl.trim()) return;
        try {
            new URL(currentUrl);
            await handleAddSource({
                type: 'url',
                url: currentUrl
            });
            setCurrentUrl('');
            setUrlError('');
        } catch {
            setUrlError('Invalid URL');
        }
    };

    const handleRemoveSource = async (sourceUrl: string) => {
        if (!knowledgeBaseId || !user?.id) return;

        try {
            // We do NOT delete from storage here anymore, only unlink from KB
            /*
            const isFile = !sourceUrl.startsWith('http') || sourceUrl.split('/').pop()?.includes('.');
            if (isFile) {
                await deleteFileFromStorage(sourceUrl);
            }
            */

            const currentUrls = knowledgeBase?.knowledgebase_sources?.[0]?.source_urls || [];
            const newUrls = currentUrls.filter(u => u !== sourceUrl);

            await updateKnowledgeBase(knowledgeBaseId, {
                user_id: user.id,
                urls: newUrls
            });

            // Refresh
            const updatedKb = await getKnowledgeBaseById(knowledgeBaseId);
            if (updatedKb) setKnowledgeBase(updatedKb);

            toast({
                title: 'Success',
                description: 'Detached from Knowledge Base.',
            });
        } catch (error: any) {
            console.error('Error removing source:', error);

            // Check for processing error
            if (error?.message?.toLowerCase().includes('processing')) {
                toast({
                    title: 'Processing in Progress',
                    description: 'The Knowledge Base is currently processing files. Please wait a moment.',
                    variant: 'default',
                });
                // Refresh to update state
                if (knowledgeBaseId) {
                    getKnowledgeBaseById(knowledgeBaseId).then(kb => kb && setKnowledgeBase(kb));
                }
            } else {
                toast({
                    title: 'Error',
                    description: error?.message || 'Failed to detach item.',
                    variant: 'destructive'
                });
            }
        }
    };

    const handleDeleteFile = async (fileUrl: string) => {
        try {
            // First detach if attached
            if (knowledgeBaseId && user?.id) {
                const currentUrls = knowledgeBase?.knowledgebase_sources?.[0]?.source_urls || [];
                if (currentUrls.includes(fileUrl)) {
                    await handleRemoveSource(fileUrl);
                }
            }

            // Then delete from storage
            const isFile = !fileUrl.startsWith('http') || fileUrl.split('/').pop()?.includes('.');
            if (isFile) {
                await deleteFileFromStorage(fileUrl);
            }

            // Refresh list
            await fetchAllFiles();

            toast({
                title: 'Success',
                description: 'File deleted successfully.',
            });
        } catch (error) {
            console.error('Error deleting file:', error);
            toast({
                title: 'Error',
                description: 'Failed to delete file.',
                variant: 'destructive'
            });
        }
    };

    const sources = getCurrentSources();

    return (
        <div className="space-y-6">
            {isProcessing && (
                <div className="bg-amber-50 border border-amber-200 rounded-md p-4 flex items-center gap-3">
                    <LoadingSpinner className="h-5 w-5 text-amber-600" />
                    <div className="flex-1">
                        <h4 className="text-sm font-medium text-amber-800">Knowledge Base is Processing</h4>
                        <p className="text-xs text-amber-700 mt-1">
                            Your files are being processed. You cannot attach new files until this is complete.
                            This usually takes a few minutes.
                        </p>
                    </div>
                    <Button
                        variant="outline"
                        size="sm"
                        onClick={() => knowledgeBaseId && getKnowledgeBaseById(knowledgeBaseId).then(kb => kb && setKnowledgeBase(kb))}
                        className="bg-white hover:bg-amber-50 border-amber-200 text-amber-700"
                    >
                        Refresh Status
                    </Button>
                </div>
            )}

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Upload Section */}
                <Card className="p-6">
                    <h3 className="font-medium mb-4 flex items-center gap-2">
                        <Icon name="upload" className="h-4 w-4" />
                        Upload PDFs
                    </h3>
                    <p className="text-sm text-muted-foreground mb-4">
                        Add PDF files to your assistant's knowledge base
                    </p>

                    <div
                        className={`border-2 border-dashed rounded-lg p-8 text-center hover:bg-muted/50 transition-colors ${isUploading ? 'opacity-50 pointer-events-none' : ''}`}
                        onClick={() => document.getElementById('kb-file-upload')?.click()}
                    >
                        <input
                            id="kb-file-upload"
                            type="file"
                            multiple
                            accept=".pdf,.txt,.doc,.docx,.md"
                            className="hidden"
                            onChange={handleFileSelect}
                        />
                        <div className="flex flex-col items-center gap-2 cursor-pointer">
                            {isUploading ? (
                                <LoadingSpinner className="h-8 w-8 text-primary" />
                            ) : (
                                <div className="h-10 w-10 rounded-full bg-muted flex items-center justify-center">
                                    <Icon name="file-text" className="h-5 w-5 text-muted-foreground" />
                                </div>
                            )}
                            <span className="text-sm font-medium">
                                {isUploading ? 'Uploading...' : 'Drag and drop a file here, or click to select'}
                            </span>
                            <span className="text-xs text-muted-foreground">
                                Supported formats: PDF (max 10MB)
                            </span>
                        </div>
                    </div>
                </Card>

                <Card className="p-6">
                    <h3 className="font-medium mb-4 flex items-center gap-2">
                        <Icon name="globe" className="h-4 w-4" />
                        Website Knowledge Base
                    </h3>
                    <p className="text-sm text-muted-foreground mb-4">
                        Add website content to your assistant's knowledge base
                    </p>

                    <div className="space-y-4">
                        <div>
                            <Label htmlFor="website-url">Website URL</Label>
                            <Input
                                id="website-url"
                                placeholder="https://example.com/"
                                value={currentUrl}
                                onChange={(e) => setCurrentUrl(e.target.value)}
                                className={urlError ? 'border-red-500' : ''}
                            />
                            {urlError && <p className="text-xs text-red-500 mt-1">{urlError}</p>}
                        </div>

                        <Button
                            className="w-full bg-teal-700 hover:bg-teal-800 text-white"
                            onClick={handleUrlSubmit}
                            disabled={!currentUrl || isLoading || isProcessing}
                        >
                            {isProcessing ? 'Processing...' : 'Add to Knowledge Base'}
                        </Button>
                    </div>
                </Card>
            </div>

            {/* Attached Files Section */}
            {allFiles.some(f => f.isAttached) && (
                <div className="space-y-3">
                    <Label>Attached Files:</Label>
                    <div className="flex flex-wrap gap-2">
                        {allFiles.filter(f => f.isAttached).map((file, idx) => (
                            <Badge
                                key={idx}
                                variant="secondary"
                                className="px-3 py-1.5 text-sm font-normal flex items-center gap-2 bg-teal-50 text-teal-700 hover:bg-teal-100 border border-teal-200"
                            >
                                <Icon name="file-text" className="h-3 w-3" />
                                <span className="max-w-[200px] truncate">{file.name}</span>
                                <button
                                    onClick={() => !isProcessing && handleRemoveSource(file.url)}
                                    className={`ml-1 hover:text-teal-900 ${isProcessing ? 'cursor-not-allowed opacity-50' : ''}`}
                                    disabled={isProcessing}
                                >
                                    <Icon name="x" className="h-3 w-3" />
                                </button>
                            </Badge>
                        ))}
                    </div>
                </div>
            )}

            {/* Available Files Section */}
            {allFiles.length > 0 && (
                <div className="space-y-4">
                    <h3 className="font-medium text-sm text-muted-foreground">Files</h3>
                    <div className="grid grid-cols-1 gap-4">
                        {allFiles.map((file, idx) => (
                            <FileCard
                                key={idx}
                                name={file.name}
                                size={file.size}
                                date={file.date}
                                url={file.url}
                                isAttached={file.isAttached}
                                onToggleAttach={() => {
                                    if (isProcessing) {
                                        toast({
                                            title: "Processing",
                                            description: "Please wait for the current files to finish processing.",
                                            variant: "destructive"
                                        });
                                        return;
                                    }
                                    if (file.isAttached) {
                                        handleRemoveSource(file.url);
                                    } else {
                                        handleAddSource({ type: 'file', url: file.url });
                                    }
                                }}
                                onDelete={() => handleDeleteFile(file.url)}
                            />
                        ))}
                    </div>
                </div>
            )}

            {/* When to Use Section */}
            <div className="space-y-2">
                <div className="flex items-center gap-2">
                    <Label>When to Use Knowledge Base</Label>
                    <Icon name="info" className="h-4 w-4 text-muted-foreground" />
                </div>
                <Textarea
                    placeholder="e.g. Use this knowledge base when the user asks about pricing or specific features..."
                    value={knowledgeBaseUsageGuide || ''}
                    onChange={(e) => onUpdateUsageGuide(e.target.value)}
                    className="h-24 resize-none"
                />
            </div>
        </div>
    );
}
