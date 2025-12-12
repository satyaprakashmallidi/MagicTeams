'use client';

import { motion } from 'framer-motion';
import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useOnboardingState } from '@/hooks/use-onboarding-state';
import { Sparkles, Zap, Mic, Brain } from 'lucide-react';

export default function CreatingPage() {
    const router = useRouter();
    const { completeOnboarding } = useOnboardingState();

    useEffect(() => {
        // Simulate agent creation
        const timer = setTimeout(() => {
            completeOnboarding();
            router.push('/dashboard/assistant');
        }, 3500);

        return () => clearTimeout(timer);
    }, [completeOnboarding, router]);

    return (
        <div className="relative min-h-screen flex items-center justify-center p-6 bg-background">
            <div className="relative z-10 max-w-2xl mx-auto text-center">
                {/* Loading Animation */}
                <div className="relative mb-8">
                    {/* Center Orb */}
                    <motion.div
                        className="w-32 h-32 mx-auto rounded-full bg-gradient-to-br from-foreground/20 to-foreground/10 shadow-2xl"
                        animate={{
                            scale: [1, 1.2, 1],
                            rotate: [0, 180, 360],
                        }}
                        transition={{
                            duration: 3,
                            repeat: Infinity,
                            ease: 'easeInOut',
                        }}
                    />

                    {/* Orbiting Icons */}
                    {[
                        { Icon: Sparkles, delay: 0, radius: 100 },
                        { Icon: Zap, delay: 0.25, radius: 100 },
                        { Icon: Mic, delay: 0.5, radius: 100 },
                        { Icon: Brain, delay: 0.75, radius: 100 },
                    ].map(({ Icon, delay, radius }, index) => (
                        <motion.div
                            key={index}
                            className="absolute top-1/2 left-1/2 w-12 h-12 -ml-6 -mt-6"
                            animate={{
                                rotate: [0, 360],
                            }}
                            transition={{
                                duration: 4,
                                repeat: Infinity,
                                ease: 'linear',
                                delay: delay * 4,
                            }}
                        >
                            <motion.div
                                className="absolute"
                                style={{ left: radius, top: 0 }}
                                animate={{
                                    rotate: [0, -360],
                                }}
                                transition={{
                                    duration: 4,
                                    repeat: Infinity,
                                    ease: 'linear',
                                    delay: delay * 4,
                                }}
                            >
                                <div className="w-12 h-12 rounded-xl bg-muted/30 backdrop-blur-sm border border-border flex items-center justify-center shadow-lg">
                                    <Icon className="w-6 h-6" />
                                </div>
                            </motion.div>
                        </motion.div>
                    ))}
                </div>

                {/* Text */}
                <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.3 }}
                >
                    <h1 className="text-4xl md:text-5xl font-bold mb-4">
                        Training Your Voice AI Agent
                    </h1>
                    <p className="text-lg text-muted-foreground mb-8">
                        Optimizing voice patterns, personality, and responses...
                    </p>

                    {/* Progress Steps */}
                    <div className="space-y-3 max-w-md mx-auto">
                        {[
                            { text: 'Analyzing voice patterns', delay: 0.5 },
                            { text: 'Training language model', delay: 1 },
                            { text: 'Optimizing response time', delay: 1.5 },
                            { text: 'Finalizing configuration', delay: 2 },
                        ].map((step, index) => (
                            <motion.div
                                key={index}
                                className="flex items-center gap-3 text-left"
                                initial={{ opacity: 0, x: -20 }}
                                animate={{ opacity: 1, x: 0 }}
                                transition={{ delay: step.delay }}
                            >
                                <motion.div
                                    className="w-5 h-5 rounded-full bg-primary flex items-center justify-center shadow-lg"
                                    initial={{ scale: 0 }}
                                    animate={{ scale: 1 }}
                                    transition={{ delay: step.delay + 0.2, type: 'spring' }}
                                >
                                    <motion.svg
                                        className="w-3 h-3 text-primary-foreground"
                                        viewBox="0 0 12 12"
                                        fill="none"
                                        initial={{ pathLength: 0 }}
                                        animate={{ pathLength: 1 }}
                                        transition={{ delay: step.delay + 0.4, duration: 0.3 }}
                                    >
                                        <path
                                            d="M2 6L5 9L10 3"
                                            stroke="currentColor"
                                            strokeWidth="2"
                                            strokeLinecap="round"
                                            strokeLinejoin="round"
                                        />
                                    </motion.svg>
                                </motion.div>
                                <span className="text-sm text-muted-foreground">{step.text}</span>
                            </motion.div>
                        ))}
                    </div>
                </motion.div>
            </div>
        </div>
    );
}
