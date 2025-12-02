"use client";

import { useState, useEffect } from 'react';

interface OnboardingState {
  hasSeenGroupCallTour: boolean;
  lastTourVersion: string;
}

const TOUR_VERSION = '1.0.0';
const STORAGE_KEY = 'magic-teams-onboarding';

export function useOnboardingTour() {
  const [state, setState] = useState<OnboardingState>({
    hasSeenGroupCallTour: false,
    lastTourVersion: '',
  });
  const [isLoaded, setIsLoaded] = useState(false);

  useEffect(() => {
    // Load onboarding state from localStorage
    const savedState = localStorage.getItem(STORAGE_KEY);
    if (savedState) {
      try {
        const parsed = JSON.parse(savedState);
        setState(parsed);
      } catch (error) {
        console.warn('Failed to parse onboarding state:', error);
      }
    }
    setIsLoaded(true);
  }, []);

  const updateState = (updates: Partial<OnboardingState>) => {
    const newState = { ...state, ...updates };
    setState(newState);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(newState));
  };

  const shouldShowGroupCallTour = () => {
    return !state.hasSeenGroupCallTour || state.lastTourVersion !== TOUR_VERSION;
  };

  const markGroupCallTourCompleted = () => {
    updateState({
      hasSeenGroupCallTour: true,
      lastTourVersion: TOUR_VERSION,
    });
  };

  const resetOnboarding = () => {
    setState({
      hasSeenGroupCallTour: false,
      lastTourVersion: '',
    });
    localStorage.removeItem(STORAGE_KEY);
  };

  return {
    isLoaded,
    shouldShowGroupCallTour,
    markGroupCallTourCompleted,
    resetOnboarding,
  };
}