'use client';

import { useState } from 'react';
import { supabase } from '@/lib/supabase';
import { Button } from '@/components/ui/button';
import { Icon } from '@/components/ui/icons';
import { useToast } from '@/hooks/use-toast';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
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
      const { error } = await supabase
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
      updateBot(botId, { ...bots.find((bot) => bot.id === botId), is_deleted: true });

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

  const handleToggleEnabled = async (botId: string, value: boolean) => {
    try {
      const { error } = await supabase
        .from('bots')
        .update({ is_enabled: value })
        .eq('id', botId);

      if (error) throw error;

      // Update local state
      const currentBot = bots.find((bot) => bot.id === botId);
      if (currentBot) {
        updateBot(botId, { ...currentBot, is_enabled: value });
      }

      toast({
        title: value ? "Bot enabled" : "Bot disabled",
        description: value
          ? "Bot can now receive and make calls."
          : "Bot is disabled and cannot make or receive calls.",
      });
    } catch (error) {
      console.error('Error toggling bot:', error);
      toast({
        title: "Error",
        description: "Failed to update bot status. Please try again.",
        variant: "destructive",
      });
    }
  };

  return (
    <TooltipProvider>
      <div className="space-y-2">
        {bots.map((bot) => {
          if (bot.is_deleted) return null;
          const isSelected = selectedBotId === bot.id;
          const isDuplicating = duplicatingBotId === bot.id;

          return (
            <div
              key={bot.id}
              className={`group relative p-2 rounded-xl border transition-all duration-200 ${isSelected
                  ? 'bg-primary/10 border-primary/20 shadow-sm'
                  : 'bg-card border-border hover:border-border/80 hover:shadow-sm'
                } ${bot.is_enabled === false ? 'opacity-40' : ''}`}
            >
              <div className="flex items-start justify-between gap-2">
                <div
                  className="flex-1 min-w-0 cursor-pointer"
                  onClick={() => handleBotSelect(bot.id)}
                >
                  <div className="flex items-center gap-3">
                    <div className={`p-2 rounded-lg flex-shrink-0 ${isSelected ? 'bg-primary/20' : 'bg-muted group-hover:bg-muted/80'
                      } transition-colors`}>
                      <Icon name="bot" className={`h-4 w-4 ${isSelected ? 'text-primary' : 'text-muted-foreground'
                        }`} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <h3 className={`font-semibold text-base truncate flex-1 ${isSelected ? 'text-primary' : 'text-foreground'
                              }`}>{bot.name}</h3>
                          </TooltipTrigger>
                          <TooltipContent>
                            <p>{bot.name}</p>
                          </TooltipContent>
                        </Tooltip>
                        {bot.is_enabled === false && (
                          <Badge variant="secondary" className="text-xs flex-shrink-0">
                            Off
                          </Badge>
                        )}
                      </div>
                    </div>
                  </div>
                </div>

                {/* Actions Menu */}
                <div className="flex items-center gap-2 flex-shrink-0">
                  {/* Toggle Switch */}
                  <div onClick={(e) => e.stopPropagation()}>
                    <Switch
                      checked={bot.is_enabled !== false}
                      onCheckedChange={(value) => handleToggleEnabled(bot.id, value)}
                      className="data-[state=checked]:bg-green-500"
                    />
                  </div>

                  <div className="opacity-0 group-hover:opacity-100 transition-opacity">
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
    </TooltipProvider>
  );
}