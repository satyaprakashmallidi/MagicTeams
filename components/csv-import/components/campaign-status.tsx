'use client';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Button } from '@/components/ui/button';
import { Icon } from '@/components/ui/icons';

interface CampaignStatusProps {
  campaignId: string | null;
  stats: {
    total: number;
    pending: number;
    queued: number;
    in_progress: number;
    completed: number;
    failed: number;
  } | null;
  onStop?: () => void;
}

export function CampaignStatus({ campaignId, stats, onStop }: CampaignStatusProps) {
  if (!campaignId || !stats) return null;

  let progressPercentage = stats.total > 0 ? 
    Math.round(((stats.completed + stats.failed) / stats.total) * 100) : 0;
  // Ensure progressPercentage is less than 100 unless all are done
  if (progressPercentage === 100 && (stats.completed + stats.failed) < stats.total) {
    progressPercentage = 99;
  }

  const isActive = stats.pending > 0 || stats.queued > 0 || stats.in_progress > 0;

  return (
    <Card className="mb-4">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-sm font-medium">Campaign Status</CardTitle>
          {isActive && onStop && (
            <Button 
              variant="outline" 
              size="sm" 
              onClick={onStop}
              className="text-red-600 hover:text-red-700"
            >
              <Icon name="square" className="h-3 w-3 mr-1" />
              Stop Campaign
            </Button>
          )}
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          <div className="flex justify-between text-xs text-muted-foreground">
            <span>Progress</span>
            <span>{progressPercentage}%</span>
          </div>
          <Progress value={progressPercentage} className="h-2" />
        </div>

        <div className="grid grid-cols-3 gap-2 text-xs">
          <div className="text-center">
            <Badge variant="secondary" className="w-full">
              {stats.completed} Completed
            </Badge>
          </div>
          <div className="text-center">
            <Badge variant="destructive" className="w-full">
              {stats.failed} Failed
            </Badge>
          </div>
          <div className="text-center">
            <Badge variant="outline" className="w-full">
              {stats.pending + stats.queued + stats.in_progress} Pending
            </Badge>
          </div>
        </div>

        <div className="grid grid-cols-4 gap-1 text-xs text-muted-foreground">
          <div className="text-center">
            <div className="font-medium">{stats.pending}</div>
            <div>Pending</div>
          </div>
          <div className="text-center">
            <div className="font-medium">{stats.queued}</div>
            <div>Queued</div>
          </div>
          <div className="text-center">
            <div className="font-medium">{stats.in_progress}</div>
            <div>In Progress</div>
          </div>
          <div className="text-center">
            <div className="font-medium">{stats.total}</div>
            <div>Total</div>
          </div>
        </div>

        {!isActive && (
          <div className="text-center text-xs text-green-600 font-medium">
            Campaign Completed
          </div>
        )}
      </CardContent>
    </Card>
  );
}