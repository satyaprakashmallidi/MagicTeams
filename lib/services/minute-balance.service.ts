import { supabase } from '@/lib/supabase';

/**
 * Unified Minute Balance Service
 * Handles both user types:
 * - Type 1: Agency Sub-Users (White Label) - Read from agency_users table
 * - Type 2: Direct Buyers (app.magicteams.ai) - Read from pricing table
 */

export interface BalanceResult {
  balance: number;          // Remaining seconds
  total?: number;           // Total allocated minutes (Type 1 only)
  used?: number;            // Used minutes (Type 1 only)
  userType: 'agency' | 'direct';
  costPerMinute?: number;   // Cost per minute in USD
}

export interface DeductResult {
  success: boolean;
  newBalance: number;       // New balance in seconds
  error?: string;
}

export class MinuteBalanceService {
  /**
   * Get remaining balance for any user type
   * Returns balance in SECONDS for consistency with existing code
   */
  static async getBalance(userId: string): Promise<BalanceResult> {
    try {
      // Get user metadata to determine type
      const { data: { user }, error: userError } = await supabase.auth.getUser();

      if (userError || !user) {
        console.error('[MinuteBalance] Error fetching user:', userError);
        return { balance: 0, userType: 'direct' };
      }

      const agencyId = user.user_metadata?.agency_id;

      if (agencyId) {
        // ========================================
        // TYPE 1: AGENCY SUB-USER (White Label)
        // Only uses agency allocated minutes
        // ========================================
        console.log(`[MinuteBalance] Fetching balance for agency user. Agency ID: ${agencyId}`);

        // Fetch agency allocated minutes
        const { data: agencyUser, error } = await supabase
          .from('agency_users')
          .select('total_minutes, used_minutes, markup_per_min')
          .eq('user_id', userId)
          .eq('agency_id', agencyId)
          .single();

        if (error) {
          console.error('[MinuteBalance] Error fetching agency_users:', error);
          if (error.code === 'PGRST116') {
            console.warn('[MinuteBalance] Agency user not found in agency_users table');
          }
          return { balance: 0, userType: 'agency', costPerMinute: 0.02 };
        }

        if (!agencyUser) {
          console.warn('[MinuteBalance] No agency user data found');
          return { balance: 0, userType: 'agency', costPerMinute: 0.02 };
        }

        const agencyMinutesRemaining = agencyUser.total_minutes - agencyUser.used_minutes;
        const agencyBalance = Math.max(0, agencyMinutesRemaining * 60); // Convert to seconds
        const costPerMin = agencyUser.markup_per_min ? agencyUser.markup_per_min / 100 : 0.02;

        console.log(`[MinuteBalance] Agency balance: ${agencyMinutesRemaining} min (${agencyBalance} sec)`);

        return {
          balance: agencyBalance,
          total: agencyUser.total_minutes,
          used: agencyUser.used_minutes,
          userType: 'agency',
          costPerMinute: costPerMin
        };

      } else {
        // ========================================
        // TYPE 2: DIRECT BUYER (app.magicteams.ai)
        // ========================================
        console.log('[MinuteBalance] Fetching balance for direct buyer');

        const { data: pricing, error } = await supabase
          .from('pricing')
          .select('time_rem, cost')
          .eq('user_id', userId)
          .single();

        if (error) {
          console.error('[MinuteBalance] Error fetching pricing:', error);

          // If pricing entry doesn't exist, create default one
          if (error.code === 'PGRST116') {
            console.log('[MinuteBalance] Creating default pricing entry');

            const { data: newPricing, error: insertError } = await supabase
              .from('pricing')
              .insert({
                user_id: userId,
                time_rem: 300, // 5 minutes default
                is_twilio_allowed: false,
                cost: 0.02
              })
              .select('time_rem, cost')
              .single();

            if (insertError) {
              console.error('[MinuteBalance] Error creating pricing entry:', insertError);
              return { balance: 300, userType: 'direct', costPerMinute: 0.02 };
            }

            return {
              balance: newPricing.time_rem,
              userType: 'direct',
              costPerMinute: newPricing.cost || 0.02
            };
          }

          return { balance: 0, userType: 'direct', costPerMinute: 0.02 };
        }

        if (!pricing) {
          console.warn('[MinuteBalance] No pricing data found');
          return { balance: 300, userType: 'direct', costPerMinute: 0.02 };
        }

        console.log(`[MinuteBalance] Direct buyer balance: ${pricing.time_rem} seconds`);

        return {
          balance: Math.max(0, pricing.time_rem),
          userType: 'direct',
          costPerMinute: pricing.cost || 0.02
        };
      }
    } catch (error) {
      console.error('[MinuteBalance] Unexpected error in getBalance:', error);
      return { balance: 0, userType: 'direct' };
    }
  }

