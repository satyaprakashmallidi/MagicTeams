'use client';

import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { useToast } from './use-toast';
import { useCalendarStore } from '@/store/use-calendar-store';
import type { CalendarEvent, CalendarAccount } from '@/store/use-calendar-store';
import { CalendarRange } from 'lucide-react';

const CACHE_DURATION = 5 * 60 * 1000; // 5 minutes in milliseconds

export interface Calendar {
  accessRole: string;
  backgroundColor: string;
  colorId: string;
  description: string;
  etag: string;
  id: string;
  kind: string;
  primary: boolean;
  selected: boolean;
  summary: string;
  timeZone: string;
}

export function useCalendar() {
  const [isLoadingEvents, setIsLoadingEvents] = useState(false);
  const [isLoadingAccounts, setIsLoadingAccounts] = useState(true);
  const { toast } = useToast();
  
  const {
    events,
    calendarAccounts,
    selectedCalendar,
    lastFetched,
    setEvents,
    setCalendarAccounts,
    setSelectedCalendar,
    setLastFetched,
  } = useCalendarStore();

  useEffect(() => {
    fetchCalendarAccounts();
  }, []);

  useEffect(() => {
    if (calendarAccounts?.length > 0 && !selectedCalendar) {
      setSelectedCalendar(calendarAccounts[0].id);
    }
  }, [calendarAccounts, selectedCalendar, setSelectedCalendar]);

  const shouldRefetchEvents = () => {
    if (!lastFetched) return true;
    return Date.now() - lastFetched > CACHE_DURATION;
  };

  const fetchCalendarAccounts = async () => {
    setIsLoadingAccounts(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      const { data, error } = await supabase
        .from('user_calendar_accounts')
        .select('id , user_id , calendar_email ')
        .eq('user_id', user?.id);

      if (error) throw error;
      setCalendarAccounts(data?.map(account => ({
        ...account,
        calendars: []
      })) || []);

      if (data?.length > 0 && shouldRefetchEvents()) {
        fetchEvents(data); // Don't await, let it load in background
      }
    } catch (error: any) {
      console.error('Error fetching calendar accounts:', error);
      toast({
        title: 'Error',
        description: 'Failed to fetch calendar accounts',
        variant: 'destructive',
      });
    } finally {
      setIsLoadingAccounts(false);
    }
  };

  const fetchEvents = async (accounts: CalendarAccount[]) => {
    setIsLoadingEvents(true);
    try {
      const timeMin = new Date();
      timeMin.setFullYear(timeMin.getFullYear() - 1);
      const timeMax = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);

      const allEvents = await Promise.all(
        accounts.map(async (account) => {
          try {
            const response = await fetch(
              `/api/calendar/events?accountId=${account.id}&timeMin=${timeMin.toISOString()}&timeMax=${timeMax.toISOString()}`
            );

            if (!response.ok) return { events: [], calendars: { calendarId: account.id, calendars: [] } };

            const data = await response.json();
            const _events = data?.events;
            const _calendars = Array.from(data?.calendars || []);

            const events = _events.map((event: any) => ({
              id: event.id,
              title: event.summary || 'Untitled Event',
              start: new Date(event.start.dateTime || event.start.date),
              end: new Date(event.end.dateTime || event.end.date),
              calendarId: account.id,
              description: event.description,
              location: event.location,
              _calendarId: event._calendarId,
            }));

            return {
              events: events,
              calendars: { calendarId: account.id, calendars: _calendars || [] },
            };
          } catch (error) {
            console.error('Error fetching events for account:', error);
            return { events: [], calendars: { calendarId: account.id, calendars: [] } };
          }
        })
      );

      const flattenedEvents = allEvents.map((account) => account?.events).flat();

      setEvents(flattenedEvents);

      const calendarsMap = new Map<string, Calendar[]>();

      allEvents.forEach((account) => {
        const calendarId = account?.calendars?.calendarId;
        if (calendarId) {
          calendarsMap.set(calendarId, account?.calendars?.calendars as Calendar[]);
        }
      });

      const _calendarAccounts = accounts.map((account) => ({
        ...account,
        calendars: calendarsMap.get(account.id) || []
      }));


      setCalendarAccounts(_calendarAccounts);

      setLastFetched(Date.now());
    } catch (error) {
      console.error('Error fetching events:', error);
      toast({
        title: 'Error',
        description: 'Failed to fetch events',
        variant: 'destructive',
      });
    } finally {
      setIsLoadingEvents(false);
    }
  };

  const createEvent = async (eventData: Partial<CalendarEvent>) => {
    const calendarId = eventData.calendarId || selectedCalendar;
    if (!calendarId) {
      throw new Error('Please select a calendar first');
    }

    const formattedEvent = {
      summary: eventData.title,
      description: eventData.description,
      start: {
        dateTime: new Date(eventData.start as Date).toISOString(),
        timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone,
      },
      end: {
        dateTime: new Date(eventData.end as Date).toISOString(),
        timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone,
      }
    };

    const response = await fetch(`/api/calendar/events?accountId=${calendarId}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        event: formattedEvent
      }),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.message || 'Failed to create event');
    }

    const newEvent = await response.json();
    await fetchEvents(calendarAccounts);
    return newEvent;
  };

  const updateEvent = async (eventData: CalendarEvent) => {
    if (!selectedCalendar) {
      throw new Error('Please select a calendar first');
    }

    const formattedEvent = {
      summary: eventData.title,
      description: eventData.description,
      start: {
        dateTime: new Date(eventData.start).toISOString(),
        timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone,
      },
      end: {
        dateTime: new Date(eventData.end).toISOString(),
        timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone,
      },
    };

    // Validate time range
    if (new Date(formattedEvent.start.dateTime) >= new Date(formattedEvent.end.dateTime)) {
      throw new Error('End time must be after start time');
    }

    try {
      const response = await fetch(
        `/api/calendar/events/${eventData.id}?accountId=${selectedCalendar}`,
        {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            calendarId: selectedCalendar,
            event: formattedEvent
          }),
        }
      );

      if (!response.ok) {
        const error = await response.json();
        if (error.details?.error?.code === 401) {
          // Token expired, trigger a refresh by redirecting to auth
          await connectCalendar();
          return;
        }
        throw new Error(error.message || error.error || error.details?.error?.message || 'Failed to update event');
      }

      const updatedEvent = await response.json();
      await fetchEvents(calendarAccounts);
      return updatedEvent;
    } catch (error: any) {
      console.error('Error updating event:', error);
      throw error;
    }
  };

  const deleteEvent = async (eventId: string) => {
    if (!selectedCalendar) {
      throw new Error('Please select a calendar first');
    }

    const response = await fetch(
      `/api/calendar/events/${eventId}?accountId=${selectedCalendar}`,
      {
        method: 'DELETE',
      }
    );

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.message || 'Failed to delete event');
    }

    await fetchEvents(calendarAccounts);
  };

  const connectCalendar = async () => {
    const response = await fetch('/api/calendar/auth-url');
    const { url } = await response.json();
    if (url && typeof window !== 'undefined') {
      window.location.href = url;
    }
  };

  // Return events with properly instantiated Date objects
  const getFormattedEvents = () => {
    // const filteredEvents = selectedCalendar
    //   ? events.filter(event => event.calendarId === selectedCalendar)
    //   : events;

    const filteredEvents = events;
      
    return filteredEvents.map(event => ({
      ...event,
      start: new Date(event.start),
      end: new Date(event.end)
    }));
  };

  return {
    events: getFormattedEvents(),
    calendarAccounts,
    isLoadingEvents,
    isLoadingAccounts,
    selectedCalendar,
    setSelectedCalendar,
    createEvent,
    updateEvent,
    deleteEvent,
    connectCalendar,
    refreshEvents: () => fetchEvents(calendarAccounts),
  };
}

export type { CalendarEvent, CalendarAccount } from '@/store/use-calendar-store';
