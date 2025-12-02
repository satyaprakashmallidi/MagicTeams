import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

// Whitelabel Supabase client (for packages catalog)
const whitelabelSupabase = createClient(
  process.env.NEXT_WHITELABEL_SUPABASE_URL!,
  process.env.NEXT_WHITELABEL_SUPABASE_SERVICE_KEY!
);

/**
 * GET /api/direct-minute-packages
 * Fetch minute packages available for direct users
 *
 * Returns: Array of packages with package_type='direct'
 */
export async function GET(request: NextRequest) {
  try {
    console.log('[DirectPackages] Fetching direct user packages...');

    const { data: packages, error } = await whitelabelSupabase
      .from('minute_packages')
      .select('*')
      .eq('is_active', true)
      .eq('package_type', 'direct')
      .order('sort_order', { ascending: true });

    if (error) {
      console.error('[DirectPackages] ❌ Error fetching packages:', error);
      return NextResponse.json(
        {
          success: false,
          error: 'Failed to fetch minute packages'
        },
        { status: 500 }
      );
    }

    console.log(`[DirectPackages] ✅ Found ${packages?.length || 0} packages`);

    return NextResponse.json({
      success: true,
      packages: packages || []
    });

  } catch (error: any) {
    console.error('[DirectPackages] ❌ Unexpected error:', error);
    return NextResponse.json(
      {
        success: false,
        error: error.message
      },
      { status: 500 }
    );
  }
}
