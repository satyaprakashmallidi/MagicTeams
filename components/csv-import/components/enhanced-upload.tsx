'use client';

import { useState, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Icon } from '@/components/ui/icons';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { useToast } from '@/hooks/use-toast';

interface EnhancedUploadProps {
  onFileUpload: (event: React.ChangeEvent<HTMLInputElement>) => Promise<void>;
  onDrop: (event: React.DragEvent) => Promise<void>;
  onDragOver: (event: React.DragEvent) => void;
  onDragLeave: (event: React.DragEvent) => void;
  isLoading: boolean;
  isDragOver: boolean;
  uploadProgress: number;
  uploadingFileName: string;
  className?: string;
}

interface SampleTemplate {
  name: string;
  description: string;
  headers: string[];
  sampleRows: string[][];
  icon: string;
  useCase: string;
}

export function EnhancedUpload({
  onFileUpload,
  onDrop,
  onDragOver,
  onDragLeave,
  isLoading,
  isDragOver,
  uploadProgress,
  uploadingFileName,
  className = ''
}: EnhancedUploadProps) {
  const [showTemplates, setShowTemplates] = useState(false);
  const { toast } = useToast();

  const sampleTemplates: SampleTemplate[] = [
    {
      name: 'Sales Leads',
      description: 'Basic customer contact information for sales outreach',
      headers: ['Name', 'Phone', 'Email', 'Company', 'Title'],
      sampleRows: [
        ['John Smith', '(555) 123-4567', 'john@example.com', 'ABC Corp', 'CEO'],
        ['Jane Doe', '(555) 987-6543', 'jane@example.com', 'XYZ Inc', 'Manager']
      ],
      icon: 'users',
      useCase: 'Cold calling prospects and leads'
    },
    {
      name: 'Customer Service',
      description: 'Customer contact details for support and follow-up calls',
      headers: ['Name', 'Phone', 'Email', 'Account_ID', 'Issue_Type', 'Priority'],
      sampleRows: [
        ['Alice Johnson', '(555) 111-2222', 'alice@email.com', 'ACC-001', 'Billing', 'High'],
        ['Bob Wilson', '(555) 333-4444', 'bob@email.com', 'ACC-002', 'Technical', 'Medium']
      ],
      icon: 'headphones',
      useCase: 'Customer support and service calls'
    },
    {
      name: 'Event Invitations',
      description: 'Contact list for event invitations and confirmations',
      headers: ['Name', 'Phone', 'Email', 'Company', 'RSVP_Status', 'Special_Needs'],
      sampleRows: [
        ['Carol Davis', '(555) 555-6666', 'carol@example.com', 'Tech Startup', 'Pending', 'None'],
        ['David Brown', '(555) 777-8888', 'david@example.com', 'Marketing Agency', 'Confirmed', 'Vegetarian']
      ],
      icon: 'calendar',
      useCase: 'Event invitations and RSVP confirmations'
    }
  ];

  const downloadTemplate = useCallback((template: SampleTemplate) => {
    const csvContent = [
      template.headers.join(','),
      ...template.sampleRows.map(row => row.join(','))
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', `${template.name.replace(/\s+/g, '_')}_Template.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    toast({
      title: "Template Downloaded",
      description: `${template.name} template has been downloaded to your computer.`,
    });
  }, [toast]);

  const formatRequirements = [
    {
      icon: 'fileSpreadsheet',
      title: 'CSV Format Only',
      description: 'Files must be in CSV (Comma Separated Values) format'
    },
    {
      icon: 'list',
      title: 'Headers Required',
      description: 'First row should contain column headers (Name, Phone, etc.)'
    },
    {
      icon: 'phone',
      title: 'Phone Numbers',
      description: 'Include a column with "phone", "mobile", or "number" in the name'
    },
    {
      icon: 'database',
      title: 'File Size Limit',
      description: 'Maximum file size: 50MB (approximately 500,000 contacts)'
    }
  ];

  return (
    <div className={className}>
      {/* Main Upload Area */}
      <div
        onClick={() => document.getElementById('csvInput')?.click()}
        onDrop={onDrop}
        onDragOver={onDragOver}
        onDragLeave={onDragLeave}
        className={`bg-background border-2 border-dashed rounded-2xl p-8 text-center cursor-pointer transition-all duration-200 ${
          isDragOver
            ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20 shadow-lg scale-[1.02]'
            : isLoading
              ? 'border-border bg-muted'
              : 'border-border hover:border-blue-400 dark:hover:border-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900/20 hover:shadow-md'
        }`}
      >
        <div className="max-w-md mx-auto">
          <div className="w-20 h-20 bg-blue-100 dark:bg-blue-900/20 rounded-full flex items-center justify-center mx-auto mb-6">
            {isLoading ? (
              <Icon name="spinner" className="h-10 w-10 text-blue-600 dark:text-blue-400 animate-spin" />
            ) : isDragOver ? (
              <Icon name="download" className="h-10 w-10 text-blue-600 dark:text-blue-400" />
            ) : (
              <Icon name="upload" className="h-10 w-10 text-blue-600 dark:text-blue-400" />
            )}
          </div>

          <h3 className="text-xl font-bold text-foreground mb-2">
            {isLoading ? `Uploading ${uploadingFileName}...` : isDragOver ? 'Drop CSV files here' : 'Upload CSV Files'}
          </h3>

          <p className="text-muted-foreground mb-6">
            {isLoading && uploadProgress > 0 ?
              `Processing: ${Math.round(uploadProgress)}% complete` :
              isDragOver ? 'Release to upload your files' : 'Drag and drop your CSV files here, or click to browse'
            }
          </p>

          {/* Progress Bar */}
          {isLoading && uploadProgress > 0 && (
            <div className="mb-6">
              <Progress value={uploadProgress} className="h-3 mb-2" />
              <p className="text-sm text-gray-500">{Math.round(uploadProgress)}% uploaded</p>
            </div>
          )}

          {/* Upload Button */}
          {!isLoading && !isDragOver && (
            <div className="space-y-3">
              <Button className="bg-blue-600 hover:bg-blue-700 text-white px-8 py-3 text-lg font-medium">
                <Icon name="plus" className="h-5 w-5 mr-2" />
                Choose Files
              </Button>
              <p className="text-xs text-gray-500">
                Supports multiple file selection
              </p>
            </div>
          )}
        </div>
      </div>

     
      {/* Sample Templates */}
      <div className="mt-8">
        <div className="flex items-center justify-between mb-4">
          <h4 className="font-semibold text-gray-900 flex items-center gap-2">
            <Icon name="template" className="h-4 w-4 text-green-600" />
            Sample Templates
          </h4>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setShowTemplates(!showTemplates)}
            className="text-gray-600 hover:text-gray-800"
          >
            {showTemplates ? 'Hide' : 'Show'} Templates
            <Icon name={showTemplates ? "chevronUp" : "chevronDown"} className="h-4 w-4 ml-1" />
          </Button>
        </div>

        {showTemplates && (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {sampleTemplates.map((template, index) => (
              <Card key={index} className="hover:shadow-lg transition-shadow cursor-pointer">
                <CardHeader className="pb-3">
                  <CardTitle className="flex items-center justify-between text-base">
                    <div className="flex items-center gap-2">
                      <Icon name={template.icon as any} className="h-4 w-4 text-green-600" />
                      {template.name}
                    </div>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => downloadTemplate(template)}
                      className="h-8 w-8 p-0"
                    >
                      <Icon name="download" className="h-4 w-4" />
                    </Button>
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-sm text-gray-600 mb-3">{template.description}</p>
                  <div className="space-y-2">
                    <div>
                      <Badge variant="outline" className="text-xs">
                        {template.headers.length} columns
                      </Badge>
                    </div>
                    <div className="text-xs text-gray-500">
                      <strong>Use case:</strong> {template.useCase}
                    </div>
                    <div className="text-xs text-gray-500">
                      <strong>Headers:</strong> {template.headers.slice(0, 3).join(', ')}
                      {template.headers.length > 3 && '...'}
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>     
    </div>
  );
}