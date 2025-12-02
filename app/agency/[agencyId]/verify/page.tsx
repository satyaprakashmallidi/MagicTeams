'use client';

import { useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { createClientComponentClient } from '@supabase/auth-helpers-nextjs';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Icon } from '@/components/ui/icons';
import { Button } from '@/components/ui/button';

interface VerifyEmailPageProps {
  params: {
    agencyId: string
  }
}

export default function VerifyEmailPage({ params }: VerifyEmailPageProps) {
  const { agencyId } = params;
  const router = useRouter();
  const searchParams = useSearchParams();
  const supabase = createClientComponentClient();

  const [verificationStatus, setVerificationStatus] = useState<'loading' | 'success' | 'error'>('loading');
  const [errorMessage, setErrorMessage] = useState<string>('');

  useEffect(() => {
    const verifyEmail = async () => {
      try {
        // Check if we have the hash fragment from email link (format: #access_token=xxx&refresh_token=xxx)
        // Supabase admin.generateLink creates this format
        const hashParams = new URLSearchParams(window.location.hash.substring(1));
        const accessToken = hashParams.get('access_token');
        const refreshToken = hashParams.get('refresh_token');

        // Also check for token in query params (alternative format)
        const token = searchParams.get('token');
        const tokenHash = searchParams.get('token_hash');
        const type = searchParams.get('type') || 'signup';

        console.log('[VERIFY] Verification attempt:', {
          hasAccessToken: !!accessToken,
          hasToken: !!token,
          hasTokenHash: !!tokenHash,
          type
        });

        // Method 1: If we have access_token in hash (admin.generateLink format)
        if (accessToken && refreshToken) {
          console.log('[VERIFY] Using access token from hash fragment');

          const { data, error } = await supabase.auth.setSession({
            access_token: accessToken,
            refresh_token: refreshToken,
          });

          if (error) {
            console.error('[VERIFY] Session creation error:', error);
            setVerificationStatus('error');
            setErrorMessage(error.message || 'Failed to create session.');
            return;
          }

          if (data?.session) {
            console.log('[VERIFY] Email verified successfully, session created');
            setVerificationStatus('success');

            // Redirect to dashboard after 2 seconds
            setTimeout(() => {
              router.push('/dashboard/aiassistant');
            }, 2000);
          }
          return;
        }

        // Method 2: If we have token_hash in query params
        if (tokenHash || token) {
          console.log('[VERIFY] Using token hash from query params');

          const { data, error } = await supabase.auth.verifyOtp({
            token_hash: tokenHash || token!,
            type: type as any,
          });

          if (error) {
            console.error('[VERIFY] Verification error:', error);
            setVerificationStatus('error');
            setErrorMessage(error.message || 'Failed to verify email. The link may have expired.');
            return;
          }

          if (data?.session) {
            console.log('[VERIFY] Email verified successfully');
            setVerificationStatus('success');

            // Redirect to dashboard after 2 seconds
            setTimeout(() => {
              router.push('/dashboard/aiassistant');
            }, 2000);
          } else {
            setVerificationStatus('error');
            setErrorMessage('Verification completed but no session was created.');
          }
          return;
        }

        // No token found
        setVerificationStatus('error');
        setErrorMessage('No verification token found in the URL.');

      } catch (err) {
        console.error('[VERIFY] Unexpected error:', err);
        setVerificationStatus('error');
        setErrorMessage('An unexpected error occurred during verification.');
      }
    };

    verifyEmail();
  }, [searchParams, supabase, router]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-background/95">
      <Card className="w-full max-w-md">
        <CardHeader className="space-y-1">
          <CardTitle className="text-2xl font-bold tracking-tight text-center">
            {verificationStatus === 'loading' && 'Verifying Email...'}
            {verificationStatus === 'success' && 'Email Verified! ✓'}
            {verificationStatus === 'error' && 'Verification Failed'}
          </CardTitle>
          <CardDescription className="text-center">
            {verificationStatus === 'loading' && 'Please wait while we verify your email address'}
            {verificationStatus === 'success' && 'Your email has been successfully verified'}
            {verificationStatus === 'error' && 'There was a problem verifying your email'}
          </CardDescription>
        </CardHeader>

        <CardContent className="flex flex-col items-center space-y-4 pb-8">
          {verificationStatus === 'loading' && (
            <div className="flex flex-col items-center space-y-4">
              <Icon name="loader2" className="h-12 w-12 animate-spin text-primary" />
              <p className="text-sm text-muted-foreground">Verifying your email address...</p>
            </div>
          )}

          {verificationStatus === 'success' && (
            <div className="flex flex-col items-center space-y-4">
              <div className="rounded-full bg-green-500/20 p-4">
                <Icon name="check" className="h-12 w-12 text-green-500" />
              </div>
              <div className="text-center space-y-2">
                <p className="text-sm text-muted-foreground">
                  Your account is now active! Redirecting you to the dashboard...
                </p>
                <div className="flex items-center justify-center space-x-2">
                  <Icon name="loader2" className="h-4 w-4 animate-spin" />
                  <span className="text-xs text-muted-foreground">Redirecting in 2 seconds...</span>
                </div>
              </div>
            </div>
          )}

          {verificationStatus === 'error' && (
            <div className="flex flex-col items-center space-y-4 w-full">
              <div className="rounded-full bg-red-500/20 p-4">
                <Icon name="x" className="h-12 w-12 text-red-500" />
              </div>
              <div className="text-center space-y-2">
                <p className="text-sm text-destructive">
                  {errorMessage}
                </p>
                <p className="text-xs text-muted-foreground">
                  This could happen if the link has expired or has already been used.
                </p>
              </div>
              <div className="w-full space-y-2 pt-4">
                <Button
                  className="w-full"
                  onClick={() => router.push(`/agency/${agencyId}/login`)}
                >
                  Go to Login
                </Button>
                <Button
                  variant="outline"
                  className="w-full"
                  onClick={() => router.push(`/agency/${agencyId}/login`)}
                >
                  Request New Verification Email
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
