'use client'

import { useEffect, useState, useRef } from 'react'
import { themes, ThemeConfig } from '@/lib/theme-config'
import { useTheme } from 'next-themes'
import { useBranding } from '@/contexts/branding-context'
import { createClient } from '@/utils/supabase/client'

interface AgencyThemeProviderProps {
    themeId?: string | null
    children: React.ReactNode
}

/**
 * Applies the agency's theme CSS variables to the document
 * This component should be placed inside the ThemeProvider
 * 
 * It works in two modes:
 * 1. Server-side: Uses themeId passed from headers (for /agency routes and custom domains)
 * 2. Client-side: Fetches theme from user's agency_id metadata (for logged-in users on /dashboard)
 */
export function AgencyThemeProvider({ themeId: serverThemeId, children }: AgencyThemeProviderProps) {
    const { resolvedTheme } = useTheme()
    const { branding } = useBranding()
    const [clientThemeId, setClientThemeId] = useState<string | null>(null)

    // Use server-provided themeId, then branding context, then client-fetched themeId
    const activeThemeId = serverThemeId || branding?.theme_id || clientThemeId

    // Helper to update favicon dynamically
    const updateFavicon = (logoUrl: string) => {
        let link = document.querySelector("link[rel~='icon']") as HTMLLinkElement
        if (!link) {
            link = document.createElement('link')
            link.rel = 'icon'
            document.head.appendChild(link)
        }
        link.href = logoUrl
        // Cache for instant load on next visit
        localStorage.setItem('agency-favicon-url', logoUrl)
        console.log('🖼️ Set favicon:', logoUrl)
    }

    // Helper to update title and cache it
    const updateTitle = (title: string) => {
        document.title = title
        // Cache for instant load on next visit
        localStorage.setItem('agency-website-title', title)
        console.log('📝 Set website title:', title)
    }

    // Track if we've already fetched or are currently fetching
    const fetchAttempted = useRef(false)

    // Fetch theme for logged-in users if no theme provided from server/context
    useEffect(() => {
        const fetchUserAgencyTheme = async () => {
            // Skip if we already have a theme or if we've already tried fetching
            if (serverThemeId || branding?.theme_id || clientThemeId || fetchAttempted.current) {
                // But still set the website title and favicon if available from branding
                if (branding?.website_title) {
                    updateTitle(branding.website_title)
                }
                if (branding?.logo_url) {
                    updateFavicon(branding.logo_url)
                }
                return
            }

            try {
                fetchAttempted.current = true
                const supabase = createClient()
                const { data: { user } } = await supabase.auth.getUser()

                if (!user?.user_metadata?.agency_id) {
                    // Clear cache if not an agency user
                    localStorage.removeItem('agency-website-title')
                    localStorage.removeItem('agency-favicon-url')
                    return
                }

                const agencyId = user.user_metadata.agency_id

                // Fetch agency theme, website title, and logo from whitelabel database
                const response = await fetch(`/api/agency-theme?agencyId=${agencyId}`)
                if (response.ok) {
                    const data = await response.json()
                    if (data.theme_id) {
                        setClientThemeId(data.theme_id)
                        console.log('🎨 Fetched agency theme:', data.theme_id)
                    }
                    // Set the document title if website_title is provided
                    if (data.website_title) {
                        updateTitle(data.website_title)
                    }
                    // Set the favicon if logo_url is provided
                    if (data.logo_url) {
                        updateFavicon(data.logo_url)
                    }
                }
            } catch (error) {
                console.error('Error fetching agency theme:', error)
                // Reset fetch attempt on error to allow retrying if needed, 
                // but maybe with a delay or debounce in a real-world scenario.
                // For now, we keep it true to prevent infinite error loops.
            }
        }

        fetchUserAgencyTheme()
    }, [serverThemeId, branding?.theme_id, branding?.website_title, branding?.logo_url, clientThemeId])

    // Apply the theme CSS variables
    useEffect(() => {
        // Check if there's a cached theme in localStorage first
        // This prevents overwriting the theme already applied by the blocking script
        let themeIdToUse = activeThemeId

        if (!themeIdToUse) {
            try {
                const cachedTheme = localStorage.getItem('agency-theme-cache')
                if (cachedTheme) {
                    const parsed = JSON.parse(cachedTheme)
                    themeIdToUse = parsed.id
                }
            } catch (e) {
                // Ignore parsing errors
            }
        }

        // Only default to blackwhite if no theme from any source
        themeIdToUse = themeIdToUse || 'blackwhite'

        // Find the theme config
        const theme = themes.find(t => t.id === themeIdToUse)
        if (!theme) {
            console.warn(`Theme not found: ${themeIdToUse}`)
            return
        }

        // Always use light theme (dark mode not supported)
        const themeVars = theme.light

        // Apply CSS variables to root
        const root = document.documentElement
        Object.entries(themeVars).forEach(([key, value]) => {
            root.style.setProperty(key, value)
        })

        // Cache the theme for instant load on next visit
        localStorage.setItem('agency-theme-cache', JSON.stringify({
            id: theme.id,
            light: theme.light,
            dark: theme.dark
        }))

        console.log(`🎨 Applied agency theme: ${theme.name} (light mode)`)

        // Ensure agency name cache is set (fallback for login page)
        if (!localStorage.getItem('agency-name-cache')) {
            localStorage.setItem('agency-name-cache', 'Magic Teams')
            console.log('🏢 Set default agency name: Magic Teams')
        }

        // Ensure agency favicon is set (fallback)
        if (!localStorage.getItem('agency-favicon-url')) {
            const defaultLogo = 'https://rpkyaierhceljnvkjgai.supabase.co/storage/v1/object/public/agency-logos/692e0d04-9bd1-49c4-ad41-560e35170170/logo_1762769591897.png'
            localStorage.setItem('agency-favicon-url', defaultLogo)
            updateFavicon(defaultLogo)
        }

        // Ensure agency website title is set (fallback)
        if (!localStorage.getItem('agency-website-title')) {
            localStorage.setItem('agency-website-title', 'Magic Teams')
            updateTitle('Magic Teams')
        }

        // Cleanup function to remove custom styles on unmount
        return () => {
            Object.keys(themeVars).forEach(key => {
                root.style.removeProperty(key)
            })
        }
    }, [activeThemeId, resolvedTheme])

    return <>{children}</>
}
