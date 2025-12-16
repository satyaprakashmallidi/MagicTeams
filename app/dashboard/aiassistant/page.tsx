"use client"
import { BotDetails } from '@/components/ai-assistants/bot-details';
import { BotList } from '@/components/ai-assistants/bot-list';
import { CreateBotWizard } from '@/components/dashboard/create-bot-wizard';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogTrigger } from '@/components/ui/dialog';
import { Icon } from '@/components/ui/icons';
import { Card } from '@/components/ui/card';
import { cn } from '@/lib/utils';
import React, { useState } from 'react'
import { useBots } from '@/hooks/use-bots';

const page = () => {
  const [open, setOpen] = useState(false);
  const { selectedBotId } = useBots();

  return (
    <div className="flex h-full">
      {/* Left Sidebar - Bot List */}
      <Card className={cn(
        "w-64 border-r",
        "bg-background",
        "overflow-y-auto custom-scrollbar"
      )}>
        <div className="p-4">
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
              <Button
                className="w-full flex items-center gap-2 mb-4"
                variant="default"
              >
                <Icon name="plus" className="h-4 w-4" />
                New Bot
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-[800px] p-0 overflow-hidden">
              <CreateBotWizard onClose={() => setOpen(false)} />
            </DialogContent>
          </Dialog>

          <BotList />
        </div>
      </Card>

      {/* Main Area - Bot Details or Empty State */}
      <div className={cn(
        "flex-1 p-6",
        "bg-muted/50"
      )}>
        {selectedBotId ? (
          <BotDetails />
        ) : (
          <div className="flex items-center justify-center h-full text-muted-foreground">
            Select a bot to view and edit details
          </div>
        )}
      </div>
    </div>
  )
}

export default page