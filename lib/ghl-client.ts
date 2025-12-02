import { createClient } from "@/utils/supabase/client";
import {
  UpdateEventPayload,
  CreateEventPayload,
  GHLUser,
  GHLEvent,
  GHLContact,
  GHLConnection,
  GHLCalendar
} from "./types";
import {
  getAllCalendars,
  getCalendarById,
  getAllContacts,
  getAllEvents,
  getAllUsersByLocationId,
  getLocationById,
  createEvent,
  updateEvent,
  deleteEvent
} from "./ghl-functions";

const supabase = createClient();

class GHLClientService {
  private async getCurrentUserId(): Promise<string> {
    const { data: { user }, error } = await supabase.auth.getUser();
    if (error || !user) {
      throw new Error("User not authenticated");
    }
    return user.id;
  }

  async getAllCalendars(options?: {
    locationId?: string;
    groupId?: string;
    showDrafted?: boolean;
  }): Promise<GHLCalendar[]> {
    const userId = await this.getCurrentUserId();
    return getAllCalendars(userId, options);
  }

  async getCalendarById(calendarId: string): Promise<GHLCalendar> {
    const userId = await this.getCurrentUserId();
    return getCalendarById(userId, calendarId);
  }

  async getAllContacts(): Promise<GHLContact[]> {
    const userId = await this.getCurrentUserId();
    return getAllContacts(userId);
  }

  async getAllEvents(options?: {
    locationId?: string;
    calendarId?: string;
    userId?: string;
    groupId?: string;
    startDate?: string;
    endDate?: string;
  }): Promise<GHLEvent[]> {
    const userId = await this.getCurrentUserId();
    return getAllEvents(userId, options);
  }

  async getAllUsersByLocationId(locationId?: string): Promise<GHLUser[]> {
    const userId = await this.getCurrentUserId();
    return getAllUsersByLocationId(userId, locationId);
  }

  async getLocationById(locationId?: string): Promise<any> {
    const userId = await this.getCurrentUserId();
    return getLocationById(userId, locationId);
  }

  async createEvent(payload: CreateEventPayload): Promise<GHLEvent> {
    const userId = await this.getCurrentUserId();
    return createEvent(userId, payload);
  }

  async updateEvent(eventId: string, payload: UpdateEventPayload): Promise<GHLEvent> {
    const userId = await this.getCurrentUserId();
    return updateEvent(userId, eventId, payload);
  }

  async deleteEvent(eventId: string): Promise<{ success: boolean; message: string }> {
    const userId = await this.getCurrentUserId();
    return deleteEvent(userId, eventId);
  }
}

// Export a singleton instance
export const ghlClient = new GHLClientService();

// Export types for reuse
export type {
  GHLCalendar,
  GHLContact,
  GHLEvent,
  GHLUser,
  CreateEventPayload,
  UpdateEventPayload,
};