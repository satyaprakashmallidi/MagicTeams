'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Icon } from '@/components/ui/icons';
import { Card } from '@/components/ui/card';
import { cn } from '@/lib/utils';
import { AppointmentToolList } from '@/components/appointment-tools/appointment-tool-list';
import { AppointmentToolDetails } from '@/components/appointment-tools/appointment-tool-details';
import { CreateAppointmentToolWizard } from '@/components/appointment-tools/create-appointment-tool-wizard';
import { CopyButton } from '@/components/ui/copy-button';

export default function AppointmentToolsPage() {
  const [selectedToolId, setSelectedToolId] = useState<string | null>(null);
  const [showCreateWizard, setShowCreateWizard] = useState(false);

  const handleToolSelect = (toolId: string) => {
    setSelectedToolId(toolId);
    setShowCreateWizard(false);
  };

  return (
    <div className={cn(
      "flex h-full",
      "bg-background"
    )}>
      {/* Left Sidebar - Tool List */}
      <Card className={cn(
        "w-72 border-r",
        "bg-card",
        "overflow-y-auto custom-scrollbar h-full"
      )}>
        <div className="p-6">
          <Button
            onClick={() => {
              setShowCreateWizard(true);
              setSelectedToolId(null);
            }}
            className="flex items-center gap-2 mb-6"
            size="lg"
          >
            <Icon name="plus" className="h-4 w-4" />
            New Appointment Tool
          </Button>

          <div className="space-y-1">
            <h2 className="text-sm font-medium text-muted-foreground px-2 mb-3">Your Tools</h2>
            <AppointmentToolList onSelectTool={handleToolSelect} selectedToolId={selectedToolId} />
          </div>
        </div>
      </Card>

      {/* Main Area - Tool Details, Create Wizard, or Empty State */}
      <div className={cn(
        "flex-1 overflow-y-auto custom-scrollbar",
        "bg-muted/50"
      )}>
        {showCreateWizard ? (
          <CreateAppointmentToolWizard 
            onClose={() => setShowCreateWizard(false)}
            onComplete={(toolId: string) => {
              setSelectedToolId(toolId);
              setShowCreateWizard(false);
            }}
          />
        ) : selectedToolId ? (
          <div className="space-y-4 p-6">
            <div className="flex items-center justify-between text-sm text-muted-foreground bg-muted p-2 rounded-md">
              <div className="flex items-center gap-2">
                <Icon name="id" className="h-4 w-4" />
                <span>Tool ID: {selectedToolId}</span>
              </div>
              <CopyButton value={selectedToolId || ''} label="Tool ID" />
            </div>
            <AppointmentToolDetails toolId={selectedToolId} />
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center h-full text-center px-6">
            <Card className={cn(
              "p-8 max-w-md w-full",
              "bg-card"
            )}>
              <div className={cn(
                "w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-6",
                "bg-primary/10"
              )}>
                <Icon name="calendar" className="h-8 w-8 text-primary" />
              </div>
              <h3 className="text-xl font-semibold mb-2">No Tool Selected</h3>
              <p className="text-muted-foreground mb-6">
                Select an existing appointment tool or create a new one to get started
              </p>
              <Button
                onClick={() => {
                  setShowCreateWizard(true);
                  setSelectedToolId(null);
                }}
                className="w-full"
                size="lg"
              >
                Create New Tool
              </Button>
            </Card>
          </div>
        )}
      </div>
    </div>
  );
}
