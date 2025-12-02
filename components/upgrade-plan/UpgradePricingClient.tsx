'use client';

import { useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { CheckCircle } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Alert, AlertTitle, AlertDescription } from '@/components/ui/alert';

// Status message component for checkout feedback
const StatusMessage = ({ status, sessionId }: { status: string | null, sessionId: string | null }) => {
  if (!status) return null;

  if (status === 'success') {
    return (
      <Alert className="mb-6 bg-green-50 border-green-200">
        <AlertTitle className="text-green-800 flex items-center">
          <CheckCircle className="mr-2 h-5 w-5" /> Payment Successful
        </AlertTitle>
        <AlertDescription className="text-green-700">
          Your subscription has been processed successfully. Your new plan features are now available.
          {sessionId && <p className="text-xs mt-1">Session ID: {sessionId}</p>}
        </AlertDescription>
      </Alert>
    );
  }

  if (status === 'cancelled') {
    return (
      <Alert className="mb-6 bg-amber-50 border-amber-200">
        <AlertTitle className="text-amber-800">Payment Cancelled</AlertTitle>
        <AlertDescription className="text-amber-700">
          Your payment process was cancelled. No changes have been made to your subscription.
        </AlertDescription>
      </Alert>
    );
  }

  return null;
};

// Calculate final price using the formula: minutes * (markup / 100)
const calculatePrice = (minutes: number, markup: number): number => {
  const markupInDollars = markup / 100;
  return minutes * markupInDollars;
};

interface PricingProps {
  userId: string;
  agencyId: string;
  pricing: {
    id: string;
    agency_id: string;
    default_min: number;
    default_markup: number;
    midt_min: number;
    midt_markup: number;
    topt_min: number;
    topt_markup: number;
    stripe_account_id?: string;
  };
  subscription: string;
}

