import { notFound } from 'next/navigation'
import { Metadata } from 'next'
import WhiteLabelLoginForm from '@/components/whitelabel-login/whitelabel-loginform'
import { createWhitelabelAdminClient } from '@/utils/supabase-whitelabel/server'

interface AgencyLoginPageProps {
  params: {
    agencyId: string
  }
}

export async function generateMetadata({ params }: AgencyLoginPageProps): Promise<Metadata> {
  const { agencyId } = params
  
  try {
    const whitelabelSupabase = await createWhitelabelAdminClient()
    const { data: agencyData, error } = await whitelabelSupabase
      .from('agencies')
      .select('id, agency_name, logo_url')
      .eq('id', agencyId)
      .single()

    if (error || !agencyData) {
      return {
        title: 'Login - Magic Teams',
        description: 'Your AI assistant',
      }
    }

    return {
      title: `Login - ${agencyData.agency_name}`,
      description: 'Your AI assistant',
      icons: agencyData.logo_url ? [
        { url: agencyData.logo_url, type: 'image/png', sizes: '32x32' },
      ] : [
        { url: '/magic.png', type: 'image/png', sizes: '32x32' },
      ],
    }
  } catch (error) {
    return {
      title: 'Login - Magic Teams',
      description: 'Your AI assistant',
    }
  }
}

export default async function AgencyLoginPage({ params }: AgencyLoginPageProps) {
  const { agencyId } = params
  
  // Validate if agency exists in whitelabel database
  const whitelabelSupabase = await createWhitelabelAdminClient()
  const { data: agencyData, error } = await whitelabelSupabase
    .from('agencies')
    .select('id, agency_name, logo_url')
    .eq('id', agencyId)
    .single()
  

  // If agency not found, return 404
  if (error || !agencyData) {
    notFound()
  }

  return (
    <div 
      style={{
        minHeight: '100vh'
      }}
    >
      <WhiteLabelLoginForm 
        agencyId={agencyId} 
        agencyName={agencyData.agency_name}
        agencyLogoUrl={agencyData.logo_url}
      />
    </div>
  )
}