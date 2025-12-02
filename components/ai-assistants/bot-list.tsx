
'use client';

import { useState } from 'react';
import { supabase } from '@/lib/supabase';
import { Button } from '@/components/ui/button';
import { Icon } from '@/components/ui/icons';
import { useToast } from '@/hooks/use-toast';
import { Badge } from '@/components/ui/badge';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useBots } from '@/hooks/use-bots';


export function BotList() {
  const { toast } = useToast();
  const [duplicatingBotId, setDuplicatingBotId] = useState<string | null>(null);

  const { bots, selectedBotId, setSelectedBotId, updateBot, duplicateBot } = useBots();

  const handleBotSelect = (botId: string) => {
    setSelectedBotId(botId);
  };

  const handleDeleteBot = async (botId: string) => {
    try {
      const {  error } = await supabase
        .from('bots')
        .update({ is_deleted: true })
        .eq('id', botId);

      if (error) throw error;

      toast({
        title: "Bot deleted",
        description: "The bot has been successfully deleted.",
      });

      if (selectedBotId === botId) {
        setSelectedBotId(null);
      }

      //@ts-ignore
      updateBot(botId,{ ...bots.find((bot) => bot.id === botId) , is_deleted: true });

    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to delete the bot. Please try again.",
        variant: "destructive",
      });
    }
  };

  const handleDuplicateBot = async (botId: string) => {
    try {
      setDuplicatingBotId(botId);
      const duplicatedBot = await duplicateBot(botId);
      
      if (duplicatedBot) {
        toast({
          title: "Bot duplicated",
          description: `Successfully created a copy: "${duplicatedBot.name}"`
        });
      }
    } catch (error: any) {
      console.error('Error duplicating bot:', error);
      toast({
        title: "Error",
        description: error.message || "Failed to duplicate the bot. Please try again.",
        variant: "destructive",
      });
    } finally {
      setDuplicatingBotId(null);
    }
  };

  return (
    <div className="space-y-2">
      {bots.map((bot) => {
        if(bot.is_deleted) return null;
        const isSelected = selectedBotId === bot.id;
        const isDuplicating = duplicatingBotId === bot.id;
        
        return (
        <div
          key={bot.id}
          className={`group relative p-2 rounded-xl border transition-all duration-200 ${
            isSelected
              ? 'bg-primary/10 border-primary/20 shadow-sm'
              : 'bg-card border-border hover:border-border/80 hover:shadow-sm'
          }`}
        >
          <div className="flex items-start justify-between">
            <div
              className="flex-1 cursor-pointer"
              onClick={() => handleBotSelect(bot.id)}
            >
              <div className="flex items-center gap-3">
                <div className={`p-2 rounded-lg ${
                  isSelected ? 'bg-primary/20' : 'bg-muted group-hover:bg-muted/80'
                } transition-colors`}>
                  <Icon name="bot" className={`h-4 w-4 ${
                    isSelected ? 'text-primary' : 'text-muted-foreground'
                  }`} />
                </div>
                <div className="flex-1">
                  <h3 className={`font-semibold text-base truncate ${
                    isSelected ? 'text-primary' : 'text-foreground'
                  }`}>{bot.name.length > 13 ? bot.name.slice(0, 13) + '...' : bot.name}</h3>
                  {/* {bot.phone_number && (
                    <p className="text-sm text-gray-500 mt-1">
                      <Icon name="phone" className="h-3 w-3 inline mr-1" />
                      {bot.phone_number}
                    </p>
                  )} */}
                </div>
              </div>
              
              {/* Bot Details */}
              {/* <div className="flex items-center gap-4 text-xs text-gray-500">
                {bot.knowledge_base_id && (
                  <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200">
                    <Icon name="brain" className="h-3 w-3 mr-1" />
                    Knowledge Base
                  </Badge>
                )}
                {bot.selected_tools && bot.selected_tools.length > 0 && (
                  <Badge variant="outline" className="bg-purple-50 text-purple-700 border-purple-200">
                    <Icon name="wrench" className="h-3 w-3 mr-1" />
                    {bot.selected_tools.length} tool{bot.selected_tools.length !== 1 ? 's' : ''}
                  </Badge>
                )}
                {bot.is_appointment_booking_allowed && (
                  <Badge variant="outline" className="bg-blue-50 text-blue-700 border-blue-200">
                    <Icon name="calendar" className="h-3 w-3 mr-1" />
                    Appointments
                  </Badge>
                )}
              </div> */}
            </div>
            
            {/* Actions Menu */}
            <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-8 w-8 p-0 text-muted-foreground hover:text-foreground"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <Icon name="moreHorizontal" className="h-4 w-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-48">
                  <DropdownMenuItem
                    onClick={(e) => {
                      e.stopPropagation();
                      handleBotSelect(bot.id);
                    }}
                    className="flex items-center gap-2"
                  >
                    <Icon name="edit" className="h-4 w-4" />
                    Edit Bot
                  </DropdownMenuItem>
                  
                  <DropdownMenuItem
                    onClick={(e) => {
                      e.stopPropagation();
                      handleDuplicateBot(bot.id);
                    }}
                    disabled={isDuplicating}
                    className="flex items-center gap-2"
                  >
                    {isDuplicating ? (
                      <Icon name="spinner" className="h-4 w-4 animate-spin" />
                    ) : (
                      <Icon name="copy" className="h-4 w-4" />
                    )}
                    {isDuplicating ? 'Duplicating...' : 'Duplicate Bot'}
                  </DropdownMenuItem>
                  
                  <DropdownMenuSeparator />
                  
                  <AlertDialog>
                    <AlertDialogTrigger asChild>
                      <DropdownMenuItem
                        onSelect={(e) => e.preventDefault()}
                        className="flex items-center gap-2 text-red-600 focus:text-red-700 focus:bg-red-50"
                      >
                        <Icon name="trash" className="h-4 w-4" />
                        Delete Bot
                      </DropdownMenuItem>
                    </AlertDialogTrigger>
                    <AlertDialogContent>
                      <AlertDialogHeader>
                        <AlertDialogTitle>Delete Bot</AlertDialogTitle>
                        <AlertDialogDescription>
                          Are you sure you want to delete "{bot.name}"? This action cannot be undone and will remove all associated data.
                        </AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                        <AlertDialogAction
                          onClick={() => handleDeleteBot(bot.id)}
                          className="bg-red-600 hover:bg-red-700"
                        >
                          Delete Bot
                        </AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </div>
        </div>
        );
      })}
      
      {bots.filter(bot => !bot.is_deleted).length === 0 && (
        <div className="text-center py-12">
          <div className="w-16 h-16 bg-muted rounded-full flex items-center justify-center mx-auto mb-4">
            <Icon name="bot" className="h-8 w-8 text-muted-foreground" />
          </div>
          <h3 className="text-lg font-semibold text-foreground mb-2">No bots found</h3>
          <p className="text-muted-foreground mb-4">Create your first AI assistant to get started</p>
        </div>
      )}
    </div>
  );
}