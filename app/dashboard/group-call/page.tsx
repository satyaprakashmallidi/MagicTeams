"use client";

import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Icon } from "@/components/ui/icons";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { useToast } from "@/hooks/use-toast";
import { usePricing } from "@/hooks/use-pricing";
import { useOnboardingTour } from "@/hooks/use-onboarding-tour";
import { GuidedTour, tourStyles } from "@/components/dashboard/guided-tour";
import { format, formatDistanceToNow, startOfDay, startOfWeek, startOfMonth, subDays } from "date-fns";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import { Area, AreaChart, CartesianGrid, XAxis } from "recharts";
import {
  ChartConfig,
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
} from "@/components/ui/chart";

interface Campaign {
  campaign_id: string;
  campaign_name: string;
  status: string;
  total_contacts: number;
  successful_calls: number;
  failed_calls: number;
  pending_calls: number;
  started_at: string;
  completed_at: string;
  created_at: string;
  bot_name: string;
  twilio_phone_number: string;
}

interface CallStats {
  today: number;
  week: number;
  month: number;
  avgDuration: number;
  successRate: number;
}

interface DailyCallData {
  date: string;
  calls: number;
  successful: number;
}

export default function GroupCallPage() {
  const router = useRouter();
  const { toast } = useToast();
  const { time: credits } = usePricing();
  const {
    isLoaded,
    shouldShowGroupCallTour,
    markGroupCallTourCompleted
  } = useOnboardingTour();
  const [loading, setLoading] = useState(true);
  const [timeRange, setTimeRange] = useState<"week" | "month">("week");
  const [showTour, setShowTour] = useState(false);
  const [currentStep, setCurrentStep] = useState(0);

  // State for analytics data
  const [recentCampaigns, setRecentCampaigns] = useState<Campaign[]>([]);
  const [callStats, setCallStats] = useState<CallStats>({
    today: 0,
    week: 0,
    month: 0,
    avgDuration: 0,
    successRate: 0
  });
  const [dailyData, setDailyData] = useState<DailyCallData[]>([]);
  const [userId, setUserId] = useState<string | null>(null);

  useEffect(() => {
    loadDashboardData();
  }, [timeRange]);

  // Show tour when component loads and conditions are met
  useEffect(() => {
    if (isLoaded && !loading) {
      const shouldShow = shouldShowGroupCallTour();
      if (shouldShow) {
        // Small delay to ensure UI is fully rendered
        const timer = setTimeout(() => {
          setShowTour(true);
        }, 1000);
        return () => clearTimeout(timer);
      }
    }
  }, [isLoaded, loading, shouldShowGroupCallTour]);

  const loadDashboardData = async () => {
    try {
      setLoading(true);

      // Get current user
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      setUserId(user.id);

      // Load recent campaigns
      const { data: campaigns, error: campaignsError } = await supabase
        .from('call_campaigns')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })
        .limit(5);

      if (campaignsError) throw campaignsError;
      setRecentCampaigns(campaigns || []);

      // Calculate date ranges
      const now = new Date();
      const todayStart = startOfDay(now);
      const weekStart = startOfWeek(now);
      const monthStart = startOfMonth(now);

      // Load call stats from campaign contacts
      const { data: allContacts, error: contactsError } = await supabase
        .from('call_campaign_contacts')
        .select(`
          call_status,
          call_duration,
          created_at,
          campaign_id,
          call_campaigns!inner(user_id)
        `)
        .eq('call_campaigns.user_id', user.id);

      if (contactsError) throw contactsError;

      // Calculate stats
      const todayCalls = allContacts?.filter(c =>
        new Date(c.created_at) >= todayStart
      ) || [];

      const weekCalls = allContacts?.filter(c =>
        new Date(c.created_at) >= weekStart
      ) || [];

      const monthCalls = allContacts?.filter(c =>
        new Date(c.created_at) >= monthStart
      ) || [];

      const successfulCalls = allContacts?.filter(c =>
        c.call_status === 'completed'
      ) || [];

      const totalDuration = successfulCalls.reduce((sum, c) =>
        sum + (c.call_duration || 0), 0
      );

      setCallStats({
        today: todayCalls.length,
        week: weekCalls.length,
        month: monthCalls.length,
        avgDuration: successfulCalls.length > 0
          ? Math.round(totalDuration / successfulCalls.length)
          : 0,
        successRate: allContacts && allContacts.length > 0
          ? Math.round((successfulCalls.length / allContacts.length) * 100)
          : 0
      });

      // Generate daily data for chart
      const days = timeRange === "week" ? 7 : 30;
      const dailyCallData: DailyCallData[] = [];

      for (let i = days - 1; i >= 0; i--) {
        const date = subDays(now, i);
        const dateStr = format(date, 'MMM dd');
        const dayStart = startOfDay(date);
        const dayEnd = new Date(dayStart);
        dayEnd.setDate(dayEnd.getDate() + 1);

        const dayCalls = allContacts?.filter(c => {
          const callDate = new Date(c.created_at);
          return callDate >= dayStart && callDate < dayEnd;
        }) || [];

        const successfulDayCalls = dayCalls.filter(c =>
          c.call_status === 'completed'
        );

        dailyCallData.push({
          date: dateStr,
          calls: dayCalls.length,
          successful: successfulDayCalls.length
        });
      }

      setDailyData(dailyCallData);

    } catch (error) {
      console.error('Error loading dashboard data:', error);
      toast({
        title: "Error",
        description: "Failed to load dashboard data",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  const handleRerunCampaign = async (campaign: Campaign) => {
    // Navigate to start page with campaign data pre-filled
    router.push(`/dashboard/group-call/start?rerun=${campaign.campaign_id}`);
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'completed': return 'text-green-600 dark:text-green-400 bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-800';
      case 'in_progress': return 'text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-900/20 border-blue-200 dark:border-blue-800';
      case 'failed': return 'text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-800';
      case 'cancelled': return 'text-muted-foreground bg-muted border-border';
      default: return 'text-yellow-600 dark:text-yellow-400 bg-yellow-50 dark:bg-yellow-900/20 border-yellow-200 dark:border-yellow-800';
    }
  };

  const formatDuration = (seconds: number) => {
    if (seconds < 60) return `${seconds}s`;
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;
    return `${minutes}m ${remainingSeconds}s`;
  };

  const getPerformanceColor = (value: number, type: 'success' | 'duration' | 'credits') => {
    switch (type) {
      case 'success':
        if (value >= 70) return 'text-green-600 dark:text-green-400 bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-800';
        if (value >= 40) return 'text-yellow-600 dark:text-yellow-400 bg-yellow-50 dark:bg-yellow-900/20 border-yellow-200 dark:border-yellow-800';
        return 'text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-800';
      case 'credits':
        const minutesLeft = Math.floor(value / 60);
        if (minutesLeft >= 30) return 'text-green-600 dark:text-green-400 bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-800';
        if (minutesLeft >= 5) return 'text-yellow-600 dark:text-yellow-400 bg-yellow-50 dark:bg-yellow-900/20 border-yellow-200 dark:border-yellow-800';
        return 'text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-800';
      case 'duration':
        if (value >= 60 && value <= 180) return 'text-green-600 dark:text-green-400 bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-800';
        if (value >= 30 && value <= 240) return 'text-yellow-600 dark:text-yellow-400 bg-yellow-50 dark:bg-yellow-900/20 border-yellow-200 dark:border-yellow-800';
        return 'text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-800';
      default:
        return 'text-muted-foreground bg-muted border-border';
    }
  };

  const getTrendIcon = (current: number, previous: number) => {
    if (current > previous) return { icon: 'trendingUp', color: 'text-green-600' };
    if (current < previous) return { icon: 'trendingDown', color: 'text-red-600' };
    return { icon: 'minus', color: 'text-gray-400' };
  };

  const getPerformanceStatus = (value: number, type: 'success' | 'duration' | 'credits') => {
    switch (type) {
      case 'success':
        if (value >= 70) return { status: 'Excellent', color: 'text-green-600 dark:text-green-400' };
        if (value >= 40) return { status: 'Good', color: 'text-yellow-600 dark:text-yellow-400' };
        return { status: 'Needs improvement', color: 'text-red-600 dark:text-red-400' };
      case 'credits':
        const minutesLeft = Math.floor(value / 60);
        if (minutesLeft >= 30) return { status: 'Sufficient', color: 'text-green-600 dark:text-green-400' };
        if (minutesLeft >= 5) return { status: 'Low', color: 'text-yellow-600 dark:text-yellow-400' };
        return { status: 'Critical', color: 'text-red-600 dark:text-red-400' };
      case 'duration':
        if (value >= 60 && value <= 180) return { status: 'Optimal', color: 'text-green-600 dark:text-green-400' };
        if (value >= 30 && value <= 240) return { status: 'Acceptable', color: 'text-yellow-600 dark:text-yellow-400' };
        return { status: 'Review needed', color: 'text-red-600 dark:text-red-400' };
      default:
        return { status: 'Normal', color: 'text-muted-foreground' };
    }
  };

  const maxCalls = Math.max(...dailyData.map(d => d.calls), 1);

  // Chart configuration for calls data
  const chartConfig = {
    calls: {
      label: "Total Calls",
      color: "#dc2626", // Dark red
    },
    successful: {
      label: "Successful",
      color: "#059669", // Dark green
    },
  } satisfies ChartConfig;

  // Dotted pattern component for the chart
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

  const tourSteps = [
    {
      id: 'welcome',
      target: '[data-tour="page-header"]',
      title: 'Welcome to Group Call Dashboard!',
      content: 'This is your central hub for managing AI-powered bulk calling campaigns. The numbered badges show the recommended starting order for new users.',
      position: 'bottom' as const,
      highlight: true,
    },
    {
      id: 'manage-data',
      target: '[data-tour="manage-data-btn"]',
      title: 'Step 1: Import Your Contacts',
      content: 'Start here! Import contacts from CSV files and organize your calling lists. This green badge shows this is the recommended first step for new users.',
      position: 'bottom' as const,
      highlight: true,
    },
    {
      id: 'new-campaign',
      target: '[data-tour="new-campaign-btn"]',
      title: 'Step 2: Create Your Campaign',
      content: 'After importing contacts, create a new calling campaign. Select your contacts, choose an AI agent, and configure campaign settings.',
      position: 'bottom' as const,
      highlight: true,
    },
    {
      id: 'quick-actions',
      target: '[data-tour="quick-actions"]',
      title: 'Quick Actions',
      content: 'These improved action cards show detailed steps for each process. Notice the color-coded borders and step-by-step breakdowns to guide you through each task.',
      position: 'left' as const,
      highlight: true,
      spotlightPadding: 16,
    },
    {
      id: 'metrics',
      target: '[data-tour="metrics-cards"]',
      title: 'Performance Monitoring',
      content: 'Track your key metrics: daily calls, weekly totals, success rates, and remaining credits. Hover over the info icons for additional details.',
      position: 'bottom' as const,
      highlight: true,
    },
    {
      id: 'chart',
      target: '[data-tour="performance-chart"]',
      title: 'Campaign Analytics',
      content: 'Visualize your calling activity over time. Monitor trends and identify your most successful periods to optimize future campaigns.',
      position: 'left' as const,
      highlight: true,
    },
    {
      id: 'recent-campaigns',
      target: '[data-tour="recent-campaigns"]',
      title: 'Campaign Management',
      content: 'View your latest campaigns with detailed statistics. Re-run successful campaigns or view detailed call logs and analytics.',
      position: 'bottom' as const,
      highlight: true,
      spotlightPadding: 24,
    }
  ];

  const handleTourComplete = () => {
    setShowTour(false);
    setCurrentStep(0); // Reset for next time
    markGroupCallTourCompleted();
  };

  const handleTourSkip = () => {
    setShowTour(false);
    setCurrentStep(0); // Reset for next time
    markGroupCallTourCompleted();
  };

  return (
    <>
      {/* Tour styles */}
      <style jsx global>{tourStyles}</style>

      {/* Glowing button animation */}
      <style jsx global>{`
        @keyframes gradientFlow {
          0%, 100% {
            background-position: 0% 50%;
          }
          50% {
            background-position: 100% 50%;
          }
        }

        @keyframes tilt {
          0%, 50%, 100% {
            transform: rotate(0deg);
          }
          25% {
            transform: rotate(1deg);
          }
          75% {
            transform: rotate(-1deg);
          }
        }

        .animate-tilt {
          animation: tilt 10s infinite linear, gradientFlow 3s ease infinite;
        }
      `}</style>

      {/* Guided Tour */}
      <GuidedTour
        steps={tourSteps}
        isActive={showTour}
        onComplete={handleTourComplete}
        onSkip={handleTourSkip}
        currentStepIndex={currentStep}
      />

      <div className="container mx-auto space-y-6 p-6 pb-2">
        <div className="flex items-center justify-between" data-tour="page-header">
          <div>
            <h1 className="text-3xl font-bold">Group Call Dashboard</h1>
            
          </div>
          <div className="flex gap-3">
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    data-tour="manage-data-btn"
                    variant="outline"
                    onClick={() => router.push("/dashboard/group-call/data-import")}
                    className="relative"
                  >
                    <Icon name="database" className="h-4 w-4 mr-2" />
                    Upload Data
                  </Button>
                </TooltipTrigger>
                <TooltipContent>
                  <p>{recentCampaigns.length === 0 ? "Start here: Import your contact list" : "Import and organize contacts"}</p>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>

            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <div className="relative group">
                    <div className="absolute -inset-0.5 bg-gradient-to-r from-blue-400 via-purple-500 to-pink-500 rounded-lg blur opacity-75 group-hover:opacity-100 transition duration-1000 group-hover:duration-200 animate-tilt"
                      style={{
                        background: 'linear-gradient(45deg, #3b82f6, #8b5cf6, #ec4899, #06b6d4, #3b82f6)',
                        backgroundSize: '400% 400%',
                        animation: 'gradientFlow 3s ease infinite'
                      }}>
                    </div>
                    <Button
                      data-tour="new-campaign-btn"
                      onClick={() => router.push("/dashboard/group-call/start")}
                      className="relative bg-blue-600 hover:bg-blue-700 text-white"
                    >
                      <Icon name="plus" className="h-4 w-4 mr-2" />
                      New Campaign
                    </Button>
                  </div>
                </TooltipTrigger>
                <TooltipContent>
                  <p>Create and launch a new calling campaign</p>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>

            {isLoaded && !shouldShowGroupCallTour() && (
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => {
                        setCurrentStep(0);
                        setShowTour(true);
                      }}
                      className="text-muted-foreground hover:text-foreground"
                    >
                      <Icon name="help" className="h-4 w-4 mr-2" />
                      Show Tour
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>
                    <p>Take a guided tour of the group calling features</p>
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            )}
          </div>
        </div>

        {/* Contextual Help Banner for New Users */}
        {!loading && recentCampaigns.length === 0 && (
          <Card className="bg-gradient-to-r from-amber-50 to-orange-50 border-amber-200">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-amber-100 rounded-full flex items-center justify-center">
                    <Icon name="info" className="h-5 w-5 text-amber-600" />
                  </div>
                  <div>
                    <h3 className="font-semibold text-amber-900">First time using Group Calling?</h3>
                    <p className="text-sm text-amber-700">
                      Import your contacts first, then create campaigns to start making AI-powered calls to your lists.
                    </p>
                  </div>
                </div>
                <div className="flex gap-2">
                  <Button
                    size="sm"
                    variant="outline"
                    className="border-amber-300 text-amber-700 hover:bg-amber-100"
                    onClick={() => {
                      setCurrentStep(0);
                      setShowTour(true);
                    }}
                  >
                    <Icon name="play" className="h-3 w-3 mr-1" />
                    Watch Demo
                  </Button>
                  <Button
                    size="sm"
                    className="bg-amber-600 hover:bg-amber-700 text-white"
                    onClick={() => router.push("/dashboard/group-call/data-import")}
                  >
                    Get Started
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        )}


        <TooltipProvider>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-6" data-tour="metrics-cards">
            {/* Calls Today Card */}
            <Card className="relative">
              <CardHeader className="pb-3 relative z-10">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="w-8 h-8 bg-blue-100 rounded-lg flex items-center justify-center">
                      <Icon name="phone" className="h-4 w-4 text-blue-600" />
                    </div>
                    <CardTitle className="text-sm font-semibold text-foreground">
                      Calls Today
                    </CardTitle>
                  </div>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <button className="text-muted-foreground hover:text-foreground transition-colors p-1 rounded-full hover:bg-accent">
                        <Icon name="info" className="h-3 w-3" />
                      </button>
                    </TooltipTrigger>
                    <TooltipContent side="top" className="z-[100] max-w-48 text-center">
                      <p>Total calls made today</p>
                    </TooltipContent>
                  </Tooltip>
                </div>
              </CardHeader>
              <CardContent className="relative z-10">
                <div className="space-y-3">
                  <div className="flex items-baseline gap-2">
                    <span className="text-3xl font-bold text-foreground">
                      {loading ? <Skeleton className="h-9 w-12" /> : callStats.today}
                    </span>
                    {!loading && callStats.today === 0 && (
                      <span className="text-xs text-amber-600 bg-amber-50 px-2 py-1 rounded-full font-medium">
                        No calls yet
                      </span>
                    )}
                  </div>

                  {!loading && (
                    <div className="space-y-2">
                      <div className="flex items-center justify-between text-xs">
                        <span className="text-muted-foreground">
                          {callStats.week > 0 ? `${Math.round((callStats.today / callStats.week) * 100)}% of weekly total` : 'Start your first campaign'}
                        </span>
                      </div>
                      {callStats.today > 0 && (
                        <div className="w-full bg-muted rounded-full h-1.5">
                          <div
                            className="bg-blue-500 h-1.5 rounded-full transition-all duration-500"
                            style={{ width: `${Math.min((callStats.today / Math.max(callStats.week, callStats.today)) * 100, 100)}%` }}
                          />
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>

            {/* Weekly Total Card */}
            <Card className="relative">
              <CardHeader className="pb-3 relative z-10">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="w-8 h-8 bg-green-100 rounded-lg flex items-center justify-center">
                      <Icon name="calendar" className="h-4 w-4 text-green-600" />
                    </div>
                    <CardTitle className="text-sm font-semibold text-foreground">
                      Weekly Total
                    </CardTitle>
                  </div>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <button className="text-muted-foreground hover:text-foreground transition-colors p-1 rounded-full hover:bg-accent">
                        <Icon name="info" className="h-3 w-3" />
                      </button>
                    </TooltipTrigger>
                    <TooltipContent side="top" className="z-[100] max-w-48 text-center">
                      <p>Total calls in the last 7 days</p>
                    </TooltipContent>
                  </Tooltip>
                </div>
              </CardHeader>
              <CardContent className="relative z-10">
                <div className="space-y-3">
                  <div className="flex items-baseline gap-2">
                    <span className="text-3xl font-bold text-foreground">
                      {loading ? <Skeleton className="h-9 w-12" /> : callStats.week}
                    </span>
                    {!loading && callStats.week > 0 && (
                      <div className="flex items-center gap-1 text-xs text-green-600">
                        <Icon name="trendingUp" className="h-3 w-3" />
                        <span>Active</span>
                      </div>
                    )}
                  </div>

                  {!loading && (
                    <div className="space-y-2">
                      <div className="text-xs text-muted-foreground">
                        {callStats.week > 0 ? (
                          <span>Average {Math.round(callStats.week / 7)} calls per day</span>
                        ) : (
                          <span>No weekly activity yet</span>
                        )}
                      </div>

                      {callStats.week > 0 && (
                        <div className="flex items-center justify-between text-xs">
                          <span className="text-muted-foreground">vs. target (70/week)</span>
                          <span className={callStats.week >= 70 ? 'text-green-600 font-medium' : callStats.week >= 35 ? 'text-yellow-600 font-medium' : 'text-red-600 font-medium'}>
                            {Math.round((callStats.week / 70) * 100)}%
                          </span>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>

            {/* Success Rate Card */}
            <Card className={cn(
              "relative border-l-4",
              !loading && getPerformanceColor(callStats.successRate, 'success')
            )}>
              <CardHeader className="pb-3 relative z-10">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className={cn(
                      "w-8 h-8 rounded-lg flex items-center justify-center",
                      callStats.successRate >= 70 ? "bg-green-100" : callStats.successRate >= 40 ? "bg-yellow-100" : "bg-red-100"
                    )}>
                      <Icon name="checkCircle" className={cn(
                        "h-4 w-4",
                        callStats.successRate >= 70 ? "text-green-600" : callStats.successRate >= 40 ? "text-yellow-600" : "text-red-600"
                      )} />
                    </div>
                    <CardTitle className="text-sm font-semibold text-foreground">
                      Success Rate
                    </CardTitle>
                  </div>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <button className="text-muted-foreground hover:text-foreground transition-colors p-1 rounded-full hover:bg-accent">
                        <Icon name="info" className="h-3 w-3" />
                      </button>
                    </TooltipTrigger>
                    <TooltipContent side="top" className="z-[100] max-w-48 text-center">
                      <p>Percentage of calls completed successfully</p>
                    </TooltipContent>
                  </Tooltip>
                </div>
              </CardHeader>
              <CardContent className="relative z-10">
                <div className="space-y-3">
                  <div className="flex items-baseline gap-2">
                    <span className={cn(
                      "text-3xl font-bold",
                      callStats.successRate >= 70 ? "text-green-700 dark:text-green-300" : callStats.successRate >= 40 ? "text-yellow-700 dark:text-yellow-300" : "text-red-700 dark:text-red-300"
                    )}>
                      {loading ? <Skeleton className="h-9 w-16" /> : `${callStats.successRate}%`}
                    </span>
                    {!loading && (
                      <span className={cn(
                        "text-xs px-2 py-1 rounded-full font-medium",
                        getPerformanceStatus(callStats.successRate, 'success').color,
                        callStats.successRate >= 70 ? "bg-green-50 dark:bg-green-900/20" : callStats.successRate >= 40 ? "bg-yellow-50 dark:bg-yellow-900/20" : "bg-red-50 dark:bg-red-900/20"
                      )}>
                        {getPerformanceStatus(callStats.successRate, 'success').status}
                      </span>
                    )}
                  </div>

                  {!loading && (
                    <div className="space-y-2">
                      <Progress
                        value={callStats.successRate}
                        className={cn(
                          "h-2 transition-all duration-500",
                          callStats.successRate >= 70 ? "[&>div]:bg-green-500" : callStats.successRate >= 40 ? "[&>div]:bg-yellow-500" : "[&>div]:bg-red-500"
                        )}
                      />

                      <div className="flex items-center justify-between text-xs">
                        <span className="text-muted-foreground">Industry benchmark: 65%</span>
                      </div>

                      
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>

            {/* Average Duration Card */}
            <Card className={cn(
              "relative border-l-4",
              !loading && getPerformanceColor(callStats.avgDuration, 'duration')
            )}>
              <CardHeader className="pb-3 relative z-10">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className={cn(
                      "w-8 h-8 rounded-lg flex items-center justify-center",
                      (callStats.avgDuration >= 60 && callStats.avgDuration <= 180) ? "bg-green-100" :
                      (callStats.avgDuration >= 30 && callStats.avgDuration <= 240) ? "bg-yellow-100" : "bg-red-100"
                    )}>
                      <Icon name="clock" className={cn(
                        "h-4 w-4",
                        (callStats.avgDuration >= 60 && callStats.avgDuration <= 180) ? "text-green-600" :
                        (callStats.avgDuration >= 30 && callStats.avgDuration <= 240) ? "text-yellow-600" : "text-red-600"
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
                      <p>Average length of successful calls</p>
                    </TooltipContent>
                  </Tooltip>
                </div>
              </CardHeader>
              <CardContent className="relative z-10">
                <div className="space-y-3">
                  <div className="flex items-baseline gap-2">
                    <span className={cn(
                      "text-3xl font-bold",
                      (callStats.avgDuration >= 60 && callStats.avgDuration <= 180) ? "text-green-700 dark:text-green-300" :
                      (callStats.avgDuration >= 30 && callStats.avgDuration <= 240) ? "text-yellow-700 dark:text-yellow-300" : "text-red-700 dark:text-red-300"
                    )}>
                      {loading ? <Skeleton className="h-9 w-20" /> : formatDuration(callStats.avgDuration)}
                    </span>
                    {!loading && callStats.avgDuration > 0 && (
                      <span className={cn(
                        "text-xs px-2 py-1 rounded-full font-medium",
                        getPerformanceStatus(callStats.avgDuration, 'duration').color,
                        (callStats.avgDuration >= 60 && callStats.avgDuration <= 180) ? "bg-green-50 dark:bg-green-900/20" :
                        (callStats.avgDuration >= 30 && callStats.avgDuration <= 240) ? "bg-yellow-50 dark:bg-yellow-900/20" : "bg-red-50 dark:bg-red-900/20"
                      )}>
                        {getPerformanceStatus(callStats.avgDuration, 'duration').status}
                      </span>
                    )}
                  </div>

                  {!loading && (
                    <div className="space-y-2">
                      <div className="text-xs text-muted-foreground">
                        {callStats.avgDuration > 0 ? (
                          <span>Optimal range: 1-3 minutes</span>
                        ) : (
                          <span>No successful calls yet</span>
                        )}
                      </div>

                      {callStats.avgDuration > 0 && (
                        <div className="w-full bg-muted rounded-full h-2">
                          <div
                            className={cn(
                              "h-2 rounded-full transition-all duration-500",
                              (callStats.avgDuration >= 60 && callStats.avgDuration <= 180) ? "bg-green-500" :
                              (callStats.avgDuration >= 30 && callStats.avgDuration <= 240) ? "bg-yellow-500" : "bg-red-500"
                            )}
                            style={{ width: `${Math.min((callStats.avgDuration / 300) * 100, 100)}%` }}
                          />
                        </div>
                      )}

                      {callStats.avgDuration < 30 && callStats.avgDuration > 0 && (
                        <button
                          onClick={() => router.push('/dashboard/ai-agents')}
                          className="text-xs text-blue-600 hover:text-blue-700 font-medium hover:underline w-full text-left"
                        >
                          💡 Improve call scripts →
                        </button>
                      )}
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>

            {/* Credits Left Card */}
            <Card className={cn(
              "relative border-l-4",
              !loading && getPerformanceColor(credits, 'credits')
            )}>
              <CardHeader className="pb-3 relative z-10">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className={cn(
                      "w-8 h-8 rounded-lg flex items-center justify-center",
                      Math.floor(credits / 60) >= 30 ? "bg-green-100" : Math.floor(credits / 60) >= 5 ? "bg-yellow-100" : "bg-red-100"
                    )}>
                      <Icon name="zap" className={cn(
                        "h-4 w-4",
                        Math.floor(credits / 60) >= 30 ? "text-green-600" : Math.floor(credits / 60) >= 5 ? "text-yellow-600" : "text-red-600"
                      )} />
                    </div>
                    <CardTitle className="text-sm font-semibold text-foreground">
                      Call Minutes
                    </CardTitle>
                  </div>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <button className="text-muted-foreground hover:text-foreground transition-colors p-1 rounded-full hover:bg-accent">
                        <Icon name="info" className="h-3 w-3" />
                      </button>
                    </TooltipTrigger>
                    <TooltipContent side="top" className="z-[100] max-w-48 text-center">
                      <p>Remaining minutes for voice campaigns</p>
                    </TooltipContent>
                  </Tooltip>
                </div>
              </CardHeader>
              <CardContent className="relative z-10">
                <div className="space-y-3">
                  <div className="flex items-baseline gap-2">
                    <span className={cn(
                      "text-3xl font-bold",
                      Math.floor(credits / 60) >= 30 ? "text-green-700 dark:text-green-300" : Math.floor(credits / 60) >= 5 ? "text-yellow-700 dark:text-yellow-300" : "text-red-700 dark:text-red-300"
                    )}>
                      {Math.floor(credits / 60)}
                    </span>
                    <span className="text-sm text-muted-foreground font-medium">min</span>
                    {!loading && (
                      <span className={cn(
                        "text-xs px-2 py-1 rounded-full font-medium",
                        getPerformanceStatus(credits, 'credits').color,
                        Math.floor(credits / 60) >= 30 ? "bg-green-50 dark:bg-green-900/20" : Math.floor(credits / 60) >= 5 ? "bg-yellow-50 dark:bg-yellow-900/20" : "bg-red-50 dark:bg-red-900/20"
                      )}>
                        {getPerformanceStatus(credits, 'credits').status}
                      </span>
                    )}
                  </div>

                  <div className="space-y-2">
                    <div className="w-full bg-muted rounded-full h-2">
                      <div
                        className={cn(
                          "h-2 rounded-full transition-all duration-500",
                          Math.floor(credits / 60) >= 30 ? "bg-green-500" : Math.floor(credits / 60) >= 5 ? "bg-yellow-500" : "bg-red-500"
                        )}
                        style={{ width: `${Math.min((credits / 3600) * 100, 100)}%` }}
                      />
                    </div>

                    <div className="flex items-center justify-between text-xs">
                      <span className="text-muted-foreground">
                        ~{Math.floor(credits / 120)} calls remaining
                      </span>
                      <span className="text-muted-foreground">
                        Updated 5 min ago
                      </span>
                    </div>

                    {Math.floor(credits / 60) < 5 && (
                      <button
                        onClick={() => router.push('/dashboard/billing')}
                        className="text-xs text-blue-600 hover:text-blue-700 font-medium hover:underline w-full text-left"
                      >
                        🔔 Add more credits →
                      </button>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </TooltipProvider>

        {/* Campaign Performance Chart - Full Width */}
        <Card className="w-full" data-tour="performance-chart">
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle>Campaign Performance</CardTitle>
                  <CardDescription>Daily call volume and success rate</CardDescription>
                </div>
                <Select value={timeRange} onValueChange={(value: "week" | "month") => setTimeRange(value)}>
                  <SelectTrigger className="w-32">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="week">Last 7 days</SelectItem>
                    <SelectItem value="month">Last 30 days</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </CardHeader>
            <CardContent>
              {loading ? (
                <div className="h-64 flex items-center justify-center">
                  <Skeleton className="h-full w-full" />
                </div>
              ) : dailyData.every(day => day.calls === 0) ? (
                <div className="h-64 flex flex-col items-center justify-center text-center">
                  <div className="w-16 h-16 bg-muted rounded-full flex items-center justify-center mb-4">
                    <Icon name="barChart" className="h-8 w-8 text-muted-foreground" />
                  </div>
                  <h3 className="font-medium text-foreground mb-2">No campaign data yet</h3>
                  <p className="text-sm text-muted-foreground max-w-sm">
                    Your campaign performance analytics will appear here once you start making calls.
                    Launch your first campaign to see real-time data and trends.
                  </p>
                </div>
              ) : (
                <div className="w-full h-96">
                  {/* Dotted pattern area chart */}
                  <ChartContainer config={chartConfig} className="h-full w-full">
                    <AreaChart
                      accessibilityLayer
                      data={dailyData}
                      margin={{ top: 20, right: 20, left: 20, bottom: 25 }}
                    >
                      <CartesianGrid vertical={false} strokeDasharray="3 3" />
                      <XAxis
                        dataKey="date"
                        tickLine={false}
                        axisLine={false}
                        tickMargin={12}
                        tickFormatter={(value) => value}
                        className="text-xs"
                      />
                      <ChartTooltip cursor={false} content={<ChartTooltipContent />} />
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
                        dataKey="successful"
                        type="natural"
                        fill="url(#dotted-background-pattern-successful)"
                        fillOpacity={0.6}
                        stroke="var(--color-successful)"
                        strokeWidth={2}
                      />
                    </AreaChart>
                  </ChartContainer>
                </div>
              )}
            </CardContent>
          </Card>

        {/* Quick Actions - Below Graph Horizontally */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4" data-tour="quick-actions">
          <Card className="hover:shadow-lg transition-all duration-200 cursor-pointer border-l-4 border-l-blue-500" onClick={() => router.push("/dashboard/group-call/start")}>
            <CardHeader className="pb-3">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 bg-blue-100 rounded-full flex items-center justify-center">
                  <Icon name="play" className="h-6 w-6 text-blue-600" />
                </div>
                <div className="flex-1">
                  <CardTitle className="text-base flex items-center gap-2">
                    Start New Campaign
                    {/* <Badge variant="secondary" className="text-xs">Step 1</Badge> */}
                  </CardTitle>
                  <CardDescription className="text-sm">
                    Create and launch a new bulk calling campaign with AI agents
                  </CardDescription>
                </div>
                <Icon name="chevronRight" className="h-4 w-4 text-muted-foreground" />
              </div>
            </CardHeader>
          </Card>

          <Card className="hover:shadow-lg transition-all duration-200 cursor-pointer border-l-4 border-l-green-500" onClick={() => router.push("/dashboard/group-call/data-import")}>
            <CardHeader className="pb-3">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 bg-green-100 rounded-full flex items-center justify-center">
                  <Icon name="database" className="h-6 w-6 text-green-600" />
                </div>
                <div className="flex-1">
                  <CardTitle className="text-base flex items-center gap-2">
                    Manage Contact Data
                    <Badge variant="secondary" className="text-xs">Recommended Start</Badge>
                  </CardTitle>
                  <CardDescription className="text-sm">
                    Import contacts from CSV files and organize your calling lists
                  </CardDescription>
                </div>
                <Icon name="chevronRight" className="h-4 w-4 text-muted-foreground" />
              </div>
            </CardHeader>
          </Card>

          <Card className="hover:shadow-lg transition-all duration-200 cursor-pointer border-l-4 border-l-purple-500" onClick={() => router.push("/dashboard/bulk-call-history")}>
            <CardHeader className="pb-3">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 bg-purple-100 rounded-full flex items-center justify-center">
                  <Icon name="history" className="h-6 w-6 text-purple-600" />
                </div>
                <div className="flex-1">
                  <CardTitle className="text-base">Campaign History</CardTitle>
                  <CardDescription className="text-sm">
                    View detailed call logs, analytics, and campaign results
                  </CardDescription>
                </div>
                <Icon name="chevronRight" className="h-4 w-4 text-muted-foreground" />
              </div>
            </CardHeader>
          </Card>

          <Card className="hover:shadow-lg transition-all duration-200 cursor-pointer border-l-4 border-l-orange-500" onClick={() => router.push("/dashboard/group-call/start")}>
            <CardHeader className="pb-3">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 bg-orange-100 rounded-full flex items-center justify-center">
                  <Icon name="calendar" className="h-6 w-6 text-orange-600" />
                </div>
                <div className="flex-1">
                  <CardTitle className="text-base">Schedule Call</CardTitle>
                  <CardDescription className="text-sm">
                    Book individual appointments and manage your calendar
                  </CardDescription>
                </div>
                <Icon name="chevronRight" className="h-4 w-4 text-muted-foreground" />
              </div>
            </CardHeader>
          </Card>
        </div>

        {/* Recent Campaigns */}
        <Card data-tour="recent-campaigns">
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle>Recent Campaigns</CardTitle>
                <CardDescription>Your last 5 campaigns with quick stats</CardDescription>
              </div>
              <Button variant="ghost" size="sm" onClick={() => router.push("/dashboard/bulk-call-history")}>
                View All
                <Icon name="arrowRight" className="h-4 w-4 ml-2" />
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="space-y-3">
                {[1, 2, 3].map(i => (
                  <Skeleton key={i} className="h-20 w-full" />
                ))}
              </div>
            ) : recentCampaigns.length > 0 ? (
              <div className="space-y-3">
                {recentCampaigns.map((campaign) => {
                  const successRate = campaign.total_contacts > 0
                    ? Math.round((campaign.successful_calls / campaign.total_contacts) * 100)
                    : 0;

                  return (
                    <div
                      key={campaign.campaign_id}
                      className="flex items-center justify-between p-4 border rounded-lg hover:bg-muted/50 transition-colors"
                    >
                      <div className="flex-1">
                        <div className="flex items-center gap-3">
                          <h4 className="font-medium">{campaign.campaign_name}</h4>
                          <Badge className={cn("text-xs", getStatusColor(campaign.status))}>
                            {campaign.status}
                          </Badge>
                        </div>
                        <div className="flex items-center gap-4 mt-2 text-sm text-muted-foreground">
                          <span className="flex items-center gap-1">
                            <Icon name="users" className="h-3 w-3" />
                            {campaign.total_contacts} contacts
                          </span>
                          <span className="flex items-center gap-1">
                            <Icon name="checkCircle" className="h-3 w-3 text-green-600" />
                            {campaign.successful_calls} successful
                          </span>
                          <span className="flex items-center gap-1">
                            <Icon name="xCircle" className="h-3 w-3 text-red-600" />
                            {campaign.failed_calls} failed
                          </span>
                          <span className="flex items-center gap-1">
                            <Icon name="trendingUp" className="h-3 w-3" />
                            {successRate}% success
                          </span>
                        </div>
                        <div className="flex items-center gap-4 mt-1 text-xs text-muted-foreground">
                          <span>{formatDistanceToNow(new Date(campaign.created_at), { addSuffix: true })}</span>
                          {campaign.bot_name && <span>Bot: {campaign.bot_name}</span>}
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        {campaign.status === 'completed' && successRate > 50 && (
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleRerunCampaign(campaign);
                            }}
                          >
                            <Icon name="refresh" className="h-3 w-3 mr-1" />
                            Re-run
                          </Button>
                        )}
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => router.push(`/dashboard/bulk-call-history?campaignId=${campaign.campaign_id}`)}
                        >
                          <Icon name="eye" className="h-3 w-3 mr-1" />
                          View
                        </Button>
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="text-center py-8 text-muted-foreground">
                <Icon name="inbox" className="h-12 w-12 mx-auto mb-3 text-muted-foreground" />
                <p>No campaigns yet</p>
                <p className="text-sm mt-1">Start your first campaign to see analytics here</p>
                <Button
                  className="mt-4"
                  onClick={() => router.push("/dashboard/group-call/start")}
                >
                  Start First Campaign
                </Button>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </>
  );
}