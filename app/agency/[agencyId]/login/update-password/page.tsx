'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { createClientComponentClient } from '@supabase/auth-helpers-nextjs';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Icon } from '@/components/ui/icons';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";

interface UpdatePasswordPageProps {
  params: {
    agencyId: string
  }
}

export default function UpdatePasswordPage({ params }: UpdatePasswordPageProps) {
  const { agencyId } = params;
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const router = useRouter();
  const supabase = createClientComponentClient();

  useEffect(() => {
    // Check if user is authenticated with a recovery token
    const checkSession = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        router.push(`/agency/${agencyId}/login`);
      }
    };
    checkSession();
  }, [router, supabase.auth, agencyId]);

  const handleUpdatePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setSuccessMessage(null);

    if (password !== confirmPassword) {
      setError('Passwords do not match');
      setLoading(false);
      return;
    }

    try {
      const { error } = await supabase.auth.updateUser({
        password: password
      });

      if (error) throw error;

      setSuccessMessage('Password has been updated successfully');
      
      // Wait for 2 seconds before redirecting to login
      setTimeout(() => {
        router.push(`/agency/${agencyId}/login`);
      }, 2000);
    } catch (error: any) {
      console.error('Error updating password:', error);
      setError(error.message || 'An error occurred while updating password');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-background/95">
      <Card className="w-full max-w-md">
        <CardHeader className="space-y-1">
          <CardTitle className="text-2xl font-bold tracking-tight">
            Update Password
          </CardTitle>
          <CardDescription>
            Please enter your new password
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
        
        <form onSubmit={handleUpdatePassword}>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="password">New Password</Label>
              <Input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                placeholder="Enter your new password"
                disabled={loading}
                minLength={6}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="confirmPassword">Confirm Password</Label>
              <Input
                id="confirmPassword"
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                required
                placeholder="Confirm your new password"
                disabled={loading}
                minLength={6}
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
                    Updating password...
                  </>
                ) : (
                  'Update Password'
                )}
              </Button>
              <Button
                type="button"
                variant="ghost"
                className="w-full"
                onClick={() => router.push(`/agency/${agencyId}/login`)}
                disabled={loading}
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