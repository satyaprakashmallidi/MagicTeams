"use client";

import { useState, useCallback, useEffect, useRef } from "react";
import { Calendar, dateFnsLocalizer, View } from "react-big-calendar";
import format from "date-fns/format";
import parse from "date-fns/parse";
import startOfWeek from "date-fns/startOfWeek";
import getDay from "date-fns/getDay";
import { useToast } from "@/hooks/use-toast";
import { useCalendar } from "@/hooks/use-calendar";
import { EventModal } from "./event-modal";
import { CalendarHeader } from "./calendar-header";

import { Icon } from "@/components/ui/icons";
import "react-big-calendar/lib/css/react-big-calendar.css";
import "@/styles/calendar.css";
import { CalendarEvent } from '@/store/use-calendar-store';

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

export function CalendarView() {
  const {
    events,
    calendarAccounts,
    isLoadingEvents,
    selectedCalendar,
    setSelectedCalendar,
    createEvent,
    updateEvent,
    deleteEvent,
    connectCalendar,
  } = useCalendar();

  const [selectedEvent, setSelectedEvent] = useState<CalendarEvent | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [integrating, setIntegrating] = useState(false);
  const [view, setView] = useState<View>('month');
  const [date, setDate] = useState(new Date());
  const [eventData, setEventData] = useState<Partial<CalendarEvent> | null>(null);
  const { toast } = useToast();
  // Add this state for dropdown visibility
  const [isCalendarSelectorOpen, setIsCalendarSelectorOpen] = useState(false);

  // Add new state for selected accounts
  const [selectedAccounts, setSelectedAccounts] = useState<Set<string>>(new Set());

  // Initialize visibleCalendars with all calendar IDs
  const [visibleCalendars, setVisibleCalendars] = useState<Set<string>>(new Set());

  // Track if user has toggled calendar visibility
  const hasUserToggledVisibility = useRef(false);
  // Track if user has toggled account selection
  const hasUserToggledAccounts = useRef(false);

  const [calendars, setCalendars] = useState<any[]>([]);

useEffect(() => {
  const _calendars = calendarAccounts.map(account => {
    if(selectedAccounts.has(account.id)) return account.calendars || [];
    return [];
  }).flat();

  //lets remove the duplicates wwiht same id
  setCalendars(_calendars.filter((calendar, index) => _calendars.findIndex(c => c.id === calendar.id) === index));
}, [calendarAccounts, selectedAccounts]);



  const handleAccountToggle = (accountId: string) => {
    hasUserToggledAccounts.current = true;
    setSelectedAccounts(prev => {
      const next = new Set(prev);
      if (next.has(accountId)) {
        next.delete(accountId);
      } else {
        next.add(accountId);
      }
      return next;
    });
  };

  const visibleEvents = events.filter(event => {
    // First check if the event has a valid calendar ID
    const eventCalendarId = event.calendarId;
    if (!eventCalendarId) return false;

    if(selectedAccounts.has(eventCalendarId)){
      //@ts-ignore
      return visibleCalendars.has(event._calendarId);
      // this _calendarId is the email of the organizer in the event
    }

    return false;
  });

  // Restore this effect to initialize selectedAccounts
  useEffect(() => {
    if (
      calendarAccounts.length > 0 &&
      selectedAccounts.size === 0 &&
      !hasUserToggledAccounts.current
    ) {
      setSelectedAccounts(new Set(calendarAccounts.map(account => account.id)));
    }
  }, [calendarAccounts, selectedAccounts.size]);

  // New effect: ensure visibleCalendars is initialized to all calendar IDs on mount/remount
  useEffect(() => {
    if (
      calendars.length > 0 &&
      visibleCalendars.size === 0 &&
      !hasUserToggledVisibility.current
    ) {
      setVisibleCalendars(new Set(calendars.map(cal => cal.id)));
    }
  }, [calendars, visibleCalendars.size]);

  // Debug logging to help identify issues
  // useEffect(() => {
  //   console.log('Debug Info:', {
  //     totalEvents: events.length,
  //     visibleEvents: visibleEvents,
  //     selectedAccounts: Array.from(selectedAccounts),
  //     visibleCalendars: Array.from(visibleCalendars),
  //     calendarAccounts: calendarAccounts
  //   });
  // }, [events, visibleEvents, selectedAccounts, visibleCalendars, calendarAccounts]);

  // Simplified and fixed getEventColor function
  const getEventColor = useCallback((calendarId: string) => {
    if(!calendarId) return '#D32F2F';

    // Vibrant fallback colors
    const vibrantColors = [
      '#D32F2F', // Bright Red
      '#1976D2', // Bold Blue
      '#F57C00', // Deep Orange
      '#388E3C', // Strong Green
      '#7B1FA2', // Rich Purple
      '#F50057', // Vivid Pink
      '#0288D1', // Vibrant Cyan
      '#FBC02D', // Golden Yellow
      '#C2185B', // Deep Rose
      '#512DA8', // Dark Indigo
      '#689F38', // Fresh Green
      '#00796B', // Rich Teal
    ];


    // Generate consistent color based on calendarId
    const hash = calendarId.split('').reduce((acc, char) => {
      return char.charCodeAt(0) + ((acc << 5) - acc);
    }, 0);

    return vibrantColors[Math.abs(hash) % vibrantColors.length];
  }, [calendars]);

  // Toggle calendar visibility
  const toggleCalendarVisibility = (calendarId: string) => {
    hasUserToggledVisibility.current = true;
    setVisibleCalendars(prev => {
      const next = new Set(prev);
      if (next.has(calendarId)) {
        next.delete(calendarId);
      } else {
        next.add(calendarId);
      }
      return next;
    });
  };

  const handleSelectSlot = useCallback(
    ({ start, end }: { start: Date; end: Date }) => {
      if (!selectedCalendar) {
        toast({
          title: "Error",
          description: "Please select a calendar first",
          variant: "destructive",
        });
        return;
      }

      setSelectedEvent(null);
      setIsModalOpen(true);
      setEventData({
        start,
        end,
        calendarId: selectedCalendar,
      });
    },
    [selectedCalendar, toast]
  );

  const handleEventModalSave = async (eventData: any) => {
    try {
      if (selectedEvent?.id) {
        await updateEvent(eventData);
      } else {
        await createEvent(eventData);
      }

      // Close modal before showing success toast
      setIsModalOpen(false);
      setSelectedEvent(null);
      setEventData(null);

      toast({
        title: "Success",
        description: selectedEvent?.id ? "Event updated successfully" : "Event created successfully",
      });
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  const handleEventDelete = async (event: any) => {
    try {
      await deleteEvent(event.id);
      toast({
        title: "Success",
        description: "Event deleted successfully",
      });
      setIsModalOpen(false);
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  const handleAddCalendar = async () => {
    setIntegrating(true);
    try {
      await connectCalendar();
    } catch (error: any) {
      toast({
        title: "Error",
        description: "Failed to start calendar authentication",
        variant: "destructive",
      });
    } finally {
      setIntegrating(false);
    }
  };

  return (
    <div className="h-full flex flex-col">
      {/* Header Section with gradient background */}
      <div className="bg-gradient-to-r from-white to-gray-50 border-b border-gray-200 shadow-sm">
        <div className="max-w-[1800px] mx-auto">
          <div className="px-6 py-4 flex items-center justify-between">
            {/* Left side group */}
            <div className="flex items-center space-x-8">

              {/* Account Selector with better styling */}
              <CalendarHeader
                calendarAccounts={calendarAccounts}
                selectedAccounts={selectedAccounts}
                onAccountToggle={handleAccountToggle}
                onAddEvent={() => {
                  const now = new Date();
                  handleSelectSlot({
                    start: now,
                    end: new Date(now.getTime() + 60 * 60 * 1000),
                  });
                }}
                onAddCalendar={handleAddCalendar}
                integrating={integrating}
              />

              {/* Calendar Visibility Selector */}
              <div className="relative">
                <button
                  onClick={() => setIsCalendarSelectorOpen(!isCalendarSelectorOpen)}
                  className={`
                    inline-flex items-center gap-2 px-4 py-2.5 
                    bg-white rounded-lg border border-gray-200 
                    hover:bg-gray-50 active:bg-gray-100
                    focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2
                    transition-all duration-200
                    ${isCalendarSelectorOpen ? 'bg-gray-50 ring-2 ring-blue-500' : ''}
                  `}
                >
                  <Icon name="calendar" className="w-4 h-4 text-gray-600" />
                  <span className="text-sm font-medium text-gray-700">Calendars</span>
                  <Icon 
                    name={isCalendarSelectorOpen ? "chevron-up" : "chevron-down"} 
                    className={`w-4 h-4 transition-transform duration-200 ${
                      isCalendarSelectorOpen ? 'text-blue-500' : 'text-gray-400'
                    }`}
                  />
                </button>

                {/* Improved Dropdown Panel */}
                {isCalendarSelectorOpen && (
                  <div className="absolute left-0 mt-2 w-80 bg-white rounded-lg shadow-xl border border-gray-200 z-50 transform opacity-100 scale-100 transition-all duration-200">
                    <div className="p-3">
                      <div className="flex items-center justify-between pb-2 border-b border-gray-100">
                        <span className="text-sm font-semibold text-gray-900">Visible Calendars</span>
                        <button
                          onClick={() => {
                            const allIds = new Set(calendars.map(cal => cal.id));
                            setVisibleCalendars(allIds);
                          }}
                          className="text-xs font-medium text-blue-600 hover:text-blue-700 transition-colors"
                        >
                          Show All
                        </button>
                      </div>
                      <div className="mt-2 max-h-[320px] overflow-y-auto custom-scrollbar">
                        {calendars.map((calendar) => {
                          const isVisible = visibleCalendars.has(calendar.id);
                          const calendarColor = getEventColor(calendar.id);
                            console.log(calendar , "i am mapping this calendsarr hahaha");
                          return (
                            <div
                              key={calendar.id}
                              onClick={() => toggleCalendarVisibility(calendar.id)}
                              className={`
                                flex items-center px-3 py-2 
                                hover:bg-gray-50 rounded-md cursor-pointer
                                transition-all duration-200
                                ${isVisible ? 'bg-gray-50/50' : ''}
                              `}
                            >
                              <div className="flex items-center gap-3 flex-1 min-w-0">
                                <div
                                  className={`
                                    w-3 h-3 rounded-full 
                                    transition-all duration-200
                                    ${isVisible ? 'scale-100' : 'scale-90 opacity-40'}
                                  `}
                                  style={{
                                    backgroundColor: calendarColor,
                                    boxShadow: isVisible ? `0 0 0 2px ${calendarColor}33` : 'none'
                                  }}
                                />
                                <span 
                                  className={`text-sm truncate transition-colors duration-200 ${
                                    isVisible ? 'text-gray-900 font-medium' : 'text-gray-500'
                                  }`}
                                >
                                  {calendar.summary || calendar.name || 'Unnamed Calendar'}
                                </span>
                                {isVisible && (
                                  <Icon 
                                    name="check" 
                                    className="w-4 h-4 ml-auto flex-shrink-0"
                                    style={{ color: calendarColor }}
                                  />
                                )}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Right side group */}
            <div className="flex items-center space-x-4">
              {/* Add Calendar Button */}
              <button
                onClick={handleAddCalendar}
                disabled={integrating}
                className={`
                  inline-flex items-center gap-2 px-4 py-2.5
                  text-gray-700 bg-white rounded-lg border border-gray-200
                  hover:bg-gray-50 active:bg-gray-100
                  focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2
                  transition-all duration-200
                  ${integrating ? 'opacity-70 cursor-not-allowed' : ''}
                `}
              >
                {integrating ? (
                  <Icon name="loader2" className="w-4 h-4 animate-spin text-gray-600" />
                ) : (
                  <Icon name="plus-circle" className="w-4 h-4 text-gray-600" />
                )}
                <span className="text-sm font-medium">
                  {integrating ? 'Connecting...' : 'Add Calendar'}
                </span>
              </button>

              {/* New Event Button */}
              <button
                onClick={() => {
                  const now = new Date();
                  handleSelectSlot({
                    start: now,
                    end: new Date(now.getTime() + 60 * 60 * 1000),
                  });
                }}
                className="
                  inline-flex items-center gap-2 px-4 py-2.5
                  bg-blue-600 text-white rounded-lg
                  hover:bg-blue-700 active:bg-blue-800
                  focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2
                  transition-all duration-200
                "
              >
                <Icon name="plus" className="w-4 h-4" />
                <span className="text-sm font-medium">New Event</span>
              </button>
            </div>
          </div>
        </div>
      </div>

      






        <div className="flex-1 p-4 relative">
          <Calendar
            localizer={localizer as any}
            events={visibleEvents}
            startAccessor="start"
            endAccessor="end"
            onSelectSlot={handleSelectSlot}
            onSelectEvent={(event) => {
              setSelectedEvent(event);
              setIsModalOpen(true);
              setSelectedCalendar(event.calendarId);
            }}
            selectable
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
            eventPropGetter={(event) => ({
              style: {
                backgroundColor: getEventColor(event._calendarId || event.calendarId),
                borderRadius: "4px",
                color: "#FFFFFF",
                border: "none",
                boxShadow: "0 1px 3px rgba(0,0,0,0.1)",
                padding: "2px 4px",
              },
            })}
          />

          {isLoadingEvents && (
            <div className="absolute inset-0 bg-white/50 flex items-center justify-center backdrop-blur-sm z-10">
              <div className="flex items-center gap-2 px-6 py-4 rounded-lg bg-white shadow-xl border border-gray-300">
                <Icon name="loader2" className="h-6 w-6 animate-spin text-blue-600" />
                <span className="text-lg font-semibold text-gray-800">Loading events...</span>
              </div>
            </div>
          )}

          {isModalOpen && (
            <EventModal
              event={selectedEvent}
              calendarAccounts={calendarAccounts}
              onClose={() => {
                setIsModalOpen(false);
                setSelectedEvent(null);
              }}
              onSave={handleEventModalSave}
              onDelete={handleEventDelete}
              eventData={eventData}
            />
          )}
        </div>
      
    </div>
  );
}