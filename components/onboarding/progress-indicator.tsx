'use client';

import { motion } from 'framer-motion';
import { ONBOARDING_STEPS } from '@/types/onboarding';

interface ProgressIndicatorProps {
    currentStep: number;
}

export function ProgressIndicator({ currentStep }: ProgressIndicatorProps) {
    const progress = ((currentStep - 1) / (ONBOARDING_STEPS.length - 1)) * 100;

    return (
        <div className="fixed top-0 left-0 right-0 z-50 bg-background/80 backdrop-blur-md border-b border-border/40">
            <div className="max-w-7xl mx-auto px-6 py-4">
                {/* Progress Bar */}
                <div className="relative h-1 bg-muted/30 rounded-full overflow-hidden mb-6">
                    <motion.div
                        className="absolute inset-y-0 left-0 bg-gradient-to-r from-blue-500 via-purple-500 to-pink-500 rounded-full"
                        initial={{ width: 0 }}
                        animate={{ width: `${progress}%` }}
                        transition={{ duration: 0.6, ease: [0.32, 0.72, 0, 1] }}
                    />
                    <motion.div
                        className="absolute inset-y-0 left-0 bg-gradient-to-r from-blue-400/50 via-purple-400/50 to-pink-400/50 blur-sm rounded-full"
                        initial={{ width: 0 }}
                        animate={{ width: `${progress}%` }}
                        transition={{ duration: 0.6, ease: [0.32, 0.72, 0, 1] }}
                    />
                </div>

                {/* Step Indicators */}
                <div className="flex items-center justify-between">
                    {ONBOARDING_STEPS.slice(0, -1).map((step, index) => {
                        const stepNumber = index + 1;
                        const isActive = currentStep === stepNumber;
                        const isComplete = currentStep > stepNumber;

                        return (
                            <div key={step.id} className="flex flex-col items-center gap-2 flex-1">
                                <motion.div
                                    className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-medium transition-all duration-300 ${isComplete
                                            ? 'bg-gradient-to-br from-blue-500 to-purple-500 text-white shadow-lg shadow-purple-500/30'
                                            : isActive
                                                ? 'bg-gradient-to-br from-blue-500 to-purple-500 text-white shadow-lg shadow-purple-500/50 ring-4 ring-purple-500/20'
                                                : 'bg-muted text-muted-foreground'
                                        }`}
                                    initial={false}
                                    animate={{
                                        scale: isActive ? 1.1 : 1,
                                    }}
                                    transition={{ duration: 0.3, ease: 'easeOut' }}
                                >
                                    {isComplete ? (
                                        <motion.svg
                                            className="w-4 h-4"
                                            viewBox="0 0 12 12"
                                            fill="none"
                                            initial={{ pathLength: 0 }}
                                            animate={{ pathLength: 1 }}
                                            transition={{ duration: 0.3 }}
                                        >
                                            <motion.path
                                                d="M2 6L5 9L10 3"
                                                stroke="currentColor"
                                                strokeWidth="2"
                                                strokeLinecap="round"
                                                strokeLinejoin="round"
                                            />
                                        </motion.svg>
                                    ) : (
                                        stepNumber
                                    )}
                                </motion.div>
                                <motion.span
                                    className={`text-xs font-medium transition-colors duration-300 ${isActive ? 'text-foreground' : 'text-muted-foreground'
                                        }`}
                                    initial={false}
                                    animate={{
                                        opacity: isActive ? 1 : 0.6,
                                    }}
                                >
                                    {step.title}
                                </motion.span>
                            </div>
                        );
                    })}
                </div>
            </div>
        </div>
    );
}
