'use client';

import { Button } from '@/components/ui/button';
import { Icon } from '@/components/ui/icons';
import { supabase } from '@/lib/supabase';
import { Pencil, Trash, Phone, Plus } from 'lucide-react';
import { useVoices } from '@/hooks/use-voices';
import { useVoiceStore } from '@/store/use-voice-store';
import { verifyTwilioCredentials, lookupPhoneNumber, listPurchasedNumbers, updatePhoneWebhook } from '@/lib/services/twilio-service';
import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { useToast } from '@/hooks/use-toast';

import type { TwilioCredentials as TwilioAccount, TwilioPhoneNumber } from '@/types/twilio';
import { useBots } from '@/hooks/use-bots';

type DialogType = 'create' | 'edit' | 'delete' | 'add-number' | 'edit-number' | 'delete-number' | 'set-inbound' | 'edit-inbound' | null;

export function TwilioIntegration() {
  const { twilioInfo } = useVoices();
  const { bots } = useBots();
  const setTwilioInfo = useVoiceStore((state) => state.setTwilioInfo);
  const { toast } = useToast();

  console.log(twilioInfo , "twiii lloopop infoo")
  
  const [dialogType, setDialogType] = useState<DialogType>(null);
  const [selectedAccount, setSelectedAccount] = useState<TwilioAccount | null>(null);
  const [selectedPhoneNumber, setSelectedPhoneNumber] = useState<TwilioPhoneNumber | null>(null);
  const [selectedBotId, setSelectedBotId] = useState<string>('');
  const [accountFormData, setAccountFormData] = useState({
    account_name: '',
    account_sid: '',
    auth_token: '',
  });
  const [phoneFormData, setPhoneFormData] = useState({
    phone_number: '',
    friendly_name: '',
  });

  const [purchasedNumbers, setPurchasedNumbers] = useState<Array<{
    phoneNumber: string;
    friendlyName: string;
    region: string;
    capabilities: {
      voice: boolean;
      SMS: boolean;
      MMS: boolean;
    };
    status: string;
  }>>([]);
  const [isLoadingNumbers, setIsLoadingNumbers] = useState(false);
  const [isSettingInbound, setIsSettingInbound] = useState(false);

  const resetForm = () => {
    setAccountFormData({
      account_name: '',
      account_sid: '',
      auth_token: '',
    });
    setPhoneFormData({
      phone_number: '',
      friendly_name: '',
    });
    setSelectedAccount(null);
    setSelectedPhoneNumber(null);
    setSelectedBotId('');
    setDialogType(null);
  };

  const handleEditAccount = (account: TwilioAccount) => {
    setSelectedAccount(account);
    setAccountFormData({
      account_name: account.account_name,
      account_sid: account.account_sid,
      auth_token: account.auth_token,
    });
    setDialogType('edit');
  };

  const handleEditPhoneNumber = (phoneNumber: TwilioPhoneNumber) => {
    setSelectedPhoneNumber(phoneNumber);
    setPhoneFormData({
      phone_number: phoneNumber.phone_number,
      friendly_name: phoneNumber.friendly_name,
    });
    setDialogType('edit-number');
  };

  const addTwilioAccount = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      
      if (!user?.id || !accountFormData.account_sid || !accountFormData.auth_token) {
        toast({
          title: "Error",
          description: "Please fill in all required fields",
          variant: "destructive",
        });
        return;
      }

      // Verify Twilio credentials first
      const verificationResult = await verifyTwilioCredentials(
        accountFormData.account_sid.trim(),
        accountFormData.auth_token.trim()
      );

      if (!verificationResult.success) {
        toast({
          title: "Error",
          description: verificationResult.error || "Invalid Twilio credentials",
          variant: "destructive",
        });
        return;
      }

      const { data, error } = await supabase
        .from('twilio_account')
        .insert([{
          ...accountFormData,
          user_id: user.id,
          account_name: accountFormData.account_name || 'Default Account',
          is_active: true
        }])
        .select();

      if (error) throw error;
      
      if (data) {
        setTwilioInfo([...twilioInfo, data[0]]);
        toast({
          title: "Success",
          description: "Twilio account verified and added successfully",
        });
        resetForm();
      }
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  const addPhoneNumber = async () => {
    if (!selectedAccount) {
      toast({
        title: "Error",
        description: "No account selected",
        variant: "destructive",
      });
      return;
    }

    if (!phoneFormData.phone_number) {
      toast({
        title: "Error",
        description: "Phone number is required",
        variant: "destructive",
      });
      return;
    }

    try {
      // First, verify the account exists and get credentials
      const { data: accountData, error: accountError } = await supabase
        .from('twilio_account')
        .select('id, account_sid, auth_token')
        .eq('id', selectedAccount.id)
        .single();

      if (accountError || !accountData) {
        toast({
          title: "Error",
          description: "Selected account not found",
          variant: "destructive",
        });
        return;
      }

      // // Verify the phone number using Twilio Lookup
      // const lookupResult = await lookupPhoneNumber(
      //   accountData.account_sid,
      //   accountData.auth_token,
      //   phoneFormData.phone_number
      // );

      // if (!lookupResult.success) {
      //   toast({
      //     title: "Error",
      //     description: lookupResult.error || "Invalid phone number",
      //     variant: "destructive",
      //   });
      //   return;
      // }

      // Now add the verified phone number
      const { data, error } = await supabase
        .from('twilio_phone_numbers')
        .insert([{
          account_id: selectedAccount.id,
          phone_number: phoneFormData.phone_number,
          friendly_name: phoneFormData.friendly_name,
          is_active: true
        }])
        .select();

      if (error) {
        console.error('Error adding phone number:', error);
        toast({
          title: "Error",
          description: `Failed to add phone number: ${error.message}`,
          variant: "destructive",
        });
        return;
      }

      if (data) {
        // Update the twilioInfo state with the new phone number
        const updatedTwilioInfo = twilioInfo.map(account => {
          if (account.id === selectedAccount.id) {
            return {
              ...account,
              phone_numbers: [
                ...(account.phone_numbers || []),
                data[0]
              ]
            };
          }
          return account;
        });

        setTwilioInfo(updatedTwilioInfo);
        toast({
          title: "Success",
          description: "Phone number verified and added successfully",
        });
        resetForm();
      }
    } catch (error: any) {
      console.error('Exception adding phone number:', error);
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  const deleteTwilioAccount = async () => {
    if (!selectedAccount) return;
    
    try {
      const { error } = await supabase
        .from('twilio_account')
        .delete()
        .eq('id', selectedAccount.id);

      if (error) throw error;
      
      setTwilioInfo(twilioInfo.filter((account) => account.id !== selectedAccount.id));
      toast({
        title: "Success",
        description: "Twilio account deleted successfully",
      });
      resetForm();
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  const deletePhoneNumber = async () => {
    if (!selectedPhoneNumber || !selectedAccount) {
      toast({
        title: "Error",
        description: "No phone number selected",
        variant: "destructive",
      });
      return;
    }
    
    try {
      const { error } = await supabase
        .from('twilio_phone_numbers')
        .delete()
        .eq('id', selectedPhoneNumber.id);

      if (error) {
        console.error('Error deleting phone number:', error);
        toast({
          title: "Error",
          description: `Failed to delete phone number: ${error.message}`,
          variant: "destructive",
        });
        return;
      }

      // Update the twilioInfo state by removing the deleted phone number
      const updatedTwilioInfo = twilioInfo.map(account => {
        if (account.id === selectedAccount.id) {
          return {
            ...account,
            phone_numbers: (account.phone_numbers || []).filter(
              phone => phone.id !== selectedPhoneNumber.id
            )
          };
        }
        return account;
      });

      setTwilioInfo(updatedTwilioInfo);
      toast({
        title: "Success",
        description: "Phone number deleted successfully",
      });
      resetForm();
    } catch (error: any) {
      console.error('Exception deleting phone number:', error);
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  const updateTwilioAccount = async () => {
    if (!selectedAccount) return;

    try {
      const { error } = await supabase
        .from('twilio_account')
        .update({
          account_name: accountFormData.account_name,
          account_sid: accountFormData.account_sid,
          auth_token: accountFormData.auth_token,
        })
        .eq('id', selectedAccount.id);

      if (error) throw error;

      setTwilioInfo(
        twilioInfo.map((acc) => 
          acc.id === selectedAccount.id 
            ? { ...acc, ...accountFormData }
            : acc
        )
      );
      toast({
        title: "Success",
        description: "Twilio account updated successfully",
      });
      resetForm();
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  const updatePhoneNumber = async () => {
    if (!selectedPhoneNumber || !selectedAccount) return;

    try {
      const { data, error } = await supabase
        .from('twilio_phone_numbers')
        .update({
          phone_number: phoneFormData.phone_number,
          friendly_name: phoneFormData.friendly_name,
        })
        .eq('id', selectedPhoneNumber.id)
        .select();

      if (error) throw error;

      if (data) {
        // Update the twilioInfo state with the updated phone number
        const updatedTwilioInfo = twilioInfo.map(account => {
          if (account.id === selectedAccount.id) {
            return {
              ...account,
              phone_numbers: account.phone_numbers?.map(phone =>
                phone.id === selectedPhoneNumber.id ? data[0] : phone
              ) || []
            };
          }
          return account;
        });

        setTwilioInfo(updatedTwilioInfo);
        toast({
          title: "Success",
          description: "Phone number updated successfully",
        });
        resetForm();
      }
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  return (
    <div className="p-6 space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">Twilio Integration</h2>
          <p className="text-muted-foreground">Manage your Twilio account and phone numbers</p>
        </div>
        <Button onClick={() => setDialogType('create')}>
          <Icon name="plus" className="h-4 w-4 mr-2" />
          Add Account
        </Button>
      </div>

      <div className="grid gap-4">
        {twilioInfo.map((account) => {
          if(account.is_active === false) return null;
          return (
          <Card key={account.id}>
            <CardHeader className="pb-4">
              <div className="flex justify-between items-start">
                <div>
                  <CardTitle className="text-lg font-medium">
                    {account.account_name}
                  </CardTitle>
                  <CardDescription className="mt-1">
                    Account SID: {account.account_sid.substring(0, 10)}...
                  </CardDescription>
                </div>
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      setSelectedAccount(account);
                      setDialogType('add-number');
                    }}
                  >
                    <Plus className="h-4 w-4 mr-2" />
                    Add Number
                  </Button>
                  <Button
                    variant="outline"
                    size="icon"
                    onClick={() => handleEditAccount(account)}
                  >
                    <Pencil className="h-4 w-4" />
                  </Button>
                  <Button
                    variant="destructive"
                    size="icon"
                    onClick={() => {
                      setSelectedAccount(account);
                      setDialogType('delete');
                    }}
                  >
                    <Trash className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {account.phone_numbers?.map((phoneNumber) => {
                  if(phoneNumber.is_active === false) return null;
                  return (
                  <div 
                    key={phoneNumber.id}
                    className="flex items-center justify-between p-2 rounded-lg border bg-card"
                  >
                    <div className="flex items-center space-x-2">
                      <Phone className="h-4 w-4 text-muted-foreground" />
                      <div>
                        <p className="text-sm font-medium">
                          {phoneNumber.friendly_name}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {phoneNumber.phone_number}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center space-x-2">
                      <Button 
                        variant="outline" 
                        className='gap-2'
                        onClick={() => {
                          setSelectedPhoneNumber(phoneNumber);
                          setSelectedAccount(account);
                          setSelectedBotId(phoneNumber.bot_id || '');
                          setDialogType(phoneNumber.bot_id ? 'edit-inbound' : 'set-inbound');
                        }}
                      >
                        <Phone className="h-4 w-4" />
                        {phoneNumber.bot_id ? 'Edit Inbound' : 'Set Inbound'}
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => handleEditPhoneNumber(phoneNumber)}
                      >
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="text-destructive hover:text-destructive"
                        onClick={() => {
                          setSelectedAccount(account);
                          setSelectedPhoneNumber(phoneNumber);
                          setDialogType('delete-number');
                        }}
                      >
                        <Trash className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                )})}
                {account.phone_numbers?.length === 0 && (
                  <div className="text-center py-4 text-muted-foreground">
                    No phone numbers added yet
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        )})}
      </div>

      {/* Account Dialog */}
      <Dialog open={dialogType === 'create' || dialogType === 'edit'} onOpenChange={() => resetForm()}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{dialogType === 'create' ? 'Add Twilio Account' : 'Edit Twilio Account'}</DialogTitle>
            <DialogDescription>
              Enter your Twilio credentials to enable voice calling functionality.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label htmlFor="account_name">Account Name</Label>
              <Input
                id="account_name"
                value={accountFormData.account_name}
                onChange={(e) => setAccountFormData({ ...accountFormData, account_name: e.target.value })}
                placeholder="Enter a name for this account"
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="account_sid">Account SID</Label>
              <Input
                id="account_sid"
                value={accountFormData.account_sid}
                onChange={(e) => setAccountFormData({ ...accountFormData, account_sid: e.target.value })}
                placeholder="Enter your Twilio Account SID"
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="auth_token">Auth Token</Label>
              <Input
                id="auth_token"
                type="password"
                value={accountFormData.auth_token}
                onChange={(e) => setAccountFormData({ ...accountFormData, auth_token: e.target.value })}
                placeholder="Enter your Twilio Auth Token"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={resetForm}>Cancel</Button>
            <Button onClick={dialogType === 'create' ? addTwilioAccount : updateTwilioAccount}>
              {dialogType === 'create' ? 'Add Account' : 'Save Changes'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Phone Number Dialog */}
      <Dialog open={dialogType === 'add-number' || dialogType === 'edit-number'} onOpenChange={() => {
        resetForm();
        setPurchasedNumbers([]);
      }}>
        <DialogContent className="max-w-3xl">
          <DialogHeader>
            <DialogTitle>{dialogType === 'add-number' ? 'Add Phone Number' : 'Edit Phone Number'}</DialogTitle>
            <DialogDescription>
              {dialogType === 'add-number' ? 'Select a phone number from available numbers or enter your own.' : 'Edit phone number details.'}
            </DialogDescription>
          </DialogHeader>
          {dialogType === 'add-number' && (
            <div className="grid gap-4 py-4">
              <div className="flex justify-between items-center">
                <div className="text-sm font-medium">Your Purchased Numbers</div>
                <Button 
                  onClick={async () => {
                    if (!selectedAccount) return;
                    setIsLoadingNumbers(true);
                    try {
                      const { data: accountData } = await supabase
                        .from('twilio_account')
                        .select('account_sid, auth_token')
                        .eq('id', selectedAccount.id)
                        .single();

                      if (accountData) {
                        const result = await listPurchasedNumbers(
                          accountData.account_sid,
                          accountData.auth_token
                        );
                        if (result.success && Array.isArray(result.data)) {
                          setPurchasedNumbers(result.data.map((number) => ({
                            phoneNumber: number.phone_number,
                            friendlyName: number.friendly_name,
                            region: number.region,
                            capabilities: number.capabilities,
                            status: number.status
                          })));
                        } else {
                          toast({
                            title: "Error",
                            description: result.error || "Failed to fetch numbers",
                            variant: "destructive",
                          });
                        }
                      }
                    } catch (error: any) {
                      toast({
                        title: "Error",
                        description: error.message,
                        variant: "destructive",
                      });
                    } finally {
                      setIsLoadingNumbers(false);
                    }
                  }}
                  disabled={isLoadingNumbers}
                  variant="outline"
                  size="sm"
                >
                  {isLoadingNumbers ? 'Loading...' : 'Refresh Numbers'}
                </Button>
              </div>

              {purchasedNumbers.length > 0 && (
                <div className="border rounded-lg overflow-y-scroll max-h-64">
                  <table className="w-full">
                    <thead className="bg-muted sticky top-0">
                      <tr>
                        <th className="px-4 py-2 text-left">Number</th>
                        <th className="px-4 py-2 text-left">Name</th>
                        <th className="px-4 py-2 text-left">Region</th>
                        <th className="px-4 py-2 text-left">Capabilities</th>
                        <th className="px-4 py-2 text-right">Action</th>
                      </tr>
                    </thead>
                    <tbody>
                      {purchasedNumbers.map((number, index) => (
                        <tr key={index} className="border-t">
                          <td className="px-4 py-2">{number.phoneNumber}</td>
                          <td className="px-4 py-2">{number.friendlyName}</td>
                          <td className="px-4 py-2">{number.region}</td>
                          <td className="px-4 py-2">
                            {[
                              number.capabilities.voice && 'Voice',
                              number.capabilities.SMS && 'SMS',
                              number.capabilities.MMS && 'MMS'
                            ].filter(Boolean).join(', ')}
                          </td>
                          <td className="px-4 py-2 text-right">
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => {
                                setPhoneFormData({
                                  phone_number: number.phoneNumber,
                                  friendly_name: number.friendlyName,
                                });
                              }}
                            >
                              Select
                            </Button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}

              <div className="text-sm text-muted-foreground">
                {purchasedNumbers.length > 0 ? 'Select a number from above or enter one manually:' : 'Enter a phone number:'}
              </div>
            </div>
          )}

          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label htmlFor="phone_number">Phone Number</Label>
              <Input
                id="phone_number"
                value={phoneFormData.phone_number}
                onChange={(e) => setPhoneFormData({ ...phoneFormData, phone_number: e.target.value })}
                placeholder="+1234567890"
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="friendly_name">Friendly Name</Label>
              <Input
                id="friendly_name"
                value={phoneFormData.friendly_name}
                onChange={(e) => setPhoneFormData({ ...phoneFormData, friendly_name: e.target.value })}
                placeholder="Enter a friendly name for this number"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={resetForm}>Cancel</Button>
            <Button onClick={dialogType === 'add-number' ? addPhoneNumber : updatePhoneNumber}>
              {dialogType === 'add-number' ? 'Add Number' : 'Save Changes'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Bot Selection Dialog */}
      <Dialog open={dialogType === 'set-inbound' || dialogType === 'edit-inbound'} onOpenChange={(open) => {
        if (!open) {
          setDialogType(null);
          setSelectedBotId('');
          setIsSettingInbound(false);
        }
      }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{dialogType === 'edit-inbound' ? 'Edit Inbound Call Handler' : 'Configure Inbound Call Handler'}</DialogTitle>
            <DialogDescription>
              {dialogType === 'edit-inbound' ? 'Change the bot handling inbound calls for' : 'Select a bot to handle inbound calls for'} {selectedPhoneNumber?.phone_number}
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label>Select Bot</Label>
              <select
                className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm transition-colors file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
                value={selectedBotId}
                onChange={(e: React.ChangeEvent<HTMLSelectElement>) => setSelectedBotId(e.target.value)}
                disabled={isSettingInbound}
              >
                <option value="">Select a bot...</option>
                {bots.map((bot) => (
                  <option key={bot.id} value={bot.id}>
                    {bot.name}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <DialogFooter>
            <div className="flex gap-2">
              <Button variant="outline" onClick={() => setDialogType(null)} disabled={isSettingInbound}>
                Cancel
              </Button>
              {dialogType === 'edit-inbound' && (
                <Button 
                  variant="destructive"
                  onClick={async () => {
                    setSelectedBotId('');
                    // Reuse the save logic by clicking the save button
                    document.getElementById('save-inbound-button')?.click();
                  }}
                  disabled={isSettingInbound || !selectedPhoneNumber?.bot_id}
                >
                  Remove Bot
                </Button>
              )}
              <Button
                id="save-inbound-button"
              onClick={async () => {
                if (!selectedAccount || !selectedPhoneNumber) return;
                
                setIsSettingInbound(true);
                
                try {
                  // 1. Update the webhook URL in Twilio
                  const { data: accountData } = await supabase
                    .from('twilio_account')
                    .select('account_sid, auth_token')
                    .eq('id', selectedAccount.id)
                    .single();

                  if (accountData) {
                    const webhookUrl = selectedBotId 
                      ? `${process.env.NEXT_PUBLIC_BACKEND_URL_WORKER}/api/inbound?bot_id=${selectedBotId}&user_id=${selectedAccount.user_id}`
                      : '';
                      
                    const result = await updatePhoneWebhook(
                      accountData.account_sid,
                      accountData.auth_token,
                      selectedPhoneNumber.phone_number,
                      webhookUrl
                    );

                    if (!result.success) {
                      throw new Error(result.error || 'Failed to update webhook');
                    }

                    // 2. Update the bot_id in our database
                    const { error: updateError } = await supabase
                      .from('twilio_phone_numbers')
                      .update({ bot_id: selectedBotId || null })
                      .eq('id', selectedPhoneNumber.id);

                    if (updateError) throw updateError;

                    // 3. Update local state
                    const updatedTwilioInfo = twilioInfo.map(acc => {
                      if (acc.id === selectedAccount.id) {
                        return {
                          ...acc,
                          phone_numbers: acc.phone_numbers?.map(phone =>
                            phone.id === selectedPhoneNumber.id
                              ? { ...phone, bot_id: selectedBotId || null }
                              : phone
                          )
                        };
                      }
                      return acc;
                    });

                    setTwilioInfo(updatedTwilioInfo);
                    
                    toast({
                      title: "Success",
                      description: selectedBotId 
                        ? "Bot configured successfully for inbound calls" 
                        : "Bot removed from inbound calls",
                    });
                    setDialogType(null);
                  }
                } catch (error: any) {
                  toast({
                    title: "Error",
                    description: error.message,
                    variant: "destructive",
                  });
                } finally {
                  setIsSettingInbound(false);
                }
              }}
              disabled={isSettingInbound}
            >
              {isSettingInbound ? 'Saving...' : 'Save'}
            </Button>
            </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Account Dialog */}
      <Dialog open={dialogType === 'delete'} onOpenChange={() => resetForm()}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete Twilio Account</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete this Twilio account? This action cannot be undone and will also delete all associated phone numbers.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={resetForm}>Cancel</Button>
            <Button variant="destructive" onClick={deleteTwilioAccount}>
              Delete Account
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Phone Number Dialog */}
      <Dialog open={dialogType === 'delete-number'} onOpenChange={() => resetForm()}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete Phone Number</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete this phone number? This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={resetForm}>Cancel</Button>
            <Button variant="destructive" onClick={deletePhoneNumber}>
              Delete Number
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
