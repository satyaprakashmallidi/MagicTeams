import { CheckCircle } from 'lucide-react';
import { createWhitelabelClient } from '@/utils/supabase-whitelabel/server';
import DefaultPlan from '@/components/upgrade-plan/magicteams-plan';
import { createClient } from '@/utils/supabase/server';
import UpgradePricingClient from '@/components/upgrade-plan/UpgradePricingClient';



export default async function UpgradePlan() {
  // Get user data from supabase
  const supabase = await createClient();
  const { data: { user: userData }, error: userError } = await supabase.auth.getUser();

  if (userError || !userData) {
    return (
      <div className="text-center p-8 text-red-500">
        Please login to view pricing information
      </div>
    );
  }

  // Get agency_id from user metadata
  const agencyId = userData.user_metadata?.agency_id;

  //if this account doesn't belong to any agency re-direct to magic teams pricing.
  if (!agencyId) {
    return (
        <DefaultPlan />
    );
  }

  // Connect to the whitelabel supabase for agency pricing details.
  const whitelabelSupabase = await createWhitelabelClient();
  
  // Fetch pricing data
  const { data: pricing, error } = await whitelabelSupabase
    .from('pricing')
    .select('*')
    .eq('agency_id', agencyId)
    .single();

  if (error) {
    return (
      <div className="text-center p-8 text-red-500">
        Error: {error.message}
      </div>
    );
  }

  if (!pricing) {
    return (
      <div className="text-center p-8">
        No pricing information available for your agency
      </div>
    );
  }

  // Fetch user's current-subscription from agency_users table
  const { data: userData2, error: userError2 } = await supabase
    .from('agency_users')
    .select('subscription')
    .eq('user_id', userData.id)
    .single();

  // Default to 'default' subscription if not found
  const subscription = userData2?.subscription || 'default';

  // Pass data to the client component
  return (
    <UpgradePricingClient 
      userId={userData.id}
      agencyId={agencyId}
      pricing={pricing}
      subscription={subscription}
    />
  );
}