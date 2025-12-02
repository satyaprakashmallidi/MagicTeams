'use client'

import { useBranding } from '@/contexts/branding-context'

interface BrandingTitleProps {
  className?: string
  fallback?: string
}

export default function BrandingTitle({ className = '', fallback = 'Magic Teams' }: BrandingTitleProps) {
  const { branding } = useBranding()
  
  return (
    <span className={className}>
      {branding?.agency_name || fallback}
    </span>
  )
}
