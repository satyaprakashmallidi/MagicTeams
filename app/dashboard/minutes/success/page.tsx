'use client';

import { useEffect, useState } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { CheckCircle2, Clock, ArrowRight, Sparkles } from 'lucide-react';
import { usePricingToolsStore } from '@/store/use-pricing-store';
import { motion } from 'framer-motion';

export default function MinutesPurchaseSuccessPage() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const sessionId = searchParams.get('session_id');
  const [loading, setLoading] = useState(true);
  const [showConfetti, setShowConfetti] = useState(false);
  const fetchPricingTools = usePricingToolsStore((state) => state.fetchPricingTools);

  useEffect(() => {
    if (sessionId) {
      // Trigger confetti animation
      setShowConfetti(true);

      // Refresh balance from server (wait for webhook to process)
      const refreshBalance = async () => {
        await new Promise(resolve => setTimeout(resolve, 2000));
        await fetchPricingTools();
        setLoading(false);
      };

      refreshBalance();
    } else {
      setLoading(false);
    }
  }, [sessionId]);

  const containerVariants = {
    hidden: { opacity: 0, scale: 0.8 },
    visible: {
      opacity: 1,
      scale: 1,
      transition: {
        duration: 0.5,
        ease: [0.43, 0.13, 0.23, 0.96]
      }
    }
  };

  const checkmarkVariants = {
    hidden: { scale: 0, rotate: -180 },
    visible: {
      scale: 1,
      rotate: 0,
      transition: {
        type: 'spring',
        stiffness: 200,
        damping: 15,
        delay: 0.2
      }
    }
  };

  const shimmerVariants = {
    animate: {
      backgroundPosition: ['200% 0', '-200% 0'],
      transition: {
        duration: 3,
        repeat: Infinity,
        ease: 'linear'
      }
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[80vh]">
        <motion.div
          className="text-center space-y-4"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
        >
          <div className="relative">
            <div className="animate-spin rounded-full h-16 w-16 border-b-4 border-primary mx-auto"></div>
            <Sparkles className="h-6 w-6 text-primary absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 animate-pulse" />
          </div>
          <p className="text-lg text-muted-foreground font-medium">
            Processing your purchase...
          </p>
          <p className="text-sm text-muted-foreground">
            Adding minutes to your account
          </p>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-16 relative overflow-hidden">
      {/* Animated Background Elements */}
      {showConfetti && (
        <div className="absolute inset-0 pointer-events-none">
          {[...Array(20)].map((_, i) => (
            <motion.div
              key={i}
              className="absolute w-2 h-2 bg-primary/30 rounded-full"
              initial={{
                x: Math.random() * window.innerWidth,
                y: -20,
                scale: 0
              }}
              animate={{
                y: window.innerHeight + 20,
                scale: [0, 1, 0],
                rotate: 360
              }}
              transition={{
                duration: 3 + Math.random() * 2,
                delay: Math.random() * 0.5,
                ease: 'easeOut'
              }}
            />
          ))}
        </div>
      )}

      <motion.div
        className="max-w-2xl mx-auto"
        variants={containerVariants}
        initial="hidden"
        animate="visible"
      >
        <Card className="overflow-hidden border-2 border-primary/20 shadow-2xl">
          <CardHeader className="text-center pb-6 pt-12 bg-gradient-to-b from-primary/5 to-transparent">
            {/* Success Icon */}
            <motion.div
              className="mx-auto mb-6 relative"
              variants={checkmarkVariants}
              initial="hidden"
              animate="visible"
            >
              <div className="p-6 bg-gradient-to-br from-green-500 to-green-600 rounded-full shadow-lg">
                <CheckCircle2 className="h-16 w-16 text-white" />
              </div>

              {/* Pulse Ring */}
              <motion.div
                className="absolute inset-0 bg-green-500/30 rounded-full"
                animate={{
                  scale: [1, 1.5, 1.8],
                  opacity: [0.6, 0.3, 0]
                }}
                transition={{
                  duration: 2,
                  repeat: Infinity,
                  ease: 'easeOut'
                }}
              />
            </motion.div>

            {/* Title */}
            <motion.h1
              className="text-4xl md:text-5xl font-bold mb-3"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.3 }}
            >
              <motion.span
                className="bg-gradient-to-r from-green-600 to-green-500 bg-clip-text text-transparent"
                variants={shimmerVariants}
                animate="animate"
                style={{
                  backgroundSize: '200% 100%',
                  backgroundImage: 'linear-gradient(90deg, #16a34a 0%, #22c55e 50%, #16a34a 100%)'
                }}
              >
                Purchase Successful!
              </motion.span>
            </motion.h1>

            <motion.p
              className="text-xl text-muted-foreground"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.4 }}
            >
              Your minutes have been added to your account
            </motion.p>
          </CardHeader>

          <CardContent className="space-y-8 px-8 pb-10">
            {/* Info Cards */}
            <motion.div
              className="grid gap-4 mt-8"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.5 }}
            >
              {/* Balance Update Notice */}
              <div className="flex items-start gap-4 p-4 bg-primary/5 rounded-lg border border-primary/20">
                <div className="p-2 bg-primary/10 rounded-lg">
                  <Clock className="h-5 w-5 text-primary" />
                </div>
                <div className="flex-1">
                  <h3 className="font-semibold mb-1">Balance Updated</h3>
                  <p className="text-sm text-muted-foreground">
                    Your new minute balance will appear in the sidebar within a few seconds. The page will auto-refresh shortly.
                  </p>
                </div>
              </div>

              {/* Instant Activation */}
              <div className="flex items-start gap-4 p-4 bg-green-50 dark:bg-green-950/20 rounded-lg border border-green-200 dark:border-green-900">
                <div className="p-2 bg-green-100 dark:bg-green-900/30 rounded-lg">
                  <Sparkles className="h-5 w-5 text-green-600 dark:text-green-400" />
                </div>
                <div className="flex-1">
                  <h3 className="font-semibold mb-1">Ready to Use</h3>
                  <p className="text-sm text-muted-foreground">
                    Your minutes are active now! Start making AI calls immediately.
                  </p>
                </div>
              </div>
            </motion.div>

            {/* Transaction ID */}
            {sessionId && (
              <motion.div
                className="text-center"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.6 }}
              >
                <p className="text-xs text-muted-foreground">
                  Transaction ID: <code className="bg-muted px-2 py-1 rounded">{sessionId.substring(0, 24)}...</code>
                </p>
              </motion.div>
            )}

            {/* Action Buttons */}
            <motion.div
              className="flex flex-col sm:flex-row gap-3 pt-4"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.7 }}
            >
              <Button
                onClick={() => router.push('/dashboard')}
                className="flex-1 h-12"
                size="lg"
              >
                Go to Dashboard
                <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
              <Button
                onClick={() => router.push('/dashboard/buy-minutes')}
                variant="outline"
                className="flex-1 h-12"
                size="lg"
              >
                Buy More Minutes
              </Button>
            </motion.div>
          </CardContent>
        </Card>

        {/* Auto-redirect notice */}
        <motion.p
          className="text-center text-sm text-muted-foreground mt-6"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 1 }}
        >
          You'll be redirected to the dashboard in a few seconds...
        </motion.p>
      </motion.div>
    </div>
  );
}
