import { redirect } from 'next/navigation'

interface AgencyPageProps {
  params: {
    agencyId: string
  }
}

export default function AgencyPage({ params }: AgencyPageProps) {
  const { agencyId } = params
  
  // Redirect to login page when accessing agency root
  redirect(`/agency/${agencyId}/login`)
}