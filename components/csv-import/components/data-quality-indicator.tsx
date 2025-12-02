'use client';

import { useMemo, useState } from 'react';
import { Icon } from '@/components/ui/icons';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { CSVFile } from '../types';

interface DataQualityIndicatorProps {
  file: CSVFile;
  className?: string;
}

interface QualityMetric {
  name: string;
  score: number;
  status: 'excellent' | 'good' | 'fair' | 'poor';
  issues: string[];
  suggestions: string[];
}

export function DataQualityIndicator({ file, className = '' }: DataQualityIndicatorProps) {
  const qualityAnalysis = useMemo(() => {
    if (!file || !file.data || file.data.length === 0) {
      return {
        overall: 0,
        metrics: [],
        readyForCampaign: false
      };
    }

    const data = file.data;
    const headers = file.headers;

    // Phone number analysis
    const phoneFields = headers.filter(h =>
      h.toLowerCase().includes('phone') ||
      h.toLowerCase().includes('mobile') ||
      h.toLowerCase().includes('number')
    );

    let phoneScore = 0;
    let phoneIssues: string[] = [];
    let phoneSuggestions: string[] = [];

    if (phoneFields.length === 0) {
      phoneScore = 0;
      phoneIssues.push('No phone number column detected');
      phoneSuggestions.push('Add a column with "phone", "mobile", or "number" in the name');
    } else {
      const phoneColumn = phoneFields[0];
      const validPhones = data.filter(row => {
        const phone = row[phoneColumn];
        return phone && phone.toString().replace(/\D/g, '').length >= 10;
      }).length;

      phoneScore = (validPhones / data.length) * 100;

      if (phoneScore < 50) {
        phoneIssues.push(`${Math.round(100 - phoneScore)}% of rows have invalid/missing phone numbers`);
        phoneSuggestions.push('Ensure phone numbers are complete and properly formatted');
      }
      if (phoneScore < 80) {
        phoneSuggestions.push('Consider cleaning phone data before starting campaigns');
      }
    }

    // Name field analysis
    const nameFields = headers.filter(h =>
      h.toLowerCase().includes('name') ||
      h.toLowerCase().includes('contact') ||
      h.toLowerCase().includes('customer')
    );

    let nameScore = 0;
    let nameIssues: string[] = [];
    let nameSuggestions: string[] = [];

    if (nameFields.length === 0) {
      nameScore = 50;
      nameIssues.push('No name column detected');
      nameSuggestions.push('Add a name column for personalized communications');
    } else {
      const nameColumn = nameFields[0];
      const validNames = data.filter(row => {
        const name = row[nameColumn];
        return name && name.toString().trim().length > 0;
      }).length;

      nameScore = (validNames / data.length) * 100;

      if (nameScore < 70) {
        nameIssues.push(`${Math.round(100 - nameScore)}% of rows have missing names`);
        nameSuggestions.push('Fill in missing names for better personalization');
      }
    }

    // Data completeness analysis
    const totalCells = data.length * headers.length;
    const filledCells = data.reduce((count, row) => {
      return count + headers.filter(header => {
        const value = row[header];
        return value !== null && value !== undefined && value.toString().trim() !== '';
      }).length;
    }, 0);

    const completenessScore = (filledCells / totalCells) * 100;
    let completenessIssues: string[] = [];
    let completenessSuggestions: string[] = [];

    if (completenessScore < 60) {
      completenessIssues.push('Many cells are empty');
      completenessSuggestions.push('Fill in missing data or remove unnecessary columns');
    }

    // Duplicate detection
    const phoneColumn = phoneFields[0];
    let duplicateScore = 100;
    let duplicateIssues: string[] = [];
    let duplicateSuggestions: string[] = [];

    if (phoneColumn) {
      const phones = data.map(row => row[phoneColumn]?.toString().replace(/\D/g, '')).filter(Boolean);
      const uniquePhones = new Set(phones);
      const duplicateCount = phones.length - uniquePhones.size;

      if (duplicateCount > 0) {
        duplicateScore = Math.max(0, 100 - (duplicateCount / phones.length * 100));
        duplicateIssues.push(`${duplicateCount} duplicate phone numbers found`);
        duplicateSuggestions.push('Remove duplicate entries to avoid calling the same person twice');
      }
    }

    const metrics: QualityMetric[] = [
      {
        name: 'Phone Numbers',
        score: phoneScore,
        status: phoneScore >= 90 ? 'excellent' : phoneScore >= 70 ? 'good' : phoneScore >= 50 ? 'fair' : 'poor',
        issues: phoneIssues,
        suggestions: phoneSuggestions
      },
      {
        name: 'Contact Names',
        score: nameScore,
        status: nameScore >= 90 ? 'excellent' : nameScore >= 70 ? 'good' : nameScore >= 50 ? 'fair' : 'poor',
        issues: nameIssues,
        suggestions: nameSuggestions
      },
      {
        name: 'Data Completeness',
        score: completenessScore,
        status: completenessScore >= 90 ? 'excellent' : completenessScore >= 70 ? 'good' : completenessScore >= 50 ? 'fair' : 'poor',
        issues: completenessIssues,
        suggestions: completenessSuggestions
      },
      {
        name: 'No Duplicates',
        score: duplicateScore,
        status: duplicateScore >= 95 ? 'excellent' : duplicateScore >= 80 ? 'good' : duplicateScore >= 60 ? 'fair' : 'poor',
        issues: duplicateIssues,
        suggestions: duplicateSuggestions
      }
    ];

    const overallScore = metrics.reduce((sum, metric) => sum + metric.score, 0) / metrics.length;
    const readyForCampaign = phoneScore >= 70 && duplicateScore >= 80;

    return {
      overall: overallScore,
      metrics,
      readyForCampaign
    };
  }, [file]);

  const getStatusColor = (status: QualityMetric['status']) => {
    switch (status) {
      case 'excellent': return 'text-green-600 bg-green-50 border-green-200';
      case 'good': return 'text-blue-600 bg-blue-50 border-blue-200';
      case 'fair': return 'text-yellow-600 bg-yellow-50 border-yellow-200';
      case 'poor': return 'text-red-600 bg-red-50 border-red-200';
    }
  };

  const getStatusIcon = (status: QualityMetric['status']) => {
    switch (status) {
      case 'excellent': return 'checkCircle';
      case 'good': return 'check';
      case 'fair': return 'alertCircle';
      case 'poor': return 'xCircle';
    }
  };

  if (!file || !file.data || file.data.length === 0) {
    return null;
  }

  return (
    <TooltipProvider>
      <Dialog>
        <Tooltip>
          <TooltipTrigger asChild>
            <DialogTrigger asChild>
              <Button
                variant="outline"
                size="sm"
                className={`fixed bottom-20 right-6 z-40 shadow-lg ${
                  qualityAnalysis.readyForCampaign
                    ? 'border-green-500 bg-green-50 hover:bg-green-100 text-green-800'
                    : 'border-yellow-500 bg-yellow-50 hover:bg-yellow-100 text-yellow-800'
                } ${className}`}
              >
                <Icon name="shieldCheck" className="h-4 w-4 mr-2" />
                <div className="flex items-center gap-2">
                  <span className="font-bold">{Math.round(qualityAnalysis.overall)}%</span>
                  <Icon
                    name={qualityAnalysis.readyForCampaign ? 'checkCircle' : 'alertCircle'}
                    className="h-4 w-4"
                  />
                </div>
              </Button>
            </DialogTrigger>
          </TooltipTrigger>
          <TooltipContent side="left">
            <p>Data Quality Score - Click for details</p>
          </TooltipContent>
        </Tooltip>

      <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Icon name="shieldCheck" className="h-5 w-5 text-blue-600" />
            Data Quality Report
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-6">
          {/* Overall Score */}
          <div className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
            <div>
              <div className="text-3xl font-bold text-gray-900">
                {Math.round(qualityAnalysis.overall)}%
              </div>
              <div className="text-sm text-gray-600">Overall Quality Score</div>
            </div>
            <div className="w-16 h-16 relative">
              <svg className="w-16 h-16 transform -rotate-90" viewBox="0 0 36 36">
                <circle
                  cx="18"
                  cy="18"
                  r="16"
                  fill="transparent"
                  stroke="#e5e7eb"
                  strokeWidth="3"
                />
                <circle
                  cx="18"
                  cy="18"
                  r="16"
                  fill="transparent"
                  stroke={qualityAnalysis.overall >= 80 ? "#10b981" : qualityAnalysis.overall >= 60 ? "#f59e0b" : "#ef4444"}
                  strokeWidth="3"
                  strokeDasharray={`${qualityAnalysis.overall * 100.53 / 100} 100.53`}
                  strokeLinecap="round"
                />
              </svg>
            </div>
          </div>

          {/* Campaign Readiness */}
          <div className={`p-4 rounded-lg border ${qualityAnalysis.readyForCampaign ? 'bg-green-50 border-green-200' : 'bg-yellow-50 border-yellow-200'}`}>
            <div className="flex items-center gap-2 mb-2">
              <Icon
                name={qualityAnalysis.readyForCampaign ? 'checkCircle' : 'alertCircle'}
                className={`h-5 w-5 ${qualityAnalysis.readyForCampaign ? 'text-green-600' : 'text-yellow-600'}`}
              />
              <span className={`font-semibold text-lg ${qualityAnalysis.readyForCampaign ? 'text-green-800' : 'text-yellow-800'}`}>
                {qualityAnalysis.readyForCampaign ? 'Ready for Campaign' : 'Needs Attention'}
              </span>
            </div>
            <p className={`${qualityAnalysis.readyForCampaign ? 'text-green-700' : 'text-yellow-700'}`}>
              {qualityAnalysis.readyForCampaign
                ? 'Your data quality is good enough to start a calling campaign.'
                : 'Consider improving data quality before starting your campaign for better results.'
              }
            </p>
          </div>

          {/* Quality Metrics */}
          <div>
            <h3 className="font-semibold text-lg mb-4">Quality Breakdown</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {qualityAnalysis.metrics.map((metric, index) => (
                <div key={index} className={`p-4 rounded-lg border ${getStatusColor(metric.status)}`}>
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-2">
                      <Icon
                        name={getStatusIcon(metric.status) as any}
                        className="h-4 w-4"
                      />
                      <span className="font-medium">{metric.name}</span>
                    </div>
                    <span className="text-lg font-bold">{Math.round(metric.score)}%</span>
                  </div>
                  <Progress value={metric.score} className="h-2 mb-3" />

                  {/* Issues and Suggestions */}
                  {(metric.issues.length > 0 || metric.suggestions.length > 0) && (
                    <div className="space-y-2">
                      {metric.issues.map((issue, i) => (
                        <p key={i} className="text-sm opacity-90 flex items-start gap-2">
                          <span className="text-red-500">⚠️</span>
                          {issue}
                        </p>
                      ))}
                      {metric.suggestions.map((suggestion, i) => (
                        <p key={i} className="text-sm opacity-80 flex items-start gap-2">
                          <span className="text-blue-500">💡</span>
                          {suggestion}
                        </p>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* Quick Actions */}
          {!qualityAnalysis.readyForCampaign && (
            <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
              <div className="flex items-center gap-2 mb-3">
                <Icon name="zap" className="h-5 w-5 text-blue-600" />
                <span className="font-semibold text-gray-900">Quick Fixes</span>
              </div>
              <div className="space-y-2">
                <p className="text-sm text-gray-600">• Edit cells by double-clicking to fix missing data</p>
                <p className="text-sm text-gray-600">• Use search to find and remove duplicates</p>
                <p className="text-sm text-gray-600">• Add new columns with the "+" button if needed</p>
              </div>
            </div>
          )}
        </div>
      </DialogContent>
      </Dialog>
    </TooltipProvider>
  );
}