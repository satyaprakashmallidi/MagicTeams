'use client';

import { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Icon } from '@/components/ui/icons';
import { Input } from '@/components/ui/input';
import { useToast } from '@/hooks/use-toast';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { ExcelTable } from './components/excel-table';
import { StartCampaignDialog } from './components/start-campaign-dialog';
import { ScheduleCampaignDialog } from './components/schedule-campaign-dialog';
import { DeleteDialog } from './components/delete-dialog';
import { LoadingState } from './components/loading-state';
import { CSVImportErrorBoundary } from './components/error-boundary';
import { CampaignStatus } from './components/campaign-status';
import { HelpSystem, ContextualTooltip } from './components/help-system';
import { DataQualityIndicator } from './components/data-quality-indicator';
import { EnhancedUpload } from './components/enhanced-upload';
import { CSVFile, EditingCell } from './types';
import { supabase } from '@/lib/supabase';
import { useFileOperations } from './hooks/useFileOperations';
import { parseCSVFile } from './utils/csv-parser';
import { syncFileToDatabase, fetchFilesFromDatabase, fetchFileData, fetchSelectedRows, updateFilePagination, fetchAdditionalRows } from './services/database';
import { createBulkCallCampaign, monitorCampaignProgress } from './services/call-service';
import { campaignsService } from './services/campaigns-service';
import { useBots } from '@/hooks/use-bots';
import { FolderManager } from './components/folder-manager';
import { FolderService } from './services/folder-service';
import { Folder } from './types';
import { useKeyboardShortcuts } from './hooks/useKeyboardShortcuts';
import { getUtcIsoStringFromLocalInput } from '@/lib/utils/timezone';

