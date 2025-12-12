'use client';

import { motion } from 'framer-motion';
import { useRouter } from 'next/navigation';
import { useOnboardingState } from '@/hooks/use-onboarding-state';
import { TEMPLATES } from '@/lib/onboarding-data';
import { ProgressIndicator } from '@/components/onboarding/progress-indicator';

export default function TemplatePage() {
    const router = useRouter();
    const { strategy, template, setTemplate, currentStep, nextStep } = useOnboardingState();

    if (!strategy) {
        router.push('/onboarding/strategy');
        return null;
    }

    const templates = TEMPLATES[strategy] || [];

    const handleContinue = () => {
        if (template) {
            nextStep();
            router.push('/onboarding/workflow');
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
                            const isSelected = template === item.id;

                            return (
                                <motion.button
                                    key={item.id}
                                    onClick={() => setTemplate(item.id)}
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
                        className="flex justify-center"
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        transition={{ duration: 0.6, delay: 0.3 }}
                    >
                        <button
                            onClick={handleContinue}
                            disabled={!template}
                            className="group relative inline-flex items-center justify-center px-12 py-4 text-lg font-medium rounded-full overflow-hidden border-2 border-foreground disabled:opacity-30 disabled:cursor-not-allowed transition-opacity"
                        >
                            <div className="absolute inset-0 bg-foreground -translate-x-full group-hover:translate-x-0 transition-transform duration-500 ease-out" />
                            <span className="relative z-10 text-foreground group-hover:text-background transition-colors duration-300">
                                Continue to Setup
                            </span>
                        </button>
                    </motion.div>
                </div>
            </div>
        </>
    );
}
