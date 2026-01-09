import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

// Use service role for webhook processing (no user auth context)
const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
);

/**
 * POST /api/xpay/webhook
 * Handles xPay webhook events for payment success/failure
 * 
 * Events handled:
 * - intent.success: Payment completed successfully
 * - intent.failed: Payment failed
 */
export async function POST(request: NextRequest) {
    try {
        const body = await request.json();

        console.log('[xPay Webhook] Received event:', body.eventType, body.intentId);

        const { eventType, intentId, status, amount, currency, metadata, errorCode, paymentMethod } = body;

        if (!intentId) {
            console.error('[xPay Webhook] ❌ Missing intentId');
            return NextResponse.json({ error: 'Missing intentId' }, { status: 400 });
        }

        // Find the transaction by xIntentId
        const { data: transaction, error: txError } = await supabase
            .from('payment_transactions')
            .select('*, minute_packages(*)')
            .eq('x_intent_id', intentId)
            .single();

        if (txError || !transaction) {
            console.error('[xPay Webhook] ❌ Transaction not found:', intentId, txError);
            return NextResponse.json({ error: 'Transaction not found' }, { status: 404 });
        }

        // Handle different event types
        if (eventType === 'intent.success' && status === 'SUCCESS') {
            console.log(`[xPay Webhook] ✅ Payment SUCCESS for intent: ${intentId}`);

            // Update transaction status
            const { error: updateError } = await supabase
                .from('payment_transactions')
                .update({
                    status: 'completed',
                    payment_method: paymentMethod || 'CARD',
                    webhook_event_data: body,
                    completed_at: new Date().toISOString(),
                })
                .eq('x_intent_id', intentId);

            if (updateError) {
                console.error('[xPay Webhook] ❌ Failed to update transaction:', updateError);
                return NextResponse.json({ error: 'Failed to update transaction' }, { status: 500 });
            }

            // Credit minutes to user's account
            const minutesToAdd = transaction.minute_packages?.minutes || 0;
            const secondsToAdd = minutesToAdd * 60;

            // Update pricing table (add seconds to time_rem)
            const { data: existingPricing, error: pricingError } = await supabase
                .from('pricing')
                .select('time_rem')
                .eq('user_id', transaction.user_id)
                .single();

            if (pricingError && pricingError.code !== 'PGRST116') {
                console.error('[xPay Webhook] ❌ Error fetching pricing:', pricingError);
            }

            const currentSeconds = existingPricing?.time_rem || 0;
            const newTotalSeconds = currentSeconds + secondsToAdd;

            const { error: creditError } = await supabase
                .from('pricing')
                .upsert({
                    user_id: transaction.user_id,
                    time_rem: newTotalSeconds,
                }, {
                    onConflict: 'user_id',
                });

            if (creditError) {
                console.error('[xPay Webhook] ❌ Failed to credit minutes:', creditError);
                // Don't fail webhook - transaction is recorded, can manually fix
            } else {
                console.log(`[xPay Webhook] ✅ Credited ${minutesToAdd} minutes (${secondsToAdd}s) to user ${transaction.user_id}`);
            }

            return NextResponse.json({
                success: true,
                message: 'Payment processed successfully',
                minutesCredited: minutesToAdd,
            });

        } else if (eventType === 'intent.failed' && status === 'FAILED') {
            console.log(`[xPay Webhook] ❌ Payment FAILED for intent: ${intentId}, error: ${errorCode}`);

            // Update transaction with failure status
            const { error: updateError } = await supabase
                .from('payment_transactions')
                .update({
                    status: 'failed',
                    error_message: errorCode || 'Payment failed',
                    webhook_event_data: body,
                })
                .eq('x_intent_id', intentId);

            if (updateError) {
                console.error('[xPay Webhook] ❌ Failed to update transaction:', updateError);
            }

            return NextResponse.json({
                success: true,
                message: 'Payment failure recorded',
            });

        } else {
            // Log other events but don't process them
            console.log(`[xPay Webhook] ℹ️ Unhandled event type: ${eventType}`);
            return NextResponse.json({
                success: true,
                message: 'Event acknowledged',
            });
        }

    } catch (error: any) {
        console.error('[xPay Webhook] ❌ Unexpected error:', error);
        return NextResponse.json(
            { error: error.message || 'Internal server error' },
            { status: 500 }
        );
    }
}

// Allow GET for webhook verification (some providers need this)
export async function GET(request: NextRequest) {
    return NextResponse.json({ status: 'ok', message: 'xPay webhook endpoint' });
}
