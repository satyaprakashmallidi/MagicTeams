'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

export default function AuthRedirectPage() {
    const router = useRouter();

    useEffect(() => {
        // Check if user has completed onboarding
        const onboardingCompleted = localStorage.getItem('onboarding_completed');

        if (onboardingCompleted === 'true') {
            router.replace('/dashboard/aiassistant');
        } else {
            router.replace('/onboarding/welcome');
        }
    }, [router]);

    return (
        <div className="min-h-screen flex items-center justify-center bg-background">
            <div className="text-center">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-foreground mx-auto mb-4"></div>
                <p className="text-muted-foreground">Redirecting...</p>
            </div>
        </div>
    );
}
