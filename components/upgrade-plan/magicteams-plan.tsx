'use client';

import { CheckCircle } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';

export default function DefaultPlan() {
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

  return (
    <div className="px-12 py-8">
      <h1 className="text-3xl font-bold mb-8 text-center">Upgrade Your Plan</h1>
        
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Default Tier */}
        <Card className="p-6 border rounded-lg shadow-md">
          <div className="mb-4">
            <h2 className="text-2xl font-bold text-center">Free Tier</h2>
            <p className="text-xl font-bold text-center mt-4">
              $0/month
            </p>
            <p className="text-sm text-center text-gray-500">
              Minimum balance of 10 minutes
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
            
          <Button disabled className="w-full mt-28">Current Plan</Button>
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
              $20/month
            </p>
            <p className="text-sm text-center text-gray-500">
              100 minutes at $0.20/min
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
            
          
            <input type="hidden" name="tier" value="mid" />
            <Button type="submit" className="w-full mt-12 bg-gray-800 hover:bg-gray-900 text-white" onClick={(e) => {
              // TODO: Implement upgrade functionality
              e.preventDefault();
              alert('Upgrade functionality will be implemented soon!');
            }}>
              Upgrade to Mid Tier
            </Button>
         
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
              $30/month
            </p>
            <p className="text-sm text-center text-gray-500">
              200 minutes at $0.15/min
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
            
         
            <input type="hidden" name="tier" value="top" />
            <Button type="submit" className="w-full mt-4 bg-gray-800 hover:bg-gray-900 text-white" onClick={(e) => {
              // TODO: Implement upgrade functionality
              e.preventDefault();
              alert('Upgrade functionality will be implemented soon!');
            }}>
              Upgrade to Top Tier
            </Button>
          
        </Card>
      </div>
    </div>
  );
}   