import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/utils/supabase/server';

// Use sandbox or production URL based on env var
const XPAY_BASE_URL = process.env.XPAY_BASE_URL || 'https://api.xpaycheckout.com';
const CREATE_INTENT_ENDPOINT = `${XPAY_BASE_URL}/payments/create-intent`;

/**
 * POST /api/xpay/create-intent
 * Creates an xPay payment intent for purchasing minutes
 * 
 * Required env vars:
 * - XPAY_API_KEY: xPay API key (username)
 * - XPAY_API_SECRET: xPay API secret (password)
 * - NEXT_PUBLIC_APP_URL: Base URL for callbacks
 * - XPAY_BASE_URL: (optional) Use sandbox URL for testing
 */
export async function POST(request: NextRequest) {
    try {
        const body = await request.json();
        const { packageId, userId } = body;

        if (!packageId || !userId) {
            return NextResponse.json(
                { success: false, error: 'Missing packageId or userId' },
                { status: 400 }
            );
        }

        console.log(`[xPay] Creating intent for package: ${packageId}, user: ${userId}`);

        // Validate xPay credentials
        const xpayApiKey = process.env.XPAY_API_KEY;
        const xpayApiSecret = process.env.XPAY_API_SECRET;
        const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';

        if (!xpayApiKey || !xpayApiSecret) {
            console.error('[xPay] ❌ Missing xPay API credentials');
            return NextResponse.json(
                { success: false, error: 'Payment system not configured' },
                { status: 500 }
            );
        }

        // Fetch user and package details
        const supabase = await createClient();

        // Get user details
        const { data: { user }, error: userError } = await supabase.auth.getUser();
        if (userError || !user || user.id !== userId) {
            console.error('[xPay] ❌ User authentication failed:', userError);
            return NextResponse.json(
                { success: false, error: 'Authentication failed' },
                { status: 401 }
            );
        }

        // Get package details
        const { data: pkg, error: pkgError } = await supabase
            .from('minute_packages')
            .select('*')
            .eq('id', packageId)
            .eq('is_active', true)
            .single();

        if (pkgError || !pkg) {
            console.error('[xPay] ❌ Package not found:', pkgError);
            return NextResponse.json(
                { success: false, error: 'Package not found' },
                { status: 404 }
            );
        }

        // Generate a unique receipt ID for this transaction
        const receiptId = `mt_${userId.slice(0, 8)}_${packageId}_${Date.now()}`;

        // Create xPay payment intent payload
        const xpayPayload = {
            amount: pkg.price_cents, // Amount in cents
            currency: pkg.currency || 'USD',
            customerDetails: {
                name: user.user_metadata?.name || user.email?.split('@')[0] || 'Customer',
                email: user.email,
            },
            callbackUrl: `${appUrl}/dashboard/buy-minutes/success`,
            cancelUrl: `${appUrl}/dashboard/buy-minutes?cancelled=true`,
            receiptId: receiptId,
            description: `${pkg.name} - ${pkg.minutes} calling minutes`,
            paymentMethods: ['CARD', 'GOOGLE_PAY', 'APPLE_PAY'],
            metadata: {
                userId: userId,
                packageId: packageId,
                packageName: pkg.name,
                minutes: String(pkg.minutes),
            },
            phoneNumberRequired: false,
        };

        // Create Basic Auth header
        const authString = Buffer.from(`${xpayApiKey}:${xpayApiSecret}`).toString('base64');

        console.log('[xPay] Sending create-intent request to:', CREATE_INTENT_ENDPOINT);

        const xpayResponse = await fetch(CREATE_INTENT_ENDPOINT, {
            method: 'POST',
            headers: {
                'Authorization': `Basic ${authString}`,
                'Content-Type': 'application/json',
                'Idempotency-Key': receiptId,
            },
            body: JSON.stringify(xpayPayload),
        });

        const xpayData = await xpayResponse.json();

        if (!xpayResponse.ok) {
            console.error('[xPay] ❌ API error:', xpayData);
            return NextResponse.json(
                { success: false, error: xpayData.message || 'Payment initialization failed' },
                { status: xpayResponse.status }
            );
        }

        console.log('[xPay] ✅ Intent created:', xpayData.xIntentId);

        // Store the transaction in the database (pending status)
        const { error: txError } = await supabase
            .from('payment_transactions')
            .insert({
                user_id: userId,
                package_id: packageId,
                x_intent_id: xpayData.xIntentId,
                status: 'pending',
                amount_cents: pkg.price_cents,
                currency: pkg.currency || 'USD',
            });

        if (txError) {
            console.error('[xPay] ⚠️ Failed to store transaction:', txError);
            // Don't fail the request - transaction can still proceed
        }

        return NextResponse.json({
            success: true,
            url: xpayData.fwdUrl,
            intentId: xpayData.xIntentId,
        });

    } catch (error: any) {
        console.error('[xPay] ❌ Unexpected error:', error);
        return NextResponse.json(
            { success: false, error: error.message || 'Internal server error' },
            { status: 500 }
        );
    }
}
