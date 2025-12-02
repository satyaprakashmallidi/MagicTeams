"use client"

import React from 'react';
import { CallHistory } from '@/components/history/call-history';
import { useCallAnalytics } from '@/hooks/use-call-analytics';

export default function Page() {
  const { 
    data: analyticsData, 
    callSummaries, 
    fetchCallSummary, 
    fetchGroupCallSummaries, 
    isLoading, 
    error 
  } = useCallAnalytics({
    from: new Date(new Date().setDate(new Date().getDate() - 30)), // Last 30 days
    to: new Date()
  });

  if (isLoading) {
    return (
      <div className="flex justify-center items-center min-h-[60vh]">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900"></div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-4">
        <div className="bg-red-50 text-red-700 p-4 rounded-md">
          {error.message}
        </div>
      </div>
    );
  }

  return (
    <div className="m-2 border-gray-400/40 rounded-lg border-2">
      <CallHistory />
    </div>
  );
}
