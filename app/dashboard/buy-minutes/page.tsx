'use client';

import { useEffect, useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Check, Loader2 } from 'lucide-react';
import { useUser } from '@/hooks/use-user';
import { useToast } from '@/hooks/use-toast';
import { useSearchParams, useRouter } from 'next/navigation';

interface MinutePackage {
  id: string;
  name: string;
  description: string;
  minutes: number;
  price_usd: number;
  price_cents: number;
  is_active: boolean;
  sort_order: number;
}

export default function BuyMinutesPage() {
  const [packages, setPackages] = useState<MinutePackage[]>([]);
  const [loading, setLoading] = useState(true);
  const [purchasing, setPurchasing] = useState<string | null>(null);
  const { user } = useUser();
  const { toast } = useToast();
  const searchParams = useSearchParams();
  const router = useRouter();
  const cancelled = searchParams.get('cancelled');

  // Redirect agency users away from this page
  useEffect(() => {
    if (user?.user_metadata?.agency_id) {
      toast({
        title: 'Access Restricted',
        description: 'Please contact your agency administrator for minute allocation.',
        variant: 'destructive',
      });
      router.push('/dashboard');
    }
  }, [user, router, toast]);

  useEffect(() => {
    if (cancelled) {
      toast({
        title: 'Payment Cancelled',
        description: 'No charges were made to your account.',
      });
    }
    loadPackages();
  }, []);

  const loadPackages = async () => {
    try {
      setLoading(true);
      const response = await fetch('/api/direct-minute-packages');
      const data = await response.json();

      if (data.success) {
        setPackages(data.packages);
      } else {
        toast({
          title: 'Error',
          description: 'Failed to load packages',
          variant: 'destructive',
        });
      }
    } catch (error: any) {
      console.error('Error loading packages:', error);
      toast({
        title: 'Error',
        description: 'Failed to load minute packages',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const handlePurchase = async (pkg: MinutePackage) => {
    if (!user?.id) {
      toast({
        title: 'Authentication Required',
        description: 'Please log in to purchase minutes',
        variant: 'destructive',
      });
      return;
    }

    try {
      setPurchasing(pkg.id);

      // Call xPay create-intent API
      const response = await fetch('/api/xpay/create-intent', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          packageId: pkg.id,
          userId: user.id
        })
      });

      const data = await response.json();

      if (data.success && data.url) {
        window.location.href = data.url;
      } else {
        toast({
          title: 'Error',
          description: data.error || 'Failed to start checkout',
          variant: 'destructive',
        });
        setPurchasing(null);
      }
    } catch (error: any) {
      console.error('Error creating checkout:', error);
      toast({
        title: 'Error',
        description: 'Failed to start checkout process',
        variant: 'destructive',
      });
      setPurchasing(null);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="text-center space-y-4">
          <Loader2 className="h-8 w-8 animate-spin mx-auto text-primary" />
          <p className="text-muted-foreground">Loading packages...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="container max-w-6xl mx-auto px-4 py-8">
      {/* Header */}
      <div className="text-center mb-10">
        <h1 className="text-3xl font-bold mb-2">Buy AI Calling Minutes</h1>
        <p className="text-muted-foreground">
          Simple pricing. No hidden fees. Minutes never expire.
        </p>
      </div>

      {/* Packages Grid */}
      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
        {packages.map((pkg, index) => {
          const isPopular = index === 1;

          return (
            <Card
              key={pkg.id}
              className={`relative transition-all hover:shadow-lg ${isPopular ? 'border-primary border-2 shadow-md' : ''
                }`}
            >
              {/* Popular Badge */}
              {isPopular && (
                <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                  <Badge className="bg-primary text-primary-foreground px-3">
                    Popular
                  </Badge>
                </div>
              )}

              <CardContent className="pt-8 pb-6 px-6">
                {/* Package Name */}
                <h3 className="text-lg font-semibold text-center mb-1">
                  {pkg.name}
                </h3>
                <p className="text-sm text-muted-foreground text-center mb-6">
                  {pkg.description}
                </p>

                {/* Price */}
                <div className="text-center mb-6">
                  <div className="text-4xl font-bold">
                    ${pkg.price_usd.toFixed(0)}
                  </div>
                  <div className="text-xs text-muted-foreground">
                    one-time payment
                  </div>
                </div>

                {/* Minutes */}
                <div className="bg-muted/50 rounded-lg py-4 px-4 text-center mb-6">
                  <div className="text-3xl font-bold">
                    {pkg.minutes.toLocaleString()}
                  </div>
                  <div className="text-sm text-muted-foreground">
                    minutes
                  </div>
                </div>

                {/* Features */}
                <ul className="space-y-2 mb-6 text-sm">
                  <li className="flex items-center gap-2">
                    <Check className="h-4 w-4 text-green-500 flex-shrink-0" />
                    <span>AI Voice Calling</span>
                  </li>
                  <li className="flex items-center gap-2">
                    <Check className="h-4 w-4 text-green-500 flex-shrink-0" />
                    <span>Never Expires</span>
                  </li>
                  <li className="flex items-center gap-2">
                    <Check className="h-4 w-4 text-green-500 flex-shrink-0" />
                    <span>Instant Activation</span>
                  </li>
                </ul>

                {/* Buy Button */}
                <Button
                  className="w-full"
                  variant={isPopular ? 'default' : 'outline'}
                  onClick={() => handlePurchase(pkg)}
                  disabled={purchasing !== null}
                >
                  {purchasing === pkg.id ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin mr-2" />
                      Processing...
                    </>
                  ) : (
                    'Buy Now'
                  )}
                </Button>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Simple Info Section */}
      <div className="mt-12 text-center">
        <p className="text-sm text-muted-foreground max-w-lg mx-auto">
          All packages are one-time purchases with instant activation.
          Minutes are added to your account immediately and never expire.
          Payments are processed securely.
        </p>
      </div>
    </div>
  );
}
