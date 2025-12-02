'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Icon } from '@/components/ui/icons';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { ScrollArea } from '@/components/ui/scroll-area';

interface HelpSystemProps {
  currentStep: 'file-selection' | 'data-view';
  className?: string;
}

export function HelpSystem({ currentStep, className = '' }: HelpSystemProps) {
  const [isExpanded, setIsExpanded] = useState(false);

  const stepGuides = {
    'file-selection': {
      title: 'File Upload & Management',
      steps: [
        {
          step: 1,
          title: 'Create a Folder First',
          description: 'Organize your data by creating folders before uploading',
          details: [
            'Click "New Folder" to create a category for your files',
            'Use descriptive folder names like "Q1 Campaigns" or "Hot Leads"',
            'Select the folder from the dropdown before uploading files',
            'Files uploaded will be automatically organized in the selected folder'
          ]
        },
        {
          step: 2,
          title: 'Prepare Your CSV File',
          description: 'Ensure your CSV has proper headers and clean data',
          details: [
            'First row should contain column headers (Name, Phone, Email, etc.)',
            'Phone numbers should be in a consistent format',
            'Remove any empty rows or columns',
            'Save file with UTF-8 encoding if you have special characters'
          ]
        },
        {
          step: 3,
          title: 'Upload to Selected Folder',
          description: 'Drag and drop or browse to upload your CSV files',
          details: [
            'Make sure you have selected the correct folder first',
            'You can upload multiple files at once to the same folder',
            'Files are automatically validated during upload',
            'Large files show progress indicators with upload status'
          ]
        }
      ]
    },
    'data-view': {
      title: 'Data Management & Campaigns',
      steps: [
        {
          step: 1,
          title: 'Review Your Data',
          description: 'Check data quality and make necessary edits',
          details: [
            'Look for missing phone numbers or invalid formats',
            'Use the search function to find specific contacts',
            'Edit cells by double-clicking',
            'Add new rows or columns as needed'
          ]
        },
        {
          step: 2,
          title: 'Select Target Contacts',
          description: 'Choose which contacts to include in your campaign',
          details: [
            'Click individual rows to select specific contacts',
            'Use "Select All" for the entire list',
            'Selected count appears in the header',
            'You can deselect by clicking selected rows again'
          ]
        },
        {
          step: 3,
          title: 'Launch Your Campaign',
          description: 'Start calling immediately or schedule for later',
          details: [
            '"Start Campaign" begins calls immediately',
            '"Schedule" lets you set specific times and dates',
            'Map data fields to personalize your AI bot',
            'Monitor progress in the Bulk Call History section'
          ]
        }
      ]
    }
  };

  const keyboardShortcuts = [
    { key: 'Ctrl+U', action: 'Upload new file' },
    { key: 'Ctrl+A', action: 'Select all rows' },
    { key: 'Ctrl+D', action: 'Deselect all rows' },
    { key: 'Ctrl+F', action: 'Focus search box' },
    { key: 'Enter', action: 'Start campaign with selected rows' },
    { key: 'Escape', action: 'Cancel current action' },
    { key: 'Space', action: 'Toggle row selection' },
    { key: '?', action: 'Open this help dialog' }
  ];

  const currentGuide = stepGuides[currentStep];

  return null;
}

export function ContextualTooltip({ children, content, shortcut }: {
  children: React.ReactNode;
  content: string;
  shortcut?: string;
}) {
  return (
    <div className="relative group">
      {children}
      <div className="absolute bottom-full left-1/2 transform -translate-x-1/2 mb-2 px-3 py-2 bg-gray-900 text-white text-xs rounded-lg opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none whitespace-nowrap z-50">
        {content}
        {shortcut && (
          <span className="ml-2 px-1.5 py-0.5 bg-gray-700 rounded text-xs font-mono">
            {shortcut}
          </span>
        )}
        <div className="absolute top-full left-1/2 transform -translate-x-1/2 border-4 border-transparent border-t-gray-900"></div>
      </div>
    </div>
  );
}