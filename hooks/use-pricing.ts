'use client';

import { useEffect } from 'react';
import { usePricingToolsStore } from '@/store/use-pricing-store';

export function usePricing() {
  const {
    time,
    setTime,
    callStarted,
    setCallStarted,
    isTwilioAllowed,
    setTwilioAllowed,
    costPerMinute,
    isLoading,
    error,
    fetchPricingTools,
    updateTimeRemaining,
    updatePricing,
    resetToDefault
  } = usePricingToolsStore();

  useEffect(() => {
    let mounted = true;

    async function loadPricingData() {
      if (mounted) {
        await fetchPricingTools();
      }
    }

    loadPricingData();

    return () => {
      mounted = false;
    };
  }, [fetchPricingTools]);

  const userType = usePricingToolsStore(state => state.userType);

  return {
    // State
    time,
    callStarted,
    isTwilioAllowed,
    costPerMinute,
    isLoading,
    error,
    userType,

    // Actions
    setTime,
    setCallStarted,
    setTwilioAllowed,
    updateTimeRemaining,
    updatePricing,
    resetToDefault
  };
}