function DataImportContent() {
  // Core state
  const [userId, setUserId] = useState<string | null>(null);
  const [csvFiles, setCsvFiles] = useState<CSVFile[]>([]);
  const [activeFileId, setActiveFileId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isInitialLoading, setIsInitialLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [editingCell, setEditingCell] = useState<EditingCell | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [showStartCampaignDialog, setShowStartCampaignDialog] = useState(false);
  const [showScheduleCampaignDialog, setShowScheduleCampaignDialog] = useState(false);
  const [currentCallIndex, setCurrentCallIndex] = useState<number>(0);
  const [callNotes, setCallNotes] = useState('');
  const [showFileDeleteDialog, setShowFileDeleteDialog] = useState(false);
  const [fileToDelete, setFileToDelete] = useState<string | null>(null);
  const [showColumnDeleteDialog, setShowColumnDeleteDialog] = useState(false);
  const [columnToDelete, setColumnToDelete] = useState<string | null>(null);
  const [activeCampaignId, setActiveCampaignId] = useState<string | null>(null);
  const [campaignStats, setCampaignStats] = useState<any>(null);
  const [selectedFolderId, setSelectedFolderId] = useState<string | null>(null);
  const [folders, setFolders] = useState<Folder[]>([]);
  const [uploadProgress, setUploadProgress] = useState<number>(0);
  const [uploadingFileName, setUploadingFileName] = useState<string>('');
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [isChangingPageSize, setIsChangingPageSize] = useState(false);

  // UI flow state
  const [currentStep, setCurrentStep] = useState<'file-selection' | 'data-view'>('file-selection');
  const [isDragOver, setIsDragOver] = useState(false);
  const [showHelpDialog, setShowHelpDialog] = useState(false);

  const { toast } = useToast();
  const { deleteFile, updateColumn, deleteColumn } = useFileOperations(userId);
  const { bots } = useBots();
  const searchInputRef = useRef<HTMLInputElement>(null);

  // Keyboard shortcuts
  useKeyboardShortcuts({
    onUpload: () => document.getElementById('csvInput')?.click(),
    onSelectAll: () => activeFile && handleRowSelect(-2),
    onDeselectAll: () => activeFile && handleRowSelect(-1),
    onSearch: () => searchInputRef.current?.focus(),
    onStartCampaign: () => {
      if (activeFile && (activeFile.selectedRows.length > 0 || (activeFile.selectedRowIds || []).length > 0)) {
        handleStartCampaign();
      }
    },
    onHelp: () => setShowHelpDialog(true),
    onEscape: () => {
      setShowDeleteDialog(false);
      setShowStartCampaignDialog(false);
      setShowScheduleCampaignDialog(false);
      setShowFileDeleteDialog(false);
      setShowColumnDeleteDialog(false);
      setEditingCell(null);
      setSearchTerm('');
    },
    isEnabled: true
  });

  // Drag and drop handlers
  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    if (currentStep === 'file-selection') {
      setIsDragOver(true);
    }
  }, [currentStep]);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
  }, []);

  const handleDrop = useCallback(async (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
    
    if (currentStep !== 'file-selection' || !userId) return;
    
    const files = Array.from(e.dataTransfer.files).filter(file => 
      file.type === 'text/csv' || file.name.endsWith('.csv')
    );
    
    if (files.length === 0) {
      toast({
        title: "Invalid Files",
        description: "Please drop CSV files only",
        variant: "destructive",
      });
      return;
    }
    
    // Process dropped files
    setIsLoading(true);
    setError(null);

    try {
      for (const file of files) {
        setUploadingFileName(file.name);
        setUploadProgress(0);
        
        const csvFile = await parseCSVFile(file);
        csvFile.folder_id = selectedFolderId;
        csvFile.folder = selectedFolderId ? 
          folders.find(f => f.id === selectedFolderId) || null : 
          null;

        // Show loading toast for large files
        if (csvFile.data.length > 100) {
          toast({
            title: "Processing Large File",
            description: `Uploading ${csvFile.name} (${csvFile.data.length} rows)...`,
          });
        }

        const updatedCsvFile = await syncFileToDatabase(csvFile, userId, selectedFolderId, (progress) => {
          setUploadProgress(progress);
        });

        setCsvFiles(prev => [...prev, updatedCsvFile]);

        toast({
          title: "Success",
          description: `Successfully imported ${csvFile.name}`,
        });
      }
    } catch (err) {
      console.error('Error reading dropped files:', err);
      const errorMessage = err instanceof Error ? err.message : String(err);
      setError('Error reading files: ' + errorMessage);
      toast({
        title: "Error",
        description: errorMessage,
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
      setUploadProgress(0);
      setUploadingFileName('');
    }
  }, [currentStep, userId, selectedFolderId, folders, toast]);
  
  const activeFile = useMemo(() => 
    csvFiles.find(file => file.id === activeFileId),
    [csvFiles, activeFileId]
  );

  const filteredFiles = useMemo(() => {
    if (selectedFolderId === null) {
      // Show files that have no folder_id (null or undefined)
      return csvFiles.filter(file => !file.folder_id);
    }
    // Show files that match the selected folder_id
    return csvFiles.filter(file => file.folder_id === selectedFolderId);
  }, [csvFiles, selectedFolderId]);


  useEffect(() => {
    const fetchUserId = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      setUserId(user?.id || null);
    };
    fetchUserId();
  }, []);

  const refreshFiles = useCallback(async () => {
    if (!userId) return;
    
    console.log('🐛 REFRESH FILES called - current selectedFolderId:', selectedFolderId);
    
    try {
      const [files, folderList] = await Promise.all([
        fetchFilesFromDatabase(userId),
        FolderService.getFolders(userId)
      ]);
      setCsvFiles(files);
      setFolders(folderList);
      
      console.log('🐛 REFRESH FILES complete - folders set to:', folderList);
    } catch (error) {
      console.error('Error refreshing files:', error);
    }
  }, [userId, selectedFolderId]);

  useEffect(() => {
    if (userId) {
      setIsInitialLoading(true);
      
      // Fetch both files and folders
      Promise.all([
        fetchFilesFromDatabase(userId),
        FolderService.getFolders(userId)
      ])
        .then(([files, folderList]) => {
          setCsvFiles(files);
          setFolders(folderList);
          
          // Don't auto-select files since we're using lazy loading
          // Users will explicitly select files which will trigger data loading
        })
        .catch(error => {
          console.error('Error fetching files:', error);
          setError('Failed to fetch files from database');
        })
        .finally(() => {
          setIsInitialLoading(false);
        });
    }
  }, [userId, selectedFolderId]);

  // Update active file when folder selection changes
  useEffect(() => {
    if (csvFiles.length > 0) {
      const relevantFiles = selectedFolderId === null 
        ? csvFiles.filter(f => !f.folder_id)
        : csvFiles.filter(f => f.folder_id === selectedFolderId);
      
      // If current active file is not in the selected folder, switch to first file in folder
      if (activeFileId && !relevantFiles.some(f => f.id === activeFileId)) {
        setActiveFileId(relevantFiles.length > 0 ? relevantFiles[0].id : null);
      } else if (!activeFileId && relevantFiles.length > 0) {
        setActiveFileId(relevantFiles[0].id);
      }
    }
  }, [selectedFolderId, csvFiles, activeFileId]);

  const handleFileUpload = useCallback(async (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files;
    if (!files || files.length === 0 || !userId) return;

    setIsLoading(true);
    setError(null);

    try {
      for (const file of Array.from(files)) {
        setUploadingFileName(file.name);
        setUploadProgress(0);
        
        const csvFile = await parseCSVFile(file);
        
        // Set folder information on the csvFile object
        csvFile.folder_id = selectedFolderId;
        csvFile.folder = selectedFolderId ? 
          folders.find(f => f.id === selectedFolderId) || null : 
          null;

        // Show loading toast for large files
        if (csvFile.data.length > 100) {
          toast({
            title: "Processing Large File",
            description: `Uploading ${csvFile.name} (${csvFile.data.length} rows)...`,
          });
        }

        const updatedCsvFile = await syncFileToDatabase(csvFile, userId, selectedFolderId, (progress) => {
          setUploadProgress(progress);
        });

        setCsvFiles(prev => [...prev, updatedCsvFile]);
        setActiveFileId(csvFile.id);
        
        toast({
          title: "Success",
          description: `Successfully imported ${csvFile.name}`,
        });
      }
    } catch (err) {
      console.error('Error reading file:', err);
      const errorMessage = err instanceof Error ? err.message : String(err);
      setError('Error reading file: ' + errorMessage);
      toast({
        title: "Error",
        description: errorMessage,
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
      setUploadProgress(0);
      setUploadingFileName('');
      if (event.target) {
        event.target.value = '';
      }
    }
  }, [userId, toast, selectedFolderId, folders]);

  const handleRemoveFile = async (fileId: string) => {
    setFileToDelete(fileId);
    setShowFileDeleteDialog(true);
  };

  const handleConfirmFileDelete = async () => {
    if (!fileToDelete || !userId) return;

    try {
      await deleteFile(fileToDelete);
      setCsvFiles(prev => prev.filter(file => file.id !== fileToDelete));
      if (activeFileId === fileToDelete) {
        setActiveFileId(csvFiles.find(file => file.id !== fileToDelete)?.id || null);
      }
    } catch (error) {
      console.error('Error deleting file:', error);
      setError('Failed to delete file from database');
    }

    setShowFileDeleteDialog(false);
    setFileToDelete(null);
  };

  const handleHeaderEdit = async (header: string, value: string) => {
    if (!activeFile || !userId) return;

    try {
      await updateColumn(activeFile.id, header, value);
      setCsvFiles(prev => prev.map(file => {
        if (file.id !== activeFileId) return file;

        const newHeaders = [...file.headers];
        const index = newHeaders.indexOf(header);
        if (index !== -1) {
          newHeaders[index] = value;
          const newData = file.data.map(row => {
            const newRow = { ...row };
            newRow[value] = newRow[header];
            delete newRow[header];
            return newRow;
          });

          return { ...file, headers: newHeaders, data: newData };
        }
        return file;
      }));
    } catch (error) {
      console.error('Error updating column name:', error);
      setError('Failed to update column name in database');
    }
    setEditingCell(null);
  };

  const handleCellEdit = (rowIndex: number | null, header: string, value: string) => {
    setEditingCell({ rowIndex, header, value });
  };

  const handleCellSave = async () => {
    if (!editingCell || !activeFile || !userId) return;
    
    try {
      if (editingCell.rowIndex === null) {
        await handleHeaderEdit(editingCell.header, editingCell.value);
      } else {
        const row = activeFile.data[editingCell.rowIndex];
        const dbId = row.dbId;

        console.log('Attempting to update row:', { row, dbId, rowIndex: editingCell.rowIndex });

        if (!dbId) {
          console.error('Row data missing dbId:', row);
          throw new Error('Row ID not found');
        }

        const newRowData = {
          ...row,
          [editingCell.header]: editingCell.value
        };
        delete newRowData.dbId;

        const { error: updateError } = await supabase
          .from('file_rows')
          .update({ row_data: newRowData })
          .eq('id', dbId);

        if (updateError) throw updateError;

        setCsvFiles(prev => prev.map(file => {
          if (file.id !== activeFileId) return file;

          const newData = [...file.data];
          newData[editingCell.rowIndex!] = {
            ...newRowData,
            dbId
          };
          return { ...file, data: newData };
        }));

        toast({
          title: "Success",
          description: "Cell updated successfully",
        });
      }
    } catch (error) {
      console.error('Error updating cell:', error);
      setError('Failed to update cell in database');
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : 'Failed to update cell',
        variant: "destructive",
      });
    }
    
    setEditingCell(null);
  };

  const handleAddNewRow = async () => {
    if (!activeFile || !userId) return;

    const newRow = activeFile.headers.reduce((acc, header) => {
      acc[header] = '';
      return acc;
    }, {} as Record<string, string>);
    newRow['call_status'] = 'not_called';
    newRow['interest'] = 'not_specified';
    newRow['call_notes'] = '';

    try {
      // Insert new row to database
      const { data: rowData, error: rowError } = await supabase
        .from('file_rows')
        .insert([{
          file_id: activeFile.id,
          row_data: newRow
        }])
        .select()
        .single();

      if (rowError) throw rowError;

      // Add the dbId to the new row
      const newRowWithId = {
        ...newRow,
        dbId: rowData.id
      };
      
      setCsvFiles(prev => prev.map(file => {
        if (file.id !== activeFileId) return file;
        return { 
          ...file, 
          data: [newRowWithId, ...file.data],
          currentPage: 1 // Reset to first page when adding new row
        };
      }));

      toast({
        title: "Success",
        description: "New row added successfully",
      });
    } catch (error) {
      console.error('Error adding new row:', error);
      setError('Failed to add new row to database');
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : 'Failed to add new row',
        variant: "destructive",
      });
    }
  };

  const handleAddColumn = async (columnName: string) => {
    if (!activeFile || !userId) return;

    try {
      // Update headers in the database
      const newHeaders = [...activeFile.headers, columnName];
      
      const { error: fileError } = await supabase
        .from('files')
        .update({ headers: newHeaders })
        .eq('id', activeFile.id)
        .eq('user_id', userId);

      if (fileError) throw fileError;

      // Update all existing rows to include the new column
      const updatedRows = activeFile.data.map(row => ({
        ...row,
        [columnName]: ''
      }));

      // Update each row in the database
      for (const row of updatedRows) {
        const { dbId, ...rowData } = row;
        if (dbId) {
          const { error: rowError } = await supabase
            .from('file_rows')
            .update({ row_data: rowData })
            .eq('id', dbId);

          if (rowError) throw rowError;
        }
      }

      setCsvFiles(prev => prev.map(file => {
        if (file.id !== activeFileId) return file;
        
        return { 
          ...file, 
          headers: newHeaders, 
          data: updatedRows
        };
      }));

      toast({
        title: "Success",
        description: `Added column "${columnName}"`,
      });
    } catch (error) {
      console.error('Error adding column:', error);
      setError('Failed to add column to database');
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : 'Failed to add column',
        variant: "destructive",
      });
    }
  };

  const handleRowSelect = (rowIndex: number) => {
    if (!activeFile) return;

    setCsvFiles(prev => prev.map(file => {
      if (file.id !== activeFileId) return file;

      let selectedRows: number[] = [];
      let selectedRowIds: string[] = [...(file.selectedRowIds || [])];

      if (rowIndex === -1) {
        // Clear all selections
        selectedRows = [];
        selectedRowIds = [];
      } else if (rowIndex === -2) {
        // Select all visible rows (current page or loaded data)
        const { pageData } = getPageData(file, searchTerm);
        const pageIndices = pageData.map((_, index) => index);
        const pageRowIds = pageData
          .filter(row => row.dbId)
          .map(row => row.dbId as string);
        
        selectedRows = [...Array.from(new Set([...file.selectedRows, ...pageIndices]))];
        selectedRowIds = [...Array.from(new Set([...selectedRowIds, ...pageRowIds]))];
      } else if (rowIndex === -3) {
        // Select all rows up to rowsPerPage limit (for 10000 rows mode)
        const maxRows = Math.min(file.rowsPerPage, file.totalRows || file.rowsPerPage);
        selectedRows = Array.from({ length: maxRows }, (_, i) => i);
        
        // Mark that we need to select the first N rows from database
        selectedRowIds = [`__SELECT_FIRST_${maxRows}__`]; // Special flag to select first N rows
      } else {
        // Toggle single row selection
        const rowData = file.data[rowIndex];
        const rowDbId = rowData?.dbId;
        
        if (file.selectedRows.includes(rowIndex)) {
          // Deselect
          selectedRows = file.selectedRows.filter(i => i !== rowIndex);
          if (rowDbId) {
            selectedRowIds = selectedRowIds.filter(id => id !== rowDbId);
          }
        } else {
          // Select
          selectedRows = [...file.selectedRows, rowIndex];
          if (rowDbId) {
            selectedRowIds = [...selectedRowIds, rowDbId];
          }
        }
      }

      return { ...file, selectedRows, selectedRowIds };
    }));
  };

  const handleStartCampaign = () => {
    if (!activeFile || (activeFile.selectedRows.length === 0 && (activeFile.selectedRowIds || []).length === 0)) return;
    setCurrentCallIndex(0);
    setCallNotes('');
    setShowStartCampaignDialog(true);
  };

  const handleScheduleCampaign = () => {
    if (!activeFile || (activeFile.selectedRows.length === 0 && (activeFile.selectedRowIds || []).length === 0)) return;
    setCurrentCallIndex(0);
    setCallNotes('');
    setShowScheduleCampaignDialog(true);
  };


  const handleStartCampaignNow = async (
    botId: string, 
    twilioPhoneNumbers: string[], 
    mappedFields: Record<string, string> = {},
    campaignSettings: any = {}
  ) => {
    await handleCampaignExecution(botId, twilioPhoneNumbers, mappedFields, undefined, campaignSettings);
    setShowStartCampaignDialog(false);
  };

  const handleScheduleCampaignExecution = async (
    botId: string,
    twilioPhoneNumbers: string[],
    mappedFields: Record<string, string> = {},
    scheduling?: any
  ) => {
    // Convert timezone if scheduled_start_time exists
    let convertedScheduling = scheduling;
    if (scheduling?.scheduled_start_time) {
      try {
        // Check if the scheduled_start_time needs conversion (local datetime format)
        // If it's already a UTC ISO string with 'Z', skip conversion
        const needsConversion = !scheduling.scheduled_start_time.endsWith('Z') &&
                                scheduling.scheduled_start_time.includes('T');

        if (needsConversion) {
          const convertedTime = getUtcIsoStringFromLocalInput(
            scheduling.scheduled_start_time.split('T')[0],  // date part
            scheduling.scheduled_start_time.split('T')[1],  // time part
            scheduling.timezone || 'UTC'
          );
          convertedScheduling = {
            ...scheduling,
            scheduled_start_time: convertedTime
          };
        }
      } catch (error) {
        console.error('Error converting timezone:', error);
        toast({
          title: "Error",
          description: "Failed to convert timezone for scheduled time",
          variant: "destructive",
        });
        return;
      }
    }

    // Extract time window from scheduling and create campaign settings
    const campaignSettings = {
      enableNumberLocking: true, // Enable by default for scheduled campaigns
      ...(convertedScheduling?.timeWindow && {
        timeWindow: convertedScheduling.timeWindow,
        timezone: convertedScheduling.timezone || 'UTC'
      })
    };

    await handleCampaignExecution(botId, twilioPhoneNumbers, mappedFields, convertedScheduling, campaignSettings);
    setShowScheduleCampaignDialog(false);
  };

  const handleCampaignExecution = async (
    botId: string, 
    twilioPhoneNumbers: string[] | string, 
    mappedFields: Record<string, string> = {},
    scheduling?: any,
    campaignSettings?: any
  ) => {
    // Handle both array and single number for backward compatibility
    const phoneNumbers = Array.isArray(twilioPhoneNumbers) ? twilioPhoneNumbers : [twilioPhoneNumbers];
    if (!activeFile || !userId) return;

    try {
      // Get selected contacts by fetching them from database using their IDs
      // Handle both selectedRowIds and the special flag for "select all"
      let selectedRowsData;
      
      if (activeFile.selectedRowIds && activeFile.selectedRowIds.length > 0) {
        selectedRowsData = await fetchSelectedRows(activeFile.id, userId, activeFile.selectedRowIds);
      } else if (activeFile.selectedRows && activeFile.selectedRows.length > 0) {
        // If we only have selectedRows indices, get the dbIds from the loaded data
        const dbIds = activeFile.selectedRows
          .map(index => activeFile.data[index]?.dbId)
          .filter(id => id);
        
        if (dbIds.length > 0) {
          selectedRowsData = await fetchSelectedRows(activeFile.id, userId, dbIds);
        } else {
          // Fallback: use the loaded data directly
          selectedRowsData = activeFile.selectedRows.map(index => activeFile.data[index]);
        }
      } else {
        throw new Error('No rows selected');
      }
      
      const selectedContacts = selectedRowsData.map(row => {
        return {
          ...row,
          phone: row["phone"] || row["phone number"] || row["phone_number"] || row["Phone"] || row["Phone Number"] || row["PHONE"] || row["PHONE NUMBER"],
          name: row["name"] || row["contact_name"] || row["customer_name"] || row["Name"] || row["Contact Name"] || row["CUSTOMER NAME"] || row["NAME"] || row["First Name"] || row["Last Name"] || row["LASTNAME"] || row["LAST NAME"] || row["LASTNAME"] || row["FIRST NAME"] || row["FIRSTNAME"] || row["first_name"] || row["last_name"] || row["firstname"] || row["lastname"]
        };
      });

      console.log('Selected contacts for campaign:', {
        count: selectedContacts.length,
        firstContact: selectedContacts[0],
        selectedRowIds: activeFile.selectedRowIds,
        selectedRows: activeFile.selectedRows
      });

      if (!selectedContacts || selectedContacts.length === 0) {
        throw new Error('No contacts found for selected rows');
      }

      // Find the selected bot
      const selectedBot = bots.find(bot => bot.id === botId);
      const botName = selectedBot?.name || 'Unknown Bot';
      
      // Create campaign name based on file name and timestamp
      const timestamp = new Date().toLocaleString();
      const campaignName = `${activeFile.name} - ${timestamp}`;

      // Get bot's system prompt and voice settings
      const systemPrompt = selectedBot?.system_prompt || 'You are a helpful AI assistant making calls.';
      const voiceSettings = {
        voice: selectedBot?.voice || "d17917ec-fd98-4c50-8c83-052c575cbf3e",
        temperature: selectedBot?.temperature || 0.6
      };

      toast({
        title: "Creating Campaign",
        description: "Setting up bulk call campaign...",
      });

      // Create and start the campaign
      const result = await createBulkCallCampaign(
        campaignName,
        selectedContacts,
        botId,
        botName,
        phoneNumbers, // Now using the array
        systemPrompt,
        voiceSettings,
        mappedFields,
        userId,
        `Bulk calls for ${activeFile.name}`,
        scheduling,
        campaignSettings
      );

      if (result.status === 'success') {
        setActiveCampaignId(result.campaign_id);
        
        toast({
          title: "Campaign Started",
          description: result.message,
        });
        
        // Redirect to bulk call history with the campaign details
        window.location.href = `/dashboard/bulk-call-history?campaignId=${result.campaign_id}&tab=details`;

        // Start monitoring campaign progress
        monitorCampaignProgress(
          result.campaign_id,
          (stats, contacts) => {
            setCampaignStats(stats);
            
            // Update the CSV file data with call results
            setCsvFiles(prev => prev.map(file => {
              if (file.id !== activeFileId) return file;
              
              const newData = [...file.data];
              contacts.forEach(contact => {
                // Find the matching row by phone number
                const rowIndex = newData.findIndex(row => {
                  const rowPhone = row["phone"] || row["phone number"] || row["phone_number"] || row["Phone"] || row["Phone Number"] || row["PHONE"] || row["PHONE NUMBER"];
                  console.log(rowPhone, contact.contact_phone);
                  return rowPhone === contact.contact_phone;
                });
                
                if (rowIndex !== -1) {
                  newData[rowIndex] = {
                    ...newData[rowIndex],
                    Call_ID: contact.ultravox_call_id || '',
                    call_status: contact.call_status,
                    call_notes: contact.call_summary || contact.call_notes || '',
                    interest: contact.interest_level || 'not_specified'
                  };
                }
              });
              
              return { ...file, data: newData };
            }));
          }
        );

        // Clear selected rows
        setCsvFiles(prev => prev.map(file => {
          if (file.id !== activeFileId) return file;
          return { ...file, selectedRows: [], selectedRowIds: [] };
        }));
      } else {
        throw new Error(result.message);
      }
    } catch (error) {
      console.error('Error creating campaign:', error);
      toast({
        title: "Campaign Failed",
        description: error instanceof Error ? error.message : 'Failed to create campaign',
        variant: "destructive",
      });
    }

    setCurrentCallIndex(0);
    setCallNotes('');
  };

  const handleStopCampaign = async () => {
    if (!activeCampaignId) return;

    try {
      await campaignsService.stopCampaign(activeCampaignId);
      setActiveCampaignId(null);
      setCampaignStats(null);
      
      toast({
        title: "Campaign Stopped",
        description: "Campaign has been cancelled successfully",
      });
    } catch (error) {
      console.error('Error stopping campaign:', error);
      toast({
        title: "Error",
        description: "Failed to stop campaign",
        variant: "destructive",
      });
    }
  };

  const handleDeleteSelected = async () => {
    if (!activeFile || !userId || (activeFile.selectedRowIds || []).length === 0) return;

    try {
      const { data: fileData, error: fileError } = await supabase
        .from('files')
        .select('id')
        .eq('id', activeFile.id)
        .eq('user_id', userId)
        .single();

      if (fileError || !fileData) {
        throw new Error('Unauthorized to delete these rows');
      }

      const { error: deleteError } = await supabase
        .from('file_rows')
        .delete()
        .in('id', activeFile.selectedRowIds || []);

      if (deleteError) throw deleteError;

      // Update the total row count and reload the current page
      setCsvFiles(prev => prev.map(file => {
        if (file.id !== activeFileId) return file;
        
        return { 
          ...file, 
          totalRows: (file.totalRows || 0) - (activeFile.selectedRowIds || []).length,
          selectedRows: [],
          selectedRowIds: []
        };
      }));

      // Reload current page to reflect deletions
      await loadFileData(activeFile.id, activeFile.currentPage);

      toast({
        title: "Success",
        description: `Successfully deleted ${(activeFile.selectedRowIds || []).length} rows`,
      });
    } catch (error) {
      console.error('Error deleting rows:', error);
      setError('Failed to delete rows from database');
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : 'Failed to delete rows',
        variant: "destructive",
      });
    }

    setShowDeleteDialog(false);
  };

  const handlePageChange = async (fileId: string, newPage: number) => {
    // Use lazy loading to fetch the new page data
    await loadFileData(fileId, newPage);
  };

  const handleRowsPerPageChange = async (fileId: string, newRowsPerPage: number) => {
    try {
      setIsChangingPageSize(true);
      
      // Show feedback to user
      toast({
        title: "Loading",
        description: `Loading ${newRowsPerPage} rows...`,
      });
      
      // Update rows per page and reload first page
      setCsvFiles(prev => prev.map(file => {
        if (file.id !== fileId) return file;
        return { ...file, rowsPerPage: newRowsPerPage, currentPage: 1 };
      }));
      
      // Load first page with new page size - pass newRowsPerPage directly to avoid state timing issues
      await loadFileData(fileId, 1, newRowsPerPage);
      
      toast({
        title: "Success",
        description: `Loaded ${newRowsPerPage === 10000 ? 'first 1000 of 10000' : newRowsPerPage} rows`,
      });
    } catch (error) {
      console.error('Error changing page size:', error);
      toast({
        title: "Error",
        description: "Failed to load rows",
        variant: "destructive",
      });
    } finally {
      setIsChangingPageSize(false);
    }
  };

  // Handler for loading more rows in virtual scrolling mode
  const handleLoadMoreRows = async (fileId: string, offset: number) => {
    if (!userId || isLoadingMore) return;
    
    try {
      setIsLoadingMore(true);
      const additionalRows = await fetchAdditionalRows(fileId, userId, offset, 1000);
      
      // Append the new rows to the existing data
      setCsvFiles(prev => prev.map(file => {
        if (file.id !== fileId) return file;
        return {
          ...file,
          data: [...file.data, ...additionalRows]
        };
      }));
    } catch (error) {
      console.error('Error loading more rows:', error);
      toast({
        title: "Error",
        description: "Failed to load more rows",
        variant: "destructive",
      });
    } finally {
      setIsLoadingMore(false);
    }
  };

  const getPageData = (file: CSVFile, searchTerm: string) => {
    // If searching, filter the loaded data (client-side filtering for current page)
    const filteredData = searchTerm ? 
      file.data.filter(row =>
        Object.values(row).some(value =>
          value?.toLowerCase().includes(searchTerm.toLowerCase())
        )
      ) : file.data;

    // For pagination info, use totalRows from server, not filtered data length
    const totalRows = file.totalRows || file.data.length;
    const totalPages = Math.ceil(totalRows / file.rowsPerPage);

    return {
      pageData: filteredData,
      totalRows,
      totalPages
    };
  };

  const handleDeleteColumn = async (header: string) => {
    setColumnToDelete(header);
    setShowColumnDeleteDialog(true);
  };

  const handleConfirmColumnDelete = async () => {
    if (!columnToDelete || !activeFile || !userId) return;

    try {
      await deleteColumn(activeFile.id, columnToDelete);
      setCsvFiles(prev => prev.map(file => {
        if (file.id !== activeFileId) return file;

        const newHeaders = file.headers.filter(h => h !== columnToDelete);
        const newData = file.data.map(row => {
          const newRow = { ...row };
          delete newRow[columnToDelete];
          return newRow;
        });

        return { ...file, headers: newHeaders, data: newData };
      }));
    } catch (error) {
      console.error('Error deleting column:', error);
      setError('Failed to delete column from database');
    }

    setShowColumnDeleteDialog(false);
    setColumnToDelete(null);
  };


  const loadFileData = useCallback(async (fileId: string, page: number = 1, customRowsPerPage?: number) => {
    if (!userId) return;

    const file = csvFiles.find(f => f.id === fileId);
    if (!file) return;

    // Use custom rowsPerPage if provided, otherwise use file's rowsPerPage
    const rowsPerPage = customRowsPerPage || file.rowsPerPage;

    try {
      setIsLoading(true);
      const { data, totalRows } = await fetchFileData(fileId, userId, page, rowsPerPage);
      
      // Update the file with loaded data
      setCsvFiles(prev => prev.map(f => {
        if (f.id !== fileId) return f;
        
        // Reset page-level selections when loading new page data
        const selectedRowsOnPage: number[] = [];
        data.forEach((row, index) => {
          if (f.selectedRowIds && f.selectedRowIds.includes(row.dbId)) {
            selectedRowsOnPage.push(index);
          }
        });
        
        return {
          ...f,
          data,
          totalRows,
          currentPage: page,
          isDataLoaded: true,
          selectedRows: selectedRowsOnPage
        };
      }));
    } catch (error) {
      console.error('Error loading file data:', error);
      toast({
        title: "Error",
        description: "Failed to load file data",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  }, [userId, csvFiles, toast]);

  const handleFileSelected = async (fileId: string) => {
    setActiveFileId(fileId);
    setCurrentStep('data-view');

    // Load file data if not already loaded
    const file = csvFiles.find(f => f.id === fileId);
    if (file && !file.isDataLoaded) {
      await loadFileData(fileId, 1);
    }
  };

  const handleBackToFiles = () => {
    setCurrentStep('file-selection');
    setActiveFileId(null);
  };

  if (isInitialLoading) {
    return <LoadingState />;
  }


  return (
    <div className="w-full h-full flex flex-col bg-gradient-to-br from-gray-50 to-white">
      {/* Compact Page Header */}
      <div className="flex-shrink-0 bg-background border-b border-border">
        <div className="px-4 py-2">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <div className="p-1.5 bg-blue-100 dark:bg-blue-900/20 rounded-lg">
                <Icon name="database" className="h-5 w-5 text-blue-600 dark:text-blue-400" />
              </div>
              <div>
                <h1 className="text-lg font-semibold text-foreground">Data Import</h1>
              </div>
            </div>
            {/* Compact Breadcrumb */}
            <div className="flex items-center space-x-1 text-xs text-muted-foreground">
              <span className={`px-2 py-1 rounded ${currentStep === 'file-selection' ? 'bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400 font-medium' : ''}`}>
                Files
              </span>
              <Icon name="chevronRight" className="h-3 w-3" />
              <span className={`px-2 py-1 rounded ${currentStep === 'data-view' ? 'bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400 font-medium' : ''}`}>
                Data
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Hidden file input */}
      <input
        id="csvInput"
        type="file"
        accept=".csv"
        multiple
        className="hidden"
        onChange={handleFileUpload}
      />

      {error && (
        <div className="px-6 py-2">
          <Alert variant="destructive" className="border-red-200 bg-red-50">
            <Icon name="alertCircle" className="h-4 w-4" />
            <AlertDescription className="text-red-800">{error}</AlertDescription>
          </Alert>
        </div>
      )}

      {/* Campaign Status */}
      <CampaignStatus
        campaignId={activeCampaignId}
        stats={campaignStats}
        onStop={handleStopCampaign}
      />

      {/* Help System */}
      <div className="px-6">
        <HelpSystem currentStep={currentStep} />
      </div>

      {/* File Selection with Integrated Folder Management */}
      {currentStep === 'file-selection' && (
        <div
          className="flex-1 flex flex-col overflow-hidden"
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
        >
          {/* File Management Header with Folder Selection */}
          <div className="flex-shrink-0 bg-background border-b border-border">
            <div className="px-4 py-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <Icon name="folder" className="h-4 w-4 text-blue-600 dark:text-blue-400" />
                  <select
                    value={selectedFolderId || ''}
                    onChange={(e) => setSelectedFolderId(e.target.value || null)}
                    className="text-lg font-semibold text-foreground bg-transparent border-none outline-none cursor-pointer hover:text-blue-600 dark:hover:text-blue-400"
                  >
                    <option value="">Uncategorized ({csvFiles.filter(f => !f.folder_id).length} files)</option>
                    {folders.map(folder => (
                      <option key={folder.id} value={folder.id}>
                        {folder.name} ({csvFiles.filter(f => f.folder_id === folder.id).length} files)
                      </option>
                    ))}
                  </select>
                </div>
                <div className="flex items-center gap-2">
                  <FolderManager
                    userId={userId}
                    selectedFolderId={selectedFolderId}
                    onFolderChange={(newFolderId) => setSelectedFolderId(newFolderId)}
                    onFolderCreated={refreshFiles}
                    folders={folders}
                    setFolders={setFolders}
                    className=""
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Enhanced File Content Area */}
          <div className="flex-1 overflow-auto bg-muted/50">
            <div className="px-6 py-8">
              {/* Enhanced Upload Area */}
              <div className="mb-8">
                <EnhancedUpload
                  onFileUpload={handleFileUpload}
                  onDrop={handleDrop}
                  onDragOver={handleDragOver}
                  onDragLeave={handleDragLeave}
                  isLoading={isLoading}
                  isDragOver={isDragOver}
                  uploadProgress={uploadProgress}
                  uploadingFileName={uploadingFileName}
                />
              </div>
            
              {/* Enhanced File Grid */}
              {filteredFiles.length > 0 ? (
                <div>
                  <div className="flex items-center justify-between mb-6">
                    <h3 className="text-lg font-semibold text-foreground">Your Files</h3>
                    <div className="text-sm text-muted-foreground">{filteredFiles.length} file{filteredFiles.length !== 1 ? 's' : ''}</div>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                    {filteredFiles.map(file => (
                      <div
                        key={file.id}
                        className="group relative bg-background border-2 border-border rounded-2xl p-6 hover:border-blue-300 dark:hover:border-blue-700 hover:shadow-xl cursor-pointer transition-all duration-200 hover:-translate-y-1"
                      >
                        <div
                          onClick={() => handleFileSelected(file.id)}
                          className="flex-1"
                        >
                          <div className="flex items-center justify-between mb-4">
                            <div className="p-3 bg-green-100 rounded-xl group-hover:bg-green-200 transition-colors">
                              <Icon name="fileSpreadsheet" className="h-8 w-8 text-green-600" />
                            </div>
                            <div className="text-right text-xs text-muted-foreground">
                              CSV
                            </div>
                          </div>
                          <h3 className="font-bold text-foreground mb-3 truncate text-lg" title={file.name}>
                            {file.name}
                          </h3>
                          <div className="space-y-3">
                            <div className="grid grid-cols-2 gap-2 text-sm">
                              <div className="bg-muted rounded-lg p-2 text-center">
                                <div className="font-semibold text-foreground">{file.totalRows || file.data.length}</div>
                                <div className="text-xs text-muted-foreground">rows</div>
                              </div>
                              <div className="bg-muted rounded-lg p-2 text-center">
                                <div className="font-semibold text-foreground">{file.headers.length}</div>
                                <div className="text-xs text-muted-foreground">columns</div>
                              </div>
                            </div>
                            {file.data.some(row => row.call_status === 'completed') && (
                              <Badge variant="outline" className="w-full justify-center bg-green-50 text-green-700 border-green-200 font-medium">
                                <Icon name="phone" className="h-3 w-3 mr-1" />
                                Has Call Data
                              </Badge>
                            )}
                          </div>
                        </div>

                        {/* File Actions */}
                        <div className="absolute top-4 right-4 opacity-0 group-hover:opacity-100 transition-opacity">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={(e: React.MouseEvent<HTMLButtonElement>) => {
                              e.stopPropagation();
                              handleRemoveFile(file.id);
                            }}
                            className="h-8 w-8 p-0 text-muted-foreground hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg"
                          >
                            <Icon name="trash" className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ) : (
                <div className="text-center py-20 bg-background rounded-2xl border-2 border-dashed border-border">
                  <div className="w-24 h-24 bg-muted rounded-full flex items-center justify-center mx-auto mb-6">
                    <Icon name="fileSpreadsheet" className="h-12 w-12 text-muted-foreground" />
                  </div>
                  <h3 className="text-xl font-bold text-foreground mb-3">
                    {selectedFolderId === null
                      ? "No uncategorized files yet"
                      : "No files in this folder yet"
                    }
                  </h3>
                  <p className="text-muted-foreground mb-6 max-w-md mx-auto">
                    Upload your first CSV file to get started with organizing and managing your data for bulk campaigns
                  </p>
                  <Button
                    onClick={() => document.getElementById('csvInput')?.click()}
                    className="bg-blue-600 hover:bg-blue-700 dark:bg-blue-600 dark:hover:bg-blue-700 text-white px-6 py-3"
                  >
                    <Icon name="upload" className="h-5 w-5 mr-2" />
                    Upload Your First File
                  </Button>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
      
      {/* Step 3: Enhanced Data View */}
      {currentStep === 'data-view' && activeFile && (
        <div className="flex-1 flex flex-col overflow-hidden">
          {/* Enhanced Loading state for file data */}
          {!activeFile.isDataLoaded && isLoading && (
            <div className="flex-1 flex items-center justify-center bg-muted/50">
              <div className="text-center bg-background rounded-2xl p-12 shadow-lg max-w-md mx-auto">
                <div className="w-16 h-16 bg-blue-100 dark:bg-blue-900/20 rounded-full flex items-center justify-center mx-auto mb-6">
                  <Icon name="spinner" className="h-8 w-8 animate-spin text-blue-600 dark:text-blue-400" />
                </div>
                <h3 className="text-xl font-bold text-foreground mb-3">Loading file data...</h3>
                <p className="text-muted-foreground mb-4">Please wait while we load {activeFile.totalRows || 0} rows from your file</p>
                <div className="bg-muted rounded-full h-2">
                  <div className="bg-blue-600 h-2 rounded-full animate-pulse" style={{ width: '60%' }}></div>
                </div>
              </div>
            </div>
          )}

          {/* Compact Header with navigation and controls */}
          {activeFile.isDataLoaded && (
            <div className="flex-shrink-0 bg-background border-b border-border">
              <div className="px-4 py-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <Button
                      onClick={handleBackToFiles}
                      variant="outline"
                      size="sm"
                      className="flex items-center gap-1 text-sm"
                    >
                      <Icon name="chevronLeft" className="h-3 w-3" />
                      Back to Files
                    </Button>
                    <div className="flex items-center gap-2">
                      <Icon name="fileSpreadsheet" className="h-4 w-4 text-green-600" />
                      <h2 className="text-base font-semibold text-foreground">{activeFile.name}</h2>
                      <span className="text-xs text-muted-foreground">
                        {activeFile.totalRows || activeFile.data.length} rows • {activeFile.headers.length} cols
                      </span>
                      {(activeFile.selectedRows.length > 0 || (activeFile.selectedRowIds || []).length > 0) && (
                        <span className="ml-2 px-2 py-0.5 bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400 text-xs rounded-full font-medium">
                          {activeFile.selectedRows.length || (activeFile.selectedRowIds || []).length} selected
                        </span>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <ContextualTooltip content="Search through your data" shortcut="Ctrl+F">
                      <div className="relative">
                        <Icon name="search" className="absolute left-2 top-1/2 transform -translate-y-1/2 h-3 w-3 text-muted-foreground" />
                        <Input
                          ref={searchInputRef}
                          type="text"
                          placeholder="Search..."
                          value={searchTerm}
                          onChange={(e) => setSearchTerm(e.target.value)}
                          className="w-40 pl-7 h-8 text-sm"
                        />
                        {searchTerm && (
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => setSearchTerm('')}
                            className="absolute right-0.5 top-1/2 transform -translate-y-1/2 h-6 w-6 p-0"
                          >
                            <Icon name="x" className="h-3 w-3" />
                          </Button>
                        )}
                      </div>
                    </ContextualTooltip>

                    {/* Action buttons */}
                    {(activeFile.selectedRows.length > 0 || (activeFile.selectedRowIds || []).length > 0) && (
                      <>
                        <ContextualTooltip content="Start calling selected contacts immediately" shortcut="Enter">
                          <Button
                            onClick={handleStartCampaign}
                            className="flex items-center gap-1 text-sm h-8 px-3"
                            size="sm"
                          >
                            <Icon name="play" className="h-3 w-3" />
                            Start Campaign
                          </Button>
                        </ContextualTooltip>
                        <ContextualTooltip content="Schedule calls for a specific date and time">
                          <Button
                            onClick={handleScheduleCampaign}
                            variant="outline"
                            className="flex items-center gap-1 text-sm h-8 px-3"
                            size="sm"
                          >
                            <Icon name="clock" className="h-3 w-3" />
                            Schedule
                          </Button>
                        </ContextualTooltip>
                        <ContextualTooltip content="Delete selected contacts from this file">
                          <Button
                            onClick={() => setShowDeleteDialog(true)}
                            variant="destructive"
                            size="sm"
                            className="flex items-center gap-1 text-sm h-8 px-3"
                          >
                            <Icon name="trash" className="h-3 w-3" />
                            Delete
                          </Button>
                        </ContextualTooltip>
                      </>
                    )}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Data Quality Indicator */}
          {activeFile.isDataLoaded && (
            <div className="px-6 py-4">
              <DataQualityIndicator file={activeFile} />
            </div>
          )}

          {/* Enhanced Excel Table */}
          {activeFile.isDataLoaded && (
            <div className="flex-1 overflow-hidden bg-muted/50">
              <div className="h-full">
                <ExcelTable
                  file={activeFile}
                  searchTerm={searchTerm}
                  editingCell={editingCell}
                  onCellEdit={handleCellEdit}
                  onCellSave={handleCellSave}
                  onRowSelect={handleRowSelect}
                  onPageChange={handlePageChange}
                  onRowsPerPageChange={handleRowsPerPageChange}
                  setEditingCell={setEditingCell}
                  onDeleteColumn={handleDeleteColumn}
                  onAddRow={handleAddNewRow}
                  onStartCalls={handleStartCampaign}
                  onDeleteSelected={handleDeleteSelected}
                  onAddColumn={handleAddColumn}
                  onLoadMoreRows={handleLoadMoreRows}
                  isLoadingMore={isLoadingMore}
                  isChangingPageSize={isChangingPageSize}
                />
              </div>
            </div>
          )}
        </div>
      )}

      <StartCampaignDialog
        showDialog={showStartCampaignDialog}
        setShowDialog={setShowStartCampaignDialog}
        activeFile={activeFile}
        currentCallIndex={currentCallIndex}
        callNotes={callNotes}
        setCallNotes={setCallNotes}
        onStartCampaign={handleStartCampaignNow}
      />

      <ScheduleCampaignDialog
        showDialog={showScheduleCampaignDialog}
        setShowDialog={setShowScheduleCampaignDialog}
        activeFile={activeFile}
        currentCallIndex={currentCallIndex}
        callNotes={callNotes}
        setCallNotes={setCallNotes}
        onScheduleCampaign={handleScheduleCampaignExecution}
      />

      <DeleteDialog
        showDialog={showDeleteDialog}
        setShowDialog={setShowDeleteDialog}
        activeFile={activeFile}
        onDelete={handleDeleteSelected}
      />

      <DeleteDialog
        showDialog={showFileDeleteDialog}
        setShowDialog={setShowFileDeleteDialog}
        title="Delete File"
        message="Are you sure you want to delete this file? This action cannot be undone."
        onDelete={handleConfirmFileDelete}
      />

      <DeleteDialog
        showDialog={showColumnDeleteDialog}
        setShowDialog={setShowColumnDeleteDialog}
        title="Delete Column"
        message={`Are you sure you want to delete the column "${columnToDelete}"? This action cannot be undone.`}
        onDelete={handleConfirmColumnDelete}
      />
    </div>
  );
}

export function DataImport() {
  return (
    <CSVImportErrorBoundary>
      <div className="h-full">
        <DataImportContent />
      </div>
    </CSVImportErrorBoundary>
  );
}