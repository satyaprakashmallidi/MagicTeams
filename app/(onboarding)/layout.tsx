'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

export default function OnboardingLayout({
    children,
}: {
    children: React.ReactNode;
}) {
    const router = useRouter();

    useEffect(() => {
        // Check if onboarding is already completed
        const onboardingCompleted = localStorage.getItem('onboarding_completed');
        if (onboardingCompleted === 'true') {
            router.replace('/dashboard/aiassistant');
        }
    }, [router]);

    return (
        <div className="min-h-screen">
            {children}
        </div>
    );
}
