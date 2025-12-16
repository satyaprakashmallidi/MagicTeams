'use client';

import { motion, AnimatePresence } from 'framer-motion';
import { Sparkles, FileText } from 'lucide-react';
import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useOnboardingState } from '@/hooks/use-onboarding-state';
import { ProgressIndicator } from '@/components/onboarding/progress-indicator';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { toast } from '@/hooks/use-toast';
// Speech input commented out for now
// import {
//   SpeechInput,
//   SpeechInputRecordButton,
//   SpeechInputPreview,
//   SpeechInputCancelButton,
// } from '@/components/ui/speech-input';

type PromptMode = 'ai-generate' | 'paste-text' | null;

export default function WorkflowPage() {
  const router = useRouter();
  const { template, strategy, workflow, setWorkflow, currentStep, nextStep, goToStep } = useOnboardingState();
  const [mode, setMode] = useState<PromptMode>(null);
  const [promptInput, setPromptInput] = useState('');
  const [isEnhancing, setIsEnhancing] = useState(false);

  // Sync currentStep with this page (step 4)
  useEffect(() => {
    if (currentStep !== 4) {
      goToStep(4);
    }
  }, [currentStep, goToStep]);

  if (!template) {
    router.push('/onboarding/template');
    return null;
  }

  const handleModeSelect = (selectedMode: PromptMode) => {
    setMode(selectedMode);
    setWorkflow(selectedMode);
    // Pre-fill with template prompt if available
    if (selectedMode === 'paste-text' && template.prompt) {
      setPromptInput(template.prompt);
    }
  };

  const enhancePrompt = async (description: string): Promise<string> => {
    const { enhancePromptWithAI } = await import('@/app/actions/enhance-prompt');

    const result = await enhancePromptWithAI(
      description,
      template?.name || 'AI Agent',
      strategy || 'general business'
    );

    if (!result.success || !result.enhancedPrompt) {
      throw new Error(result.error || 'Failed to enhance prompt');
    }

    return result.enhancedPrompt;
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

      if (mode === 'ai-generate') {
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

  const workflows = [
    {
      id: 'ai-generate' as PromptMode,
      title: 'Generate with AI',
      description: 'Describe what you want and we\'ll create the perfect prompt for you',
    },
    {
      id: 'paste-text' as PromptMode,
      title: 'Paste Manually',
      description: 'Write or paste your own custom prompt directly',
    }
  ];

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
              How would you like to create your AI agent?
            </p>
          </motion.div>

          {!mode ? (
            /* Mode Selection */
            <div className="grid md:grid-cols-2 gap-6 mb-8">
              {workflows.map((item, index) => {
                const isSelected = mode === item.id;

                return (
                  <motion.button
                    key={item.id}
                    onClick={() => handleModeSelect(item.id)}
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: index * 0.1, duration: 0.4 }}
                    className={`
                      relative p-8 rounded-2xl text-left transition-all duration-300
                      border-2 ${isSelected ? 'border-foreground bg-foreground/5' : 'border-border hover:border-foreground/50'}
                    `}
                    whileHover={{ y: -4 }}
                  >
                    {/* Selection Indicator */}
                    {isSelected && (
                      <motion.div
                        className="absolute top-4 right-4 w-6 h-6 rounded-full bg-foreground flex items-center justify-center"
                        initial={{ scale: 0 }}
                        animate={{ scale: 1 }}
                        transition={{ type: 'spring', stiffness: 500, damping: 30 }}
                      >
                        <svg className="w-4 h-4 text-background" viewBox="0 0 24 24" fill="none">
                          <path
                            d="M5 13l4 4L19 7"
                            stroke="currentColor"
                            strokeWidth={3}
                            strokeLinecap="round"
                            strokeLinejoin="round"
                          />
                        </svg>
                      </motion.div>
                    )}

                    {/* Content */}
                    <h3 className="text-xl font-semibold mb-2">{item.title}</h3>
                    <p className="text-sm text-muted-foreground">
                      {item.description}
                    </p>
                  </motion.button>
                );
              })}
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
                  {mode === 'ai-generate' ? (
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
                <div className="flex items-center justify-between">
                  <Label htmlFor="prompt" className="text-base font-semibold">
                    {mode === 'ai-generate' ? 'Describe your agent' : 'Agent System Prompt'}
                  </Label>
                  {/* Commented out for now - Voice input will be added later */}
                  {/* {mode === 'ai-generate' && (
                    <SpeechInput
                      onStop={(data) => setPromptInput(data.transcript)}
                      onChange={(data) => setPromptInput(data.transcript)}
                    >
                      <SpeechInputRecordButton />
                      <SpeechInputPreview placeholder="Listening..." />
                      <SpeechInputCancelButton />
                    </SpeechInput>
                  )} */}
                </div>
                <Textarea
                  id="prompt"
                  value={promptInput}
                  onChange={(e) => setPromptInput(e.target.value)}
                  placeholder={
                    mode === 'ai-generate'
                      ? 'e.g., "I want a friendly customer support agent that helps users with product questions and issues..."'
                      : 'Enter your system prompt here...'
                  }
                  rows={mode === 'ai-generate' ? 6 : 12}
                  className="text-base resize-none"
                />
                <p className="text-sm text-muted-foreground">
                  {mode === 'ai-generate'
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
                <div className="flex flex-col items-center gap-4">
                  <button
                    onClick={handleContinue}
                    disabled={!promptInput.trim() || isEnhancing}
                    className="group relative inline-flex items-center justify-center px-12 py-3 text-lg font-medium rounded-full overflow-hidden border-2 border-foreground disabled:opacity-30 disabled:cursor-not-allowed transition-opacity"
                  >
                    <div className="absolute inset-0 bg-foreground -translate-x-full group-hover:translate-x-0 transition-transform duration-500 ease-out" />
                    <span className="relative z-10 text-foreground group-hover:text-background transition-colors duration-300 flex items-center gap-2">
                      {isEnhancing ? (
                        <>
                          <Sparkles className="w-4 h-4 animate-pulse" />
                          Enhancing with AI...
                        </>
                      ) : (
                        mode === 'ai-generate' ? 'Enhance & Continue' : 'Continue'
                      )}
                    </span>
                  </button>

                  {/* Loading indicator dots */}
                  <AnimatePresence>
                    {isEnhancing && (
                      <motion.div
                        initial={{ opacity: 0, y: -10 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -10 }}
                        className="flex gap-2"
                      >
                        {[0, 1, 2].map((i) => (
                          <motion.div
                            key={i}
                            className="w-2 h-2 bg-foreground rounded-full"
                            animate={{
                              y: [0, -10, 0],
                            }}
                            transition={{
                              duration: 0.6,
                              repeat: Infinity,
                              delay: i * 0.2,
                            }}
                          />
                        ))}
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              </div>
            </motion.div>
          )}
        </div>
      </div>
    </>
  );
}
