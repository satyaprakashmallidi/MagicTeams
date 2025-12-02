import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import Stripe from 'stripe';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: '2025-10-29.clover',
});

// Jenny Supabase (for user data)
const jennySupabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// Whitelabel Supabase (for packages)
const whitelabelSupabase = createClient(
  process.env.NEXT_WHITELABEL_SUPABASE_URL!,
  process.env.NEXT_WHITELABEL_SUPABASE_SERVICE_KEY!
);

/**
 * POST /api/create-direct-checkout
 * Create Stripe checkout session for direct minute purchase
 *
 * Body: { packageId: string, userId: string }
 * Returns: { success: boolean, sessionId: string, url: string }
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { packageId, userId } = body;

    console.log('[DirectCheckout] ========================================');
    console.log('[DirectCheckout] Creating checkout session');
    console.log('[DirectCheckout] User ID:', userId);
    console.log('[DirectCheckout] Package ID:', packageId);

    // ============================================
    // VALIDATION
    // ============================================
    if (!packageId || !userId) {
      console.error('[DirectCheckout] ❌ Missing required fields');
      return NextResponse.json(
        {
          success: false,
          error: 'Package ID and User ID are required'
        },
        { status: 400 }
      );
    }

    // ============================================
    // STEP 1: Get user details
    // ============================================
    const { data: { user }, error: userError } = await jennySupabase.auth.admin.getUserById(userId);

    if (userError || !user) {
      console.error('[DirectCheckout] ❌ User not found:', userError);
      return NextResponse.json(
        {
          success: false,
          error: 'User not found'
        },
        { status: 404 }
      );
    }

    console.log('[DirectCheckout] User found:', user.email);
    console.log('[DirectCheckout] User ID:', userId);

    // ❌ BLOCK: Agency users cannot buy direct minutes
    const agencyId = user.user_metadata?.agency_id;
    if (agencyId) {
      console.error('[DirectCheckout] ❌ Blocked: Agency user cannot purchase direct minutes');
      console.log('[DirectCheckout] Agency ID:', agencyId);
      return NextResponse.json(
        {
          success: false,
          error: 'Agency users cannot purchase minutes directly. Please contact your agency administrator for minute allocation.'
        },
        { status: 403 }
      );
    }

    console.log('[DirectCheckout] ✅ Direct buyer confirmed, proceeding with checkout');

    // ============================================
    // STEP 2: Get package details
    // ============================================
    const { data: packageData, error: packageError } = await whitelabelSupabase
      .from('minute_packages')
      .select('*')
      .eq('id', packageId)
      .eq('is_active', true)
      .eq('package_type', 'direct')
      .single();

    if (packageError || !packageData) {
      console.error('[DirectCheckout] ❌ Package not found:', packageError);
      return NextResponse.json(
        {
          success: false,
          error: 'Package not found or inactive'
        },
        { status: 404 }
      );
    }

    console.log('[DirectCheckout] Package:', packageData.name);
    console.log('[DirectCheckout] Minutes:', packageData.minutes);
    console.log('[DirectCheckout] Price: $', packageData.price_usd);

    // ============================================
    // STEP 4: Create Stripe checkout session
    // ============================================
    const session = await stripe.checkout.sessions.create({
      payment_method_types: ['card'],
      mode: 'payment',
      customer_email: user.email,
      line_items: [
        {
          price_data: {
            currency: 'usd',
            unit_amount: Math.round(packageData.price_usd * 100), // Convert to cents
            product_data: {
              name: packageData.name,
              description: `${packageData.minutes.toLocaleString()} minutes for AI calling on MagicTeams`,
              metadata: {
                package_id: packageData.id,
                minutes: packageData.minutes.toString(),
                package_type: 'direct'
              }
            }
          },
          quantity: 1
        }
      ],
      metadata: {
        user_id: userId,
        user_email: user.email,
        package_id: packageData.id,
        package_name: packageData.name,
        minutes: packageData.minutes.toString(),
        transaction_type: 'direct_minute_purchase'
      },
      success_url: `${process.env.NEXT_PUBLIC_APP_URL}/dashboard/minutes/success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${process.env.NEXT_PUBLIC_APP_URL}/dashboard/buy-minutes?cancelled=true`
    });

    console.log('[DirectCheckout] ✅ Stripe session created:', session.id);
    console.log('[DirectCheckout] ========================================');

    return NextResponse.json({
      success: true,
      sessionId: session.id,
      url: session.url
    });

  } catch (error: any) {
    console.error('[DirectCheckout] ❌ Error:', error);
    return NextResponse.json(
      {
        success: false,
        error: error.message
      },
      { status: 500 }
    );
  }
}
