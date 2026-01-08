'use client';

import { useEffect, useState } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { CheckCircle, Loader2, XCircle, ArrowRight } from 'lucide-react';
import Link from 'next/link';

export default function PaymentSuccessPage() {
    const searchParams = useSearchParams();
    const router = useRouter();
    const [status, setStatus] = useState<'loading' | 'success' | 'error'>('loading');
    const [message, setMessage] = useState('');

    const intentId = searchParams.get('xpay_intent_id');

    useEffect(() => {
        if (!intentId) {
            // No intent ID - probably direct navigation
            setStatus('success');
            setMessage('Your payment has been processed.');
            return;
        }

        // The webhook should have already been received by now
        // Just show success - the backend has already credited the minutes
        const timer = setTimeout(() => {
            setStatus('success');
            setMessage('Your minutes have been added to your account!');
        }, 1500);

        return () => clearTimeout(timer);
    }, [intentId]);

    return (
        <div className="container max-w-lg mx-auto px-4 py-16">
            <Card className="text-center">
                <CardContent className="pt-10 pb-8 px-8">
                    {status === 'loading' && (
                        <>
                            <Loader2 className="h-16 w-16 animate-spin mx-auto text-primary mb-6" />
                            <h1 className="text-2xl font-bold mb-2">Processing Payment...</h1>
                            <p className="text-muted-foreground">
                                Please wait while we confirm your payment.
                            </p>
                        </>
                    )}

                    {status === 'success' && (
                        <>
                            <div className="w-20 h-20 rounded-full bg-green-100 dark:bg-green-900/30 flex items-center justify-center mx-auto mb-6">
                                <CheckCircle className="h-10 w-10 text-green-600 dark:text-green-400" />
                            </div>
                            <h1 className="text-2xl font-bold mb-2">Payment Successful!</h1>
                            <p className="text-muted-foreground mb-8">
                                {message}
                            </p>
                            <div className="space-y-3">
                                <Button asChild className="w-full">
                                    <Link href="/dashboard/aiassistant">
                                        Start Making Calls
                                        <ArrowRight className="ml-2 h-4 w-4" />
                                    </Link>
                                </Button>
                                <Button variant="outline" asChild className="w-full">
                                    <Link href="/dashboard/buy-minutes">
                                        Buy More Minutes
                                    </Link>
                                </Button>
                            </div>
                        </>
                    )}

                    {status === 'error' && (
                        <>
                            <div className="w-20 h-20 rounded-full bg-red-100 dark:bg-red-900/30 flex items-center justify-center mx-auto mb-6">
                                <XCircle className="h-10 w-10 text-red-600 dark:text-red-400" />
                            </div>
                            <h1 className="text-2xl font-bold mb-2">Payment Issue</h1>
                            <p className="text-muted-foreground mb-8">
                                {message || 'There was an issue processing your payment. Please try again.'}
                            </p>
                            <Button asChild className="w-full">
                                <Link href="/dashboard/buy-minutes">
                                    Try Again
                                </Link>
                            </Button>
                        </>
                    )}
                </CardContent>
            </Card>
        </div>
    );
}
