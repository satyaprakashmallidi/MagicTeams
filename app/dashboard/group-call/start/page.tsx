"use client";

import { useState, useEffect, useMemo, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Icon } from "@/components/ui/icons";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from '@/components/ui/checkbox';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { ExcelTable } from '@/components/csv-import/components/excel-table';
import { FieldsDialog } from '@/components/csv-import/components/fields-dialog';
import { CSVFile, EditingCell } from '@/components/csv-import/types';
import { supabase } from '@/lib/supabase';
import { useRouter, useSearchParams } from 'next/navigation';
import { useToast } from '@/hooks/use-toast';
import { useBots } from '@/hooks/use-bots';
import { useVoices } from '@/hooks/use-voices';
import { usePricing } from '@/hooks/use-pricing';
import { TwilioPhoneNumber } from '@/types/twilio';
import { fetchFilesFromDatabase, fetchFileData, fetchAdditionalRows } from '@/components/csv-import/services/database';
import { createBulkCallCampaign } from '@/components/csv-import/services/call-service';
import { useFileOperations } from '@/components/csv-import/hooks/useFileOperations';
import { StartPageSkeleton } from '@/components/skeletons/start-page-skeleton';
import { getUtcIsoStringFromLocalInput } from '@/lib/utils/timezone';

interface CampaignSettings {
  enableNumberLocking: boolean;
}

const timezones = [
  { value: "UTC", label: "UTC" },
  // North America
  { value: "America/New_York", label: "Eastern Time (US)" },
  { value: "America/Chicago", label: "Central Time (US)" },
  { value: "America/Denver", label: "Mountain Time (US)" },
  { value: "America/Los_Angeles", label: "Pacific Time (US)" },
  { value: "America/Phoenix", label: "Arizona" },
  { value: "America/Anchorage", label: "Alaska" },
  { value: "Pacific/Honolulu", label: "Hawaii" },
  { value: "America/Toronto", label: "Toronto" },
  { value: "America/Vancouver", label: "Vancouver" },
  { value: "America/Mexico_City", label: "Mexico City" },
  // Europe
  { value: "Europe/London", label: "London (GMT)" },
  { value: "Europe/Paris", label: "Paris (CET)" },
  { value: "Europe/Berlin", label: "Berlin (CET)" },
  { value: "Europe/Rome", label: "Rome (CET)" },
  { value: "Europe/Madrid", label: "Madrid (CET)" },
  { value: "Europe/Amsterdam", label: "Amsterdam (CET)" },
  { value: "Europe/Stockholm", label: "Stockholm (CET)" },
  { value: "Europe/Helsinki", label: "Helsinki (EET)" },
  { value: "Europe/Athens", label: "Athens (EET)" },
  { value: "Europe/Moscow", label: "Moscow (MSK)" },
  // Asia
  { value: "Asia/Tokyo", label: "Tokyo (JST)" },
  { value: "Asia/Shanghai", label: "Shanghai (CST)" },
  { value: "Asia/Hong_Kong", label: "Hong Kong (HKT)" },
  { value: "Asia/Singapore", label: "Singapore (SGT)" },
  { value: "Asia/Seoul", label: "Seoul (KST)" },
  { value: "Asia/Taipei", label: "Taipei (CST)" },
  { value: "Asia/Bangkok", label: "Bangkok (ICT)" },
  { value: "Asia/Jakarta", label: "Jakarta (WIB)" },
  { value: "Asia/Manila", label: "Manila (PST)" },
  { value: "Asia/Mumbai", label: "Mumbai (IST)" },
  { value: "Asia/Kolkata", label: "Kolkata (IST)" },
  { value: "Asia/Dubai", label: "Dubai (GST)" },
  { value: "Asia/Riyadh", label: "Riyadh (AST)" },
  // Australia & Pacific
  { value: "Australia/Sydney", label: "Sydney (AEST)" },
  { value: "Australia/Melbourne", label: "Melbourne (AEST)" },
  { value: "Australia/Brisbane", label: "Brisbane (AEST)" },
  { value: "Australia/Perth", label: "Perth (AWST)" },
  { value: "Australia/Adelaide", label: "Adelaide (ACST)" },
  { value: "Pacific/Auckland", label: "Auckland (NZST)" },
  // South America
  { value: "America/Sao_Paulo", label: "São Paulo (BRT)" },
  { value: "America/Buenos_Aires", label: "Buenos Aires (ART)" },
  { value: "America/Lima", label: "Lima (PET)" },
  { value: "America/Bogota", label: "Bogotá (COT)" },
  { value: "America/Santiago", label: "Santiago (CLT)" },
  // Africa
  { value: "Africa/Cairo", label: "Cairo (EET)" },
  { value: "Africa/Lagos", label: "Lagos (WAT)" },
  { value: "Africa/Johannesburg", label: "Johannesburg (SAST)" },
  { value: "Africa/Nairobi", label: "Nairobi (EAT)" },
];

