'use client';

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Check } from "lucide-react";

const pricingPlans = [
  {
    name: "Limited",
    price: "0.15",
    unit: "Cents/Minute",
    description: "Perfect for individuals and small teams",
    features: [
      "Ultra-low Latency: 125ms, ensuring real-time communication",
      "Languages Supported: 5 languages with more being added",
      "Upto 2,500 minutes",
      "Voice Cloning: Clone a voice in just 2 minutes",
      "AI Audio Intelligence: Basic features for better call handling",
      "Create upto 10 Voice Agent Creation",
      "AI Script Templates: Ready-made templates for sales calls",
      "Call Recording and Transcription: Keep records for review and analysis",
    ],
    ctaText: "Get Started",
  },
  {
    name: "Business",
    price: "0.12",
    unit: "Cents/Minute",
    description: "Ideal for growing businesses",
    popular: true,
    features: [
      "Ultra-low Latency: 125ms, ensuring real-time communication",
      "Languages Supported: 15 languages with more being added",
      "Upto 10,000 minutes",
      "Voice Cloning: Clone a voice in just 2 minutes",
      "AI Audio Intelligence: Basic features for better call handling",
      "Unlimited Voice Agent Creation",
      "AI Script Templates: Ready-made templates for sales calls",
      "Call Recording and Transcription: Keep records for review and analysis",
    ],
    ctaText: "Get Started",
  },
  {
    name: "Agency / Enterprise",
    price: "Custom",
    unit: "",
    description: "For large organizations with custom needs",
    features: [
      "Ultra-low Latency: 125ms for real-time responsiveness",
      "Languages Supported: 15+ languages for global reach",
      "Greater than 10,000 and above minutes",
      "Voice Cloning: Clone a voice in 2 minutes",
      "Advanced AI Intelligence: Superior noise reduction",
      "Premium Support: Dedicated assistance and troubleshooting",
      "Call Recording and Transcription",
      "Real-Time Call Streaming",
      "AI script templates for both sales and support",
      "Automated booking and scheduling",
    ],
    ctaText: "Contact Sales",
  },
];

export default function PricingPage() {
  return (
    <div className="container mx-auto py-10">
      <div className="text-center mb-10">
        <h1 className="text-3xl font-bold tracking-tight">Transparent Pricing</h1>
        <p className="text-muted-foreground mt-2">
          Choose the perfect plan for your needs. All plans include a free trial period.
        </p>
      </div>

      <div className="grid md:grid-cols-3 gap-6">
        {pricingPlans.map((plan) => (
          <Card 
            key={plan.name} 
            className={`flex flex-col ${
              plan.popular ? 'border-primary shadow-lg' : ''
            }`}
          >
            <CardHeader>
              {plan.popular && (
                <div className="px-3 py-1 text-sm text-primary-foreground bg-primary rounded-full w-fit mb-2">
                  Most Popular
                </div>
              )}
              <CardTitle>{plan.name}</CardTitle>
              <CardDescription>{plan.description}</CardDescription>
              <div className="mt-4">
                <span className="text-4xl font-bold">${plan.price}</span>
                {plan.unit && (
                  <span className="text-muted-foreground ml-2">{plan.unit}</span>
                )}
              </div>
            </CardHeader>
            <CardContent className="flex-1">
              <p className="text-sm text-muted-foreground mb-6">
                Cancel anytime
              </p>
              <ul className="space-y-4">
                {plan.features.map((feature, i) => (
                  <li key={i} className="flex items-start gap-3">
                    <Check className="h-5 w-5 text-primary flex-shrink-0 mt-0.5" />
                    <span className="text-sm">{feature}</span>
                  </li>
                ))}
              </ul>
            </CardContent>
            <CardFooter>
              <Button 
                className="w-full" 
                variant={plan.popular ? "default" : "outline"}
              >
                {plan.ctaText}
              </Button>
            </CardFooter>
          </Card>
        ))}
      </div>
    </div>
  );
}
