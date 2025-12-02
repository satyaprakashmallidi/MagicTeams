import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';

export interface CalendarEvent {
  id: string;
  title: string;
  start: Date;
  end: Date;
  calendarId: string;
  description?: string;
  location?: string;
}

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

export interface CalendarAccount {
  id: string;
  calendar_email: string;
  user_id: string;
  calendars?: Calendar[];
}

interface CalendarStore {
  events: CalendarEvent[];
  calendarAccounts: CalendarAccount[];
  selectedCalendar: string | null;
  lastFetched: number | null;
  setEvents: (events: CalendarEvent[]) => void;
  setCalendarAccounts: (accounts: CalendarAccount[]) => void;
  setSelectedCalendar: (id: string | null) => void;
  setLastFetched: (timestamp: number) => void;
  clearStore: () => void;
}

// Custom storage object to handle Date serialization/deserialization
const customStorage = {
  getItem: async (name: string): Promise<string | null> => {
    const str = localStorage.getItem(name);
    return str ?? null;
  },
  setItem: async (name: string, value: string): Promise<void> => {
    localStorage.setItem(name, value);
  },
  removeItem: async (name: string): Promise<void> => {
    localStorage.removeItem(name);
  },
};

export const useCalendarStore = create<CalendarStore>()(
  persist(
    (set) => ({
      events: [],
      calendarAccounts: [],
      selectedCalendar: null,
      lastFetched: null,
      setEvents: (events) => set({ events }),
      setCalendarAccounts: (accounts) => set({ calendarAccounts: accounts }),
      setSelectedCalendar: (id) => set({ selectedCalendar: id }),
      setLastFetched: (timestamp) => set({ lastFetched: timestamp }),
      clearStore: () => set({ 
        events: [], 
        calendarAccounts: [], 
        selectedCalendar: null, 
        lastFetched: null 
      }),
    }),
    {
      name: 'calendar-store',
      storage: createJSONStorage(() => customStorage),
      partialize: (state) => ({
        calendarAccounts: state.calendarAccounts,
        selectedCalendar: state.selectedCalendar,
        lastFetched: state.lastFetched,
        // Don't persist events to avoid date serialization issues
      }),
    }
  )
);
