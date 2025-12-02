'use client'

import Image from 'next/image'
import { useBranding } from '@/contexts/branding-context'
import { Icon } from '@/components/ui/icons'

interface BrandingLogoProps {
  size?: 'sm' | 'md' | 'lg' | 'xl'
  showText?: boolean
  className?: string
}

const sizeMap = {
  sm: { width: 24, height: 24, textClass: 'text-sm' },
  md: { width: 32, height: 32, textClass: 'text-base' },
  lg: { width: 40, height: 40, textClass: 'text-lg' },
  xl: { width: 48, height: 48, textClass: 'text-xl' }
}

export default function BrandingLogo({ 
  size = 'md', 
  showText = true, 
  className = '' 
}: BrandingLogoProps) {
  const { branding } = useBranding()
  const { width, height, textClass } = sizeMap[size]

  if (branding?.logo_url) {
    return (
      <div className={`flex items-center gap-2 ${className}`}>
        <Image
          src={branding.logo_url}
          alt={branding.agency_name}
          width={width}
          height={height}
          className="rounded"
          onError={(e) => {
            // Fallback to default logo on error
            const target = e.target as HTMLImageElement
            target.style.display = 'none'
            const fallback = target.nextElementSibling as HTMLElement
            if (fallback) {
              fallback.style.display = 'flex'
            }
          }}
        />
        <div className="hidden items-center gap-2">
          <Icon name="building2" className="text-muted-foreground" style={{ width, height }} />
          {showText && (
            <span className={`font-semibold ${textClass}`}>
              {branding.agency_name}
            </span>
          )}
        </div>
      </div>
    )
  }

  // Default Magic Teams branding
  return (
    <div className={`flex items-center gap-2 ${className}`}>
      <Image
        src="/magic.png"
        alt="Magic Teams"
        width={width}
        height={height}
        className="rounded"
        onError={(e) => {
          // Fallback to icon on error
          const target = e.target as HTMLImageElement
          target.style.display = 'none'
          const fallback = target.nextElementSibling as HTMLElement
          if (fallback) {
            fallback.style.display = 'flex'
          }
        }}
      />
      <div className="hidden items-center gap-2">
        <Icon name="sparkles" className="text-muted-foreground" style={{ width, height }} />
        {showText && (
          <span className={`font-semibold ${textClass}`}>
            {branding?.agency_name || 'Magic Teams'}
          </span>
        )}
      </div>
    </div>
  )
}
