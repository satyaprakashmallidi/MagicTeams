"use client";

import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Icon } from "@/components/ui/icons";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { motion, AnimatePresence } from 'framer-motion';
import { useRouter } from 'next/navigation';
import { cn } from '@/lib/utils';

interface QuickStartOption {
  id: string;
  title: string;
  description: string;
  icon: string;
  estimatedTime: string;
  recommended?: boolean;
  action: () => void;
}

interface QuickStartWizardProps {
  onClose?: () => void;
  userType?: 'new' | 'returning';
}

export function QuickStartWizard({ onClose, userType = 'new' }: QuickStartWizardProps) {
  const router = useRouter();
  const [currentStep, setCurrentStep] = useState(0);
  const [selectedOption, setSelectedOption] = useState<string>('');
  const [campaignName, setCampaignName] = useState('');

  const quickStartOptions: QuickStartOption[] = [
    {
      id: 'simple',
      title: 'Simple Campaign',
      description: 'Start calling with minimal setup. Perfect for first-time users.',
      icon: 'zap',
      estimatedTime: '2 minutes',
      recommended: userType === 'new',
      action: () => router.push('/dashboard/group-call/start?mode=simple')
    },
    {
      id: 'upload',
      title: 'Upload & Call',
      description: 'Upload a CSV file and start calling immediately with default settings.',
      icon: 'upload',
      estimatedTime: '3 minutes',
      action: () => router.push('/dashboard/group-call/data-import?quickstart=true')
    },
    {
      id: 'template',
      title: 'Use Template',
      description: 'Start from a pre-configured template for common use cases.',
      icon: 'fileText',
      estimatedTime: '1 minute',
      action: () => setCurrentStep(1)
    },
    {
      id: 'advanced',
      title: 'Full Setup',
      description: 'Configure all settings for maximum control over your campaign.',
      icon: 'settings',
      estimatedTime: '5-10 minutes',
      action: () => router.push('/dashboard/group-call/start')
    }
  ];

  const templates = [
    { id: 'sales', name: 'Sales Outreach', icon: 'dollar', contacts: 'Upload required' },
    { id: 'survey', name: 'Customer Survey', icon: 'clipboard', contacts: 'Upload required' },
    { id: 'reminder', name: 'Appointment Reminders', icon: 'calendar', contacts: 'From calendar' },
    { id: 'followup', name: 'Follow-up Calls', icon: 'phone', contacts: 'Upload required' }
  ];

  const handleOptionSelect = (option: QuickStartOption) => {
    setSelectedOption(option.id);
    option.action();
  };

  const handleTemplateSelect = (templateId: string) => {
    router.push(`/dashboard/group-call/start?template=${templateId}`);
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <motion.div
        initial={{ scale: 0.9, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        className="w-full max-w-2xl"
      >
        <Card className="overflow-hidden">
          <CardHeader className="bg-gradient-to-r from-blue-500 to-purple-600 text-white">
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="text-2xl">
                  {currentStep === 0 ? 'Quick Start Your Campaign' : 'Choose a Template'}
                </CardTitle>
                <CardDescription className="text-white/90">
                  {currentStep === 0
                    ? 'Choose how you want to get started'
                    : 'Select a pre-configured template'}
                </CardDescription>
              </div>
              {onClose && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={onClose}
                  className="text-white hover:bg-white/20"
                >
                  <Icon name="x" className="h-5 w-5" />
                </Button>
              )}
            </div>
          </CardHeader>

          <CardContent className="p-6">
            <AnimatePresence mode="wait">
              {currentStep === 0 ? (
                <motion.div
                  key="options"
                  initial={{ x: -20, opacity: 0 }}
                  animate={{ x: 0, opacity: 1 }}
                  exit={{ x: 20, opacity: 0 }}
                  className="space-y-3"
                >
                  {/* Quick Name Input */}
                  <div className="mb-6">
                    <Label htmlFor="campaign-name">Campaign Name (Optional)</Label>
                    <Input
                      id="campaign-name"
                      placeholder="e.g., Monday Sales Calls"
                      value={campaignName}
                      onChange={(e) => setCampaignName(e.target.value)}
                      className="mt-1"
                    />
                    <p className="text-xs text-muted-foreground mt-1">
                      You can name your campaign now or later
                    </p>
                  </div>

                  {/* Options Grid */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    {quickStartOptions.map((option) => (
                      <motion.div
                        key={option.id}
                        whileHover={{ scale: 1.02 }}
                        whileTap={{ scale: 0.98 }}
                      >
                        <Card
                          className={cn(
                            "cursor-pointer transition-all hover:shadow-md",
                            selectedOption === option.id && "ring-2 ring-blue-500",
                            option.recommended && "border-blue-500 bg-blue-50/50"
                          )}
                          onClick={() => handleOptionSelect(option)}
                        >
                          <CardContent className="p-4">
                            <div className="flex items-start gap-3">
                              <div
                                className={cn(
                                  "w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0",
                                  option.recommended ? "bg-blue-100" : "bg-gray-100"
                                )}
                              >
                                <Icon
                                  name={option.icon as any}
                                  className={cn(
                                    "h-5 w-5",
                                    option.recommended ? "text-blue-600" : "text-gray-600"
                                  )}
                                />
                              </div>
                              <div className="flex-1">
                                <div className="flex items-center gap-2">
                                  <h3 className="font-semibold text-sm">{option.title}</h3>
                                  {option.recommended && (
                                    <span className="text-xs bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full">
                                      Recommended
                                    </span>
                                  )}
                                </div>
                                <p className="text-xs text-muted-foreground mt-1">
                                  {option.description}
                                </p>
                                <div className="flex items-center gap-1 mt-2">
                                  <Icon name="clock" className="h-3 w-3 text-gray-400" />
                                  <span className="text-xs text-gray-500">
                                    {option.estimatedTime}
                                  </span>
                                </div>
                              </div>
                            </div>
                          </CardContent>
                        </Card>
                      </motion.div>
                    ))}
                  </div>

                  {/* Help Text */}
                  <div className="mt-6 p-4 bg-amber-50 rounded-lg border border-amber-200">
                    <div className="flex items-start gap-2">
                      <Icon name="lightBulb" className="h-4 w-4 text-amber-600 mt-0.5" />
                      <div className="text-sm">
                        <p className="font-medium text-amber-900">First time here?</p>
                        <p className="text-amber-700 mt-1">
                          We recommend starting with a Simple Campaign. You can always add more
                          features and complexity as you become familiar with the platform.
                        </p>
                      </div>
                    </div>
                  </div>
                </motion.div>
              ) : (
                <motion.div
                  key="templates"
                  initial={{ x: 20, opacity: 0 }}
                  animate={{ x: 0, opacity: 1 }}
                  exit={{ x: -20, opacity: 0 }}
                  className="space-y-3"
                >
                  {/* Back Button */}
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setCurrentStep(0)}
                    className="mb-4"
                  >
                    <Icon name="arrowLeft" className="h-4 w-4 mr-2" />
                    Back to Options
                  </Button>

                  {/* Templates */}
                  <RadioGroup className="space-y-3">
                    {templates.map((template) => (
                      <Card
                        key={template.id}
                        className="cursor-pointer hover:shadow-md transition-all"
                        onClick={() => handleTemplateSelect(template.id)}
                      >
                        <CardContent className="p-4">
                          <div className="flex items-center gap-3">
                            <RadioGroupItem value={template.id} id={template.id} />
                            <div className="w-10 h-10 bg-gray-100 rounded-lg flex items-center justify-center">
                              <Icon name={template.icon as any} className="h-5 w-5 text-gray-600" />
                            </div>
                            <div className="flex-1">
                              <Label htmlFor={template.id} className="cursor-pointer">
                                <div className="font-medium">{template.name}</div>
                                <div className="text-xs text-muted-foreground">
                                  Contacts: {template.contacts}
                                </div>
                              </Label>
                            </div>
                            <Button size="sm" variant="outline">
                              Select
                              <Icon name="arrowRight" className="h-3 w-3 ml-1" />
                            </Button>
                          </div>
                        </CardContent>
                      </Card>
                    ))}
                  </RadioGroup>
                </motion.div>
              )}
            </AnimatePresence>
          </CardContent>
        </Card>
      </motion.div>
    </div>
  );
}

// Inline Quick Start Card for Dashboard
export function InlineQuickStart() {
  const router = useRouter();
  const [isExpanded, setIsExpanded] = useState(false);

  return (
    <Card className="overflow-hidden bg-gradient-to-br from-blue-50 to-purple-50 border-blue-200">
      <CardContent className="p-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 bg-white rounded-lg shadow-sm flex items-center justify-center">
              <Icon name="rocket" className="h-6 w-6 text-blue-600" />
            </div>
            <div>
              <h3 className="font-semibold">Ready to start calling?</h3>
              <p className="text-sm text-muted-foreground">
                Launch your first campaign in under 2 minutes
              </p>
            </div>
          </div>
          <Button
            onClick={() => setIsExpanded(!isExpanded)}
            className="bg-blue-600 hover:bg-blue-700"
          >
            Get Started
            <Icon name="arrowRight" className="h-4 w-4 ml-2" />
          </Button>
        </div>

        <AnimatePresence>
          {isExpanded && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              className="mt-4 pt-4 border-t border-blue-200"
            >
              <div className="grid grid-cols-3 gap-3">
                <Button
                  variant="outline"
                  className="flex-col h-auto py-3"
                  onClick={() => router.push('/dashboard/group-call/start?mode=simple')}
                >
                  <Icon name="zap" className="h-5 w-5 mb-1" />
                  <span className="text-xs">Quick Start</span>
                </Button>
                <Button
                  variant="outline"
                  className="flex-col h-auto py-3"
                  onClick={() => router.push('/dashboard/group-call/data-import')}
                >
                  <Icon name="upload" className="h-5 w-5 mb-1" />
                  <span className="text-xs">Upload Data</span>
                </Button>
                <Button
                  variant="outline"
                  className="flex-col h-auto py-3"
                  onClick={() => router.push('/dashboard/group-call/start')}
                >
                  <Icon name="settings" className="h-5 w-5 mb-1" />
                  <span className="text-xs">Full Setup</span>
                </Button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </CardContent>
    </Card>
  );
}