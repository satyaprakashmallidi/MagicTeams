import { supabase } from '@/lib/supabase';

/**
 * Unified Minute Balance Service
 * Handles both user types:
 * - Type 1: Agency Sub-Users (White Label) - Read from agency_users table
 * - Type 2: Direct Buyers (app.magicteams.ai) - Read from pricing table
 */

export interface BalanceResult {
  balance: number;          // Total available balance in seconds (Agency + Direct)
  agencyBalance: number;    // Agency balance in seconds
  directBalance: number;    // Direct balance in seconds

  // Metadata
  agencyTotal?: number;     // Total allocated agency minutes
  agencyUsed?: number;      // Used agency minutes

  userType: 'agency' | 'direct' | 'both';
  costPerMinute?: number;   // Cost per minute in USD
}

export interface DeductResult {
  success: boolean;
  newBalance: number;       // New total balance in seconds
  newAgencyBalance: number; // New agency balance in seconds
  newDirectBalance: number; // New direct balance in seconds
  deductedFrom: 'agency' | 'direct' | 'none';
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
        return {
          balance: 0,
          agencyBalance: 0,
          directBalance: 0,
          userType: 'direct'
        };
      }

      const agencyId = user.user_metadata?.agency_id;

      // Initialize balances
      let agencyBalance = 0;
      let directBalance = 0;
      let agencyTotal = 0;
      let agencyUsed = 0;
      let costPerMinute = 0.02;
      let hasAgency = false;

      // 1. Fetch Agency Balance (if applicable)
      if (agencyId) {
        hasAgency = true; // User belongs to an agency
        console.log(`[MinuteBalance] Fetching balance for agency user. Agency ID: ${agencyId}`);

        const { data: agencyUser, error } = await supabase
          .from('agency_users')
          .select('total_minutes, used_minutes, markup_per_min')
          .eq('user_id', userId)
          .eq('agency_id', agencyId)
          .single();

        if (!error && agencyUser) {
          const agencyMinutesRemaining = agencyUser.total_minutes - agencyUser.used_minutes;
          agencyBalance = Math.max(0, agencyMinutesRemaining * 60); // Convert to seconds
          agencyTotal = agencyUser.total_minutes;
          agencyUsed = agencyUser.used_minutes;
          costPerMinute = agencyUser.markup_per_min ? agencyUser.markup_per_min / 100 : 0.02;

          console.log(`[MinuteBalance] Agency balance: ${agencyMinutesRemaining} min (${agencyBalance} sec)`);
        } else {
          console.warn('[MinuteBalance] Agency user check failed or not found:', error);
        }
      }

      // 2. Fetch Direct Balance (Always check for everyone)
      console.log('[MinuteBalance] Fetching balance for direct buyer');
      const { data: pricing, error: pricingError } = await supabase
        .from('pricing')
        .select('time_rem, cost')
        .eq('user_id', userId)
        .single();

      if (!pricingError && pricing) {
        directBalance = Math.max(0, pricing.time_rem);
        // Use direct cost if no agency cost set (or override? usually agency cost wins for agency users)
        if (!hasAgency) {
          costPerMinute = pricing.cost || 0.02;
        }
        console.log(`[MinuteBalance] Direct buyer balance: ${pricing.time_rem} seconds`);
      } else if (pricingError && pricingError.code === 'PGRST116') {
        // Create default pricing if missing
        console.log('[MinuteBalance] Creating default pricing entry');
        const { data: newPricing } = await supabase
          .from('pricing')
          .insert({
            user_id: userId,
            time_rem: 300, // 5 minutes default
            is_twilio_allowed: false,
            cost: 0.02
          })
          .select('time_rem, cost')
          .single();

        if (newPricing) {
          directBalance = newPricing.time_rem;
          if (!hasAgency) costPerMinute = newPricing.cost || 0.02;
        }
      }

      // Determine user type
      let userType: 'agency' | 'direct' | 'both' = 'direct';
      if (hasAgency) {
        userType = 'both'; // Agency users should see both balances (Agency + Direct Fallback)
      }

      return {
        balance: agencyBalance + directBalance,
        agencyBalance,
        directBalance,
        agencyTotal,
        agencyUsed,
        userType,
        costPerMinute
      };

    } catch (error) {
      console.error('[MinuteBalance] Unexpected error in getBalance:', error);
      return {
        balance: 0,
        agencyBalance: 0,
        directBalance: 0,
        userType: 'direct'
      };
    }
  }

  /**
   * Deduct minutes after call ends
   * Priority: Agency -> Direct
   * Strategy: Atomic Deduction (No splitting)
   */
  static async deductMinutes(
    userId: string,
    secondsUsed: number
  ): Promise<DeductResult> {
    try {
      console.log(`[MinuteBalance] Deducting ${secondsUsed} seconds for user ${userId}`);

      // Get current balances first to decide where to deduct from
      const currentStatus = await this.getBalance(userId);
      const minutesUsed = Math.ceil(secondsUsed / 60);

      const { data: { user } } = await supabase.auth.getUser();
      const agencyId = user?.user_metadata?.agency_id;

      // ========================================
      // STRATEGY: TRY AGENCY FIRST
      // ========================================
      if (agencyId && currentStatus.agencyBalance >= secondsUsed) {
        console.log('[MinuteBalance] ✅ Deducting from AGENCY balance');

        // Fetch fresh agency record to be safe
        const { data: currentAgency, error: fetchError } = await supabase
          .from('agency_users')
          .select('total_minutes, used_minutes')
          .eq('user_id', userId)
          .eq('agency_id', agencyId)
          .single();

        if (fetchError || !currentAgency) {
          return {
            success: false,
            newBalance: currentStatus.balance,
            newAgencyBalance: currentStatus.agencyBalance,
            newDirectBalance: currentStatus.directBalance,
            deductedFrom: 'none',
            error: 'Failed to fetch agency balance'
          };
        }

        const newUsedMinutes = currentAgency.used_minutes + minutesUsed;

        const { data: updatedAgency, error: updateError } = await supabase
          .from('agency_users')
          .update({ used_minutes: newUsedMinutes })
          .eq('user_id', userId)
          .eq('agency_id', agencyId)
          .select('total_minutes, used_minutes')
          .single();

        if (updateError || !updatedAgency) {
          return {
            success: false,
            newBalance: currentStatus.balance,
            newAgencyBalance: currentStatus.agencyBalance,
            newDirectBalance: currentStatus.directBalance,
            deductedFrom: 'none',
            error: 'Failed to update agency balance'
          };
        }

        const newAgencyBalance = Math.max(0, (updatedAgency.total_minutes - updatedAgency.used_minutes) * 60);

        // Sync to Whitelabel DB
        this.syncToWhitelabel(agencyId, userId).catch(console.warn);

        return {
          success: true,
          newBalance: newAgencyBalance + currentStatus.directBalance,
          newAgencyBalance,
          newDirectBalance: currentStatus.directBalance,
          deductedFrom: 'agency'
        };
      }

      // ========================================
      // FALLBACK: TRY DIRECT BALANCE
      // ========================================
      if (currentStatus.directBalance >= secondsUsed) {
        console.log('[MinuteBalance] ⚠️ Agency insufficient/missing. Deducting from DIRECT balance');

        const { data: currentDirect, error: fetchDirectError } = await supabase
          .from('pricing')
          .select('time_rem')
          .eq('user_id', userId)
          .single();

        if (fetchDirectError || !currentDirect) {
          return {
            success: false,
            newBalance: currentStatus.balance,
            newAgencyBalance: currentStatus.agencyBalance,
            newDirectBalance: currentStatus.directBalance,
            deductedFrom: 'none',
            error: 'Failed to fetch direct balance'
          };
        }

        const newDirectBalance = Math.max(0, currentDirect.time_rem - secondsUsed);

        const { error: updateDirectError } = await supabase
          .from('pricing')
          .update({ time_rem: newDirectBalance })
          .eq('user_id', userId);

        if (updateDirectError) {
          return {
            success: false,
            newBalance: currentStatus.balance,
            newAgencyBalance: currentStatus.agencyBalance,
            newDirectBalance: currentStatus.directBalance,
            deductedFrom: 'none',
            error: 'Failed to update direct balance'
          };
        }

        return {
          success: true,
          newBalance: currentStatus.agencyBalance + newDirectBalance,
          newAgencyBalance: currentStatus.agencyBalance,
          newDirectBalance: newDirectBalance,
          deductedFrom: 'direct'
        };
      }

      // ========================================
      // FAILURE: INSUFFICIENT FUNDS EVERYWHERE
      // ========================================
      console.error('[MinuteBalance] ❌ Insufficient balance in both Agency and Direct');
      return {
        success: false,
        newBalance: currentStatus.balance,
        newAgencyBalance: currentStatus.agencyBalance,
        newDirectBalance: currentStatus.directBalance,
        deductedFrom: 'none',
        error: `Insufficient minutes. Required: ${minutesUsed} min. Available: Agency (${Math.floor(currentStatus.agencyBalance / 60)}m), Direct (${Math.floor(currentStatus.directBalance / 60)}m)`
      };

    } catch (error) {
      console.error('[MinuteBalance] Unexpected error in deductMinutes:', error);
      return {
        success: false,
        newBalance: 0,
        newAgencyBalance: 0,
        newDirectBalance: 0,
        deductedFrom: 'none',
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
    // Note: This function's return type signature changed to match DeductResult
    // But for now, we'll keep the logic simple and just return what's needed or refactor if used heavily.
    // Given the scope, I'll update it to return the new structure but keep logic similar.

    try {
      console.log(`[MinuteBalance] Adding ${minutesToAdd} minutes for user ${userId}`);
      const { data: { user } } = await supabase.auth.getUser();
      const agencyId = user?.user_metadata?.agency_id;

      if (agencyId) {
        // Add to Agency
        const { data: current } = await supabase
          .from('agency_users')
          .select('total_minutes, used_minutes')
          .eq('user_id', userId)
          .eq('agency_id', agencyId)
          .single();

        if (current) {
          const newTotal = current.total_minutes + minutesToAdd;
          await supabase
            .from('agency_users')
            .update({ total_minutes: newTotal })
            .eq('user_id', userId)
            .eq('agency_id', agencyId);

          // Return updated state
          return this.deductMinutes(userId, 0); // Hack to get fresh state without deduction
        }
      } else {
        // Add to Direct
        const { data: current } = await supabase
          .from('pricing')
          .select('time_rem')
          .eq('user_id', userId)
          .single();

        if (current) {
          const newBalance = current.time_rem + (minutesToAdd * 60);
          await supabase
            .from('pricing')
            .update({ time_rem: newBalance })
            .eq('user_id', userId);

          return this.deductMinutes(userId, 0); // Hack to get fresh state
        }
      }

      return { success: false, newBalance: 0, newAgencyBalance: 0, newDirectBalance: 0, deductedFrom: 'none', error: 'Failed to add minutes' };

    } catch (error) {
      return { success: false, newBalance: 0, newAgencyBalance: 0, newDirectBalance: 0, deductedFrom: 'none', error: 'Unknown error' };
    }
  }

  private static async syncToWhitelabel(agencyId: string, userId: string) {
    try {
      const backendUrl = process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:5000';
      await fetch(`${backendUrl}/api/sync/minutes-to-whitelabel`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ agencyId, userId })
      });
    } catch (e) {
      console.warn('[MinuteBalance] Sync warning:', e);
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
