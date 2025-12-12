'use client';

import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { OnboardingState, WorkflowType, LeadGenStrategy, Template, AgentConfig } from '@/types/onboarding';

interface OnboardingStore extends OnboardingState {
    setWorkflow: (workflow: WorkflowType) => void;
    setStrategy: (strategy: LeadGenStrategy) => void;
    setTemplate: (template: Template) => void;
    updateAgentConfig: (config: Partial<AgentConfig>) => void;
    nextStep: () => void;
    prevStep: () => void;
    goToStep: (step: number) => void;
    completeOnboarding: () => void;
    reset: () => void;
}

const initialState: OnboardingState = {
    currentStep: 1,
    workflow: null,
    strategy: null,
    template: null,
    agentConfig: {},
    isComplete: false,
};

export const useOnboardingState = create<OnboardingStore>()(
    persist(
        (set) => ({
            ...initialState,

            setWorkflow: (workflow) =>
                set((state) => ({
                    workflow,
                    agentConfig: { ...state.agentConfig, workflow },
                })),

            setStrategy: (strategy) =>
                set((state) => ({
                    strategy,
                    agentConfig: { ...state.agentConfig, strategy },
                })),

            setTemplate: (template) =>
                set((state) => ({
                    template,
                    agentConfig: { ...state.agentConfig, template },
                })),

            updateAgentConfig: (config) =>
                set((state) => ({
                    agentConfig: { ...state.agentConfig, ...config },
                })),

            nextStep: () =>
                set((state) => ({
                    currentStep: Math.min(state.currentStep + 1, 6),
                })),

            prevStep: () =>
                set((state) => ({
                    currentStep: Math.max(state.currentStep - 1, 1),
                })),

            goToStep: (step) =>
                set(() => ({
                    currentStep: step,
                })),

            completeOnboarding: () =>
                set(() => ({
                    isComplete: true,
                })),

            reset: () => set(initialState),
        }),
        {
            name: 'onboarding-storage',
        }
    )
);
