'use client';

import { motion, AnimatePresence } from 'framer-motion';
import { useRouter } from 'next/navigation';
import { useOnboardingState } from '@/hooks/use-onboarding-state';
import { TEMPLATES } from '@/lib/onboarding-data';
import { ProgressIndicator } from '@/components/onboarding/progress-indicator';
import { useState, useEffect } from 'react';

export default function TemplatePage() {
    const router = useRouter();
    const { strategy, template, setTemplate, currentStep, nextStep, goToStep } = useOnboardingState();
    const [isLoading, setIsLoading] = useState(false);
    const [hasSelectedOnThisPage, setHasSelectedOnThisPage] = useState(false);

    // Sync currentStep with this page (step 3)
    useEffect(() => {
        if (currentStep !== 3) {
            goToStep(3);
        }
    }, [currentStep, goToStep]);

    if (!strategy) {
        router.push('/onboarding/strategy');
        return null;
    }

    const templates = TEMPLATES[strategy] || [];

    const handleTemplateSelect = (templateId: string) => {
        const selectedTemplate = templates.find(t => t.id === templateId);
        if (selectedTemplate) {
            setTemplate(selectedTemplate);
            setHasSelectedOnThisPage(true);
        }
    };

    const handleContinue = () => {
        if (template && hasSelectedOnThisPage) {
            setIsLoading(true);
            setTimeout(() => {
                nextStep();
                router.push('/onboarding/workflow');
            }, 800);
        }
    };

    return (
        <>
            <ProgressIndicator currentStep={currentStep} />

            <div className="min-h-screen flex items-center justify-center p-6 pt-32 bg-background">
                <div className="max-w-6xl mx-auto w-full">
                    {/* Header */}
                    <motion.div
                        className="text-center mb-12"
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.6 }}
                    >
                        <h1 className="text-4xl md:text-5xl font-bold mb-4">
                            Choose a Template
                        </h1>
                        <p className="text-lg text-muted-foreground">
                            Select a pre-built template or start from scratch
                        </p>
                    </motion.div>

                    {/* Templates Grid */}
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
                        {templates.map((item, index) => {
                            const isSelected = template?.id === item.id;

                            return (
                                <motion.button
                                    key={item.id}
                                    onClick={() => handleTemplateSelect(item.id)}
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
                                    <h3 className="text-xl font-semibold mb-2">{item.name}</h3>
                                    <p className="text-sm text-muted-foreground">
                                        {item.description}
                                    </p>
                                </motion.button>
                            );
                        })}
                    </div>

                    {/* Continue Button */}
                    <motion.div
                        className="flex flex-col items-center gap-4"
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        transition={{ duration: 0.6, delay: 0.3 }}
                    >
                        <button
                            onClick={handleContinue}
                            disabled={!template || !hasSelectedOnThisPage || isLoading}
                            className="group relative inline-flex items-center justify-center px-12 py-4 text-lg font-medium rounded-full overflow-hidden border-2 border-foreground disabled:opacity-30 disabled:cursor-not-allowed transition-opacity"
                        >
                            <div className="absolute inset-0 bg-foreground -translate-x-full group-hover:translate-x-0 transition-transform duration-500 ease-out" />
                            <span className="relative z-10 text-foreground group-hover:text-background transition-colors duration-300">
                                {isLoading ? 'Processing...' : 'Continue to Setup'}
                            </span>
                        </button>

                        {/* Loading indicator dots */}
                        <AnimatePresence>
                            {isLoading && (
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
                    </motion.div>
                </div>
            </div>
        </>
    );
}
