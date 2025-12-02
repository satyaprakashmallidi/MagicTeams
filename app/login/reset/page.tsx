'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import {createClient} from '@/utils/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Icon } from '@/components/ui/icons';

export default function ResetPasswordPage() {
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const router = useRouter();
  const supabase = createClient();
  

  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setSuccessMessage(null);

    try {
      // Simple password reset without redirect
      const { error } = await supabase.auth.resetPasswordForEmail(email, { redirectTo: 'https://magicteams.netlify.app/login/update-password' });
      
      if (error) throw error;
      setSuccessMessage(
        'Password reset instructions have been sent to your email. Click the link in the email to reset your password.'
      );  
    } catch (error: any) {
      console.error('Error resetting password:', error);
      setError(error.message || 'An error occurred while requesting password reset');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="max-w-md w-full space-y-8 p-8 bg-white rounded-xl shadow-lg">
        <div className="text-center">
          <h2 className="mt-6 text-3xl font-bold text-gray-900">Reset Password</h2>
          <p className="mt-2 text-sm text-gray-600">
            Enter your email address and we'll send you instructions to reset your password
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

        <form className="mt-8 space-y-6" onSubmit={handleResetPassword}>
          <div className="space-y-4">
            <div>
              <Label htmlFor="email">Email address</Label>
              <Input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                className="mt-1"
                placeholder="Enter your email"
                disabled={loading}
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
                'Send Reset Instructions'
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