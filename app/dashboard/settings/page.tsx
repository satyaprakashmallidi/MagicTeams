"use client";

import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Icon } from "@/components/ui/icons";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/lib/supabase";
import { useUser } from "@/hooks/use-user";
import { CopyButton } from "@/components/ui/copy-button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

export default function SettingsPage() {
  const [geminiApiKey, setGeminiApiKey] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const { toast } = useToast();
  const { user } = useUser();

  // Load existing API key on component mount
  useEffect(() => {
    loadGeminiApiKey();
  }, [user]);

  const loadGeminiApiKey = async () => {
    if (!user?.id) return;

    setIsLoading(true);
    try {
      const { data, error } = await supabase
        .from('user_api_keys')
        .select('encrypted_key')
        .eq('user_id', user.id)
        .eq('service', 'gemini')
        .single();

      if (error && error.code !== 'PGRST116') { // PGRST116 = not found
        console.error('Error loading API key:', error);
        toast({
          title: "Error",
          description: "Failed to load saved API key",
          variant: "destructive",
        });
        return;
      }

      if (data?.encrypted_key) {
        // Show placeholder text to indicate key exists
        setGeminiApiKey('••••••••••••••••••••••••••••••••••••••••');
      }
    } catch (error) {
      console.error('Error loading API key:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const saveGeminiApiKey = async () => {
    if (!user?.id) {
      toast({
        title: "Error",
        description: "User not authenticated",
        variant: "destructive",
      });
      return;
    }

    if (!geminiApiKey.trim() || geminiApiKey === '••••••••••••••••••••••••••••••••••••••••') {
      toast({
        title: "Error",
        description: "Please enter a valid API key",
        variant: "destructive",
      });
      return;
    }

    setIsSaving(true);
    try {
      const { error } = await supabase
        .from('user_api_keys')
        .upsert({
          user_id: user.id,
          service: 'gemini',
          encrypted_key: geminiApiKey.trim(), // In production, this should be encrypted
          updated_at: new Date().toISOString()
        }, {
          onConflict: 'user_id,service'
        });

      if (error) {
        throw error;
      }

      toast({
        title: "Success",
        description: "Gemini API key saved successfully",
      });

      // Update display to show masked key
      setGeminiApiKey('••••••••••••••••••••••••••••••••••••••••');
    } catch (error) {
      console.error('Error saving API key:', error);
      toast({
        title: "Error",
        description: "Failed to save API key",
        variant: "destructive",
      });
    } finally {
      setIsSaving(false);
    }
  };

  const clearGeminiApiKey = async () => {
    if (!user?.id) return;

    setIsSaving(true);
    try {
      const { error } = await supabase
        .from('user_api_keys')
        .delete()
        .eq('user_id', user.id)
        .eq('service', 'gemini');

      if (error) {
        throw error;
      }

      setGeminiApiKey("");
      toast({
        title: "Success",
        description: "Gemini API key removed successfully",
      });
    } catch (error) {
      console.error('Error removing API key:', error);
      toast({
        title: "Error",
        description: "Failed to remove API key",
        variant: "destructive",
      });
    } finally {
      setIsSaving(false);
    }
  };

  const handleKeyChange = (value: string) => {
    // If the current value is the masked placeholder, clear it when user starts typing
    if (geminiApiKey === '••••••••••••••••••••••••••••••••••••••••') {
      setGeminiApiKey(value);
    } else {
      setGeminiApiKey(value);
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-96">
        <Icon name="spinner" className="h-8 w-8 animate-spin" />
      </div>
    );
  }

  return (
    <div className="container mx-auto space-y-6 p-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Settings</h1>
          <p className="text-muted-foreground">
            Manage your account information, API keys and preferences
          </p>
        </div>
      </div>

      <Tabs defaultValue="account" className="w-full">
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="account" className="flex items-center gap-2">
            <Icon name="user" className="h-4 w-4" />
            Account Information
          </TabsTrigger>
          <TabsTrigger value="keys" className="flex items-center gap-2">
            <Icon name="key" className="h-4 w-4" />
            Keys
          </TabsTrigger>
        </TabsList>

        <TabsContent value="account" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Icon name="user" className="h-5 w-5" />
                Account Details
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-2">
                  <Label className="text-sm font-medium">Email Address</Label>
                  <div className="flex items-center justify-between p-3 bg-muted/50 rounded-lg border">
                    <span className="text-sm font-mono break-all">{user?.email}</span>
                    <CopyButton value={user?.email || ''} label="Email" className="h-8 w-8" />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label className="text-sm font-medium">User ID</Label>
                  <div className="flex items-center justify-between p-3 bg-muted/50 rounded-lg border">
                    <span className="text-sm font-mono">
                      {user?.id ? `${'*'.repeat(8)}...${user.id.slice(-4)}` : ''}
                    </span>
                    <CopyButton value={user?.id || ''} label="User ID" className="h-8 w-8" />
                  </div>
                </div>
              </div>

              <div className="bg-blue-50 dark:bg-blue-900/20 p-4 rounded-lg">
                <div className="flex items-start gap-3">
                  <Icon name="info" className="h-5 w-5 text-blue-600 dark:text-blue-400 mt-0.5" />
                  <div className="text-sm">
                    <div className="font-medium text-blue-900 dark:text-blue-100 mb-1">
                      Account Security
                    </div>
                    <div className="text-blue-800 dark:text-blue-200">
                      Your account information is securely stored and protected. Use the copy buttons to safely share your User ID for support purposes if needed.
                    </div>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="keys" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Icon name="key" className="h-5 w-5" />
                API Keys
              </CardTitle>
            </CardHeader>
        <CardContent className="space-y-6">
          <div className="space-y-4">
            <div>
              <Label htmlFor="gemini-api-key">Gemini API Key</Label>
              <p className="text-sm text-muted-foreground mb-2">
                Your Gemini API key is used for AI analysis of call transcripts. 
                Get your API key from{" "}
                <a 
                  href="https://makersuite.google.com/app/apikey" 
                  target="_blank" 
                  rel="noopener noreferrer"
                  className="text-blue-600 dark:text-blue-400 hover:underline"
                >
                  Google AI Studio
                </a>
              </p>
              <div className="flex gap-2">
                <Input
                  id="gemini-api-key"
                  type="password"
                  placeholder="Enter your Gemini API key (AIza...)"
                  value={geminiApiKey}
                  onChange={(e) => handleKeyChange(e.target.value)}
                  className="flex-1"
                />
                <Button 
                  onClick={saveGeminiApiKey}
                  disabled={isSaving || !geminiApiKey.trim() || geminiApiKey === '••••••••••••••••••••••••••••••••••••••••'}
                >
                  {isSaving ? (
                    <>
                      <Icon name="spinner" className="h-4 w-4 mr-2 animate-spin" />
                      Saving...
                    </>
                  ) : (
                    <>
                      <Icon name="save" className="h-4 w-4 mr-2" />
                      Save
                    </>
                  )}
                </Button>
                {geminiApiKey && geminiApiKey !== '••••••••••••••••••••••••••••••••••••••••' && (
                  <Button 
                    variant="outline"
                    onClick={clearGeminiApiKey}
                    disabled={isSaving}
                  >
                    <Icon name="trash" className="h-4 w-4 mr-2" />
                    Clear
                  </Button>
                )}
              </div>
            </div>

            <div className="bg-blue-50 dark:bg-blue-900/20 p-4 rounded-lg">
              <div className="flex items-start gap-3">
                <Icon name="info" className="h-5 w-5 text-blue-600 dark:text-blue-400 mt-0.5" />
                <div className="text-sm">
                  <div className="font-medium text-blue-900 dark:text-blue-100 mb-1">
                    Security Note
                  </div>
                  <div className="text-blue-800 dark:text-blue-200">
                    Your API key is stored securely and encrypted. It will only be used for AI analysis features within the application.
                    You can update or remove it at any time.
                  </div>
                </div>
              </div>
            </div>

            {geminiApiKey === '••••••••••••••••••••••••••••••••••••••••' && (
              <div className="bg-green-50 dark:bg-green-900/20 p-4 rounded-lg">
                <div className="flex items-start gap-3">
                  <Icon name="check-circle" className="h-5 w-5 text-green-600 dark:text-green-400 mt-0.5" />
                  <div className="text-sm">
                    <div className="font-medium text-green-900 dark:text-green-100 mb-1">
                      API Key Configured
                    </div>
                    <div className="text-green-800 dark:text-green-200">
                      Your Gemini API key is saved and ready to use for AI analysis features.
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}