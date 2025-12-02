"use client";

import { useState, useCallback, useEffect, useRef } from "react";
import { Calendar, dateFnsLocalizer, View } from "react-big-calendar";
import format from "date-fns/format";
import parse from "date-fns/parse";
import startOfWeek from "date-fns/startOfWeek";
import getDay from "date-fns/getDay";
import { useToast } from "@/hooks/use-toast";
import { Icon } from "@/components/ui/icons";
import { ghlClient } from "@/lib/ghl-client";
import GHLNewBooking from "./ghl-new-booking";
import GHLViewBooking from "./ghl-view-booking";
import "react-big-calendar/lib/css/react-big-calendar.css";
import "@/styles/calendar.css";

const locales = {
  "en-US": require("date-fns/locale/en-US"),
};

const localizer = dateFnsLocalizer({
  format,
  parse,
  startOfWeek,
  getDay,
  locales,
});

interface GHLCalendar {
  id: string;
  name: string;
  description?: string;
  isActive: boolean;
  eventColor?: string;
  calendarType: string;
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
  startTime?: string;
  endTime?: string;
}

interface GHLCalendarViewProps {
  isConnected: boolean;
  onConnect: () => void;
}

export function GHLCalendarView({ isConnected, onConnect }: GHLCalendarViewProps) {
  const [calendars, setCalendars] = useState<GHLCalendar[]>([]);
  const [events, setEvents] = useState<GHLEvent[]>([]);
  const [selectedCalendars, setSelectedCalendars] = useState<Set<string>>(new Set());
  const [isLoadingCalendars, setIsLoadingCalendars] = useState(false);
  const [isLoadingEvents, setIsLoadingEvents] = useState(false);
  const [view, setView] = useState<View>("month");
  const [date, setDate] = useState(new Date());
  const [isCalendarSelectorOpen, setIsCalendarSelectorOpen] = useState(false);
  const [isBookingModalOpen, setIsBookingModalOpen] = useState(false);
  const [selectedEvent, setSelectedEvent] = useState<GHLEvent | null>(null);
  const [isViewBookingModalOpen, setIsViewBookingModalOpen] = useState(false);
  const { toast } = useToast();

  const hasUserToggledCalendars = useRef(false);

  // Fetch calendars when connected
  useEffect(() => {
    if (isConnected) {
      fetchCalendars();
    }
  }, [isConnected]);

  // Fetch events when calendars change
  useEffect(() => {
    if (selectedCalendars.size > 0) {
      fetchEvents();
    }
  }, [selectedCalendars, date, view]);

  // Initialize selected calendars when calendars are loaded
  useEffect(() => {
    if (
      calendars.length > 0 &&
      selectedCalendars.size === 0 &&
      !hasUserToggledCalendars.current
    ) {
      setSelectedCalendars(new Set(calendars.filter(cal => cal.isActive).map(cal => cal.id)));
    }
  }, [calendars, selectedCalendars.size]);

  const fetchCalendars = async () => {
    try {
      setIsLoadingCalendars(true);
      const calendars = await ghlClient.getAllCalendars();
      setCalendars(calendars);
    } catch (error) {
      console.error("Error fetching calendars:", error);
      toast({
        title: "Error",
        description: "Failed to fetch calendars",
        variant: "destructive",
      });
    } finally {
      setIsLoadingCalendars(false);
    }
  };

  const fetchEvents = async () => {
    try {
      setIsLoadingEvents(true);

      // Calculate date range based on current view
      const startDate = getViewStartDate(date, view);
      const endDate = getViewEndDate(date, view);

      const promises = Array.from(selectedCalendars).map(calendarId =>
        ghlClient.getAllEvents({
          calendarId,
          startDate: startDate.toISOString(),
          endDate: endDate.toISOString(),
        }).then(events => {
          // Transform the events to ensure proper date objects
          return events.map((event: any) => ({
            ...event,
            id: event.id,
            title: event.title || 'Untitled',
            start: new Date(event.startTime || event.start),
            end: new Date(event.endTime || event.end || event.startTime || event.start),
            calendarId: event.calendarId,
            appointmentStatus: event.appointmentStatus,
            notes: event.notes,
            contactId: event.contactId,
            address: event.address
          }));
        })
      );

      const eventArrays = await Promise.all(promises);
      const allEvents = eventArrays.flat();

      setEvents(allEvents);
    } catch (error) {
      console.error("Error fetching events:", error);
      toast({
        title: "Error",
        description: "Failed to fetch calendar events",
        variant: "destructive",
      });
    } finally {
      setIsLoadingEvents(false);
    }
  };

  const getViewStartDate = (date: Date, view: View) => {
    const start = new Date(date);
    switch (view) {
      case "month":
        start.setDate(1);
        start.setDate(start.getDate() - start.getDay());
        break;
      case "week":
        start.setDate(start.getDate() - start.getDay());
        break;
      case "day":
        // Keep same date
        break;
    }
    start.setHours(0, 0, 0, 0);
    return start;
  };

  const getViewEndDate = (date: Date, view: View) => {
    const end = new Date(date);
    switch (view) {
      case "month":
        end.setMonth(end.getMonth() + 1);
        end.setDate(0);
        end.setDate(end.getDate() + (6 - end.getDay()));
        break;
      case "week":
        end.setDate(end.getDate() + (6 - end.getDay()));
        break;
      case "day":
        // Keep same date
        break;
    }
    end.setHours(23, 59, 59, 999);
    return end;
  };

  const getEventColor = useCallback((calendarId: string) => {
    const calendar = calendars.find(cal => cal.id === calendarId);
    if (calendar?.eventColor) {
      return calendar.eventColor;
    }

    // Fallback colors
    const colors = [
      '#D32F2F', '#1976D2', '#F57C00', '#388E3C', '#7B1FA2',
      '#F50057', '#0288D1', '#FBC02D', '#C2185B', '#512DA8'
    ];
    
    const hash = calendarId.split('').reduce((acc, char) => {
      return char.charCodeAt(0) + ((acc << 5) - acc);
    }, 0);

    return colors[Math.abs(hash) % colors.length];
  }, [calendars]);

  const toggleCalendarSelection = (calendarId: string) => {
    hasUserToggledCalendars.current = true;
    setSelectedCalendars(prev => {
      const next = new Set(prev);
      if (next.has(calendarId)) {
        next.delete(calendarId);
      } else {
        next.add(calendarId);
      }
      return next;
    });
  };

  const visibleEvents = events.filter(event => 
    selectedCalendars.has(event.calendarId)
  );

  if (!isConnected) {
    return (
      <div className="h-full flex flex-col items-center justify-center">
        <div className="text-center">
          <Icon name="calendar" className="w-16 h-16 text-gray-400 mx-auto mb-4" />
          <h2 className="text-2xl font-bold text-gray-900 mb-2">Connect your GHL Calendar</h2>
          <p className="text-gray-600 mb-6">
            Connect your GoHighLevel account to view and manage your calendars
          </p>
          <button
            onClick={onConnect}
            className="inline-flex items-center gap-2 px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
          >
            <Icon name="link" className="w-5 h-5" />
            Connect GHL Account
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <div className="bg-gradient-to-r from-background to-muted/50 border-b border-border shadow-sm">
        <div className="max-w-[1800px] mx-auto">
          <div className="px-6 py-4 flex items-center justify-between">
            {/* Left side */}
            <div className="flex items-center space-x-8">
              {/* Calendar Selector */}
              <div className="relative">
                <button
                  onClick={() => setIsCalendarSelectorOpen(!isCalendarSelectorOpen)}
                  className={`
                    inline-flex items-center gap-2 px-4 py-2.5 
                    bg-background rounded-lg border border-border
                    hover:bg-accent active:bg-accent
                    focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2
                    transition-all duration-200
                    ${isCalendarSelectorOpen ? 'bg-accent ring-2 ring-primary' : ''}
                  `}
                >
                  <Icon name="calendar" className="w-4 h-4 text-gray-600" />
                  <span className="text-sm font-medium text-gray-700">
                    Calendars ({selectedCalendars.size})
                  </span>
                  <Icon 
                    name={isCalendarSelectorOpen ? "chevron-up" : "chevron-down"} 
                    className={`w-4 h-4 transition-transform duration-200 ${
                      isCalendarSelectorOpen ? 'text-blue-500' : 'text-gray-400'
                    }`}
                  />
                </button>

                {/* Calendar Dropdown */}
                {isCalendarSelectorOpen && (
                  <div className="absolute left-0 mt-2 w-80 bg-popover rounded-lg shadow-xl border border-border z-50">
                    <div className="p-3">
                      <div className="flex items-center justify-between pb-2 border-b border-gray-100">
                        <span className="text-sm font-semibold text-gray-900">Select Calendars</span>
                        <button
                          onClick={() => {
                            const allActiveIds = new Set(calendars.filter(cal => cal.isActive).map(cal => cal.id));
                            setSelectedCalendars(allActiveIds);
                          }}
                          className="text-xs font-medium text-blue-600 hover:text-blue-700 transition-colors"
                        >
                          Select All Active
                        </button>
                      </div>
                      <div className="mt-2 max-h-[320px] overflow-y-auto">
                        {isLoadingCalendars ? (
                          <div className="flex items-center justify-center py-8">
                            <Icon name="loader2" className="w-5 h-5 animate-spin text-blue-600" />
                            <span className="ml-2 text-sm text-gray-600">Loading calendars...</span>
                          </div>
                        ) : calendars.length === 0 ? (
                          <div className="py-8 text-center text-gray-500">
                            <p className="text-sm">No calendars found</p>
                          </div>
                        ) : (
                          calendars.map((calendar) => {
                            const isSelected = selectedCalendars.has(calendar.id);
                            const calendarColor = getEventColor(calendar.id);
                            
                            return (
                              <div
                                key={calendar.id}
                                onClick={() => toggleCalendarSelection(calendar.id)}
                                className={`
                                  flex items-center px-3 py-2 
                                  hover:bg-accent rounded-md cursor-pointer
                                  transition-all duration-200
                                  ${isSelected ? 'bg-accent/50' : ''}
                                `}
                              >
                                <div className="flex items-center gap-3 flex-1 min-w-0">
                                  <div
                                    className={`
                                      w-3 h-3 rounded-full 
                                      transition-all duration-200
                                      ${isSelected ? 'scale-100' : 'scale-90 opacity-40'}
                                    `}
                                    style={{
                                      backgroundColor: calendarColor,
                                      boxShadow: isSelected ? `0 0 0 2px ${calendarColor}33` : 'none'
                                    }}
                                  />
                                  <div className="flex-1 min-w-0">
                                    <span className={`text-sm truncate transition-colors duration-200 ${
                                      isSelected ? 'text-gray-900 font-medium' : 'text-gray-500'
                                    }`}>
                                      {calendar.name}
                                    </span>
                                    {calendar.description && (
                                      <p className="text-xs text-gray-400 truncate">
                                        {calendar.description}
                                      </p>
                                    )}
                                  </div>
                                  {isSelected && (
                                    <Icon 
                                      name="check" 
                                      className="w-4 h-4 ml-auto flex-shrink-0"
                                      style={{ color: calendarColor }}
                                    />
                                  )}
                                </div>
                              </div>
                            );
                          })
                        )}
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Right side */}
            <div className="flex items-center space-x-4">
              <button
                onClick={fetchCalendars}
                disabled={isLoadingCalendars}
                className="inline-flex items-center gap-2 px-4 py-2.5 text-foreground bg-background rounded-lg border border-border hover:bg-accent transition-colors"
              >
                {isLoadingCalendars ? (
                  <Icon name="loader2" className="w-4 h-4 animate-spin" />
                ) : (
                  <Icon name="refresh-cw" className="w-4 h-4" />
                )}
                <span className="text-sm font-medium">Refresh</span>
              </button>
              
              <button
                onClick={() => setIsBookingModalOpen(true)}
                disabled={calendars.length === 0}
                className="inline-flex items-center gap-2 px-4 py-2.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                <Icon name="plus" className="w-4 h-4" />
                <span className="text-sm font-medium">New Appointment</span>
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Calendar */}
      <div className="flex-1 p-4 relative">
        <Calendar
          localizer={localizer as any}
          events={visibleEvents}
          startAccessor="start"
          endAccessor="end"
          style={{ height: "calc(100% - 16px)" }}
          view={view}
          onView={setView}
          date={date}
          onNavigate={setDate}
          defaultView="month"
          views={["month", "week", "day"]}
          popup
          toolbar={true}
          min={new Date(0, 0, 0, 6, 0, 0)}
          max={new Date(0, 0, 0, 23, 59, 59)}
          eventPropGetter={(event) => {
            const isCancelled = event.appointmentStatus?.toLowerCase() === 'cancelled';
            return {
              style: {
                backgroundColor: isCancelled ? '#ef4444' : getEventColor(event.calendarId),
                borderRadius: "4px",
                color: "#FFFFFF",
                border: "none",
                boxShadow: "0 1px 3px rgba(0,0,0,0.1)",
                padding: "2px 4px",
                opacity: isCancelled ? 0.7 : 1,
              },
            };
          }}
          onSelectEvent={(event) => {
            setSelectedEvent(event);
            setIsViewBookingModalOpen(true);
          }}
        />

        {isLoadingEvents && (
          <div className="absolute inset-0 bg-background/50 flex items-center justify-center backdrop-blur-sm z-10">
            <div className="flex items-center gap-2 px-6 py-4 rounded-lg bg-background shadow-xl border border-border">
              <Icon name="loader2" className="h-6 w-6 animate-spin text-blue-600" />
              <span className="text-lg font-semibold text-gray-800">Loading events...</span>
            </div>
          </div>
        )}
      </div>

      {/* New Booking Modal */}
      {isBookingModalOpen && (
        <GHLNewBooking
          calendars={calendars}
          onClose={() => setIsBookingModalOpen(false)}
          onBookingConfirmed={() => {
            setIsBookingModalOpen(false);
            fetchEvents(); // Refresh events after creating appointment
          }}
        />
      )}

      {/* View Booking Modal */}
      {isViewBookingModalOpen && selectedEvent && (
        <GHLViewBooking
          event={selectedEvent}
          onClose={() => {
            setIsViewBookingModalOpen(false);
            setSelectedEvent(null);
          }}
          onEventUpdated={() => {
            setIsViewBookingModalOpen(false);
            setSelectedEvent(null);
            fetchEvents(); // Refresh events after updating
          }}
        />
      )}
    </div>
  );
}