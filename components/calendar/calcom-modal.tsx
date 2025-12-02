import { useState } from "react";
import { 
  Dialog, 
  DialogContent, 
  DialogHeader, 
  DialogTitle, 
  DialogDescription,
  DialogFooter
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "@/hooks/use-toast";
import { supabase } from "@/lib/supabase";


interface CalcomModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConnectSuccess: (apiKey: string) => Promise<void>; 
}

export default function CalcomModal({ isOpen, onClose, onConnectSuccess }: CalcomModalProps) {

  const [apiKey, setApiKey] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);

    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) throw new Error('User not found');

      const { error } = await supabase
        .from('user_calcom_credentials')
        .upsert({ user_id: user.id, api_key: apiKey }, { onConflict: 'user_id' });

      if (error) throw error;

      await onConnectSuccess(apiKey); 
      onClose(); 

    } catch (err: any) {
      toast({
        title: 'Error',
        description: 'Failed to save API key: ' + err.message,
        variant: 'destructive',
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>Connect to Cal.com</DialogTitle>
          <DialogDescription>
            Enter your Cal.com API key to connect your account. You can find your API key in your Cal.com account settings.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit}>
          <div className="grid gap-4 py-4">
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="apiKey" className="text-right">
                API Key
              </Label>
              <Input
                id="apiKey"
                value={apiKey}
                onChange={(e) => setApiKey(e.target.value)}
                className="col-span-3"
                placeholder="cal_live_..."
                required
              />
            </div>
          
          </div>
          <DialogFooter>
            <Button 
              type="button" 
              variant="outline" 
              onClick={onClose}
              disabled={isSubmitting}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={isSubmitting || !apiKey}>
              {isSubmitting ? "Connecting..." : "Connect"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}