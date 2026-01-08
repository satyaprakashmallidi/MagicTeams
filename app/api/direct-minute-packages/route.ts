import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/utils/supabase/server';

/**
 * GET /api/direct-minute-packages
 * Fetch minute packages available for direct purchase
 * Uses the new minute_packages table with xPay integration
 */
export async function GET(request: NextRequest) {
  try {
    console.log('[DirectPackages] Fetching minute packages...');

    const supabase = await createClient();

    const { data: packages, error } = await supabase
      .from('minute_packages')
      .select('id, name, description, minutes, price_cents, currency, is_active, sort_order')
      .eq('is_active', true)
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

    // Transform packages to match frontend expected format
    const transformedPackages = packages?.map(pkg => ({
      id: pkg.id,
      name: pkg.name,
      description: pkg.description,
      minutes: pkg.minutes,
      price_usd: pkg.price_cents / 100, // Convert cents to dollars
      price_cents: pkg.price_cents,
      currency: pkg.currency,
      is_active: pkg.is_active,
      sort_order: pkg.sort_order
    })) || [];

    console.log(`[DirectPackages] ✅ Found ${transformedPackages.length} packages`);

    return NextResponse.json({
      success: true,
      packages: transformedPackages
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
