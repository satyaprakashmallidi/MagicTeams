import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useToast } from "@/components/ui/use-toast";
import { createClientComponentClient } from "@supabase/auth-helpers-nextjs";

interface TwilioCredential {
  id: number;
  account_sid: string;
  auth_token: string;
  from_phone_number: string;
}

interface TwilioFormProps {
  credential?: TwilioCredential;
  onSuccess: () => void;
  onCancel: () => void;
}

export function TwilioForm({
  credential,
  onSuccess,
  onCancel,
}: TwilioFormProps) {
  const [isLoading, setIsLoading] = useState(false);
  const [formData, setFormData] = useState({
    account_sid: credential?.account_sid || "",
    auth_token: credential?.auth_token || "",
    from_phone_number: credential?.from_phone_number || "",
  });

  const { toast } = useToast();
  const supabase = createClientComponentClient();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);

    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) throw new Error("User not authenticated");

      if (credential) {
        // Update existing credential
        await supabase
          .from("twilio_credentials")
          .update(formData)
          .eq("id", credential.id);

        toast({
          title: "Success",
          description: "Twilio credentials updated successfully",
        });
      } else {
        // Create new credential
        await supabase.from("twilio_credentials").insert([
          {
            ...formData,
            user_id: user.id,
          },
        ]);

        toast({
          title: "Success",
          description: "Twilio credentials added successfully",
        });
      }

      onSuccess();
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to save Twilio credentials",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4 p-4 bg-white rounded-lg">
      <div className="space-y-2">
        <label className="text-sm font-medium">Account SID</label>
        <Input
          required
          type="text"
          value={formData.account_sid}
          onChange={(e) =>
            setFormData({ ...formData, account_sid: e.target.value })
          }
          placeholder="Enter your Twilio Account SID"
        />
      </div>

      <div className="space-y-2">
        <label className="text-sm font-medium">Auth Token</label>
        <Input
          required
          type="password"
          value={formData.auth_token}
          onChange={(e) =>
            setFormData({ ...formData, auth_token: e.target.value })
          }
          placeholder="Enter your Twilio Auth Token"
        />
      </div>

      <div className="space-y-2">
        <label className="text-sm font-medium">From Phone Number</label>
        <Input
          required
          type="text"
          value={formData.from_phone_number}
          onChange={(e) =>
            setFormData({ ...formData, from_phone_number: e.target.value })
          }
          placeholder="+1234567890"
        />
      </div>

      <div className="flex justify-end space-x-2 pt-4">
        <Button
          type="button"
          variant="outline"
          onClick={onCancel}
          disabled={isLoading}
        >
          Cancel
        </Button>
        <Button type="submit" disabled={isLoading}>
          {isLoading ? "Saving..." : credential ? "Update" : "Save"}
        </Button>
      </div>
    </form>
  );
}
