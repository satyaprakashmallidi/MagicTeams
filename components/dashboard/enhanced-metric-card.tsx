import React from "react";
import { Card, CardContent } from "@/components/ui/card";
import { CircularProgress } from "@/components/ui/circular-progress";
import { cn } from "@/lib/utils";
import { Skeleton } from "@/components/ui/skeleton";

interface EnhancedMetricCardProps {
  title: string;
  value: string | number;
  subtitle?: string;
  progress?: number;
  loading?: boolean;
  className?: string;
  showCircularProgress?: boolean;
}

export const EnhancedMetricCard: React.FC<EnhancedMetricCardProps> = ({
  title,
  value,
  subtitle,
  progress,
  loading = false,
  className,
  showCircularProgress = false,
}) => {
  if (loading) {
    return (
      <Card className={cn("bg-white border-0 shadow-sm", className)}>
        <CardContent className="p-8">
          <div className="space-y-6">
            <Skeleton className="h-4 w-24" />
            <div className="flex items-center justify-between">
              <Skeleton className="h-12 w-20" />
              {showCircularProgress && <Skeleton className="h-16 w-16 rounded-full" />}
            </div>
            <Skeleton className="h-3 w-28" />
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className={cn(
      "bg-white border-0 shadow-sm hover:shadow-md transition-all duration-300",
      className
    )}>
      <CardContent className="p-8">
        <div className="space-y-6">
          {/* Title */}
          <div className="text-sm font-medium text-gray-500 uppercase tracking-wide">
            {title}
          </div>
          
          {/* Value and Progress */}
          <div className="flex items-center justify-between">
            <div className="text-4xl font-bold text-gray-900 leading-none">
              {value}
            </div>
            
            {showCircularProgress && progress !== undefined && (
              <CircularProgress
                value={progress}
                size={64}
                strokeWidth={8}
                color="#10b981"
                backgroundColor="#f1f5f9"
              >
                <div className="text-center">
                  <div className="text-lg font-bold text-gray-900">
                    {Math.round(progress)}
                  </div>
                  <div className="text-xs text-gray-500 -mt-1">
                    %
                  </div>
                </div>
              </CircularProgress>
            )}
          </div>

          {/* Subtitle */}
          {subtitle && (
            <div className="text-sm text-gray-500">
              {subtitle}
            </div>
          )}

          {/* Linear Progress Bar (if not using circular) */}
          {!showCircularProgress && progress !== undefined && (
            <div className="space-y-2">
              <div className="w-full bg-gray-100 rounded-full h-2">
                <div
                  className="h-2 bg-gray-800 rounded-full transition-all duration-700 ease-out"
                  style={{
                    width: `${Math.min(progress, 100)}%`,
                  }}
                />
              </div>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}; 