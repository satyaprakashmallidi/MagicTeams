import { NextRequest, NextResponse } from 'next/server'
import { createWhitelabelAdminClient } from '@/utils/supabase-whitelabel/server'

/**
 * GET /api/agency-theme?agencyId=xxx
 * Returns the theme_id for an agency
 */
export async function GET(request: NextRequest) {
    try {
        const { searchParams } = new URL(request.url)
        const agencyId = searchParams.get('agencyId')

        if (!agencyId) {
            return NextResponse.json({ error: 'agencyId is required' }, { status: 400 })
        }

        const whitelabelSupabase = await createWhitelabelAdminClient()

        const { data: agency, error } = await whitelabelSupabase
            .from('agencies')
            .select('theme_id, website_title, logo_url')
            .eq('id', agencyId)
            .single()

        if (error) {
            console.error('Error fetching agency theme:', error)
            return NextResponse.json({ error: 'Agency not found' }, { status: 404 })
        }

        return NextResponse.json({
            theme_id: agency?.theme_id || 'blackwhite',
            website_title: agency?.website_title || null,
            logo_url: agency?.logo_url || null
        })
    } catch (error: any) {
        console.error('Error in agency-theme API:', error)
        return NextResponse.json({ error: error.message }, { status: 500 })
    }
}
