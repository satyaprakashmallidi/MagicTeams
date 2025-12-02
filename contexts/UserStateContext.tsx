"use client";

import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { supabase } from '@/lib/supabase';
import { usePathname } from 'next/navigation';

export type UserState = 'new' | 'has_data' | 'active_campaign' | 'returning' | 'experienced';
export type OnboardingStep = 'welcome' | 'upload_data' | 'create_campaign' | 'monitor' | 'completed';

interface UserActivity {
  totalCampaigns: number;
  totalContacts: number;
  activeCampaigns: number;
  lastActivityDate: Date | null;
  hasUploadedData: boolean;
  hasCreatedCampaign: boolean;
  daysSinceLastActivity: number;
  isFirstVisit: boolean;
  currentPath: string;
  timeOnPlatform: number; // in seconds
  preferredFeatures: string[];
}

interface UserStateContextType {
  userState: UserState;
  onboardingStep: OnboardingStep;
  userActivity: UserActivity;
  isLoading: boolean;
  updateOnboardingStep: (step: OnboardingStep) => void;
  dismissGuidance: () => void;
  showGuidance: boolean;
  refreshUserState: () => Promise<void>;
  shouldShowMetrics: boolean;
  shouldShowAdvancedFeatures: boolean;
}

const UserStateContext = createContext<UserStateContextType | undefined>(undefined);

export function UserStateProvider({ children }: { children: ReactNode }) {
  const [userState, setUserState] = useState<UserState>('new');
  const [onboardingStep, setOnboardingStep] = useState<OnboardingStep>('welcome');
  const [userActivity, setUserActivity] = useState<UserActivity>({
    totalCampaigns: 0,
    totalContacts: 0,
    activeCampaigns: 0,
    lastActivityDate: null,
    hasUploadedData: false,
    hasCreatedCampaign: false,
    daysSinceLastActivity: 0,
    isFirstVisit: true,
    currentPath: '',
    timeOnPlatform: 0,
    preferredFeatures: []
  });
  const [isLoading, setIsLoading] = useState(true);
  const [showGuidance, setShowGuidance] = useState(true);
  const pathname = usePathname();

  // Track time on platform
  useEffect(() => {
    const startTime = Date.now();
    const interval = setInterval(() => {
      setUserActivity(prev => ({
        ...prev,
        timeOnPlatform: Math.floor((Date.now() - startTime) / 1000)
      }));
    }, 30000); // Update every 30 seconds

    return () => clearInterval(interval);
  }, []);

  // Analyze user state based on data
  const analyzeUserState = async () => {
    try {
      setIsLoading(true);
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        setIsLoading(false);
        return;
      }

      // Check localStorage for first visit
      const hasVisited = localStorage.getItem('has_visited_dashboard');
      const guidanceDismissed = localStorage.getItem('guidance_dismissed');
      const onboardingCompleted = localStorage.getItem('onboarding_completed');

      setShowGuidance(!guidanceDismissed);

      // Fetch user's campaigns
      const { data: campaigns } = await supabase
        .from('call_campaigns')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false });

      // Fetch user's files (uploaded data)
      const { data: files } = await supabase
        .from('files')
        .select('*')
        .eq('user_id', user.id);

      // Fetch total contacts across all campaigns
      const { data: contacts } = await supabase
        .from('call_campaign_contacts')
        .select('campaign_id, call_campaigns!inner(user_id)')
        .eq('call_campaigns.user_id', user.id);

      // Calculate activity metrics
      const totalCampaigns = campaigns?.length || 0;
      const activeCampaigns = campaigns?.filter(c => c.status === 'in_progress')?.length || 0;
      const hasUploadedData = (files?.length || 0) > 0;
      const hasCreatedCampaign = totalCampaigns > 0;
      const totalContacts = contacts?.length || 0;

      // Calculate days since last activity
      let lastActivityDate = null;
      let daysSinceLastActivity = 999;
      if (campaigns && campaigns.length > 0) {
        lastActivityDate = new Date(campaigns[0].created_at);
        daysSinceLastActivity = Math.floor((Date.now() - lastActivityDate.getTime()) / (1000 * 60 * 60 * 24));
      }

      // Determine user state
      let newUserState: UserState = 'new';
      let newOnboardingStep: OnboardingStep = 'welcome';

      if (totalCampaigns >= 10 && totalContacts >= 100) {
        newUserState = 'experienced';
        newOnboardingStep = 'completed';
      } else if (activeCampaigns > 0) {
        newUserState = 'active_campaign';
        newOnboardingStep = 'monitor';
      } else if (hasCreatedCampaign && daysSinceLastActivity < 30) {
        newUserState = 'returning';
        newOnboardingStep = 'completed';
      } else if (hasUploadedData && !hasCreatedCampaign) {
        newUserState = 'has_data';
        newOnboardingStep = 'create_campaign';
      } else if (!hasVisited || (!hasUploadedData && !hasCreatedCampaign)) {
        newUserState = 'new';
        newOnboardingStep = 'welcome';
      }

      // Override with saved onboarding state if completed
      if (onboardingCompleted) {
        newOnboardingStep = 'completed';
      }

      // Track feature usage patterns
      const preferredFeatures: string[] = [];
      if (totalCampaigns > 5) preferredFeatures.push('campaigns');
      if (files && files.length > 3) preferredFeatures.push('data_management');

      setUserActivity({
        totalCampaigns,
        totalContacts,
        activeCampaigns,
        lastActivityDate,
        hasUploadedData,
        hasCreatedCampaign,
        daysSinceLastActivity,
        isFirstVisit: !hasVisited,
        currentPath: pathname,
        timeOnPlatform: 0,
        preferredFeatures
      });

      setUserState(newUserState);
      setOnboardingStep(newOnboardingStep);

      // Mark as visited
      if (!hasVisited) {
        localStorage.setItem('has_visited_dashboard', 'true');
      }

    } catch (error) {
      console.error('Error analyzing user state:', error);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    analyzeUserState();
  }, [pathname]);

  const updateOnboardingStep = (step: OnboardingStep) => {
    setOnboardingStep(step);
    if (step === 'completed') {
      localStorage.setItem('onboarding_completed', 'true');
    }
  };

  const dismissGuidance = () => {
    setShowGuidance(false);
    localStorage.setItem('guidance_dismissed', 'true');
  };

  const refreshUserState = async () => {
    await analyzeUserState();
  };

  // Determine what features to show based on user state
  const shouldShowMetrics = userState !== 'new' && userActivity.totalCampaigns > 0;
  const shouldShowAdvancedFeatures = userState === 'experienced' || userActivity.totalCampaigns > 5;

  return (
    <UserStateContext.Provider value={{
      userState,
      onboardingStep,
      userActivity,
      isLoading,
      updateOnboardingStep,
      dismissGuidance,
      showGuidance,
      refreshUserState,
      shouldShowMetrics,
      shouldShowAdvancedFeatures
    }}>
      {children}
    </UserStateContext.Provider>
  );
}

export function useUserState() {
  const context = useContext(UserStateContext);
  if (context === undefined) {
    throw new Error('useUserState must be used within a UserStateProvider');
  }
  return context;
}