  /**
   * Deduct minutes after call ends
   * Handles both user types automatically
   */
  static async deductMinutes(
    userId: string,
    secondsUsed: number
  ): Promise<DeductResult> {
    try {
      console.log(`[MinuteBalance] Deducting ${secondsUsed} seconds for user ${userId}`);

      // Get user metadata to determine type
      const { data: { user }, error: userError } = await supabase.auth.getUser();

      if (userError || !user) {
        console.error('[MinuteBalance] Error fetching user for deduction:', userError);
        return { success: false, newBalance: 0, error: 'User not found' };
      }

      const agencyId = user.user_metadata?.agency_id;

      if (agencyId) {
        // ========================================
        // TYPE 1: AGENCY SUB-USER (Priority Deduction)
        // Deduct from agency balance first, then fall back to direct balance
        // ========================================
        console.log(`[MinuteBalance] Deducting from agency user. Agency ID: ${agencyId}`);

        // Step 1: Fetch current agency balance
        const { data: current, error: fetchError } = await supabase
          .from('agency_users')
          .select('total_minutes, used_minutes')
          .eq('user_id', userId)
          .eq('agency_id', agencyId)
          .single();

        if (fetchError || !current) {
          console.error('[MinuteBalance] Error fetching current agency user:', fetchError);
          return { success: false, newBalance: 0, error: 'Failed to fetch current balance' };
        }

        const minutesUsed = Math.ceil(secondsUsed / 60);
        const agencyRemainingMinutes = current.total_minutes - current.used_minutes;

        console.log(`[MinuteBalance] 💰 Agency balance: ${agencyRemainingMinutes} min, Need: ${minutesUsed} min`);

        // Step 2: Try to deduct from agency balance first
        if (agencyRemainingMinutes >= minutesUsed) {
          // ✅ Enough agency minutes - deduct from agency only
          console.log('[MinuteBalance] ✅ Deducting from agency balance only');

          const newUsedMinutes = current.used_minutes + minutesUsed;

          const { data: updated, error: updateError } = await supabase
            .from('agency_users')
            .update({ used_minutes: newUsedMinutes })
            .eq('user_id', userId)
            .eq('agency_id', agencyId)
            .select('total_minutes, used_minutes')
            .single();

          if (updateError || !updated) {
            console.error('[MinuteBalance] Error updating agency_users:', updateError);
            return { success: false, newBalance: 0, error: 'Failed to update balance' };
          }

          const remainingMinutes = updated.total_minutes - updated.used_minutes;
          const newBalance = Math.max(0, remainingMinutes * 60);

          console.log(`[MinuteBalance] Agency user updated. New balance: ${remainingMinutes} minutes`);

          // ⭐ Sync to Whitelabel DB for dashboard accuracy
          try {
            const backendUrl = process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:5000';
            console.log(`[MinuteBalance] Syncing to whitelabel DB: ${backendUrl}/api/sync/minutes-to-whitelabel`);

            const syncResponse = await fetch(`${backendUrl}/api/sync/minutes-to-whitelabel`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ agencyId, userId })
            });

            if (syncResponse.ok) {
              const syncData = await syncResponse.json();
              console.log('[MinuteBalance] ✅ Synced to whitelabel successfully:', syncData.stats);
            } else {
              const errorText = await syncResponse.text();
              console.warn('[MinuteBalance] ⚠️ Sync failed but continuing:', errorText);
            }
          } catch (syncError) {
            console.warn('[MinuteBalance] ⚠️ Sync error (non-critical):', syncError);
          }

          return { success: true, newBalance };

        } else {
          // ❌ Insufficient agency minutes - FAIL (no fallback to direct)
          console.error('[MinuteBalance] ❌ Insufficient agency balance');
          console.log(`[MinuteBalance] Available: ${agencyRemainingMinutes} min, Required: ${minutesUsed} min`);

          return {
            success: false,
            newBalance: agencyRemainingMinutes * 60, // Return current balance in seconds
            error: `Insufficient agency minutes. You need ${minutesUsed} minutes but only have ${agencyRemainingMinutes} minutes. Please contact your agency administrator.`
          };
        }

      } else {
        // ========================================
        // TYPE 2: DIRECT BUYER
        // ========================================
        console.log('[MinuteBalance] Deducting from direct buyer');

        // Step 1: Fetch current balance
        const { data: current, error: fetchError } = await supabase
          .from('pricing')
          .select('time_rem')
          .eq('user_id', userId)
          .single();

        if (fetchError || !current) {
          console.error('[MinuteBalance] Error fetching current pricing:', fetchError);
          return { success: false, newBalance: 0, error: 'Failed to fetch current balance' };
        }

        // Step 2: Calculate new balance
        const newBalance = Math.max(0, current.time_rem - secondsUsed);

        // Check if user has enough time
        if (newBalance === 0 && current.time_rem < secondsUsed) {
          console.warn('[MinuteBalance] Insufficient time for deduction');
        }

        // Step 3: Update database
        const { error: updateError } = await supabase
          .from('pricing')
          .update({ time_rem: newBalance })
          .eq('user_id', userId);

        if (updateError) {
          console.error('[MinuteBalance] Error updating pricing:', updateError);
          return { success: false, newBalance: 0, error: 'Failed to update balance' };
        }

        console.log(`[MinuteBalance] Direct buyer updated. New balance: ${newBalance} seconds`);

        return { success: true, newBalance };
      }
    } catch (error) {
      console.error('[MinuteBalance] Unexpected error in deductMinutes:', error);
      return {
        success: false,
        newBalance: 0,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  /**
   * Add minutes (admin/purchase operation)
   * Used when agency owner allocates or user purchases directly
   */
  static async addMinutes(
    userId: string,
    minutesToAdd: number
  ): Promise<DeductResult> {
    try {
      console.log(`[MinuteBalance] Adding ${minutesToAdd} minutes for user ${userId}`);

      // Get user metadata to determine type
      const { data: { user }, error: userError } = await supabase.auth.getUser();

      if (userError || !user) {
        console.error('[MinuteBalance] Error fetching user for addition:', userError);
        return { success: false, newBalance: 0, error: 'User not found' };
      }

      const agencyId = user.user_metadata?.agency_id;

      if (agencyId) {
        // ========================================
        // TYPE 1: AGENCY SUB-USER
        // ========================================
        console.log(`[MinuteBalance] Adding minutes to agency user. Agency ID: ${agencyId}`);

        // Fetch current balance
        const { data: current, error: fetchError } = await supabase
          .from('agency_users')
          .select('total_minutes, used_minutes')
          .eq('user_id', userId)
          .eq('agency_id', agencyId)
          .single();

        if (fetchError || !current) {
          console.error('[MinuteBalance] Error fetching agency user for addition:', fetchError);
          return { success: false, newBalance: 0, error: 'Failed to fetch current balance' };
        }

        const newTotal = current.total_minutes + minutesToAdd;

        const { data: updated, error: updateError } = await supabase
          .from('agency_users')
          .update({ total_minutes: newTotal })
          .eq('user_id', userId)
          .eq('agency_id', agencyId)
          .select('total_minutes, used_minutes')
          .single();

        if (updateError || !updated) {
          console.error('[MinuteBalance] Error updating agency_users for addition:', updateError);
          return { success: false, newBalance: 0, error: 'Failed to add minutes' };
        }

        const remaining = (updated.total_minutes - updated.used_minutes) * 60;
        console.log(`[MinuteBalance] Minutes added to agency user. New total: ${updated.total_minutes} minutes`);

        return { success: true, newBalance: remaining };

      } else {
        // ========================================
        // TYPE 2: DIRECT BUYER
        // ========================================
        console.log('[MinuteBalance] Adding minutes to direct buyer');

        const { data: current, error: fetchError } = await supabase
          .from('pricing')
          .select('time_rem')
          .eq('user_id', userId)
          .single();

        if (fetchError || !current) {
          console.error('[MinuteBalance] Error fetching pricing for addition:', fetchError);
          return { success: false, newBalance: 0, error: 'Failed to fetch current balance' };
        }

        const newBalance = current.time_rem + (minutesToAdd * 60);

        const { error: updateError } = await supabase
          .from('pricing')
          .update({ time_rem: newBalance })
          .eq('user_id', userId);

        if (updateError) {
          console.error('[MinuteBalance] Error updating pricing for addition:', updateError);
          return { success: false, newBalance: 0, error: 'Failed to add minutes' };
        }

        console.log(`[MinuteBalance] Minutes added to direct buyer. New balance: ${newBalance} seconds`);

        return { success: true, newBalance };
      }
    } catch (error) {
      console.error('[MinuteBalance] Unexpected error in addMinutes:', error);
      return {
        success: false,
        newBalance: 0,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  /**
   * Get user type (helper method)
   */
  static async getUserType(): Promise<'agency' | 'direct' | null> {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return null;

      return user.user_metadata?.agency_id ? 'agency' : 'direct';
    } catch (error) {
      console.error('[MinuteBalance] Error getting user type:', error);
      return null;
    }
  }
}
