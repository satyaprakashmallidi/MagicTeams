'use client';

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Icon } from "@/components/ui/icons";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { Area, AreaChart, CartesianGrid, XAxis, YAxis } from "recharts";
import {
  ChartConfig,
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
} from "@/components/ui/chart";
import { usePricing } from "@/hooks/use-pricing";
import { useCallAnalytics } from "@/hooks/use-call-analytics";
import { useMemo, useCallback } from "react";
import { cn } from "@/lib/utils";


export default function AnalyticsPage() {
  const { costPerMinute } = usePricing();

  // Get analytics data based on date range
  const { data: analyticsData, isLoading , setFrom, setTo , from , to } = useCallAnalytics();

  // Memoize metrics calculations
  const metrics = useMemo(() => {
    if (!analyticsData?.length) {
      return {
        totalCalls: 0,
        totalTalkTime: 0,
        totalCost: 0,
        averageCallDuration: 0
      };
    }

    const totalCalls = analyticsData.reduce((sum, item) => sum + (item.calls || 0), 0);
    const totalTalkTime = analyticsData.reduce((sum, item) => sum + (item.talkTime || 0), 0);
    const totalCost = (totalTalkTime / 60) * (costPerMinute / 100);
    const averageCallDuration = totalCalls > 0 ? totalTalkTime / totalCalls : 0;

    return {
      totalCalls,
      totalTalkTime,
      totalCost,
      averageCallDuration
    };
  }, [analyticsData, costPerMinute]);

  // Transform data for recharts
  const chartData = useMemo(() => {
    if (!analyticsData?.length) {
      return [];
    }

    return analyticsData.map(item => ({
      date: new Date(item.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
      calls: item.calls || 0,
      talkTime: (item.talkTime || 0) / 60, // Convert to minutes
      cost: ((item.talkTime || 0) / 60) * (costPerMinute / 100)
    }));
  }, [analyticsData, costPerMinute]);

  // Chart configuration
  const chartConfig = {
    calls: {
      label: "Number of Calls",
      color: "#3b82f6", // Blue
    },
    talkTime: {
      label: "Talk Time (minutes)",
      color: "#10b981", // Green
    },
    cost: {
      label: "Cost ($)",
      color: "#ef4444", // Red
    },
  } satisfies ChartConfig;

  // Date range handlers
  const handlePresetChange = useCallback((e: React.ChangeEvent<HTMLSelectElement>) => {
    const to = new Date();
    const from = new Date();
    
    switch(e.target.value) {
      case 'week':
        from.setDate(to.getDate() - 7);
        break;
      case 'month':
        from.setDate(to.getDate() - 30);
        break;
      case 'year':
        from.setFullYear(to.getFullYear() - 1);
        break;
      default:
        return;
    }

    setFrom(from);
    setTo(to);
  }, []);

  const handleDateFromChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const newFrom = new Date(e.target.value);
    if (!isNaN(newFrom.getTime())) {
      setFrom(newFrom);
    }
  }, []);

  const handleDateToChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const newTo = new Date(e.target.value);
    if (!isNaN(newTo.getTime())) {
      setTo(newTo);
    }
  }, []);

  // Helper function to format duration
  const formatDuration = (seconds: number) => {
    if (seconds < 60) return `${Math.round(seconds)}s`;
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = Math.round(seconds % 60);
    return remainingSeconds > 0 ? `${minutes}m ${remainingSeconds}s` : `${minutes}m`;
  };

  // Helper function to get performance status
  const getPerformanceStatus = (value: number, type: 'cost' | 'duration') => {
    if (type === 'cost') {
      if (value < 10) return { status: 'Low', color: 'text-green-600 dark:text-green-400' };
      if (value < 50) return { status: 'Moderate', color: 'text-yellow-600 dark:text-yellow-400' };
      return { status: 'High', color: 'text-red-600 dark:text-red-400' };
    }
    if (type === 'duration') {
      if (value >= 60 && value <= 180) return { status: 'Optimal', color: 'text-green-600 dark:text-green-400' };
      if (value >= 30 && value <= 240) return { status: 'Good', color: 'text-yellow-600 dark:text-yellow-400' };
      return { status: 'Review needed', color: 'text-red-600 dark:text-red-400' };
    }
    return { status: 'Normal', color: 'text-muted-foreground' };
  };

  // Custom tooltip component with better positioning
  const CustomTooltip = ({ active, payload, label, coordinate }: any) => {
    if (active && payload && payload.length) {
      return (
        <div
          className="bg-background border border-border rounded-lg shadow-lg p-3 text-sm"
        >
          <p className="font-medium text-foreground mb-2">{label}</p>
          <div className="space-y-1">
            {payload.map((entry: any, index: number) => {
              let formattedValue = entry.value;
              let displayLabel = entry.name;

              if (entry.dataKey === 'calls') {
                formattedValue = Math.round(entry.value);
                displayLabel = 'Number of Calls';
              } else if (entry.dataKey === 'talkTime') {
                formattedValue = `${Number(entry.value).toFixed(1)} min`;
                displayLabel = 'Talk Time (minutes)';
              } else if (entry.dataKey === 'cost') {
                formattedValue = `$${Number(entry.value).toFixed(2)}`;
                displayLabel = 'Cost ($)';
              }

              return (
                <div key={index} className="flex items-center gap-2">
                  <div
                    className="w-3 h-3 rounded-full flex-shrink-0"
                    style={{ backgroundColor: entry.color }}
                  />
                  <span className="text-muted-foreground">{displayLabel}:</span>
                  <span className="font-medium text-foreground">{formattedValue}</span>
                </div>
              );
            })}
          </div>
        </div>
      );
    }
    return null;
  };

  // Dotted pattern component for the chart (Evil Charts style)
  const DottedBackgroundPattern = ({ config }: { config: ChartConfig }) => {
    const items = Object.fromEntries(
      Object.entries(config).map(([key, value]) => [key, value.color])
    );
    return (
      <>
        {Object.entries(items).map(([key, value]) => (
          <pattern
            key={key}
            id={`dotted-background-pattern-${key}`}
            x="0"
            y="0"
            width="7"
            height="7"
            patternUnits="userSpaceOnUse"
          >
            <circle cx="3.5" cy="3.5" r="1.5" fill={value} opacity={0.5}></circle>
          </pattern>
        ))}
      </>
    );
  };

  return (
    <main className="h-full bg-background">
      <div className="container mx-auto px-4 py-8">
        <div className="mb-8">
          <h1 className="text-2xl font-semibold text-foreground mb-2">Analytics Dashboard</h1>
          <p className="text-muted-foreground">Track your call metrics and performance</p>
        </div>

        <div className="mb-8">
          <div className="flex items-center gap-4">
            <select
              className="px-4 py-2 bg-background border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-ring text-foreground transition-all hover:border-border/80 shadow-sm"
              onChange={handlePresetChange}
              defaultValue="month"
              disabled={isLoading}
            >
              <option value="week">Last Week</option>
              <option value="month">Last Month</option>
              <option value="year">Last Year</option>
            </select>
            <div className="flex items-center gap-2">
              <input
                type="date"
                className="px-3 py-2 bg-background border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-ring text-foreground transition-all hover:border-border/80 shadow-sm"
                value={from?.toISOString().split('T')[0] || ''}
                max={to?.toISOString().split('T')[0]}
                onChange={handleDateFromChange}
                disabled={isLoading}
              />
              <span className="text-muted-foreground">to</span>
              <input
                type="date"
                className="px-3 py-2 bg-background border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-ring text-foreground transition-all hover:border-border/80 shadow-sm"
                value={to?.toISOString().split('T')[0] || ''}
                min={from?.toISOString().split('T')[0]}
                onChange={handleDateToChange}
                disabled={isLoading}
              />
            </div>
          </div>
        </div>

        <TooltipProvider>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
            {/* Total Calls Card */}
            <Card className="relative">
              <CardHeader className="pb-3 relative z-10">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="w-8 h-8 bg-blue-100 dark:bg-blue-900/20 rounded-lg flex items-center justify-center">
                      <Icon name="phone" className="h-4 w-4 text-blue-600 dark:text-blue-400" />
                    </div>
                    <CardTitle className="text-sm font-semibold text-foreground">
                      Total Calls
                    </CardTitle>
                  </div>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <button className="text-muted-foreground hover:text-foreground transition-colors p-1 rounded-full hover:bg-accent">
                        <Icon name="info" className="h-3 w-3" />
                      </button>
                    </TooltipTrigger>
                    <TooltipContent side="top" className="z-[100] max-w-48 text-center">
                      <p>Total number of calls made in selected period</p>
                    </TooltipContent>
                  </Tooltip>
                </div>
              </CardHeader>
              <CardContent className="relative z-10">
                <div className="space-y-3">
                  <div className="flex items-baseline gap-2">
                    <span className="text-3xl font-bold text-foreground">
                      {isLoading ? <Skeleton className="h-9 w-12" /> : metrics.totalCalls}
                    </span>
                    {!isLoading && metrics.totalCalls === 0 && (
                      <span className="text-xs text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-900/20 px-2 py-1 rounded-full font-medium">
                        No calls yet
                      </span>
                    )}
                  </div>
                  {!isLoading && metrics.totalCalls > 0 && (
                    <div className="text-xs text-muted-foreground">
                      <span>Across selected time period</span>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>

            {/* Total Talk Time Card */}
            <Card className="relative">
              <CardHeader className="pb-3 relative z-10">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="w-8 h-8 bg-green-100 dark:bg-green-900/20 rounded-lg flex items-center justify-center">
                      <Icon name="clock" className="h-4 w-4 text-green-600 dark:text-green-400" />
                    </div>
                    <CardTitle className="text-sm font-semibold text-foreground">
                      Total Talk Time
                    </CardTitle>
                  </div>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <button className="text-muted-foreground hover:text-foreground transition-colors p-1 rounded-full hover:bg-accent">
                        <Icon name="info" className="h-3 w-3" />
                      </button>
                    </TooltipTrigger>
                    <TooltipContent side="top" className="z-[100] max-w-48 text-center">
                      <p>Total duration of all calls</p>
                    </TooltipContent>
                  </Tooltip>
                </div>
              </CardHeader>
              <CardContent className="relative z-10">
                <div className="space-y-3">
                  <div className="flex items-baseline gap-2">
                    <span className="text-3xl font-bold text-foreground">
                      {isLoading ? <Skeleton className="h-9 w-16" /> : `${(metrics.totalTalkTime / 60).toFixed(1)}m`}
                    </span>
                  </div>
                  {!isLoading && metrics.totalTalkTime > 0 && (
                    <div className="text-xs text-muted-foreground">
                      <span>{formatDuration(metrics.totalTalkTime)} total</span>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>

            {/* Total Cost Card */}
            <Card className={cn(
              "relative border-l-4",
              !isLoading && (metrics.totalCost < 10 ? "border-l-green-500" : metrics.totalCost < 50 ? "border-l-yellow-500" : "border-l-red-500")
            )}>
              <CardHeader className="pb-3 relative z-10">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className={cn(
                      "w-8 h-8 rounded-lg flex items-center justify-center",
                      metrics.totalCost < 10 ? "bg-green-100 dark:bg-green-900/20" : metrics.totalCost < 50 ? "bg-yellow-100 dark:bg-yellow-900/20" : "bg-red-100 dark:bg-red-900/20"
                    )}>
                      <Icon name="dollarSign" className={cn(
                        "h-4 w-4",
                        metrics.totalCost < 10 ? "text-green-600 dark:text-green-400" : metrics.totalCost < 50 ? "text-yellow-600 dark:text-yellow-400" : "text-red-600 dark:text-red-400"
                      )} />
                    </div>
                    <CardTitle className="text-sm font-semibold text-foreground">
                      Total Cost
                    </CardTitle>
                  </div>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <button className="text-muted-foreground hover:text-foreground transition-colors p-1 rounded-full hover:bg-accent">
                        <Icon name="info" className="h-3 w-3" />
                      </button>
                    </TooltipTrigger>
                    <TooltipContent side="top" className="z-[100] max-w-48 text-center">
                      <p>Total cost based on talk time and pricing</p>
                    </TooltipContent>
                  </Tooltip>
                </div>
              </CardHeader>
              <CardContent className="relative z-10">
                <div className="space-y-3">
                  <div className="flex items-baseline gap-2">
                    <span className={cn(
                      "text-3xl font-bold",
                      metrics.totalCost < 10 ? "text-green-700 dark:text-green-300" : metrics.totalCost < 50 ? "text-yellow-700 dark:text-yellow-300" : "text-red-700 dark:text-red-300"
                    )}>
                      {isLoading ? <Skeleton className="h-9 w-16" /> : `$${metrics.totalCost.toFixed(2)}`}
                    </span>
                    {!isLoading && metrics.totalCost > 0 && (
                      <span className={cn(
                        "text-xs px-2 py-1 rounded-full font-medium",
                        getPerformanceStatus(metrics.totalCost, 'cost').color,
                        metrics.totalCost < 10 ? "bg-green-50 dark:bg-green-900/20" : metrics.totalCost < 50 ? "bg-yellow-50 dark:bg-yellow-900/20" : "bg-red-50 dark:bg-red-900/20"
                      )}>
                        {getPerformanceStatus(metrics.totalCost, 'cost').status}
                      </span>
                    )}
                  </div>
                  {!isLoading && metrics.totalCost > 0 && (
                    <div className="text-xs text-muted-foreground">
                      <span>At ${(costPerMinute / 100).toFixed(3)}/min</span>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>

            {/* Average Call Duration Card */}
            <Card className={cn(
              "relative border-l-4",
              !isLoading && (metrics.averageCallDuration >= 60 && metrics.averageCallDuration <= 180 ? "border-l-green-500" :
                             metrics.averageCallDuration >= 30 && metrics.averageCallDuration <= 240 ? "border-l-yellow-500" : "border-l-red-500")
            )}>
              <CardHeader className="pb-3 relative z-10">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className={cn(
                      "w-8 h-8 rounded-lg flex items-center justify-center",
                      (metrics.averageCallDuration >= 60 && metrics.averageCallDuration <= 180) ? "bg-green-100 dark:bg-green-900/20" :
                      (metrics.averageCallDuration >= 30 && metrics.averageCallDuration <= 240) ? "bg-yellow-100 dark:bg-yellow-900/20" : "bg-red-100 dark:bg-red-900/20"
                    )}>
                      <Icon name="clock" className={cn(
                        "h-4 w-4",
                        (metrics.averageCallDuration >= 60 && metrics.averageCallDuration <= 180) ? "text-green-600 dark:text-green-400" :
                        (metrics.averageCallDuration >= 30 && metrics.averageCallDuration <= 240) ? "text-yellow-600 dark:text-yellow-400" : "text-red-600 dark:text-red-400"
                      )} />
                    </div>
                    <CardTitle className="text-sm font-semibold text-foreground">
                      Avg Duration
                    </CardTitle>
                  </div>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <button className="text-muted-foreground hover:text-foreground transition-colors p-1 rounded-full hover:bg-accent">
                        <Icon name="info" className="h-3 w-3" />
                      </button>
                    </TooltipTrigger>
                    <TooltipContent side="top" className="z-[100] max-w-48 text-center">
                      <p>Average length per call</p>
                    </TooltipContent>
                  </Tooltip>
                </div>
              </CardHeader>
              <CardContent className="relative z-10">
                <div className="space-y-3">
                  <div className="flex items-baseline gap-2">
                    <span className={cn(
                      "text-3xl font-bold",
                      (metrics.averageCallDuration >= 60 && metrics.averageCallDuration <= 180) ? "text-green-700 dark:text-green-300" :
                      (metrics.averageCallDuration >= 30 && metrics.averageCallDuration <= 240) ? "text-yellow-700 dark:text-yellow-300" : "text-red-700 dark:text-red-300"
                    )}>
                      {isLoading ? <Skeleton className="h-9 w-20" /> : formatDuration(metrics.averageCallDuration)}
                    </span>
                    {!isLoading && metrics.averageCallDuration > 0 && (
                      <span className={cn(
                        "text-xs px-2 py-1 rounded-full font-medium",
                        getPerformanceStatus(metrics.averageCallDuration, 'duration').color,
                        (metrics.averageCallDuration >= 60 && metrics.averageCallDuration <= 180) ? "bg-green-50 dark:bg-green-900/20" :
                        (metrics.averageCallDuration >= 30 && metrics.averageCallDuration <= 240) ? "bg-yellow-50 dark:bg-yellow-900/20" : "bg-red-50 dark:bg-red-900/20"
                      )}>
                        {getPerformanceStatus(metrics.averageCallDuration, 'duration').status}
                      </span>
                    )}
                  </div>
                  {!isLoading && metrics.averageCallDuration > 0 && (
                    <div className="text-xs text-muted-foreground">
                      <span>Optimal range: 1-3 minutes</span>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          </div>
        </TooltipProvider>

        <Card className="">
          <CardHeader>
            <CardTitle>Call Analytics Over Time</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-[400px]">
              {isLoading ? (
                <div className="h-full flex items-center justify-center">
                  <Skeleton className="h-full w-full" />
                </div>
              ) : chartData.length === 0 ? (
                <div className="h-full flex flex-col items-center justify-center text-center">
                  <div className="w-16 h-16 bg-muted rounded-full flex items-center justify-center mb-4">
                    <Icon name="barChart" className="h-8 w-8 text-muted-foreground" />
                  </div>
                  <h3 className="font-medium text-foreground mb-2">No analytics data yet</h3>
                  <p className="text-sm text-muted-foreground max-w-sm">
                    Your call analytics will appear here once you start making calls.
                    Data will be available after your first successful call.
                  </p>
                </div>
              ) : (
                <ChartContainer config={chartConfig} className="h-full w-full">
                  <AreaChart
                    accessibilityLayer
                    data={chartData}
                    margin={{ top: 20, right: 20, left: 20, bottom: 25 }}
                  >
                    <CartesianGrid vertical={false} strokeDasharray="3 3" />
                    <XAxis
                      dataKey="date"
                      tickLine={false}
                      axisLine={false}
                      tickMargin={12}
                      tickFormatter={(value) => value}
                      className="my-24 py-24"
                      />
                    <YAxis
                      tickLine={false}
                      axisLine={false}
                      tickMargin={8}
                      className="my-24 py-24"
                    />
                    <ChartTooltip
                      content={<CustomTooltip />}
                      cursor={{ strokeDasharray: '3 3' }}
                    />
                    <defs>
                      <DottedBackgroundPattern config={chartConfig} />
                    </defs>
                    <Area
                      dataKey="calls"
                      type="natural"
                      fill="url(#dotted-background-pattern-calls)"
                      fillOpacity={0.3}
                      stroke="var(--color-calls)"
                      strokeWidth={2}
                    />
                    <Area
                      dataKey="talkTime"
                      type="natural"
                      fill="url(#dotted-background-pattern-talkTime)"
                      fillOpacity={0.4}
                      stroke="var(--color-talkTime)"
                      strokeWidth={2}
                    />
                    <Area
                      dataKey="cost"
                      type="natural"
                      fill="url(#dotted-background-pattern-cost)"
                      fillOpacity={0.5}
                      stroke="var(--color-cost)"
                      strokeWidth={2}
                    />
                  </AreaChart>
                </ChartContainer>
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    </main>
  );
}
