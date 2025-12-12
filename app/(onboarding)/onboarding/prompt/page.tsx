'use client';

import { motion } from 'framer-motion';
import { Sparkles, FileText } from 'lucide-react';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useOnboardingState } from '@/hooks/use-onboarding-state';
import { ProgressIndicator } from '@/components/onboarding/progress-indicator';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { toast } from '@/hooks/use-toast';

type PromptMode = 'ai' | 'manual' | null;

export default function PromptPage() {
    const router = useRouter();
    const { template, currentStep, nextStep } = useOnboardingState();
    const [mode, setMode] = useState<PromptMode>(null);
    const [promptInput, setPromptInput] = useState('');
    const [isEnhancing, setIsEnhancing] = useState(false);

    if (!template) {
        router.push('/onboarding/template');
        return null;
    }

    const handleModeSelect = (selectedMode: PromptMode) => {
        setMode(selectedMode);
        // Pre-fill with template prompt if available
        if (selectedMode === 'manual' && template.prompt) {
            setPromptInput(template.prompt);
        }
    };

    const enhancePrompt = async (description: string): Promise<string> => {
        const { enhancePromptWithAI } = await import('@/app/actions/enhance-prompt');
        const result = await enhancePromptWithAI(description, template.name, template.strategy);
        if (result.success) {
            return result.enhancedPrompt!;
        }
        // TODO: Integrate with your AI enhancement API
        // For now, return a formatted version
        return `You are a professional ${template.name} assistant. ${description}

Key responsibilities:
- Maintain a ${template.name === 'Customer Support Agent' ? 'helpful and empathetic' : 'professional and efficient'} tone
- Provide accurate information
- Guide users through their needs effectively

Always be courteous and clear in your communication.`;
    };

    const handleContinue = async () => {
        if (!promptInput.trim()) {
            toast({
                title: 'Prompt required',
                description: 'Please enter or generate a prompt before continuing.',
                variant: 'destructive',
            });
            return;
        }

        try {
            let finalPrompt = promptInput;

            if (mode === 'ai') {
                setIsEnhancing(true);
                finalPrompt = await enhancePrompt(promptInput);
            }

            // Update the template with the new prompt
            const updatedTemplate = {
                ...template,
                prompt: finalPrompt,
            };

            // Store the updated template
            useOnboardingState.getState().setTemplate(updatedTemplate);

            nextStep();
            router.push('/onboarding/config');
        } catch (error) {
            console.error('Error enhancing prompt:', error);
            toast({
                title: 'Enhancement failed',
                description: 'Failed to enhance the prompt. Please try again.',
                variant: 'destructive',
            });
        } finally {
            setIsEnhancing(false);
        }
    };

    return (
        <>
            <ProgressIndicator currentStep={currentStep} />

            <div className="min-h-screen p-6 pt-32 pb-20 bg-background">
                <div className="max-w-4xl mx-auto w-full">
                    {/* Header */}
                    <motion.div
                        className="text-center mb-12"
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.6 }}
                    >
                        <h1 className="text-4xl md:text-5xl font-bold mb-4">
                            Configure Your Prompt
                        </h1>
                        <p className="text-lg text-muted-foreground">
                            Define your agent's personality and behavior
                        </p>
                    </motion.div>

                    {!mode ? (
                        /* Mode Selection */
                        <div className="grid md:grid-cols-2 gap-6">
                            <motion.button
                                onClick={() => handleModeSelect('ai')}
                                className="group relative p-8 rounded-2xl border-2 border-border hover:border-primary/50 transition-all duration-300 bg-card hover:shadow-lg"
                                initial={{ opacity: 0, x: -20 }}
                                animate={{ opacity: 1, x: 0 }}
                                transition={{ delay: 0.1 }}
                                whileHover={{ scale: 1.02 }}
                                whileTap={{ scale: 0.98 }}
                            >
                                <div className="flex flex-col items-center text-center space-y-4">
                                    <div className="p-4 rounded-full bg-primary/10 group-hover:bg-primary/20 transition-colors">
                                        <Sparkles className="w-8 h-8 text-primary" />
                                    </div>
                                    <div>
                                        <h3 className="text-xl font-semibold mb-2">Generate with AI</h3>
                                        <p className="text-muted-foreground text-sm">
                                            Describe what you want and we'll create the perfect prompt for you
                                        </p>
                                    </div>
                                    <div className="absolute inset-0 rounded-2xl bg-gradient-to-br from-primary/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity -z-10" />
                                </div>
                            </motion.button>

                            <motion.button
                                onClick={() => handleModeSelect('manual')}
                                className="group relative p-8 rounded-2xl border-2 border-border hover:border-primary/50 transition-all duration-300 bg-card hover:shadow-lg"
                                initial={{ opacity: 0, x: 20 }}
                                animate={{ opacity: 1, x: 0 }}
                                transition={{ delay: 0.2 }}
                                whileHover={{ scale: 1.02 }}
                                whileTap={{ scale: 0.98 }}
                            >
                                <div className="flex flex-col items-center text-center space-y-4">
                                    <div className="p-4 rounded-full bg-muted group-hover:bg-muted/80 transition-colors">
                                        <FileText className="w-8 h-8 text-foreground" />
                                    </div>
                                    <div>
                                        <h3 className="text-xl font-semibold mb-2">Paste Manually</h3>
                                        <p className="text-muted-foreground text-sm">
                                            Write or paste your own custom prompt directly
                                        </p>
                                    </div>
                                    <div className="absolute inset-0 rounded-2xl bg-gradient-to-br from-muted/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity -z-10" />
                                </div>
                            </motion.button>
                        </div>
                    ) : (
                        /* Prompt Input */
                        <motion.div
                            initial={{ opacity: 0, y: 20 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ duration: 0.4 }}
                            className="space-y-6"
                        >
                            <div className="flex items-center justify-between">
                                <div className="flex items-center gap-3">
                                    {mode === 'ai' ? (
                                        <>
                                            <div className="p-2 rounded-lg bg-primary/10">
                                                <Sparkles className="w-5 h-5 text-primary" />
                                            </div>
                                            <div>
                                                <h3 className="font-semibold">AI-Enhanced Prompt</h3>
                                                <p className="text-sm text-muted-foreground">
                                                    Describe what you want your agent to do
                                                </p>
                                            </div>
                                        </>
                                    ) : (
                                        <>
                                            <div className="p-2 rounded-lg bg-muted">
                                                <FileText className="w-5 h-5 text-foreground" />
                                            </div>
                                            <div>
                                                <h3 className="font-semibold">Manual Prompt</h3>
                                                <p className="text-sm text-muted-foreground">
                                                    Write your custom prompt
                                                </p>
                                            </div>
                                        </>
                                    )}
                                </div>
                                <button
                                    onClick={() => {
                                        setMode(null);
                                        setPromptInput('');
                                    }}
                                    className="text-sm text-muted-foreground hover:text-foreground transition-colors"
                                >
                                    Change mode
                                </button>
                            </div>

                            <div className="space-y-3">
                                <Label htmlFor="prompt" className="text-base font-semibold">
                                    {mode === 'ai' ? 'Describe your agent' : 'Agent System Prompt'}
                                </Label>
                                <Textarea
                                    id="prompt"
                                    value={promptInput}
                                    onChange={(e) => setPromptInput(e.target.value)}
                                    placeholder={
                                        mode === 'ai'
                                            ? 'e.g., "I want a friendly customer support agent that helps users with product questions and issues..."'
                                            : 'Enter your system prompt here...'
                                    }
                                    rows={mode === 'ai' ? 6 : 12}
                                    className="text-base resize-none"
                                />
                                <p className="text-sm text-muted-foreground">
                                    {mode === 'ai'
                                        ? 'Tip: Be specific about the tone, responsibilities, and behavior you want'
                                        : `Current length: ${promptInput.length} characters`}
                                </p>
                            </div>

                            <div className="flex justify-center gap-4 pt-6">
                                <button
                                    onClick={() => {
                                        setMode(null);
                                        setPromptInput('');
                                    }}
                                    className="px-8 py-3 rounded-full border-2 border-border hover:border-foreground/20 transition-colors font-medium"
                                >
                                    Back
                                </button>
                                <button
                                    onClick={handleContinue}
                                    disabled={!promptInput.trim() || isEnhancing}
                                    className="group relative inline-flex items-center justify-center px-12 py-3 text-lg font-medium rounded-full overflow-hidden border-2 border-foreground disabled:opacity-30 disabled:cursor-not-allowed transition-opacity"
                                >
                                    <div className="absolute inset-0 bg-foreground -translate-x-full group-hover:translate-x-0 transition-transform duration-500 ease-out" />
                                    <span className="relative z-10 text-foreground group-hover:text-background transition-colors duration-300">
                                        {isEnhancing ? 'Enhancing...' : mode === 'ai' ? 'Enhance & Continue' : 'Continue'}
                                    </span>
                                </button>
                            </div>
                        </motion.div>
                    )}
                </div>
            </div>
        </>
    );
}