export default function StartCampaignPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { toast } = useToast();
  const { bots: allBots } = useBots();
  const bots = allBots.filter(bot => !bot.is_deleted);
  const { twilioInfo: twilioNumbers } = useVoices();
  const { time } = usePricing();

  // Check for rerun parameter
  const rerunCampaignId = searchParams.get('rerun');

  // User and files state
  const [userId, setUserId] = useState<string | null>(null);
  const [csvFiles, setCsvFiles] = useState<CSVFile[]>([]);
  const [isLoadingFiles, setIsLoadingFiles] = useState(true);
  const [isLoadingRerun, setIsLoadingRerun] = useState(false);

  // File operations hook
  const { deleteFile, updateColumn, deleteColumn } = useFileOperations(userId);

  // Campaign creation state
  const [currentStep, setCurrentStep] = useState<1 | 2>(1);
  const [campaignName, setCampaignName] = useState('');
  const [selectedFileId, setSelectedFileId] = useState<string>('');
  const [validationError, setValidationError] = useState<string | null>(null);

  // Campaign settings state (Step 2)
  const [botId, setBotId] = useState('');
  const [selectedPhoneNumbers, setSelectedPhoneNumbers] = useState<string[]>([]);
  const [campaignSettings, setCampaignSettings] = useState<CampaignSettings>({
    enableNumberLocking: false
  });

  // Scheduling state
  const [scheduling, setScheduling] = useState<'now' | 'schedule'>('now');
  const [scheduledDateTime, setScheduledDateTime] = useState<string>('');
  const [timezone, setTimezone] = useState<string>(Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC');

  // Helper function to get default scheduled time (current time)
  const getDefaultScheduledTime = () => {
    const now = new Date();
    // Format as YYYY-MM-DDTHH:mm with correct local time
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const day = String(now.getDate()).padStart(2, '0');
    const hours = String(now.getHours()).padStart(2, '0');
    const minutes = String(now.getMinutes()).padStart(2, '0');
    return `${year}-${month}-${day}T${hours}:${minutes}`;
  };

  // Right side - Excel table state
  const [activeFile, setActiveFile] = useState<CSVFile | null>(null);
  const [editingCell, setEditingCell] = useState<EditingCell | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [isLoadingFileData, setIsLoadingFileData] = useState(false);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [isChangingPageSize, setIsChangingPageSize] = useState(false);

  // Resizable partition state
  const [leftPanelWidth, setLeftPanelWidth] = useState(35); // percentage
  const [isResizing, setIsResizing] = useState(false);

  // Fields dialog state
  const [showFieldsDialog, setShowFieldsDialog] = useState(false);

  // Resize handlers
  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    setIsResizing(true);
  }, []);

  const handleMouseMove = useCallback((e: MouseEvent) => {
    if (!isResizing) return;

    const containerWidth = window.innerWidth;
    const newLeftWidth = (e.clientX / containerWidth) * 100;

    // Set minimum widths: 25% for left, 25% for right
    const minLeftWidth = 25;
    const maxLeftWidth = 75;

    const clampedWidth = Math.max(minLeftWidth, Math.min(maxLeftWidth, newLeftWidth));
    setLeftPanelWidth(clampedWidth);
  }, [isResizing]);

  const handleMouseUp = useCallback(() => {
    setIsResizing(false);
  }, []);

  useEffect(() => {
    if (isResizing) {
      document.addEventListener('mousemove', handleMouseMove);
      document.addEventListener('mouseup', handleMouseUp);
      document.body.style.cursor = 'col-resize';
      document.body.style.userSelect = 'none';

      return () => {
        document.removeEventListener('mousemove', handleMouseMove);
        document.removeEventListener('mouseup', handleMouseUp);
        document.body.style.cursor = '';
        document.body.style.userSelect = '';
      };
    }
  }, [isResizing, handleMouseMove, handleMouseUp]);

  // Process Twilio phone numbers
  const flattenedPhoneNumbers = useMemo(() => {
    return (twilioNumbers || []).reduce((acc, account) => {
      return acc.concat(
        (account.phone_numbers || []).map(number => ({
          ...number,
          accountSid: account.account_sid
        }))
      );
    }, [] as (TwilioPhoneNumber & { accountSid: string })[]);
  }, [twilioNumbers]);

  const uniquePhoneNumbers = useMemo(() => {
    return Array.from(
      new Map(flattenedPhoneNumbers.map(item => [item.phone_number, item])).values()
    );
  }, [flattenedPhoneNumbers]);

  // Initialize user and load files
  useEffect(() => {
    const initializeUser = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      setUserId(user?.id || null);

      if (user?.id) {
        try {
          const files = await fetchFilesFromDatabase(user.id);
          setCsvFiles(files);
        } catch (error) {
          console.error('Error fetching files:', error);
          toast({
            title: "Error",
            description: "Failed to load your files",
            variant: "destructive",
          });
        } finally {
          setIsLoadingFiles(false);
        }
      }
    };
    initializeUser();
  }, [toast]);

  // Store rerun campaign data
  const [rerunCampaignData, setRerunCampaignData] = useState<any>(null);

  // Load campaign data when rerun ID is present
  useEffect(() => {
    if (rerunCampaignId && userId && !isLoadingRerun) {
      loadCampaignData(userId);
    }
  }, [rerunCampaignId, userId]);

  // Apply campaign data after files are loaded
  useEffect(() => {
    if (rerunCampaignData && csvFiles.length > 0 && bots.length > 0 && !isLoadingFiles) {
      // console.log('Applying rerun campaign data...');
      applyCampaignData(rerunCampaignData);
    }
  }, [rerunCampaignData, csvFiles.length, bots.length, isLoadingFiles]);

  // Select campaign contacts when file becomes active (for rerun)
  useEffect(() => {
    const rerunId = sessionStorage.getItem('rerun_campaign_id');
    if (rerunId && activeFile && activeFile.data.length > 0) {
      selectCampaignContacts(rerunId);
      // Clear the session storage to avoid re-selecting
      sessionStorage.removeItem('rerun_campaign_id');
    }
  }, [activeFile?.data.length]);

  // Load campaign data from database
  const loadCampaignData = async (currentUserId: string) => {
    if (!rerunCampaignId || isLoadingRerun) return;

    setIsLoadingRerun(true);
    try {
      // Load campaign data
      const { data: campaign, error: campaignError } = await supabase
        .from('call_campaigns')
        .select('*')
        .eq('campaign_id', rerunCampaignId)
        .eq('user_id', currentUserId)
        .single();

      if (campaignError || !campaign) {
        toast({
          title: "Error",
          description: "Campaign not found or access denied",
          variant: "destructive",
        });
        return;
      }

      // Store campaign data for later application
      setRerunCampaignData(campaign);
      // console.log('Campaign data loaded:', campaign);

    } catch (error) {
      console.error('Error loading campaign for rerun:', error);
      toast({
        title: "Error",
        description: "Failed to load campaign data",
        variant: "destructive",
      });
    } finally {
      setIsLoadingRerun(false);
    }
  };

  // Select contacts from original campaign
  const selectCampaignContacts = async (campaignId: string) => {
    if (!activeFile) return;

    try {
      // Load campaign contacts to pre-select them
      const { data: contacts, error: contactsError } = await supabase
        .from('call_campaign_contacts')
        .select('contact_phone, contact_data')
        .eq('campaign_id', campaignId);

      if (!contactsError && contacts && contacts.length > 0) {
        // console.log('Found', contacts.length, 'contacts to pre-select');
        const phoneNumbers = contacts.map(c => c.contact_phone);
        const selectedRowIndices: number[] = [];
        const selectedDbIds: string[] = [];

        activeFile.data.forEach((row: any, index: number) => {
          const rowPhone = row.phone || row["phone number"] || row.phone_number || row.Phone || row["Phone Number"] || row.PHONE;
          if (phoneNumbers.includes(rowPhone)) {
            selectedRowIndices.push(index);
            if (row.dbId) {
              selectedDbIds.push(row.dbId);
            }
          }
        });

        // console.log('Pre-selected', selectedRowIndices.length, 'rows for rerun');

        // Update the active file with selected rows
        const updatedFile = {
          ...activeFile,
          selectedRows: selectedRowIndices,
          selectedRowIds: selectedDbIds
        };

        setActiveFile(updatedFile);
        setCsvFiles(prev => prev.map(f => f.id === activeFile.id ? updatedFile : f));

        toast({
          title: "Contacts Selected",
          description: `Pre-selected ${selectedRowIndices.length} contacts from original campaign.`,
        });
      }
    } catch (error) {
      console.error('Error selecting campaign contacts:', error);
    }
  };

  // Smart function to consolidate retry/rerun prefixes (for rerun action)
  const generateSmartCampaignNameForRerun = (baseName: string): string => {
    // Pattern to match retry/rerun prefixes with optional counts
    const prefixPattern = /^((?:Retry(?:\(\d+\))?:\s*|Rerun(?:\s*\(\d+\))?:\s*)+)(.*)$/i;
    const match = baseName.match(prefixPattern);

    if (!match) {
      // No existing prefixes, add first rerun
      return `Rerun: ${baseName}`;
    }

    const prefixPart = match[1];
    const namePart = match[2];

    // Count occurrences of each type
    let retryCount = 0;
    let rerunCount = 0;

    // Match all retry patterns (including "Retry:", "Retry(n):")
    const retryMatches = prefixPart.match(/Retry(?:\((\d+)\))?:/gi) || [];
    retryMatches.forEach(retryMatch => {
      const countMatch = retryMatch.match(/\((\d+)\)/);
      if (countMatch) {
        retryCount += parseInt(countMatch[1]);
      } else {
        retryCount += 1;
      }
    });

    // Match all rerun patterns (including "Rerun:", "Rerun (n):")
    const rerunMatches = prefixPart.match(/Rerun(?:\s*\((\d+)\))?:/gi) || [];
    rerunMatches.forEach(rerunMatch => {
      const countMatch = rerunMatch.match(/\((\d+)\)/);
      if (countMatch) {
        rerunCount += parseInt(countMatch[1]);
      } else {
        rerunCount += 1;
      }
    });

    // Since we're adding a new rerun, increment rerun count
    rerunCount += 1;

    // Build consolidated prefix
    let newPrefix = '';
    if (retryCount > 0) {
      newPrefix += retryCount > 1 ? `Retry(${retryCount}): ` : 'Retry: ';
    }
    if (rerunCount > 0) {
      newPrefix += rerunCount > 1 ? `Rerun(${rerunCount}): ` : 'Rerun: ';
    }

    return newPrefix + namePart;
  };

  // Apply campaign data to form
  const applyCampaignData = async (campaign: any) => {
    if (!campaign) return;

    try {
      // Use the smart naming function to generate consolidated campaign name
      const newCampaignName = generateSmartCampaignNameForRerun(campaign.campaign_name);
      setCampaignName(newCampaignName);

      // Set bot if it exists
      if (campaign.bot_id && bots.find(b => b.id === campaign.bot_id)) {
        setBotId(campaign.bot_id);
      }

      // Add a small delay to allow state to settle
      await new Promise(resolve => setTimeout(resolve, 100));

      // Set phone numbers
      if (campaign.twilio_phone_number) {
        // console.log('Setting phone numbers from campaign:', campaign.twilio_phone_number);
        // Handle both single number and array of numbers (could be JSON string)
        let phoneNumbers: string[] = [];

        if (typeof campaign.twilio_phone_number === 'string') {
          // Check if it starts with [ or { to determine if it's JSON
          if (campaign.twilio_phone_number.startsWith('[') || campaign.twilio_phone_number.startsWith('{')) {
            try {
              const parsed = JSON.parse(campaign.twilio_phone_number);
              phoneNumbers = Array.isArray(parsed) ? parsed : [parsed];
            } catch {
              // If not valid JSON, treat as single number
              phoneNumbers = [campaign.twilio_phone_number];
            }
          } else {
            // Plain string phone number
            phoneNumbers = [campaign.twilio_phone_number];
          }
        } else if (Array.isArray(campaign.twilio_phone_number)) {
          phoneNumbers = campaign.twilio_phone_number;
        }

        // console.log('Parsed phone numbers:', phoneNumbers);
        setSelectedPhoneNumbers(phoneNumbers);
      }

      // Load campaign settings if available
      if (campaign.field_mappings) {
        // Store field mappings for later use (when FieldsDialog opens)
        sessionStorage.setItem('rerun_field_mappings', JSON.stringify(campaign.field_mappings));
      }

      // If there's a file_id, try to select it
      if (campaign.file_id) {
        const file = csvFiles.find(f => f.id === campaign.file_id);
        // console.log('Looking for file:', campaign.file_id);
        // console.log('Available files:', csvFiles.map(f => ({ id: f.id, name: f.name })));

        if (file) {
          // console.log('Found file for rerun:', file.id, file.name);

          // Simply trigger the file selection which will load the data
          await handleFileSelect(campaign.file_id);

          // Mark that we need to select contacts after file loads
          sessionStorage.setItem('rerun_campaign_id', rerunCampaignId || '');
        } else {
          console.warn('File not found:', campaign.file_id);
          toast({
            title: "Warning",
            description: "Original data file not found. Please select a new file.",
            variant: "destructive",
          });
        }
      }

      toast({
        title: "Campaign Loaded",
        description: `Loaded settings from "${campaign.campaign_name}". Review and modify as needed.`,
      });
    } catch (error) {
      console.error('Error applying campaign data:', error);
      toast({
        title: "Error",
        description: "Failed to apply campaign settings",
        variant: "destructive",
      });
    }
  };

  // Load file data when selected
  const loadFileData = async (fileId: string) => {
    if (!userId) return;

    const file = csvFiles.find(f => f.id === fileId);
    if (!file) return;

    if (file.isDataLoaded) {
      setActiveFile(file);
      return;
    }

    setIsLoadingFileData(true);
    try {
      const { data, totalRows } = await fetchFileData(fileId, userId, 1, file.rowsPerPage);

      const updatedFile = {
        ...file,
        data,
        totalRows,
        currentPage: 1,
        isDataLoaded: true
      };

      setCsvFiles(prev => prev.map(f => f.id === fileId ? updatedFile : f));
      setActiveFile(updatedFile);
    } catch (error) {
      console.error('Error loading file data:', error);
      toast({
        title: "Error",
        description: "Failed to load file data",
        variant: "destructive",
      });
    } finally {
      setIsLoadingFileData(false);
    }
  };

  // Handle file selection
  const handleFileSelect = async (fileId: string) => {
    setSelectedFileId(fileId);
    await loadFileData(fileId);
    setValidationError(null);
  };

  // Step 1 validation
  const validateStep1 = () => {
    setValidationError(null);

    if (!campaignName.trim()) {
      setValidationError("Please enter a campaign name");
      return false;
    }
    if (!selectedFileId) {
      setValidationError("Please select a data file");
      return false;
    }

    const selectedFile = csvFiles.find(f => f.id === selectedFileId);
    if (!selectedFile || !selectedFile.data || selectedFile.data.length === 0) {
      setValidationError("Selected file has no data");
      return false;
    }

    return true;
  };

  // Step 2 validation
  const validateStep2 = () => {
    setValidationError(null);

    if (time <= 0) {
      setValidationError("No credits left. Please top up your account to continue using campaigns.");
      return false;
    }

    if (!botId) {
      setValidationError("Please select a bot");
      return false;
    }

    if (selectedPhoneNumbers.length === 0) {
      setValidationError("Please select at least one Twilio phone number");
      return false;
    }

    // Check if rows are selected
    if (!activeFile?.selectedRows || activeFile.selectedRows.length === 0) {
      setValidationError("Please select at least one row from the data table to create a campaign");
      return false;
    }

    // Calculate credits based on selected rows, not entire file
    const estimatedCallsCount = activeFile.selectedRows.length;
    const averageCallDuration = 120; // 2 minutes average
    const estimatedTotalDuration = estimatedCallsCount * averageCallDuration;

    if (estimatedTotalDuration > time) {
      setValidationError(`Insufficient credits. You need approximately ${Math.ceil(estimatedTotalDuration / 60)} minutes but only have ${Math.floor(time / 60)} minutes remaining.`);
      return false;
    }

    // Validate scheduling if scheduled
    if (scheduling === 'schedule') {
      if (!scheduledDateTime) {
        setValidationError("Please select a date and time for the scheduled campaign");
        return false;
      }

      const scheduledDate = new Date(scheduledDateTime);
      const now = new Date();

      if (scheduledDate <= now) {
        setValidationError("Scheduled time must be in the future");
        return false;
      }
    }

    return true;
  };

  // Navigation handlers
  const handleNext = () => {
    if (currentStep === 1 && validateStep1()) {
      setCurrentStep(2);
      // Set default bot if available
      if (bots.length > 0 && !botId) {
        setBotId(bots[0].id);
      }
    } else if (currentStep === 2 && validateStep2()) {
      setShowFieldsDialog(true);
    }
  };

  const handleBack = () => {
    if (currentStep === 2) {
      setCurrentStep(1);
    }
  };

  const handlePhoneNumberToggle = (phoneNumber: string) => {
    setSelectedPhoneNumbers(prev =>
      prev.includes(phoneNumber)
        ? prev.filter(num => num !== phoneNumber)
        : [...prev, phoneNumber]
    );
    setValidationError(null);
  };

  // Handle final campaign creation
  const handleFieldsMapped = async (mappedFields: Record<string, string>) => {
    if (!activeFile || !userId) return;

    // Check if any rows are selected
    if (!activeFile.selectedRows || activeFile.selectedRows.length === 0) {
      toast({
        title: "Error",
        description: "Please select at least one row from the data table to create a campaign",
        variant: "destructive",
      });
      return;
    }

    setShowFieldsDialog(false);

    try {
      const selectedBot = bots.find(bot => bot.id === botId);
      if (!selectedBot) throw new Error('Selected bot not found');

      // Use only the selected rows from the Excel table
      const selectedRowsData = activeFile.selectedRows.map(rowIndex => activeFile.data[rowIndex]);

      const selectedContacts = selectedRowsData.map(row => ({
        ...row,
        phone: row["phone"] || row["phone number"] || row["phone_number"] || row["Phone"] || row["Phone Number"] || row["PHONE"] || row["PHONE NUMBER"],
        name: row["name"] || row["contact_name"] || row["customer_name"] || row["Name"] || row["Contact Name"] || row["CUSTOMER NAME"] || row["NAME"] || row["First Name"] || row["Last Name"]
      }));

      const systemPrompt = selectedBot.system_prompt || 'You are a helpful AI assistant making calls.';
      const voiceSettings = {
        voice: selectedBot.voice || "d17917ec-fd98-4c50-8c83-052c575cbf3e",
        temperature: selectedBot.temperature || 0.6
      };

      toast({
        title: "Creating Campaign",
        description: "Setting up bulk call campaign...",
      });

      // Prepare scheduling object if campaign is scheduled
      const schedulingData = scheduling === 'schedule' ? {
        scheduled_start_time: getUtcIsoStringFromLocalInput(
          scheduledDateTime.split('T')[0],  // date part
          scheduledDateTime.split('T')[1],  // time part
          timezone
        ),
        timezone: timezone,
        is_recurring: false,
        recurring_type: "none" as const,
        recurring_interval: 1,
        auto_start: true
      } : undefined;

      const result = await createBulkCallCampaign(
        campaignName.trim(),
        selectedContacts,
        botId,
        selectedBot.name,
        selectedPhoneNumbers,
        systemPrompt,
        voiceSettings,
        mappedFields,
        userId,
        `Campaign created from ${activeFile.name}`,
        schedulingData,
        campaignSettings
      );

      if (result.status === 'success') {
        toast({
          title: "Campaign Started",
          description: result.message,
        });

        // Redirect to bulk call history with the campaign details
        window.location.href = `/dashboard/bulk-call-history?campaignId=${result.campaign_id}&tab=details`;
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
  };

  // Excel table handlers - Full functionality
  const handleCellEdit = (rowIndex: number | null, header: string, value: string) => {
    setEditingCell({ rowIndex, header, value });
  };

  const handleCellSave = async () => {
    if (!editingCell || !activeFile || !userId) return;

    try {
      if (editingCell.rowIndex === null) {
        // Header edit
        await updateColumn(activeFile.id, editingCell.header, editingCell.value);
        setCsvFiles(prev => prev.map(file => {
          if (file.id !== activeFile.id) return file;

          const newHeaders = [...file.headers];
          const index = newHeaders.indexOf(editingCell.header);
          if (index !== -1) {
            newHeaders[index] = editingCell.value;
            const newData = file.data.map(row => {
              const newRow = { ...row };
              newRow[editingCell.value] = newRow[editingCell.header];
              delete newRow[editingCell.header];
              return newRow;
            });

            return { ...file, headers: newHeaders, data: newData };
          }
          return file;
        }));

        if (activeFile.id === activeFile.id) {
          setActiveFile(prev => {
            if (!prev) return null;
            const newHeaders = [...prev.headers];
            const index = newHeaders.indexOf(editingCell.header);
            if (index !== -1) {
              newHeaders[index] = editingCell.value;
              const newData = prev.data.map(row => {
                const newRow = { ...row };
                newRow[editingCell.value] = newRow[editingCell.header];
                delete newRow[editingCell.header];
                return newRow;
              });

              return { ...prev, headers: newHeaders, data: newData };
            }
            return prev;
          });
        }
      } else {
        // Cell edit
        const row = activeFile.data[editingCell.rowIndex];
        const dbId = row.dbId;

        if (!dbId) {
          console.warn('Row ID not found, attempting to create new row in database');
          const newRowData = {
            ...row,
            [editingCell.header]: editingCell.value
          };
          delete newRowData.dbId;

          const { data: rowData, error: insertError } = await supabase
            .from('file_rows')
            .insert([{
              file_id: activeFile.id,
              row_data: newRowData
            }])
            .select()
            .single();

          if (insertError) throw insertError;

          setCsvFiles(prev => prev.map(file => {
            if (file.id !== activeFile.id) return file;
            const newData = [...file.data];
            newData[editingCell.rowIndex!] = {
              ...newRowData,
              dbId: rowData.id
            };
            return { ...file, data: newData };
          }));

          if (activeFile.id === activeFile.id) {
            setActiveFile(prev => {
              if (!prev) return null;
              const newData = [...prev.data];
              newData[editingCell.rowIndex!] = {
                ...newRowData,
                dbId: rowData.id
              };
              return { ...prev, data: newData };
            });
          }

          toast({
            title: "Success",
            description: "Cell updated successfully",
          });

          setEditingCell(null);
          return;
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
          if (file.id !== activeFile.id) return file;
          const newData = [...file.data];
          newData[editingCell.rowIndex!] = {
            ...newRowData,
            dbId
          };
          return { ...file, data: newData };
        }));

        if (activeFile.id === activeFile.id) {
          setActiveFile(prev => {
            if (!prev) return null;
            const newData = [...prev.data];
            newData[editingCell.rowIndex!] = {
              ...newRowData,
              dbId
            };
            return { ...prev, data: newData };
          });
        }

        toast({
          title: "Success",
          description: "Cell updated successfully",
        });
      }
    } catch (error) {
      console.error('Error updating cell:', error);
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : 'Failed to update cell',
        variant: "destructive",
      });
    }

    setEditingCell(null);
  };

  const handleRowSelect = (rowIndex: number) => {
    if (!activeFile) return;

    setCsvFiles(prev => prev.map(file => {
      if (file.id !== activeFile.id) return file;

      let selectedRows: number[] = [];
      let selectedRowIds: string[] = [...(file.selectedRowIds || [])];

      if (rowIndex === -1) {
        // Clear all selections
        selectedRows = [];
        selectedRowIds = [];
      } else if (rowIndex === -2) {
        // Select all visible rows (current page or loaded data)
        const pageIndices = file.data.map((_, index) => index);
        const pageRowIds = file.data
          .filter(row => row.dbId)
          .map(row => row.dbId as string);

        selectedRows = [...Array.from(new Set([...file.selectedRows, ...pageIndices]))];
        selectedRowIds = [...Array.from(new Set([...selectedRowIds, ...pageRowIds]))];
      } else if (rowIndex === -3) {
        // Select all rows up to rowsPerPage limit (for 10000 rows mode)
        const maxRows = Math.min(file.rowsPerPage, file.totalRows || file.rowsPerPage);
        selectedRows = Array.from({ length: maxRows }, (_, i) => i);
        selectedRowIds = [`__SELECT_FIRST_${maxRows}__`];
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

    if (activeFile.id === activeFile.id) {
      setActiveFile(prev => {
        if (!prev) return null;

        let selectedRows: number[] = [];
        let selectedRowIds: string[] = [...(prev.selectedRowIds || [])];

        if (rowIndex === -1) {
          selectedRows = [];
          selectedRowIds = [];
        } else if (rowIndex === -2) {
          const pageIndices = prev.data.map((_, index) => index);
          const pageRowIds = prev.data
            .filter(row => row.dbId)
            .map(row => row.dbId as string);

          selectedRows = [...Array.from(new Set([...prev.selectedRows, ...pageIndices]))];
          selectedRowIds = [...Array.from(new Set([...selectedRowIds, ...pageRowIds]))];
        } else if (rowIndex === -3) {
          const maxRows = Math.min(prev.rowsPerPage, prev.totalRows || prev.rowsPerPage);
          selectedRows = Array.from({ length: maxRows }, (_, i) => i);
          selectedRowIds = [`__SELECT_FIRST_${maxRows}__`];
        } else {
          const rowData = prev.data[rowIndex];
          const rowDbId = rowData?.dbId;

          if (prev.selectedRows.includes(rowIndex)) {
            selectedRows = prev.selectedRows.filter(i => i !== rowIndex);
            if (rowDbId) {
              selectedRowIds = selectedRowIds.filter(id => id !== rowDbId);
            }
          } else {
            selectedRows = [...prev.selectedRows, rowIndex];
            if (rowDbId) {
              selectedRowIds = [...selectedRowIds, rowDbId];
            }
          }
        }

        return { ...prev, selectedRows, selectedRowIds };
      });
    }
  };

  const handlePageChange = async (fileId: string, newPage: number) => {
    if (!userId) return;
    try {
      const { data, totalRows } = await fetchFileData(fileId, userId, newPage, activeFile?.rowsPerPage || 10);

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
          currentPage: newPage,
          selectedRows: selectedRowsOnPage
        };
      }));

      if (activeFile?.id === fileId) {
        setActiveFile(prev => {
          if (!prev) return null;

          const selectedRowsOnPage: number[] = [];
          data.forEach((row, index) => {
            if (prev.selectedRowIds && prev.selectedRowIds.includes(row.dbId)) {
              selectedRowsOnPage.push(index);
            }
          });

          return {
            ...prev,
            data,
            totalRows,
            currentPage: newPage,
            selectedRows: selectedRowsOnPage
          };
        });
      }
    } catch (error) {
      console.error('Error changing page:', error);
      toast({
        title: "Error",
        description: "Failed to load page data",
        variant: "destructive",
      });
    }
  };

  const handleRowsPerPageChange = async (fileId: string, newRowsPerPage: number) => {
    try {
      setIsChangingPageSize(true);

      toast({
        title: "Loading",
        description: `Loading ${newRowsPerPage} rows...`,
      });

      setCsvFiles(prev => prev.map(file => {
        if (file.id !== fileId) return file;
        return { ...file, rowsPerPage: newRowsPerPage, currentPage: 1 };
      }));

      const { data, totalRows } = await fetchFileData(fileId, userId || '', 1, newRowsPerPage);

      setCsvFiles(prev => prev.map(f => {
        if (f.id !== fileId) return f;
        return { ...f, data, totalRows, currentPage: 1 };
      }));

      if (activeFile?.id === fileId) {
        setActiveFile(prev => prev ? { ...prev, data, totalRows, currentPage: 1, rowsPerPage: newRowsPerPage } : null);
      }

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

  const handleLoadMoreRows = async (fileId: string, offset: number) => {
    if (!userId || isLoadingMore) return;

    try {
      setIsLoadingMore(true);
      const additionalRows = await fetchAdditionalRows(fileId, userId, offset, 1000);

      setCsvFiles(prev => prev.map(file => {
        if (file.id !== fileId) return file;
        return {
          ...file,
          data: [...file.data, ...additionalRows]
        };
      }));

      if (activeFile?.id === fileId) {
        setActiveFile(prev => prev ? {
          ...prev,
          data: [...prev.data, ...additionalRows]
        } : null);
      }
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
      const { data: rowData, error: rowError } = await supabase
        .from('file_rows')
        .insert([{
          file_id: activeFile.id,
          row_data: newRow
        }])
        .select()
        .single();

      if (rowError) throw rowError;

      const newRowWithId = {
        ...newRow,
        dbId: rowData.id
      };

      setCsvFiles(prev => prev.map(file => {
        if (file.id !== activeFile.id) return file;
        return {
          ...file,
          data: [newRowWithId, ...file.data],
          currentPage: 1
        };
      }));

      if (activeFile.id === activeFile.id) {
        setActiveFile(prev => prev ? {
          ...prev,
          data: [newRowWithId, ...prev.data],
          currentPage: 1
        } : null);
      }

      toast({
        title: "Success",
        description: "New row added successfully",
      });
    } catch (error) {
      console.error('Error adding new row:', error);
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
      const newHeaders = [...activeFile.headers, columnName];

      const { error: fileError } = await supabase
        .from('files')
        .update({ headers: newHeaders })
        .eq('id', activeFile.id)
        .eq('user_id', userId);

      if (fileError) throw fileError;

      const updatedRows = activeFile.data.map(row => ({
        ...row,
        [columnName]: ''
      }));

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
        if (file.id !== activeFile.id) return file;
        return {
          ...file,
          headers: newHeaders,
          data: updatedRows
        };
      }));

      if (activeFile.id === activeFile.id) {
        setActiveFile(prev => prev ? {
          ...prev,
          headers: newHeaders,
          data: updatedRows
        } : null);
      }

      toast({
        title: "Success",
        description: `Added column "${columnName}"`,
      });
    } catch (error) {
      console.error('Error adding column:', error);
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : 'Failed to add column',
        variant: "destructive",
      });
    }
  };

  const handleDeleteColumn = async (header: string) => {
    if (!activeFile || !userId) return;

    try {
      await deleteColumn(activeFile.id, header);

      setCsvFiles(prev => prev.map(file => {
        if (file.id !== activeFile.id) return file;

        const newHeaders = file.headers.filter(h => h !== header);
        const newData = file.data.map(row => {
          const newRow = { ...row };
          delete newRow[header];
          return newRow;
        });

        return { ...file, headers: newHeaders, data: newData };
      }));

      if (activeFile.id === activeFile.id) {
        setActiveFile(prev => {
          if (!prev) return null;
          const newHeaders = prev.headers.filter(h => h !== header);
          const newData = prev.data.map(row => {
            const newRow = { ...row };
            delete newRow[header];
            return newRow;
          });
          return { ...prev, headers: newHeaders, data: newData };
        });
      }

      toast({
        title: "Success",
        description: `Column "${header}" deleted successfully`,
      });
    } catch (error) {
      console.error('Error deleting column:', error);
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : 'Failed to delete column',
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

      setCsvFiles(prev => prev.map(file => {
        if (file.id !== activeFile.id) return file;
        return {
          ...file,
          totalRows: (file.totalRows || 0) - (activeFile.selectedRowIds || []).length,
          selectedRows: [],
          selectedRowIds: []
        };
      }));

      if (activeFile.id === activeFile.id) {
        setActiveFile(prev => prev ? {
          ...prev,
          totalRows: (prev.totalRows || 0) - (activeFile.selectedRowIds || []).length,
          selectedRows: [],
          selectedRowIds: []
        } : null);
      }

      // Reload current page to reflect deletions
      await handlePageChange(activeFile.id, activeFile.currentPage);

      toast({
        title: "Success",
        description: `Successfully deleted ${(activeFile.selectedRowIds || []).length} rows`,
      });
    } catch (error) {
      console.error('Error deleting rows:', error);
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : 'Failed to delete rows',
        variant: "destructive",
      });
    }
  };

  if (isLoadingFiles || isLoadingRerun) {
    return <StartPageSkeleton />;
  }

  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <div className="flex-shrink-0 px-4 py-2 border-b bg-background">
        <div className="flex items-center gap-3">
          <Button
            variant="outline"
            size="sm"
            onClick={() => router.push('/dashboard/group-call')}
            className="flex items-center gap-2"
          >
            <Icon name="chevronLeft" className="h-4 w-4" />
            Back to Group Call
          </Button>
          <div className="flex-1">
            <h1 className="text-xl font-bold">Start New Campaign</h1>
            <p className="text-xs text-muted-foreground">
              Step {currentStep} of 2: {currentStep === 1 ? 'Campaign Details' : 'Campaign Settings'}
            </p>
          </div>
        </div>
      </div>

      {/* Main Content - Split Layout */}
      <div className="flex-1 flex overflow-hidden relative">
        {/* Left Side - Campaign Form */}
        <div
          className="border-r overflow-y-auto"
          style={{ width: `${leftPanelWidth}%` }}
        >
          <div className="p-6">
            {currentStep === 1 && (
              <Card>
                <CardHeader>
                  <CardTitle>Campaign Details</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="campaign-name">Campaign Name</Label>
                    <Input
                      id="campaign-name"
                      placeholder="Enter campaign name..."
                      value={campaignName}
                      onChange={(e) => {
                        setCampaignName(e.target.value);
                        setValidationError(null);
                      }}
                    />
                  </div>

                  <div className="space-y-2">
                    <Label>Select Data File</Label>
                    {csvFiles.length === 0 ? (
                      <div className="border-2 border-dashed border-blue-300 rounded-lg p-8 text-center bg-gradient-to-b from-blue-50 to-white">
                        <div className="bg-blue-100 dark:bg-blue-900/20 h-16 w-16 rounded-full flex items-center justify-center mx-auto mb-4">
                          <Icon name="fileSpreadsheet" className="h-8 w-8 text-blue-600 dark:text-blue-400" />
                        </div>
                        <h3 className="text-base font-semibold text-foreground mb-2">No CSV files available</h3>
                        <p className="text-sm text-muted-foreground mb-6 max-w-sm mx-auto">
                          Import your contact lists to get started with bulk calling campaigns
                        </p>
                        <div className="space-y-3">
                          <Button
                            onClick={() => router.push('/dashboard/group-call/data-import')}
                            size="default"
                            className="w-full sm:w-auto"
                          >
                            <Icon name="upload" className="h-4 w-4 mr-2" />
                            Import CSV Files
                          </Button>
                          <p className="text-xs text-muted-foreground">
                            Upload CSV files containing your contact information
                          </p>
                        </div>
                      </div>
                    ) : (
                      <Select value={selectedFileId} onValueChange={handleFileSelect}>
                        <SelectTrigger>
                          <SelectValue placeholder="Choose a CSV file..." />
                        </SelectTrigger>
                        <SelectContent>
                          {csvFiles.map((file) => (
                            <SelectItem key={file.id} value={file.id}>
                              {file.name} ({file.totalRows || file.data.length} rows)
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    )}
                  </div>

                  {selectedFileId && (
                    <div className="bg-muted p-3 rounded-lg">
                      <div className="text-sm">
                        <div className="font-medium">Selected File:</div>
                        <div className="text-muted-foreground">
                          {csvFiles.find(f => f.id === selectedFileId)?.name}
                        </div>
                        <div className="text-muted-foreground">
                          {csvFiles.find(f => f.id === selectedFileId)?.totalRows || csvFiles.find(f => f.id === selectedFileId)?.data.length || 0} contacts
                        </div>
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>
            )}

            {currentStep === 2 && (
              <div className="space-y-6">
                {/* Credits Display */}
                <Card>
                  <CardContent className="pt-6">
                    <div className="bg-muted p-3 rounded-lg">
                      <div className="flex justify-between items-center text-sm">
                        <span>Available Credits:</span>
                        <span className={`font-medium ${time <= 0 ? 'text-red-600' : time < 300 ? 'text-yellow-600' : 'text-green-600'}`}>
                          {Math.floor(time / 60)} minutes ({time} seconds)
                        </span>
                      </div>
                      {activeFile && (
                        <div className="text-xs text-muted-foreground mt-1">
                          Estimated usage: ~{Math.ceil((activeFile.selectedRows?.length || 0) * 2)} minutes for {activeFile.selectedRows?.length || 0} selected contacts
                          {(!activeFile.selectedRows || activeFile.selectedRows.length === 0) && (
                            <span className="text-red-600 block">⚠️ No rows selected - please select rows from the data table</span>
                          )}
                        </div>
                      )}
                    </div>
                  </CardContent>
                </Card>

                {/* Bot Selection */}
                <Card>
                  <CardHeader>
                    <CardTitle>Select Bot</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <Select
                      value={botId}
                      onValueChange={(value) => {
                        setBotId(value);
                        setValidationError(null);
                      }}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select Bot" />
                      </SelectTrigger>
                      <SelectContent>
                        {bots.map((bot) => (
                          <SelectItem key={bot.id} value={bot.id}>{bot.name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </CardContent>
                </Card>

                {/* Phone Numbers */}
                <Card>
                  <CardHeader>
                    <CardTitle>Select Twilio Numbers</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <p className="text-sm text-muted-foreground mb-3">Choose one or more phone numbers for this campaign</p>
                    <div className="max-h-48 overflow-y-auto space-y-2 border rounded-md p-3">
                      {uniquePhoneNumbers.map((number) => (
                        <div key={number.phone_number} className="flex items-center space-x-2">
                          <Checkbox
                            id={number.phone_number}
                            checked={selectedPhoneNumbers.includes(number.phone_number)}
                            onCheckedChange={() => handlePhoneNumberToggle(number.phone_number)}
                          />
                          <Label htmlFor={number.phone_number} className="flex-1 cursor-pointer">
                            {number.friendly_name} ({number.phone_number})
                          </Label>
                        </div>
                      ))}
                    </div>
                    {selectedPhoneNumbers.length > 0 && (
                      <p className="text-sm text-green-600 mt-2">
                        {selectedPhoneNumbers.length} number(s) selected
                      </p>
                    )}
                  </CardContent>
                </Card>

                {/* Campaign Settings */}
                <Card>
                  <CardHeader>
                    <CardTitle>Campaign Settings</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="flex items-center justify-between">
                      <div className="space-y-1">
                        <Label htmlFor="number-locking">Enable Number Locking</Label>
                        <p className="text-xs text-muted-foreground">
                          Prevent simultaneous calls to the same number during the campaign
                        </p>
                      </div>
                      <Switch
                        id="number-locking"
                        checked={campaignSettings.enableNumberLocking}
                        onCheckedChange={(checked) =>
                          setCampaignSettings(prev => ({ ...prev, enableNumberLocking: checked }))
                        }
                      />
                    </div>

                    {campaignSettings.enableNumberLocking && (
                      <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-md p-3 mt-3">
                        <p className="text-xs text-blue-800 dark:text-blue-200">
                          When enabled, each phone number will be locked during a call to prevent
                          multiple simultaneous calls to the same contact. Numbers will be unlocked
                          automatically when calls end.
                        </p>
                        {selectedPhoneNumbers.length > 1 && (
                          <p className="text-xs text-blue-800 dark:text-blue-200 mt-2">
                            <strong>Smart Number Selection:</strong> The system will automatically choose
                            the nearest phone number based on each customer's timezone for optimal call timing.
                          </p>
                        )}
                      </div>
                    )}
                  </CardContent>
                </Card>

                {/* Scheduling Options */}
                <Card>
                  <CardHeader>
                    <CardTitle>Campaign Execution</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <RadioGroup
                      value={scheduling}
                      onValueChange={(value: 'now' | 'schedule') => {
                        setScheduling(value);
                        // Set default time when switching to schedule mode
                        if (value === 'schedule' && !scheduledDateTime) {
                          setScheduledDateTime(getDefaultScheduledTime());
                        }
                      }}
                    >
                      <div className="flex items-center space-x-2">
                        <RadioGroupItem value="now" id="now" />
                        <Label htmlFor="now">Start immediately</Label>
                      </div>
                      <div className="flex items-center space-x-2">
                        <RadioGroupItem value="schedule" id="schedule" />
                        <Label htmlFor="schedule">Schedule for later</Label>
                      </div>
                    </RadioGroup>

                    {scheduling === 'schedule' && (
                      <div className="mt-4 space-y-4">
                        <div className="space-y-2">
                          <Label htmlFor="datetime" className="text-sm">Schedule Date & Time:</Label>
                          <div className="flex gap-2">
                            <Input
                              id="date"
                              type="date"
                              value={scheduledDateTime ? scheduledDateTime.split('T')[0] : ''}
                              onChange={(e) => {
                                const currentTime = scheduledDateTime ? scheduledDateTime.split('T')[1] : getDefaultScheduledTime().split('T')[1];
                                setScheduledDateTime(e.target.value ? `${e.target.value}T${currentTime}` : '');
                                setValidationError(null);
                              }}
                              min={new Date().toISOString().split('T')[0]}
                              className="flex-1"
                            />
                            <div className="flex items-center gap-1">
                              {/* Hour Selector */}
                              <Select
                                value={(() => {
                                  if (!scheduledDateTime) return '12';
                                  const time = scheduledDateTime.split('T')[1];
                                  if (!time) return '12';
                                  const [hours] = time.split(':');
                                  const hour = parseInt(hours);
                                  const displayHour = hour === 0 ? 12 : hour > 12 ? hour - 12 : hour;
                                  return displayHour.toString();
                                })()}
                                onValueChange={(value) => {
                                  const currentDate = scheduledDateTime ? scheduledDateTime.split('T')[0] : new Date().toISOString().split('T')[0];
                                  const currentTime = scheduledDateTime ? scheduledDateTime.split('T')[1] : getDefaultScheduledTime().split('T')[1];
                                  const [, minutes] = currentTime.split(':');
                                  const hour = parseInt(value);
                                  const hourNum = parseInt(currentTime.split(':')[0]);
                                  const isCurrentlyPM = hourNum >= 12;

                                  let hour24 = hour;
                                  if (isCurrentlyPM && hour !== 12) hour24 += 12;
                                  if (!isCurrentlyPM && hour === 12) hour24 = 0;

                                  setScheduledDateTime(`${currentDate}T${hour24.toString().padStart(2, '0')}:${minutes}`);
                                  setValidationError(null);
                                }}
                              >
                                <SelectTrigger className="w-[65px]">
                                  <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                  {[12, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11].map(hour => (
                                    <SelectItem key={hour} value={hour.toString()}>
                                      {hour.toString().padStart(2, '0')}
                                    </SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>

                              <span className="text-sm font-medium">:</span>

                              {/* Minute Selector */}
                              <Select
                                value={(() => {
                                  if (!scheduledDateTime) return '00';
                                  const time = scheduledDateTime.split('T')[1];
                                  if (!time) return '00';
                                  const [, minutes] = time.split(':');
                                  return minutes;
                                })()}
                                onValueChange={(value) => {
                                  const currentDate = scheduledDateTime ? scheduledDateTime.split('T')[0] : new Date().toISOString().split('T')[0];
                                  const currentTime = scheduledDateTime ? scheduledDateTime.split('T')[1] : getDefaultScheduledTime().split('T')[1];
                                  const [hours] = currentTime.split(':');
                                  setScheduledDateTime(`${currentDate}T${hours}:${value}`);
                                  setValidationError(null);
                                }}
                              >
                                <SelectTrigger className="w-[65px]">
                                  <SelectValue />
                                </SelectTrigger>
                                <SelectContent className="max-h-[200px]">
                                  {Array.from({ length: 60 }, (_, i) => {
                                    const minute = i.toString().padStart(2, '0');
                                    return (
                                      <SelectItem key={minute} value={minute}>
                                        {minute}
                                      </SelectItem>
                                    );
                                  })}
                                </SelectContent>
                              </Select>

                              {/* AM/PM Selector */}
                              <Select
                                value={(() => {
                                  if (!scheduledDateTime) return 'AM';
                                  const time = scheduledDateTime.split('T')[1];
                                  if (!time) return 'AM';
                                  const [hours] = time.split(':');
                                  const hour = parseInt(hours);
                                  return hour >= 12 ? 'PM' : 'AM';
                                })()}
                                onValueChange={(value) => {
                                  const currentDate = scheduledDateTime ? scheduledDateTime.split('T')[0] : new Date().toISOString().split('T')[0];
                                  const currentTime = scheduledDateTime ? scheduledDateTime.split('T')[1] : getDefaultScheduledTime().split('T')[1];
                                  const [hours, minutes] = currentTime.split(':');
                                  let hour = parseInt(hours);

                                  // Convert current hour to 12-hour format
                                  const currentHour12 = hour === 0 ? 12 : hour > 12 ? hour - 12 : hour;

                                  // Convert back to 24-hour based on new AM/PM
                                  let hour24 = currentHour12;
                                  if (value === 'PM' && currentHour12 !== 12) hour24 = currentHour12 + 12;
                                  if (value === 'AM' && currentHour12 === 12) hour24 = 0;

                                  setScheduledDateTime(`${currentDate}T${hour24.toString().padStart(2, '0')}:${minutes}`);
                                  setValidationError(null);
                                }}
                              >
                                <SelectTrigger className="w-[65px]">
                                  <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="AM">AM</SelectItem>
                                  <SelectItem value="PM">PM</SelectItem>
                                </SelectContent>
                              </Select>
                            </div>
                          </div>
                        </div>

                        <div className="space-y-2">
                          <Label htmlFor="timezone" className="text-sm">Timezone:</Label>
                          <Select
                            value={timezone}
                            onValueChange={(value) => setTimezone(value)}
                          >
                            <SelectTrigger>
                              <SelectValue placeholder="Select timezone" />
                            </SelectTrigger>
                            <SelectContent className="max-h-[200px]">
                              {timezones.map((tz) => (
                                <SelectItem key={tz.value} value={tz.value}>
                                  {tz.label}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>

                        {scheduledDateTime && (
                          <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-md p-3">
                            <p className="text-xs text-blue-800 dark:text-blue-200">
                              <strong>Scheduled Time Preview:</strong><br />
                              {(() => {
                                if (scheduledDateTime) {
                                  const [datePart, timePart] = scheduledDateTime.split('T');
                                  const [year, month, day] = datePart.split('-');
                                  const [hour24, minute] = timePart.split(':');
                                  const hourNum = parseInt(hour24);
                                  const ampm = hourNum >= 12 ? 'PM' : 'AM';
                                  const displayHour = hourNum === 0 ? 12 : hourNum > 12 ? hourNum - 12 : hourNum;
                                  return `${month}/${day}/${year}, ${displayHour}:${minute} ${ampm}`;
                                }
                                return '';
                              })()} ({timezone})
                            </p>
                          </div>
                        )}
                      </div>
                    )}

                    <p className="text-sm text-muted-foreground mt-4">
                      {scheduling === 'now'
                        ? 'This will create a new campaign and start calling the selected contacts immediately.'
                        : 'This will create a scheduled campaign that will start at the specified time.'}
                    </p>
                  </CardContent>
                </Card>
              </div>
            )}

            {/* Validation Error */}
            {validationError && (
              <div className="text-red-500 text-sm mt-4 p-3 bg-red-50 rounded-lg">
                {validationError}
              </div>
            )}

            {/* Navigation Buttons */}
            <div className="flex justify-between mt-6">
              <div>
                {currentStep === 2 && (
                  <Button variant="outline" onClick={handleBack}>
                    <Icon name="chevronLeft" className="h-4 w-4 mr-2" />
                    Back
                  </Button>
                )}
              </div>
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <span>
                      <Button
                        onClick={handleNext}
                        disabled={currentStep === 1 && csvFiles.length === 0}
                      >
                        {currentStep === 1 ? 'Next' : 'Configure Fields'}
                        <Icon name="chevronRight" className="h-4 w-4 ml-2" />
                      </Button>
                    </span>
                  </TooltipTrigger>
                  {currentStep === 1 && csvFiles.length === 0 && (
                    <TooltipContent>
                      <p>Import CSV files first to continue</p>
                    </TooltipContent>
                  )}
                </Tooltip>
              </TooltipProvider>
            </div>
          </div>
        </div>

        {/* Resize Handle */}
        <div
          className={`w-1 bg-border hover:bg-blue-400 dark:hover:bg-blue-600 cursor-col-resize transition-colors relative group ${
            isResizing ? 'bg-blue-500' : ''
          }`}
          onMouseDown={handleMouseDown}
          title="Drag to resize panels"
        >
          <div className="absolute inset-y-0 left-1/2 transform -translate-x-1/2 w-3 flex items-center justify-center">
            <div className={`w-0.5 h-8 rounded-full transition-colors ${
              isResizing ? 'bg-white' : 'bg-muted-foreground group-hover:bg-white'
            }`}></div>
          </div>
          {/* Resize indicator */}
          {isResizing && (
            <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 bg-blue-600 dark:bg-blue-500 text-white text-xs px-2 py-1 rounded whitespace-nowrap pointer-events-none">
              {Math.round(leftPanelWidth)}% | {Math.round(100 - leftPanelWidth)}%
            </div>
          )}
        </div>

        {/* Right Side - Excel Table Preview */}
        <div
          className="flex flex-col overflow-hidden"
          style={{ width: `${100 - leftPanelWidth}%` }}
        >
          <div className="flex-shrink-0 px-3 py-2 border-b bg-background border-border">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <h3 className="text-sm font-semibold text-foreground">Data Preview</h3>
                {activeFile && (
                  <span className="text-xs text-muted-foreground bg-muted px-2 py-0.5 rounded">
                    {activeFile.name} • {activeFile.data.length} rows
                  </span>
                )}
              </div>

              {activeFile && (
                <div className="flex items-center gap-2">
                  <div className="relative">
                    <Icon name="search" className="absolute left-2 top-1/2 transform -translate-y-1/2 h-3 w-3 text-muted-foreground" />
                    <Input
                      placeholder="Search in data..."
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                      className="pl-7 h-7 w-48 text-xs bg-background border-border"
                    />
                    {searchTerm && (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setSearchTerm('')}
                        className="absolute right-0.5 top-1/2 transform -translate-y-1/2 h-5 w-5 p-0"
                      >
                        <Icon name="x" className="h-3 w-3" />
                      </Button>
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>

          <div className="flex-1 overflow-hidden">
            {isLoadingFileData ? (
              <div className="flex items-center justify-center h-full">
                <div className="text-center">
                  <Icon name="spinner" className="h-8 w-8 animate-spin text-blue-600 dark:text-blue-400 mx-auto mb-4" />
                  <p className="text-lg font-medium text-foreground">Loading file data...</p>
                </div>
              </div>
            ) : activeFile ? (
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
                onStartCalls={() => {}}
                onDeleteSelected={handleDeleteSelected}
                onAddColumn={handleAddColumn}
                onLoadMoreRows={handleLoadMoreRows}
                isLoadingMore={isLoadingMore}
                isChangingPageSize={isChangingPageSize}
              />
            ) : (
              <div className="flex items-center justify-center h-full">
                <div className="text-center">
                  <Icon name="fileSpreadsheet" className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                  <p className="text-lg text-foreground mb-2">No file selected</p>
                  <p className="text-muted-foreground">Choose a CSV file from the left to preview your data</p>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Fields Dialog */}
      <FieldsDialog
        showDialog={showFieldsDialog}
        setShowDialog={setShowFieldsDialog}
        activeFile={activeFile || undefined}
        botId={botId}
        onBack={() => setShowFieldsDialog(false)}
        onStartCalls={handleFieldsMapped}
      />
    </div>
  );
}