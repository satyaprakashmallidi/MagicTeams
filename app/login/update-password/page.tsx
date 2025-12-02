'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import {createClient} from '@/utils/supabase/client'

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Icon } from '@/components/ui/icons';

export default function UpdatePasswordPage() {
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const router = useRouter();
  const supabase = createClient();
 


  const handleAuthCallback = async () => {
    try {
      // Check for existing session first
      const { data: { session: existingSession }, error: sessionError } = await supabase.auth.getSession();
      if (existingSession) {
        console.log('Already have valid session:', existingSession.user?.email);
        setLoading(false);
        return;
      }

      const searchParams = new URLSearchParams(window.location.search);
      const code = searchParams.get('code');
      
      if (!code) {
        setError('No authentication code found. Please use the link from your email.');
        setLoading(false);
        return;
      }
      
      // Try the exchange
      const { data, error: exchangeError } = await supabase.auth.exchangeCodeForSession(
        window.location.href
      );
      
      if (exchangeError) {
        console.log('Exchange error:', exchangeError);
        setError('Invalid or expired reset link');
        setLoading(false);
        return;
      }

  
      const { data: { session } } = await supabase.auth.getSession();
      if (!session ){
        router.push('/login');
      } 
    } catch (err) {
      console.error('Unexpected error during auth callback:', err);
      setError('Something went wrong. Please try again.');
    } finally {
      setLoading(false);
    }
  };


  useEffect(() => {
    handleAuthCallback();
  }, []);
  

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
        router.push('/login');
      }, 2000);
    } catch (error: any) {
      console.error('Error updating password:', error);
      setError(error.message || 'An error occurred while updating password');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="max-w-md w-full space-y-8 p-8 bg-white rounded-xl shadow-lg">
        <div className="text-center">
          <h2 className="mt-6 text-3xl font-bold text-gray-900">Update Password</h2>
          <p className="mt-2 text-sm text-gray-600">
            Please enter your new password
          </p>
        </div>

        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded relative" role="alert">
            <span className="block sm:inline">{error}</span>
          </div>
        )}

        {successMessage && (
          <div className="bg-green-50 border border-green-200 text-green-700 px-4 py-3 rounded relative" role="alert">
            <span className="block sm:inline">{successMessage}</span>
          </div>
        )}

        <form className="mt-8 space-y-6" onSubmit={handleUpdatePassword}>
          <div className="space-y-4">
            <div>
              <Label htmlFor="password">New Password</Label>
              <Input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                className="mt-1"
                placeholder="Enter your new password"
                disabled={loading}
                minLength={6}
              />
            </div>

            <div>
              <Label htmlFor="confirmPassword">Confirm Password</Label>
              <Input
                id="confirmPassword"
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                required
                className="mt-1"
                placeholder="Confirm your new password"
                disabled={loading}
                minLength={6}
              />
            </div>
          </div>

          <div className="space-y-4">
            <Button
              type="submit"
              className="w-full flex justify-center py-2"
              disabled={loading}
            >
              {loading ? (
                <Icon name="loader2" className="h-4 w-4 animate-spin" />
              ) : (
                'Update Password'
              )}
            </Button>

            <Button
              type="button"
              variant="outline"
              className="w-full"
              onClick={() => router.push('/login')}
            >
              Back to Login
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
