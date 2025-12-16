'use client';

import { motion, AnimatePresence } from 'framer-motion';
import { useRouter } from 'next/navigation';
import { useOnboardingState } from '@/hooks/use-onboarding-state';
import { useState, useEffect } from 'react';

export default function WelcomePage() {
    const router = useRouter();
    const { nextStep } = useOnboardingState();
    const [isLoading, setIsLoading] = useState(false);
    const [loadingTextIndex, setLoadingTextIndex] = useState(0);

    const loadingTexts = [
        "Creating agents in minutes...",
        "Setting up your workspace...",
        "Preparing AI capabilities...",
        "Almost there..."
    ];

    useEffect(() => {
        if (isLoading) {
            const interval = setInterval(() => {
                setLoadingTextIndex((prev) => (prev + 1) % loadingTexts.length);
            }, 1500);
            return () => clearInterval(interval);
        }
    }, [isLoading]);

    const handleStart = () => {
        setIsLoading(true);
        setTimeout(() => {
            nextStep();
            router.push('/onboarding/strategy');
        }, 2000);
    };

    return (
        <div className="min-h-screen flex items-center justify-center p-6 bg-background">
            {/* Main Content */}
            <div className="relative z-10 max-w-4xl mx-auto text-center">
                {/* Logo/Badge */}
                <motion.div
                    className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-muted/20 backdrop-blur-sm border border-border mb-8"
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.6 }}
                >
                    <span className="text-sm font-medium">AI-Powered Voice Agents</span>
                </motion.div>

                {/* Heading */}
                <motion.h1
                    className="text-6xl md:text-7xl lg:text-8xl font-bold mb-6"
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.6, delay: 0.1 }}
                >
                    Welcome to
                    <br />
                    MagicTeams
                </motion.h1>

                {/* Subtitle */}
                <motion.p
                    className="text-xl md:text-2xl text-muted-foreground mb-12 max-w-2xl mx-auto"
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.6, delay: 0.2 }}
                >
                    Create your first Voice AI agent in minutes. No coding required.
                    <br />
                    Just answer a few questions and let AI do the rest.
                </motion.p>

                {/* CTA Button with Loading State */}
                <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.6, delay: 0.3 }}
                    className="flex flex-col items-center gap-4"
                >
                    <button
                        onClick={handleStart}
                        disabled={isLoading}
                        className="group relative inline-flex items-center justify-center px-12 py-4 text-lg font-medium rounded-full overflow-hidden border-2 border-foreground disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                        {/* Fill animation - starts off-screen left, slides in on hover */}
                        <div className="absolute inset-0 bg-foreground -translate-x-full group-hover:translate-x-0 transition-transform duration-500 ease-out" />

                        {/* Text - black normally, white on hover */}
                        <span className="relative z-10 text-foreground group-hover:text-background transition-colors duration-300">
                            {isLoading ? loadingTexts[loadingTextIndex] : 'Create Voice AI Agent'}
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
    );
}
