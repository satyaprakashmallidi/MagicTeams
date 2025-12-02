import { useState, useEffect } from 'react';
import { campaignsService, Campaign, CampaignContact } from '@/components/csv-import/services/campaigns-service';
import { useToast } from '@/hooks/use-toast';

export function useCampaigns(userId: string | null) {
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { toast } = useToast();

  const fetchCampaigns = async () => {
    if (!userId) return;
    
    try {
      setIsLoading(true);
      setError(null);
      const result = await campaignsService.getCampaigns(userId);
      setCampaigns(result.campaigns);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to fetch campaigns';
      setError(errorMessage);
      console.error('Error fetching campaigns:', error);
      toast({
        title: "Error",
        description: errorMessage,
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const fetchCampaignDetails = async (campaignId: string): Promise<{ campaign: Campaign; contacts: CampaignContact[] } | null> => {
    try {
      const result = await campaignsService.getCampaign(campaignId);
      return result;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to fetch campaign details';
      console.error('Error fetching campaign details:', error);
      toast({
        title: "Error",
        description: errorMessage,
        variant: "destructive",
      });
      return null;
    }
  };

  const deleteCampaign = async (campaignId: string): Promise<boolean> => {
    try {
      await campaignsService.deleteCampaign(campaignId);
      setCampaigns(prev => prev.filter(c => c.campaign_id !== campaignId));
      toast({
        title: "Success",
        description: "Campaign deleted successfully",
      });
      return true;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to delete campaign';
      console.error('Error deleting campaign:', error);
      toast({
        title: "Error",
        description: errorMessage,
        variant: "destructive",
      });
      return false;
    }
  };

  const stopCampaign = async (campaignId: string): Promise<boolean> => {
    try {
      await campaignsService.stopCampaign(campaignId);
      // Update local state
      setCampaigns(prev => prev.map(c => 
        c.campaign_id === campaignId 
          ? { ...c, status: 'cancelled' as const }
          : c
      ));
      toast({
        title: "Success",
        description: "Campaign stopped successfully",
      });
      return true;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to stop campaign';
      console.error('Error stopping campaign:', error);
      toast({
        title: "Error",
        description: errorMessage,
        variant: "destructive",
      });
      return false;
    }
  };

  useEffect(() => {
    if (userId) {
      fetchCampaigns();
    }
  }, [userId]);

  return {
    campaigns,
    isLoading,
    error,
    fetchCampaigns,
    fetchCampaignDetails,
    deleteCampaign,
    stopCampaign,
    refetch: fetchCampaigns
  };
}