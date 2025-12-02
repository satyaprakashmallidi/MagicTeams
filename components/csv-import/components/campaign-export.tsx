'use client';

import { Button } from '@/components/ui/button';
import { Icon } from '@/components/ui/icons';
import { CampaignContact } from '../services/campaigns-service';

interface CampaignExportProps {
  campaignName: string;
  contacts: CampaignContact[];
}

export function CampaignExport({ campaignName, contacts }: CampaignExportProps) {
  const exportToCSV = () => {
    if (contacts.length === 0) return;

    // Define CSV headers
    const headers = [
      'Contact Name',
      'Phone Number',
      'Email',
      'Call Status',
      'Duration (seconds)',
      'Interest Level',
      'Call Summary',
      'Call Notes',
      'Queued At',
      'Started At',
      'Completed At',
      'Error Message',
      'Retry Count'
    ];

    // Convert contacts to CSV rows
    const csvRows = [
      headers.join(','),
      ...contacts.map(contact => [
        `"${contact.contact_name || ''}"`,
        `"${contact.contact_phone}"`,
        `"${contact.contact_email || ''}"`,
        `"${contact.call_status}"`,
        contact.call_duration || 0,
        `"${contact.interest_level || 'not_specified'}"`,
        `"${(contact.call_summary || '').replace(/"/g, '""')}"`,
        `"${(contact.call_notes || '').replace(/"/g, '""')}"`,
        `"${contact.queued_at || ''}"`,
        `"${contact.started_at || ''}"`,
        `"${contact.completed_at || ''}"`,
        `"${(contact.error_message || '').replace(/"/g, '""')}"`,
        contact.retry_count || 0
      ].join(','))
    ];

    // Create and download CSV
    const csvContent = csvRows.join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    
    if (link.download !== undefined) {
      const url = URL.createObjectURL(blob);
      link.setAttribute('href', url);
      link.setAttribute('download', `${campaignName.replace(/[^a-z0-9]/gi, '_').toLowerCase()}_call_results.csv`);
      link.style.visibility = 'hidden';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    }
  };


  return (
    <div className="flex gap-2">
      <Button
        onClick={exportToCSV}
        variant="outline"
        size="sm"
        disabled={contacts.length === 0}
      >
        <Icon name="download" className="h-4 w-4 mr-2" />
        Export Details
      </Button>
    </div>
  );
}