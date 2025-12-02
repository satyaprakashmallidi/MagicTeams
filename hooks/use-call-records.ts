import { useEffect } from 'react';
import { useCallRecordsStore } from '@/store/use-call-records-store';

export function useCallRecords() {
  const { callRecords, isLoading, error, fetchCallRecords } = useCallRecordsStore();

  useEffect(() => {
    // Only fetch if we don't have any records and we're not currently loading
    if (!callRecords.length && !isLoading && !error) {
      fetchCallRecords();
    }
  }, [callRecords.length, isLoading, error, fetchCallRecords]);

  // Transform call records into the format expected by CallHistory
  const transformCallRecords = () : {call_date: string, call_details: { [key: string]: string }[]}[] => {
    const groupedCalls = callRecords.reduce((acc: any, record) => {
      const date = new Date(record.created_at).toISOString().split('T')[0];
      
      if (!acc[date]) {
        acc[date] = {
          call_date: date,
          call_details: []
        };
      }

      acc[date].call_details.push({
        [record.call_id]: record.bot_id
      });

      return acc;
    }, {});

    return Object.values(groupedCalls).sort((a: any, b: any) => 
      new Date(b.call_date).getTime() - new Date(a.call_date).getTime()
    );
  };

  return {
    callData: transformCallRecords() as {call_date: string, call_details: { [key: string]: string }[]}[],
    isLoading,
    error
  };
}