export default function UpgradePricingClient({ userId, agencyId, pricing, subscription }: PricingProps) {
  const searchParams = useSearchParams();
  const status = searchParams.get('status');
  const sessionId = searchParams.get('session_id');

  // Feature lists for each tier
  const defaultFeatures = [
    'Basic AI Assistant',
    'Standard Support',
    'Email Integration'
  ];

  const midTierFeatures = [
    'Advanced AI Assistant',
    'Priority Support',
    'Twilio Integration',
    'Advanced Analytics',
    'Custom Voice Options'
  ];

  const topTierFeatures = [
    'Premium AI Assistant',
    '24/7 Premium Support',
    'Full Multi-channel Integration',
    'Real-time Analytics',
    'Custom Voice & Branding',
    'Dedicated Account Manager'
  ];

  const handleUpgrade = async (plan: 'mid' | 'top') => {
    try {
      // Use environment variable for backend URL
      const backendUrl = process.env.NEXT_PUBLIC_STRIPE_BACKEND_URL || 'http://localhost:5000';
      
      // console.log(`Creating checkout session for plan: ${plan}, userId: ${userId}, agencyId: ${agencyId}`);
      
      const res = await fetch(`${backendUrl}/create-checkout-session`, {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Accept': 'application/json'
        },
        body: JSON.stringify({
          plan,
          userId,
          agencyId,
        }),
      });

      if (!res.ok) {
        const errorText = await res.text();
        throw new Error(`Failed to create checkout session: ${res.status} ${res.statusText} - ${errorText}`);
      }

      const data = await res.json();
      
      if (!data.url) {
        throw new Error('No checkout URL returned from server');
      }
      
      console.log(`Redirecting to Stripe checkout: ${data.url.substring(0, 60)}...`);
      window.location.href = data.url;
    } catch (error) {
      console.error('Error creating checkout session:', error);
      alert(`Failed to start checkout process. Please try again. ${error instanceof Error ? error.message : ''}`);
    }
  };

  return (
    <div className="px-12 py-8">
      <h1 className="text-3xl font-bold mb-4 text-center">Upgrade Your Plan</h1>
      
      {/* Display status message if redirected from Stripe */}
      <StatusMessage status={status} sessionId={sessionId} />
        
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Default Tier */}
        <Card className="p-6 border rounded-lg shadow-md">
          <div className="mb-4">
            <h2 className="text-2xl font-bold text-center">Free Tier</h2>
            <p className="text-xl font-bold text-center mt-4">
              $0/month
            </p>
            <p className="text-sm text-center text-gray-500">
              Minimum balance of {pricing.default_min} minutes
            </p>
          </div>
            
          <div className="my-6">
            <h3 className="text-lg font-semibold mb-3">Features</h3>
            <ul className="space-y-2">
              {defaultFeatures.map((feature, index) => (
                <li key={index} className="flex items-center">
                  <CheckCircle className="h-5 w-5 text-green-500 mr-2" />
                  <span>{feature}</span>
                </li>
              ))}
            </ul>
          </div>
            
          {subscription === 'default' ? (
            <Button disabled className="w-full mt-28 bg-gray-700">Current Plan</Button>
          ) : (
            <Button disabled className="w-full mt-28 bg-gray-600 hover:bg-gray-600 text-white">Free Tier</Button>
          )}
        </Card>
            
        {/* Mid Tier */}
        <Card className="p-6 border border-gray-700 rounded-lg shadow-lg relative bg-gray-800/10">
          <div className="absolute -top-3 left-0 right-0 flex justify-center">
            <span className="bg-gray-800 text-white px-3 py-1 rounded-full text-sm">
              Most Popular
            </span>
          </div>
            
          <div className="mb-4">
            <h2 className="text-2xl font-bold text-center text-gray-900">Mid Tier</h2>
            <p className="text-xl font-bold text-center mt-4">
              ${calculatePrice(pricing.midt_min, pricing.midt_markup).toFixed(2)}/month
            </p>
            <p className="text-sm text-center text-gray-500">
              {pricing.midt_min} minutes at ${(pricing.midt_markup / 100).toFixed(2)}/min
            </p>
          </div>
            
          <div className="my-6">
            <h3 className="text-lg font-semibold mb-3">Features</h3>
            <ul className="space-y-2">
              {midTierFeatures.map((feature, index) => (
                <li key={index} className="flex items-center">
                  <CheckCircle className="h-5 w-5 text-green-500 mr-2" />
                  <span>{feature}</span>
                </li>
              ))}
            </ul>
          </div>
            
          {subscription === 'mid' ? (
            <Button disabled className="w-full mt-12 bg-gray-600 hover:bg-gray-600 text-white">
              Current Plan
            </Button>
          ) : (
            <Button 
              onClick={() => handleUpgrade('mid')}
              className="w-full mt-12 bg-gray-800 hover:bg-gray-900 text-white"
            >
              Upgrade to Mid Tier
            </Button>
          ) }
        </Card>
            
        {/* Top Tier */}
        <Card className="p-6 border border-gray-700 rounded-lg shadow-lg relative bg-gray-800/10">
          <div className="absolute -top-3 left-0 right-0 flex justify-center">
            <span className="bg-gray-800 text-white px-3 py-1 rounded-full text-sm">
              Enterprise
            </span>
          </div>
            
          <div className="mb-4">
            <h2 className="text-2xl font-bold text-center text-gray-900">Top Tier</h2>
            <p className="text-xl font-bold text-center mt-4">
              ${calculatePrice(pricing.topt_min, pricing.topt_markup).toFixed(2)}/month
            </p>
            <p className="text-sm text-center text-gray-500">
              {pricing.topt_min} minutes at ${(pricing.topt_markup / 100).toFixed(2)}/min
            </p>
          </div>
            
          <div className="my-6">
            <h3 className="text-lg font-semibold mb-3">Features</h3>
            <ul className="space-y-2">
              {topTierFeatures.map((feature, index) => (
                <li key={index} className="flex items-center">
                  <CheckCircle className="h-5 w-5 text-green-500 mr-2" />
                  <span>{feature}</span>
                </li>
              ))}
            </ul>
          </div>
            
          {subscription === 'top' ? (
            <Button disabled className="w-full mt-4 bg-gray-600 hover:bg-gray-600 text-white">
              Current Plan
            </Button>
          ) : (
            <Button 
              onClick={() => handleUpgrade('top')}
              className="w-full mt-4 bg-gray-800 hover:bg-gray-900 text-white"
            >
              Upgrade to Top Tier
            </Button>
          ) }
        </Card>
      </div>
    </div>
  );
} 