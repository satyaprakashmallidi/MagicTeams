"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Calendar, Clock, Repeat, Play, Pause } from "lucide-react";
import { Campaign } from "../services/campaigns-service";
import { utcToZonedTime, format as formatTz } from 'date-fns-tz';

interface CampaignScheduleInfoProps {
  campaign: Campaign;
}

export function CampaignScheduleInfo({ campaign }: CampaignScheduleInfoProps) {
  const hasScheduling = campaign.scheduled_start_time || campaign.is_recurring;

  if (!hasScheduling) {
    return null;
  }

  const formatDate = (isoString: string, timezone?: string) => {
    try {
      const date = new Date(isoString);

      // If a specific timezone is provided, format in that timezone
      if (timezone && timezone !== 'UTC') {
        const zonedDate = utcToZonedTime(date, timezone);
        return formatTz(zonedDate, 'MMM dd, yyyy, hh:mm a zzz', { timeZone: timezone });
      }

      // Otherwise use browser's timezone
      return date.toLocaleString(undefined, {
        month: 'short',
        day: '2-digit',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        timeZoneName: 'short'
      });
    } catch (error) {
      console.error('Error formatting date:', error);
      return new Date(isoString).toLocaleString();
    }
  };

  const getRecurringDescription = () => {
    if (!campaign.is_recurring) return null;
    
    const interval = campaign.recurring_interval || 1;
    const type = campaign.recurring_type;
    
    let description = `Every ${interval} ${type}`;
    if (interval === 1) {
      description = `${type?.charAt(0).toUpperCase()}${type?.slice(1)}`;
    } else {
      description = `Every ${interval} ${type}s`;
    }
    
    return description;
  };

  return (
    <Card className="mt-4">
      <CardHeader className="pb-3">
        <CardTitle className="text-sm font-medium flex items-center gap-2">
          <Calendar className="h-4 w-4" />
          Campaign Schedule
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {campaign.scheduled_start_time && (
          <div className="flex items-center gap-2 text-sm">
            <Clock className="h-4 w-4 text-muted-foreground" />
            <span className="font-medium">Scheduled:</span>
            <span>{formatDate(campaign.scheduled_start_time, campaign.timezone)}</span>
          </div>
        )}

        {campaign.is_recurring && (
          <div className="space-y-2">
            <div className="flex items-center gap-2 text-sm">
              <Repeat className="h-4 w-4 text-muted-foreground" />
              <span className="font-medium">Recurring:</span>
              <Badge variant="secondary">
                {getRecurringDescription()}
              </Badge>
            </div>
            
            {campaign.execution_count !== undefined && (
              <div className="text-sm text-muted-foreground ml-6">
                Executed {campaign.execution_count} time(s)
                {campaign.max_executions && (
                  <span> of {campaign.max_executions} max</span>
                )}
              </div>
            )}
            
            {campaign.recurring_until && (
              <div className="text-sm text-muted-foreground ml-6">
                Until: {formatDate(campaign.recurring_until, campaign.timezone)}
              </div>
            )}
          </div>
        )}

        <div className="flex items-center gap-2 text-sm">
          {campaign.auto_start ? (
            <>
              <Play className="h-4 w-4 text-green-600" />
              <span>Auto-start enabled</span>
            </>
          ) : (
            <>
              <Pause className="h-4 w-4 text-orange-600" />
              <span>Manual start required</span>
            </>
          )}
        </div>

        {campaign.status === 'pending' && campaign.scheduled_start_time && (
          <div className="text-xs text-muted-foreground mt-2">
            {new Date(campaign.scheduled_start_time) > new Date() ? (
              <span className="text-blue-600">
                ⏳ Waiting for scheduled time
              </span>
            ) : (
              <span className="text-orange-600">
                ⚠️ Scheduled time has passed
              </span>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}