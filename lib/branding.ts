import { createWhitelabelAdminClient } from '@/utils/supabase-whitelabel/server'
import { AgencyBranding } from '@/contexts/branding-context'

export async function getAgencyBranding(agencyId: string): Promise<AgencyBranding | null> {
  try {
    const whitelabelSupabase = await createWhitelabelAdminClient()
    const { data: agencyData, error } = await whitelabelSupabase
      .from('agencies')
      .select('id, agency_name, logo_url, custom_domain, theme_id, website_title')
      .eq('id', agencyId)
      .single()

    if (error || !agencyData) {
      return null
    }

    return {
      id: agencyData.id,
      agency_name: agencyData.agency_name,
      logo_url: agencyData.logo_url,
      custom_domain: agencyData.custom_domain,
      theme_id: agencyData.theme_id,
      website_title: agencyData.website_title
    }
  } catch (error) {
    console.error('Error fetching agency branding:', error)
    return null
  }
}

export async function getAgencyBrandingByDomain(domain: string): Promise<AgencyBranding | null> {
  try {
    const whitelabelSupabase = await createWhitelabelAdminClient()
    const { data: domainRecord, error } = await whitelabelSupabase
      .from('agency_domain')
      .select(`
        *,
        agencies!inner(id, agency_name, logo_url, custom_domain, theme_id, website_title)
      `)
      .eq('domain', domain.toLowerCase().replace(/^www\./, ''))
      .eq('verification_status', 'verified')
      .single()

    if (error || !domainRecord?.agencies) {
      return null
    }

    return {
      id: domainRecord.agencies.id,
      agency_name: domainRecord.agencies.agency_name,
      logo_url: domainRecord.agencies.logo_url,
      custom_domain: domainRecord.agencies.custom_domain,
      theme_id: domainRecord.agencies.theme_id,
      website_title: domainRecord.agencies.website_title
    }
  } catch (error) {
    console.error('Error fetching agency branding by domain:', error)
    return null
  }
}
