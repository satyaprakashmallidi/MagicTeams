import { useState, useCallback, useEffect } from "react";
import { useToast } from "@/hooks/use-toast";

interface GHLCalendar {
  id: string;
  name: string;
  description?: string;
  isActive: boolean;
  eventColor?: string;
  calendarType: string;
  locationId: string;
  groupId?: string;
}

interface GHLEvent {
  id: string;
  title: string;
  start: Date;
  end: Date;
  calendarId: string;
  appointmentStatus: string;
  notes?: string;
  contactId?: string;
  address?: string;
  assignedUserId?: string;
  users?: string[];
}

interface GHLConnection {
  isConnected: boolean;
  locationId?: string;
}

export function useGHLCalendar() {
  const [connection, setConnection] = useState<GHLConnection>({ isConnected: false });
  const [calendars, setCalendars] = useState<GHLCalendar[]>([]);
  const [events, setEvents] = useState<GHLEvent[]>([]);
  const [isLoadingConnection, setIsLoadingConnection] = useState(true);
  const [isLoadingCalendars, setIsLoadingCalendars] = useState(false);
  const [isLoadingEvents, setIsLoadingEvents] = useState(false);
  const { toast } = useToast();

  // Check connection status
  const checkConnection = useCallback(async () => {
    try {
      setIsLoadingConnection(true);
      const response = await fetch("/api/gh/status");
      const data = await response.json();
      
      setConnection({
        isConnected: data.connected,
        locationId: data.locationId,
      });
      
      return data.connected;
    } catch (error) {
      console.error("Error checking GHL connection:", error);
      setConnection({ isConnected: false });
      return false;
    } finally {
      setIsLoadingConnection(false);
    }
  }, []);

  // Fetch calendars
  const fetchCalendars = useCallback(async () => {
    try {
      setIsLoadingCalendars(true);
      const response = await fetch("/api/gh/calendars");

      if (!response.ok) {
        throw new Error(`Failed to fetch calendars: ${response.status}`);
      }

      const data = await response.json();
      setCalendars(data.calendars || []);

      return data.calendars || [];
    } catch (error) {
      console.error("Error fetching calendars:", error);
      toast({
        title: "Error",
        description: "Failed to fetch calendars",
        variant: "destructive",
      });
      return [];
    } finally {
      setIsLoadingCalendars(false);
    }
  }, [toast]);

  // Fetch events for specific calendars
  const fetchEvents = useCallback(async (
    calendarIds: string[],
    startDate?: Date,
    endDate?: Date
  ) => {
    if (calendarIds.length === 0) {
      setEvents([]);
      return [];
    }

    try {
      setIsLoadingEvents(true);
      
      const params = new URLSearchParams();
      if (startDate) params.append("startDate", startDate.toISOString());
      if (endDate) params.append("endDate", endDate.toISOString());
      
      const promises = calendarIds.map(async (calendarId) => {
        const params = new URLSearchParams();
        params.append("calendarId", calendarId);
        if (startDate) params.append("startDate", startDate.toISOString());
        if (endDate) params.append("endDate", endDate.toISOString());

        const response = await fetch(`/api/gh/events?${params.toString()}`);

        if (!response.ok) {
          console.error(`Failed to fetch events for calendar ${calendarId}: ${response.status}`);
          return [];
        }

        const data = await response.json();
        return data.events || [];
      });

      const eventArrays = await Promise.all(promises);
      const allEvents = eventArrays.flat();
      
      setEvents(allEvents);
      return allEvents;
    } catch (error) {
      console.error("Error fetching events:", error);
      toast({
        title: "Error",
        description: "Failed to fetch calendar events",
        variant: "destructive",
      });
      return [];
    } finally {
      setIsLoadingEvents(false);
    }
  }, [toast]);

  // Get calendar by ID
  const getCalendar = useCallback(async (calendarId: string) => {
    try {
      const response = await fetch(`/api/gh/calendars/${calendarId}`);

      if (!response.ok) {
        throw new Error(`Failed to fetch calendar: ${response.status}`);
      }

      const data = await response.json();
      return data.calendar;
    } catch (error) {
      console.error("Error fetching calendar:", error);
      toast({
        title: "Error",
        description: "Failed to fetch calendar details",
        variant: "destructive",
      });
      return null;
    }
  }, [toast]);

  // Connect to GHL
  const connectGHL = useCallback(() => {
    const clientId = process.env.NEXT_PUBLIC_GHL_CLIENT_ID;
    const redirectUri = `${window.location.origin}/api/gh/callback`;
    const scope = "calendars.readonly calendars.write calendars/events.readonly calendars/events.write contacts.readonly users.readonly locations.readonly";

    const authUrl = `https://marketplace.gohighlevel.com/oauth/chooselocation?response_type=code&client_id=${clientId}&redirect_uri=${redirectUri}&scope=${scope}&location_selection=true`;

    window.location.href = authUrl;
  }, []);

  // Disconnect from GHL
  const disconnectGHL = useCallback(() => {
    // The disconnect route is a GET request that handles the disconnection and redirects
    // So we just redirect to it and let it handle the cleanup
    window.location.href = "/api/gh/disconnect";
  }, []);

  // Initialize connection check on mount
  useEffect(() => {
    checkConnection();
  }, [checkConnection]);

  return {
    // Connection
    connection,
    isLoadingConnection,
    connectGHL,
    disconnectGHL,
    checkConnection,
    
    // Calendars
    calendars,
    isLoadingCalendars,
    fetchCalendars,
    getCalendar,
    
    // Events
    events,
    isLoadingEvents,
    fetchEvents,
  };
}