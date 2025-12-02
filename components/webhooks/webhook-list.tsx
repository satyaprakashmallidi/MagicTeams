"use client";

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { AlertDialog, AlertDialogContent, AlertDialogHeader, AlertDialogTitle, AlertDialogDescription, AlertDialogFooter, AlertDialogCancel, AlertDialogAction } from '@/components/ui/alert-dialog';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { Icon } from '@/components/ui/icons';
import { Skeleton } from '@/components/ui/skeleton';
import { useToast } from '@/hooks/use-toast';
import { useWebhooks } from '@/hooks/use-webhooks';
import { useBots } from '@/hooks/use-bots';
import { Webhook, WEBHOOK_EVENTS } from '@/types/webhooks';
import { CreateWebhookDialog } from './create-webhook-dialog';
import { UpdateWebhookDialog } from './update-webhook-dialog';

export function WebhookList() {
  const [selectedWebhook, setSelectedWebhook] = useState<Webhook | null>(null);
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [showUpdateDialog, setShowUpdateDialog] = useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [webhookToDelete, setWebhookToDelete] = useState<Webhook | null>(null);
  const [testingWebhookId, setTestingWebhookId] = useState<string | null>(null);

  const { webhooks, isLoading, error, deleteWebhook, testWebhook, clearError } = useWebhooks();
  const { bots } = useBots();
  const { toast } = useToast();

  console.log(webhooks);

  const handleEditWebhook = (webhook: Webhook) => {
    setSelectedWebhook(webhook);
    setShowUpdateDialog(true);
  };

  const handleDeleteWebhook = (webhook: Webhook) => {
    setWebhookToDelete(webhook);
    setShowDeleteDialog(true);
  };

  const confirmDelete = async () => {
    if (!webhookToDelete) return;

    try {
      await deleteWebhook(webhookToDelete.webhook_id);
      toast({
        title: "Success",
        description: "Webhook deleted successfully",
      });
    } catch (error) {
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to delete webhook",
        variant: "destructive",
      });
    } finally {
      setShowDeleteDialog(false);
      setWebhookToDelete(null);
    }
  };

  const handleTestWebhook = async (webhook: Webhook) => {
    setTestingWebhookId(webhook.webhook_id);
    
    try {
      const success = await testWebhook(webhook.url);
      toast({
        title: success ? "Test Successful" : "Test Failed",
        description: success 
          ? "Webhook endpoint responded successfully" 
          : "Webhook endpoint is not responding",
        variant: success ? "default" : "destructive",
      });
    } catch (error) {
      toast({
        title: "Test Failed",
        description: "Failed to test webhook endpoint",
        variant: "destructive",
      });
    } finally {
      setTestingWebhookId(null);
    }
  };

  const getBotName = (agentId: string | null | undefined) => {
    if (!agentId) return 'All Agents';
    const bot = bots.find(b => b.id === agentId);
    return bot ? bot.name : 'Unknown Agent';
  };

  const getEventLabel = (event: string) => {
    const eventInfo = WEBHOOK_EVENTS.find(e => e.value === event);
    return eventInfo ? eventInfo.label : event;
  };

  if (error) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center py-8">
          <div className="text-center">
            <Icon name="alertTriangle" className="h-8 w-8 text-red-500 mx-auto mb-2" />
            <p className="text-red-600 mb-4">{error}</p>
            <Button onClick={clearError} variant="outline">
              Try Again
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold">Webhooks</h2>
          <p className="text-muted-foreground">
            Manage your webhook endpoints for real-time notifications
          </p>
        </div>
        <Button onClick={() => setShowCreateDialog(true)} className="flex items-center gap-2">
          <Icon name="plus" className="h-4 w-4" />
          Create Webhook
        </Button>
      </div>

      {/* Webhooks Table */}
      <Card>
        <CardHeader>
          <CardTitle>Your Webhooks</CardTitle>
          <CardDescription>
            {webhooks.length} webhook{webhooks.length !== 1 ? 's' : ''} configured
          </CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="space-y-2">
              {[...Array(3)].map((_, i) => (
                <Skeleton key={i} className="h-16 w-full" />
              ))}
            </div>
          ) : webhooks.length === 0 ? (
            <div className="text-center py-8">
              <Icon name="webhook" className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
              <h3 className="text-lg font-semibold mb-2">No Webhooks</h3>
              <p className="text-muted-foreground mb-4">
                Create your first webhook to receive real-time notifications
              </p>
              <Button onClick={() => setShowCreateDialog(true)}>
                Create Webhook
              </Button>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>URL</TableHead>
                    <TableHead>Events</TableHead>
                    <TableHead>Agent</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Created</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {webhooks.map((webhook) => (
                    <TableRow key={webhook.webhookId}>
                      <TableCell className="max-w-xs">
                        <div className="truncate" title={webhook.url}>
                          {webhook.url}
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex gap-1 flex-wrap">
                          {webhook.events.map((event) => (
                            <Badge key={event} variant="secondary" className="text-xs">
                              {getEventLabel(event)}
                            </Badge>
                          ))}
                        </div>
                      </TableCell>
                      <TableCell>
                        <span className="text-sm">{getBotName(webhook.agentId)}</span>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <div className={`w-2 h-2 rounded-full ${
                            webhook.status === 'normal' ? 'bg-green-500' : 'bg-red-500'
                          }`} />
                          <span className="text-sm capitalize">{webhook.status}</span>
                          {webhook.recentFailures && webhook.recentFailures.length > 0 && (
                            <Badge variant="destructive" className="text-xs">
                              {webhook.recentFailures.length} failures
                            </Badge>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        <span className="text-sm text-muted-foreground">
                          {new Date(webhook.created || webhook?.created_at).toLocaleDateString()}
                        </span>
                      </TableCell>
                      <TableCell className="text-right">
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="sm">
                              <Icon name="moreHorizontal" className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem onClick={() => handleEditWebhook(webhook)}>
                              <Icon name="edit" className="h-4 w-4 mr-2" />
                              Edit
                            </DropdownMenuItem>
                            <DropdownMenuItem 
                              onClick={() => handleTestWebhook(webhook)}
                              disabled={testingWebhookId === webhook.webhookId}
                            >
                              <Icon 
                                name={testingWebhookId === webhook.webhookId ? "loader" : "zap"} 
                                className={`h-4 w-4 mr-2 ${testingWebhookId === webhook.webhookId ? "animate-spin" : ""}`} 
                              />
                              Test
                            </DropdownMenuItem>
                            <DropdownMenuItem 
                              onClick={() => handleDeleteWebhook(webhook)}
                              className="text-red-600"
                            >
                              <Icon name="trash" className="h-4 w-4 mr-2" />
                              Delete
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Dialogs */}
      <CreateWebhookDialog 
        open={showCreateDialog}
        onOpenChange={setShowCreateDialog}
      />

      <UpdateWebhookDialog 
        webhook={selectedWebhook}
        open={showUpdateDialog}
        onOpenChange={setShowUpdateDialog}
      />

      <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Webhook</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete this webhook? This action cannot be undone.
              {webhookToDelete && (
                <div className="mt-2 p-2 bg-muted rounded">
                  <code className="text-sm">{webhookToDelete.url}</code>
                </div>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction 
              onClick={confirmDelete}
              className="bg-red-600 hover:bg-red-700"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}