'use client';

import { motion, AnimatePresence } from 'framer-motion';
import { useRouter } from 'next/navigation';
import { useOnboardingState } from '@/hooks/use-onboarding-state';
import { LEAD_GEN_STRATEGIES } from '@/lib/onboarding-data';
import { ProgressIndicator } from '@/components/onboarding/progress-indicator';
import { useState, useEffect } from 'react';

export default function StrategyPage() {
    const router = useRouter();
    const { strategy, setStrategy, currentStep, nextStep, goToStep } = useOnboardingState();
    const [isLoading, setIsLoading] = useState(false);

    // Sync currentStep with this page (step 2)
    useEffect(() => {
        if (currentStep !== 2) {
            goToStep(2);
        }
    }, [currentStep, goToStep]);

    const handleContinue = () => {
        if (strategy) {
            setIsLoading(true);
            setTimeout(() => {
                nextStep();
                router.push('/onboarding/template');
            }, 800);
        }
    };

    return (
        <>
            <ProgressIndicator currentStep={currentStep} />

            <div className="min-h-screen flex items-center justify-center p-6 pt-32 bg-background">
                <div className="max-w-5xl mx-auto w-full">
                    {/* Header */}
                    <motion.div
                        className="text-center mb-12"
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.6 }}
                    >
                        <h1 className="text-4xl md:text-5xl font-bold mb-4">
                            Select Your Industry
                        </h1>
                        <p className="text-lg text-muted-foreground">
                            Choose the industry that best fits your use case
                        </p>
                    </motion.div>

                    {/* Strategy Grid */}
                    <div className="grid grid-cols-2 md:grid-cols-3 gap-4 mb-8">
                        {LEAD_GEN_STRATEGIES.map((item, index) => {
                            const isSelected = strategy === item.id;

                            return (
                                <motion.button
                                    key={item.id}
                                    onClick={() => setStrategy(item.id)}
                                    initial={{ opacity: 0, y: 20 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    transition={{ delay: index * 0.05, duration: 0.4 }}
                                    className={`
                    relative p-6 rounded-2xl text-left transition-all duration-300
                    border-2 ${isSelected ? 'border-foreground bg-foreground/5' : 'border-border hover:border-foreground/50'}
                  `}
                                    whileHover={{ y: -4 }}
                                >
                                    {/* Selection Indicator */}
                                    {isSelected && (
                                        <motion.div
                                            className="absolute top-3 right-3 w-5 h-5 rounded-full bg-foreground flex items-center justify-center"
                                            initial={{ scale: 0 }}
                                            animate={{ scale: 1 }}
                                            transition={{ type: 'spring', stiffness: 500, damping: 30 }}
                                        >
                                            <svg className="w-3 h-3 text-background" viewBox="0 0 12 12" fill="none">
                                                <path
                                                    d="M2 6L5 9L10 3"
                                                    stroke="currentColor"
                                                    strokeWidth="2"
                                                    strokeLinecap="round"
                                                    strokeLinejoin="round"
                                                />
                                            </svg>
                                        </motion.div>
                                    )}

                                    {/* Content */}
                                    <h3 className="font-semibold mb-1 text-sm">{item.name}</h3>
                                    <p className="text-xs text-muted-foreground line-clamp-2">
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
                            disabled={!strategy || isLoading}
                            className="group relative inline-flex items-center justify-center px-12 py-4 text-lg font-medium rounded-full overflow-hidden border-2 border-foreground disabled:opacity-30 disabled:cursor-not-allowed transition-opacity"
                        >
                            <div className="absolute inset-0 bg-foreground -translate-x-full group-hover:translate-x-0 transition-transform duration-500 ease-out" />
                            <span className="relative z-10 text-foreground group-hover:text-background transition-colors duration-300">
                                {isLoading ? 'Processing...' : 'Continue'}
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
