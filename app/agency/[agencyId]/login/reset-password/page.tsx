'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Icon } from '@/components/ui/icons';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { agencyPasswordReset } from '../actions';

interface ResetPasswordPageProps {
  params: {
    agencyId: string
  }
}

export default function ResetPasswordPage({ params }: ResetPasswordPageProps) {
  const { agencyId } = params;
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const router = useRouter();

  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setSuccessMessage(null);

    try {
      // Use our custom server action that handles Resend/Supabase
      const result = await agencyPasswordReset(email, agencyId);

      if (result.error) {
        setError(result.error);
        return;
      }

      setSuccessMessage(result.message || 'Password reset instructions have been sent to your email.');

      // Wait 5 seconds before redirecting back to login
      setTimeout(() => {
        router.push(`/agency/${agencyId}/login`);
      }, 5000);
    } catch (error: any) {
      console.error('Error resetting password:', error);
      setError('An error occurred while requesting password reset');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-background/95">
      <Card className="w-full max-w-md">
        <CardHeader className="space-y-1">
          <CardTitle className="text-2xl font-bold tracking-tight">
            Reset Password
          </CardTitle>
          <CardDescription>
            Enter your email address and we'll send you instructions to reset your password
          </CardDescription>
        </CardHeader>
        
        {error && (
          <div className="mx-6 mb-4 p-4 bg-destructive/10 border border-destructive/20 rounded-md text-sm text-destructive">
            {error}
          </div>
        )}
        
        {successMessage && (
          <div className="mx-6 mb-4 p-4 bg-green-500/10 border border-green-500/20 rounded-md text-sm text-green-500">
            {successMessage}
          </div>
        )}
        
        <form onSubmit={handleResetPassword}>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                placeholder="name@example.com"
                disabled={loading}
              />
            </div>
          </CardContent>
          <CardFooter className="flex flex-col space-y-4">
            <div className="w-full space-y-2">
              <Button
                type="submit"
                className="w-full"
                disabled={loading}
              >
                {loading ? (
                  <>
                    <Icon name="loader2" className="mr-2 h-4 w-4 animate-spin" />
                    Sending instructions
                  </>
                ) : (
                  'Send Reset Instructions'
                )}
              </Button>
              <Button
                type="button"
                variant="ghost"
                className="w-full"
                onClick={() => router.push(`/agency/${agencyId}/login`)}
              >
                Back to Login
              </Button>
            </div>
          </CardFooter>
        </form>
      </Card>
    </div>
  );
}