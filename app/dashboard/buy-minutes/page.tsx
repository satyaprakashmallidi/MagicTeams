'use client';

import { useEffect, useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { ShoppingCart, Clock, Zap, Star, CheckCircle, TrendingUp, AlertCircle } from 'lucide-react';
import { useUser } from '@/hooks/use-user';
import { useToast } from '@/hooks/use-toast';
import { useSearchParams, useRouter } from 'next/navigation';

interface MinutePackage {
  id: string;
  name: string;
  description: string;
  minutes: number;
  price_usd: number;
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

  // ❌ BLOCK: Redirect agency users away from this page
  useEffect(() => {
    if (user?.user_metadata?.agency_id) {
      console.log('[BuyMinutes] ❌ Agency user detected, redirecting to dashboard');
      toast({
        title: 'Access Restricted',
        description: 'Agency users cannot purchase minutes directly. Please contact your agency administrator for minute allocation.',
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

  const handlePurchase = async (packageId: string) => {
    if (!user?.id) {
      toast({
        title: 'Authentication Required',
        description: 'Please log in to purchase minutes',
        variant: 'destructive',
      });
      return;
    }

    try {
      setPurchasing(packageId);

      const response = await fetch('/api/create-direct-checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          packageId,
          userId: user.id
        })
      });

      const data = await response.json();

      if (data.success && data.url) {
        // Redirect to Stripe checkout
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

  const getPackageIcon = (index: number) => {
    const icons = [Clock, Zap, Star, TrendingUp];
    const Icon = icons[index] || Clock;
    return Icon;
  };

  const getPackageBadge = (index: number) => {
    if (index === 1) return { text: 'Most Popular', variant: 'default' as const };
    if (index === 2) return { text: 'Best Value', variant: 'secondary' as const };
    return null;
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="text-center space-y-4">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto"></div>
          <p className="text-muted-foreground">Loading minute packages...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-background to-muted/20">
      <div className="container mx-auto px-4 py-12 space-y-12">
        {/* Header Section */}
        <div className="text-center space-y-6 max-w-3xl mx-auto">
          <div className="inline-flex items-center gap-2 px-4 py-2 bg-primary/10 text-primary rounded-full text-sm font-medium">
            <Zap className="h-4 w-4" />
            <span>Simple, Transparent Pricing</span>
          </div>
          <h1 className="text-5xl md:text-6xl font-bold bg-gradient-to-r from-primary via-primary/80 to-primary/60 bg-clip-text text-transparent leading-tight">
            Buy AI Calling Minutes
          </h1>
          <p className="text-xl text-muted-foreground leading-relaxed">
            Choose a package that fits your needs. Minutes never expire and can be used anytime.
          </p>
        </div>

        {/* Cancelled Alert */}
        {cancelled && (
          <Alert className="max-w-3xl mx-auto border-orange-200 bg-orange-50 dark:bg-orange-950 dark:border-orange-800">
            <AlertCircle className="h-4 w-4 text-orange-600 dark:text-orange-400" />
            <AlertDescription className="text-orange-800 dark:text-orange-200">
              Payment was cancelled. No charges were made to your account.
            </AlertDescription>
          </Alert>
        )}

        {/* Packages Grid */}
        <div className="grid gap-8 md:grid-cols-2 lg:grid-cols-4 max-w-7xl mx-auto">
          {packages.map((pkg, index) => {
            const Icon = getPackageIcon(index);
            const badge = getPackageBadge(index);
            const pricePerMinute = pkg.price_usd / pkg.minutes;

            return (
              <Card
                key={pkg.id}
                className={`relative overflow-hidden transition-all duration-300 hover:shadow-2xl hover:-translate-y-2 group ${
                  badge
                    ? 'border-primary border-2 shadow-xl scale-105 bg-gradient-to-b from-primary/5 to-background'
                    : 'hover:border-primary/50 bg-card'
                }`}
              >
                {/* Badge */}
                {badge && (
                  <div className="absolute -top-3 left-0 right-0 flex justify-center z-10">
                    <Badge variant={badge.variant} className="shadow-lg px-4 py-1 text-xs font-semibold">
                      ⭐ {badge.text}
                    </Badge>
                  </div>
                )}

                <CardHeader className="text-center pb-6 pt-10">
                  {/* Icon */}
                  <div className={`mx-auto mb-4 p-4 rounded-2xl w-fit transition-all ${
                    badge
                      ? 'bg-gradient-to-br from-primary/20 to-primary/10 group-hover:scale-110'
                      : 'bg-gradient-to-br from-primary/10 to-primary/5 group-hover:scale-105'
                  }`}>
                    <Icon className={`h-10 w-10 ${badge ? 'text-primary' : 'text-primary/80'}`} />
                  </div>

                  <CardTitle className="text-2xl font-bold">{pkg.name}</CardTitle>
                  <CardDescription className="min-h-[45px] text-sm">{pkg.description}</CardDescription>
                </CardHeader>

                <CardContent className="space-y-6 px-6 pb-6">
                  {/* Price */}
                  <div className="text-center space-y-1">
                    <div className={`text-5xl font-bold ${badge ? 'text-primary' : 'text-foreground'}`}>
                      ${pkg.price_usd.toFixed(0)}
                    </div>
                    <div className="text-xs text-muted-foreground font-medium">one-time payment</div>
                  </div>

                  {/* Minutes Display */}
                  <div className={`text-center py-6 rounded-xl border transition-all ${
                    badge
                      ? 'bg-gradient-to-br from-primary/10 to-primary/20 border-primary/30 shadow-inner'
                      : 'bg-gradient-to-br from-muted/50 to-muted border-muted'
                  }`}>
                    <div className="text-5xl font-extrabold text-foreground">
                      {pkg.minutes.toLocaleString()}
                    </div>
                    <div className="text-sm font-semibold text-muted-foreground mt-2">minutes</div>
                    <div className="text-xs text-muted-foreground mt-2 font-mono">
                      $0.1000/min
                    </div>
                  </div>

                  {/* Features */}
                  <ul className="space-y-3 py-2">
                    <li className="flex items-start text-sm group/item">
                      <CheckCircle className="h-4 w-4 text-green-500 mr-3 mt-0.5 flex-shrink-0 group-hover/item:scale-110 transition-transform" />
                      <span className="font-medium">AI Voice Calling</span>
                    </li>
                    <li className="flex items-start text-sm group/item">
                      <CheckCircle className="h-4 w-4 text-green-500 mr-3 mt-0.5 flex-shrink-0 group-hover/item:scale-110 transition-transform" />
                      <span className="font-medium">Never Expires</span>
                    </li>
                    <li className="flex items-start text-sm group/item">
                      <CheckCircle className="h-4 w-4 text-green-500 mr-3 mt-0.5 flex-shrink-0 group-hover/item:scale-110 transition-transform" />
                      <span className="font-medium">Instant Activation</span>
                    </li>
                    <li className="flex items-start text-sm group/item">
                      <CheckCircle className="h-4 w-4 text-green-500 mr-3 mt-0.5 flex-shrink-0 group-hover/item:scale-110 transition-transform" />
                      <span className="font-medium">24/7 Support</span>
                    </li>
                  </ul>

                  {/* Buy Button */}
                  <Button
                    className={`w-full h-12 text-base font-bold transition-all ${
                      badge
                        ? 'shadow-lg hover:shadow-xl'
                        : 'shadow-sm hover:shadow-md'
                    }`}
                    onClick={() => handlePurchase(pkg.id)}
                    disabled={purchasing !== null}
                    variant={badge ? 'default' : 'outline'}
                    size="lg"
                  >
                    {purchasing === pkg.id ? (
                      <>
                        <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2" />
                        Processing...
                      </>
                    ) : (
                      <>
                        <ShoppingCart className="h-5 w-5 mr-2" />
                        Buy Now
                    </>
                  )}
                </Button>
              </CardContent>
            </Card>
          );
        })}
      </div>

        {/* Info Section */}
        <div className="max-w-6xl mx-auto mt-20">
          <div className="text-center mb-12">
            <h2 className="text-3xl md:text-4xl font-bold mb-4">
              Why Choose MagicTeams Minutes?
            </h2>
            <p className="text-lg text-muted-foreground">
              The smart way to power your AI calling campaigns
            </p>
          </div>

          <div className="grid md:grid-cols-2 gap-8">
            <Card className="border-2 hover:border-primary/50 transition-all hover:shadow-lg group">
              <CardContent className="flex gap-5 p-6">
                <div className="p-4 bg-gradient-to-br from-green-500/10 to-green-500/5 rounded-xl h-fit group-hover:scale-110 transition-transform">
                  <CheckCircle className="h-7 w-7 text-green-500" />
                </div>
                <div className="space-y-2">
                  <h3 className="font-bold text-xl">Pay As You Go</h3>
                  <p className="text-sm text-muted-foreground leading-relaxed">
                    Only pay for what you need. No monthly commitments or hidden fees. Cancel anytime.
                  </p>
                </div>
              </CardContent>
            </Card>

            <Card className="border-2 hover:border-primary/50 transition-all hover:shadow-lg group">
              <CardContent className="flex gap-5 p-6">
                <div className="p-4 bg-gradient-to-br from-blue-500/10 to-blue-500/5 rounded-xl h-fit group-hover:scale-110 transition-transform">
                  <Clock className="h-7 w-7 text-blue-500" />
                </div>
                <div className="space-y-2">
                  <h3 className="font-bold text-xl">Never Expire</h3>
                  <p className="text-sm text-muted-foreground leading-relaxed">
                    Your minutes roll over indefinitely. Use them whenever you need, at your own pace.
                  </p>
                </div>
              </CardContent>
            </Card>

            <Card className="border-2 hover:border-primary/50 transition-all hover:shadow-lg group">
              <CardContent className="flex gap-5 p-6">
                <div className="p-4 bg-gradient-to-br from-amber-500/10 to-amber-500/5 rounded-xl h-fit group-hover:scale-110 transition-transform">
                  <Zap className="h-7 w-7 text-amber-500" />
                </div>
                <div className="space-y-2">
                  <h3 className="font-bold text-xl">Instant Activation</h3>
                  <p className="text-sm text-muted-foreground leading-relaxed">
                    Minutes are added to your account immediately after purchase. Start calling right away.
                  </p>
                </div>
              </CardContent>
            </Card>

            <Card className="border-2 hover:border-primary/50 transition-all hover:shadow-lg group">
              <CardContent className="flex gap-5 p-6">
                <div className="p-4 bg-gradient-to-br from-purple-500/10 to-purple-500/5 rounded-xl h-fit group-hover:scale-110 transition-transform">
                  <ShoppingCart className="h-7 w-7 text-purple-500" />
                </div>
                <div className="space-y-2">
                  <h3 className="font-bold text-xl">Secure Payment</h3>
                  <p className="text-sm text-muted-foreground leading-relaxed">
                    Protected by Stripe's industry-leading security. Your payment information is always safe.
                  </p>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
}
