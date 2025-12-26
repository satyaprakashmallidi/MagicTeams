'use client'

import { createContext, useContext, useState, useEffect, ReactNode } from 'react'

export interface AgencyBranding {
  id: string
  agency_name: string
  logo_url?: string | null
  custom_domain?: string | null
  theme_id?: string | null
  website_title?: string | null
}

interface BrandingContextType {
  branding: AgencyBranding | null
  setBranding: (branding: AgencyBranding | null) => void
  isLoading: boolean
}

const BrandingContext = createContext<BrandingContextType | undefined>(undefined)

export function BrandingProvider({ children, initialBranding }: {
  children: ReactNode
  initialBranding?: AgencyBranding | null
}) {
  const [branding, setBrandingState] = useState<AgencyBranding | null>(initialBranding || null)
  const [isLoading, setIsLoading] = useState(false)

  const setBranding = (newBranding: AgencyBranding | null) => {
    setBrandingState(newBranding)
  }

  return (
    <BrandingContext.Provider value={{ branding, setBranding, isLoading }}>
      {children}
    </BrandingContext.Provider>
  )
}

export function useBranding() {
  const context = useContext(BrandingContext)
  if (context === undefined) {
    throw new Error('useBranding must be used within a BrandingProvider')
  }
  return context
}
