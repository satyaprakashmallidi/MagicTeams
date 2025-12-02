"use client";

import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Icon } from "@/components/ui/icons";
import { Progress } from "@/components/ui/progress";
import { motion, AnimatePresence } from 'framer-motion';
import { cn } from '@/lib/utils';
import { Skeleton } from "@/components/ui/skeleton";

interface MetricCard {
  id: string;
  title: string;
  value: string | number;
  description?: string;
  icon: string;
  color: string;
  trend?: {
    value: number;
    isPositive: boolean;
  };
  progress?: number;
  complexity: 'basic' | 'intermediate' | 'advanced';
}

interface ProgressiveMetricsProps {
  metrics: MetricCard[];
  userLevel: 'beginner' | 'intermediate' | 'advanced';
  loading?: boolean;
  expandedView?: boolean;
  onToggleExpand?: () => void;
}

export function ProgressiveMetrics({
  metrics,
  userLevel,
  loading = false,
  expandedView = false,
  onToggleExpand
}: ProgressiveMetricsProps) {
  const [hoveredCard, setHoveredCard] = useState<string | null>(null);
  const [selectedMetric, setSelectedMetric] = useState<string | null>(null);

  // Filter metrics based on user level
  const visibleMetrics = metrics.filter(metric => {
    if (userLevel === 'beginner') {
      return metric.complexity === 'basic';
    } else if (userLevel === 'intermediate') {
      return metric.complexity !== 'advanced';
    }
    return true; // Advanced users see everything
  });

  // Separate primary and secondary metrics
  const primaryMetrics = visibleMetrics.filter(m => m.complexity === 'basic').slice(0, 3);
  const secondaryMetrics = visibleMetrics.filter(m => m.complexity !== 'basic');

  if (loading) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {[1, 2, 3].map(i => (
          <Card key={i}>
            <CardHeader className="pb-2">
              <Skeleton className="h-4 w-20" />
            </CardHeader>
            <CardContent>
              <Skeleton className="h-8 w-24 mb-2" />
              <Skeleton className="h-3 w-32" />
            </CardContent>
          </Card>
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Primary Metrics - Always Visible */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {primaryMetrics.map((metric, index) => (
          <motion.div
            key={metric.id}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: index * 0.1 }}
            onHoverStart={() => setHoveredCard(metric.id)}
            onHoverEnd={() => setHoveredCard(null)}
          >
            <Card
              className={cn(
                "relative overflow-hidden transition-all duration-300 cursor-pointer",
                hoveredCard === metric.id && "shadow-lg scale-[1.02]",
                selectedMetric === metric.id && "ring-2 ring-blue-500"
              )}
              onClick={() => setSelectedMetric(selectedMetric === metric.id ? null : metric.id)}
            >
              {/* Background gradient */}
              <div
                className="absolute inset-0 opacity-5"
                style={{
                  background: `linear-gradient(135deg, ${metric.color} 0%, transparent 100%)`
                }}
              />

              <CardHeader className="pb-2">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-sm font-medium text-muted-foreground">
                    {metric.title}
                  </CardTitle>
                  <div
                    className="w-8 h-8 rounded-lg flex items-center justify-center"
                    style={{ backgroundColor: `${metric.color}20` }}
                  >
                    <Icon
                      name={metric.icon as any}
                      className="h-4 w-4"
                      style={{ color: metric.color }}
                    />
                  </div>
                </div>
              </CardHeader>

              <CardContent>
                <div className="flex items-baseline justify-between">
                  <div className="text-2xl font-bold">{metric.value}</div>
                  {metric.trend && (
                    <div className={cn(
                      "flex items-center text-xs font-medium",
                      metric.trend.isPositive ? "text-green-600" : "text-red-600"
                    )}>
                      <Icon
                        name={metric.trend.isPositive ? "trendingUp" : "trendingDown"}
                        className="h-3 w-3 mr-1"
                      />
                      {metric.trend.value}%
                    </div>
                  )}
                </div>

                {metric.description && (
                  <p className="text-xs text-muted-foreground mt-1">
                    {metric.description}
                  </p>
                )}

                {metric.progress !== undefined && (
                  <Progress value={metric.progress} className="mt-2 h-1" />
                )}

                {/* Detailed view when selected */}
                <AnimatePresence>
                  {selectedMetric === metric.id && (
                    <motion.div
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: 'auto', opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      className="mt-3 pt-3 border-t"
                    >
                      <div className="space-y-2">
                        <div className="flex justify-between text-xs">
                          <span className="text-muted-foreground">Daily Average</span>
                          <span className="font-medium">
                            {Math.round(Number(metric.value) / 30)}
                          </span>
                        </div>
                        <div className="flex justify-between text-xs">
                          <span className="text-muted-foreground">Best Day</span>
                          <span className="font-medium">
                            {Math.round(Number(metric.value) * 1.5 / 30)}
                          </span>
                        </div>
                        <Button
                          size="sm"
                          variant="ghost"
                          className="w-full mt-2 h-7 text-xs"
                        >
                          View Details
                          <Icon name="arrowRight" className="h-3 w-3 ml-1" />
                        </Button>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </CardContent>
            </Card>
          </motion.div>
        ))}
      </div>

      {/* Secondary Metrics - Progressive Disclosure */}
      {userLevel !== 'beginner' && secondaryMetrics.length > 0 && (
        <div>
          {/* Toggle Button */}
          <Button
            variant="ghost"
            size="sm"
            onClick={onToggleExpand}
            className="mb-3 text-xs"
          >
            <Icon
              name={expandedView ? "chevronUp" : "chevronDown"}
              className="h-3 w-3 mr-1"
            />
            {expandedView ? 'Show Less' : `Show ${secondaryMetrics.length} More Metrics`}
          </Button>

          {/* Expanded Metrics */}
          <AnimatePresence>
            {expandedView && (
              <motion.div
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: 'auto', opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                className="grid grid-cols-2 md:grid-cols-4 gap-3"
              >
                {secondaryMetrics.map((metric, index) => (
                  <motion.div
                    key={metric.id}
                    initial={{ opacity: 0, scale: 0.9 }}
                    animate={{ opacity: 1, scale: 1 }}
                    transition={{ delay: index * 0.05 }}
                  >
                    <Card className="hover:shadow-md transition-shadow">
                      <CardContent className="pt-4">
                        <div className="flex items-center gap-2 mb-2">
                          <Icon
                            name={metric.icon as any}
                            className="h-3 w-3 text-muted-foreground"
                          />
                          <span className="text-xs text-muted-foreground">
                            {metric.title}
                          </span>
                        </div>
                        <div className="text-lg font-semibold">{metric.value}</div>
                        {metric.trend && (
                          <div className={cn(
                            "text-xs mt-1",
                            metric.trend.isPositive ? "text-green-600" : "text-red-600"
                          )}>
                            {metric.trend.isPositive ? '↑' : '↓'} {metric.trend.value}%
                          </div>
                        )}
                      </CardContent>
                    </Card>
                  </motion.div>
                ))}
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      )}

      {/* Upgrade Prompt for Beginners */}
      {userLevel === 'beginner' && metrics.length > primaryMetrics.length && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.5 }}
        >
          <Card className="bg-gradient-to-r from-blue-50 to-purple-50 border-blue-200">
            <CardContent className="flex items-center justify-between py-3">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 bg-blue-100 rounded-lg flex items-center justify-center">
                  <Icon name="trendingUp" className="h-4 w-4 text-blue-600" />
                </div>
                <div>
                  <p className="text-sm font-medium">Unlock Advanced Analytics</p>
                  <p className="text-xs text-muted-foreground">
                    {metrics.length - primaryMetrics.length} more metrics available as you grow
                  </p>
                </div>
              </div>
              <Button size="sm" variant="ghost">
                Learn More
              </Button>
            </CardContent>
          </Card>
        </motion.div>
      )}
    </div>
  );
}

// Simplified metric card for minimal view
export function MinimalMetricCard({
  title,
  value,
  icon,
  color
}: {
  title: string;
  value: string | number;
  icon: string;
  color: string;
}) {
  return (
    <div className="flex items-center gap-3 p-3 bg-white rounded-lg border">
      <div
        className="w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0"
        style={{ backgroundColor: `${color}20` }}
      >
        <Icon
          name={icon as any}
          className="h-5 w-5"
          style={{ color }}
        />
      </div>
      <div>
        <p className="text-xs text-muted-foreground">{title}</p>
        <p className="text-lg font-semibold">{value}</p>
      </div>
    </div>
  );
}