import { useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { CalendarAccount } from '@/hooks/use-calendar';

interface SidebarProps {
  calendarAccounts: CalendarAccount[];
  selectedCalendar: string | null;
  onCalendarSelect: (id: string) => void;
  calendars: any[];
}

export function Sidebar({
  calendarAccounts,
  selectedCalendar,
  onCalendarSelect,
  calendars,
}: SidebarProps) {

  useEffect(() => {
    const fetchCalendars = async () => {
      if (!selectedCalendar) return;

      // Fetch the selected account's tokens
      const { data: account, error } = await supabase
        .from('user_calendar_accounts')
        .select('access_token, refresh_token')
        .eq('id', selectedCalendar)
        .single();

      if (error || !account) {
        console.error('Error fetching account tokens:', error);
        return;
      }
    };

    fetchCalendars();
  }, [selectedCalendar]);

  return (
    <div className="w-64 bg-gray-100 p-4 border-r">
      <h2 className="text-lg font-semibold mb-4">Calendars</h2>
      {calendarAccounts?.length > 0 ? (
        <select
          value={selectedCalendar || ""}
          onChange={(e) => onCalendarSelect(e.target.value)}
          className="w-full rounded-md border border-gray-300 px-3 py-1 text-sm mb-4"
        >
          {calendarAccounts.map((account) => (
            <option key={account.id} value={account.id}>
              {account.calendar_email}
            </option>
          ))}
        </select>
      ) : (
        <p className="text-sm text-gray-500">No calendars available</p>
      )}

      <h3 className="text-md font-semibold mb-2">Associated Calendars</h3>
      {calendars?.length > 0 ? (
        <ul className="list-disc pl-5">
          {calendars.map((calendar) => (
            <li key={calendar.id} className="text-sm">
              {calendar.summary}
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-sm text-gray-500">No associated calendars</p>
      )}
    </div>
  );
} 