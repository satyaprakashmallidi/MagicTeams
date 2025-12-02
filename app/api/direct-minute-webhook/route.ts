import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import Stripe from 'stripe';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: '2025-10-29.clover',
});

const webhookSecret = process.env.STRIPE_DIRECT_MINUTE_WEBHOOK_SECRET!;

// Jenny Supabase (for updating balances)
const jennySupabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

/**
 * POST /api/direct-minute-webhook
 * Handle Stripe webhook events for direct minute purchases
 *
 * This endpoint receives payment confirmations from Stripe and
 * adds purchased minutes to user's balance in pricing.time_rem
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.text();
    const signature = request.headers.get('stripe-signature');

    if (!signature) {
      console.error('[DirectWebhook] ❌ Missing signature');
      return NextResponse.json(
        { error: 'Missing signature' },
        { status: 400 }
      );
    }

    // ============================================
    // STEP 1: Verify webhook signature
    // ============================================
    let event: Stripe.Event;

    try {
      event = stripe.webhooks.constructEvent(body, signature, webhookSecret);
    } catch (err: any) {
      console.error('[DirectWebhook] ❌ Signature verification failed:', err.message);
      return NextResponse.json(
        { error: `Webhook Error: ${err.message}` },
        { status: 400 }
      );
    }

    console.log('[DirectWebhook] ========================================');
    console.log('[DirectWebhook] Received event:', event.type);

    // ============================================
    // STEP 2: Handle checkout.session.completed
    // ============================================
    if (event.type === 'checkout.session.completed') {
      const session = event.data.object as Stripe.Checkout.Session;

      console.log('[DirectWebhook] Processing payment success');
      console.log('[DirectWebhook] Session ID:', session.id);

      const {
        user_id,
        user_email,
        package_name,
        minutes,
        transaction_type
      } = session.metadata || {};

      if (!user_id || !minutes) {
        console.error('[DirectWebhook] ❌ Missing metadata');
        return NextResponse.json({ error: 'Missing metadata' }, { status: 400 });
      }

      const minutesToAdd = parseInt(minutes);
      const secondsToAdd = minutesToAdd * 60; // Convert to seconds
      const amountPaid = (session.amount_total || 0) / 100;

      console.log('[DirectWebhook] User:', user_email);
      console.log('[DirectWebhook] User ID:', user_id);
      console.log('[DirectWebhook] Package:', package_name);
      console.log('[DirectWebhook] Minutes:', minutesToAdd);
      console.log('[DirectWebhook] Seconds to add:', secondsToAdd);
      console.log('[DirectWebhook] Amount paid: $', amountPaid);

      // ============================================
      // STEP 3: Get current balance
      // ============================================
      console.log('[DirectWebhook] Fetching pricing for user_id:', user_id);

      const { data: currentPricing, error: fetchError } = await jennySupabase
        .from('pricing')
        .select('time_rem, user_id')
        .eq('user_id', user_id)
        .single();

      if (fetchError) {
        console.error('[DirectWebhook] ❌ Error fetching pricing:', fetchError);

        // If user doesn't exist in pricing table, create entry
        if (fetchError.code === 'PGRST116') {
          console.log('[DirectWebhook] Creating new pricing entry for user');
          console.log('[DirectWebhook] User ID from metadata:', user_id);

          const { error: insertError } = await jennySupabase
            .from('pricing')
            .insert({
              user_id: user_id,
              time_rem: secondsToAdd,
              is_twilio_allowed: true,
              cost: 0  // bigint - use 0 to match existing entries
            });

          if (insertError) {
            console.error('[DirectWebhook] ❌ Error creating pricing entry:', insertError);
            return NextResponse.json({ error: 'Database error' }, { status: 500 });
          }

          console.log('[DirectWebhook] ✅ Created new pricing entry with', secondsToAdd, 'seconds');
          console.log('[DirectWebhook] ========================================');

          return NextResponse.json({ received: true });
        }

        return NextResponse.json({ error: 'Database error' }, { status: 500 });
      }

      const currentBalance = currentPricing?.time_rem || 0;
      const newBalance = currentBalance + secondsToAdd;

      console.log('[DirectWebhook] Current balance:', currentBalance, 'seconds');
      console.log('[DirectWebhook] New balance:', newBalance, 'seconds');

      // ============================================
      // STEP 4: Update balance
      // ============================================
      const { error: updateError } = await jennySupabase
        .from('pricing')
        .update({
          time_rem: newBalance
        })
        .eq('user_id', user_id);

      if (updateError) {
        console.error('[DirectWebhook] ❌ Error updating balance:', updateError);
        return NextResponse.json({ error: 'Database error' }, { status: 500 });
      }

      console.log('[DirectWebhook] ✅ Minutes added successfully!');
      console.log('[DirectWebhook] User now has:', newBalance, 'seconds (',Math.floor(newBalance / 60),'minutes )');
      console.log('[DirectWebhook] ========================================');
    }

    // ============================================
    // STEP 5: Handle other events
    // ============================================
    else if (event.type === 'payment_intent.payment_failed') {
      const paymentIntent = event.data.object as Stripe.PaymentIntent;
      console.log('[DirectWebhook] ❌ Payment failed:', paymentIntent.id);
      console.log('[DirectWebhook] Failure message:', paymentIntent.last_payment_error?.message);
    }

    return NextResponse.json({ received: true });

  } catch (error: any) {
    console.error('[DirectWebhook] ❌ Unexpected error:', error);
    return NextResponse.json(
      { error: 'Webhook processing failed' },
      { status: 500 }
    );
  }
}
