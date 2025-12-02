import { notFound } from 'next/navigation'
import WhiteLabelLoginForm from '@/components/whitelabel-login/whitelabel-loginform'
import { createWhitelabelAdminClient } from '@/utils/supabase-whitelabel/server'

interface AgencyLocationLoginPageProps {
  params: {
    agencyId: string
    locationId: string
  }
}

export default async function AgencyLocationLoginPage({ params }: AgencyLocationLoginPageProps) {
  const { agencyId, locationId } = params
  
  // Validate if agency exists in whitelabel database
  const whitelabelSupabase = await createWhitelabelAdminClient()
  const { data: agencyData, error } = await whitelabelSupabase
    .from('agencies')
    .select('id, agency_name')
    .eq('id', agencyId)
    .single()
  

  // If agency not found, return 404
  if (error || !agencyData) {
    notFound()
  }

  // You can also validate locationId here if needed
  // For now, we'll just pass it along to the form

  return (
    <div 
      style={{
        minHeight: '100vh'
      }}
    >
      <WhiteLabelLoginForm 
        agencyId={agencyId} 
        agencyName={agencyData.agency_name}
      />
    </div>
  )
}