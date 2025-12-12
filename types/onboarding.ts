export type WorkflowType = 'ai-generate' | 'paste-text';

export type LeadGenStrategy = 'real-estate' | 'insurance' | 'ecommerce' | 'education' | 'healthcare' | 'finance';

export interface Template {
    id: string;
    name: string;
    description: string;
    icon: string;
    category: LeadGenStrategy;
    prompt: string;
    defaultGreeting?: string;
}

export interface VoiceOption {
    id: string;
    name: string;
    gender: 'male' | 'female' | 'neutral';
    accent: string;
    previewUrl?: string;
    description: string;
}

export interface AgentConfig {
    name: string;
    voice: VoiceOption;
    personality: string;
    goal: string;
    language: string;
    greeting?: string;
    template?: Template;
    workflow: WorkflowType;
    strategy: LeadGenStrategy;
}

export interface OnboardingState {
    currentStep: number;
    workflow: WorkflowType | null;
    strategy: LeadGenStrategy | null;
    template: Template | null;
    agentConfig: Partial<AgentConfig>;
    isComplete: boolean;
}

export const ONBOARDING_STEPS = [
    { id: 1, name: 'welcome', title: 'Welcome' },
    { id: 2, name: 'workflow', title: 'Choose Workflow' },
    { id: 3, name: 'strategy', title: 'Select Strategy' },
    { id: 4, name: 'template', title: 'Choose Template' },
    { id: 5, name: 'config', title: 'Configure Agent' },
    { id: 6, name: 'creating', title: 'Creating Agent' },
] as const;

export type OnboardingStepName = typeof ONBOARDING_STEPS[number]['name'];
