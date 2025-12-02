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

const GHL_BASE_URL = "https://services.leadconnectorhq.com";

export async function refreshGHLToken(
  currentRefreshToken: string,
  userId: string
): Promise<{ access_token: string; refresh_token: string; expires_at: string }> {
  const encodedParams = new URLSearchParams();
  encodedParams.set("grant_type", "refresh_token");
  encodedParams.set("refresh_token", currentRefreshToken);
  encodedParams.set("client_id", process.env.NEXT_PUBLIC_GHL_CLIENT_ID || "");
  encodedParams.set("client_secret", process.env.NEXT_PUBLIC_GHL_CLIENT_SECRET || "");
  encodedParams.set("user_type", "Company");
  encodedParams.set("redirect_uri", process.env.NEXT_PUBLIC_GHL_REDIRECT_URI || "");

  const refreshRes = await fetch(`${GHL_BASE_URL}/oauth/token`, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      "Accept": "application/json"
    },
    body: encodedParams
  });

  if (!refreshRes.ok) {
    const errorText = await refreshRes.text();
    throw new Error(`Failed to refresh GHL token: ${refreshRes.status} - ${errorText}`);
  }

  const refreshData = await refreshRes.json();
  const newAccessToken = refreshData.access_token;
  const newRefreshToken = refreshData.refresh_token;
  const expiresAt = new Date(Date.now() + refreshData.expires_in * 1000).toISOString();

  // Update the database with new tokens
  const supabase = createClient();
  const { error } = await supabase
    .from("ghl_connections")
    .update({
      access_token: newAccessToken,
      refresh_token: newRefreshToken,
      expires_at: expiresAt
    })
    .eq("user_id", userId);

  if (error) {
    console.error("Failed to update refreshed tokens in database:", error);
    throw new Error("Failed to save refreshed tokens to database");
  }

  return {
    access_token: newAccessToken,
    refresh_token: newRefreshToken,
    expires_at: expiresAt
  };
}



async function getGHLConnection(userId: string): Promise<GHLConnection> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("ghl_connections")
    .select("access_token, location_id, refresh_token, expires_at")
    .eq("user_id", userId)
    .single();

  if (error || !data) {
    throw new Error(`GHL connection not found for user ${userId}`);
  }

  let { access_token, refresh_token, expires_at, location_id } = data;


  if (expires_at && new Date(expires_at) < new Date()) {
    console.log("Token is expired, attempting refresh...");

    if (!refresh_token) {
      console.error("No refresh token available for user:", userId);
      throw new Error("Access token expired and no refresh token available");
    }

    try {
      console.log("Calling refreshGHLToken...");
      const refreshedTokens = await refreshGHLToken(refresh_token, userId);
      access_token = refreshedTokens.access_token;
      refresh_token = refreshedTokens.refresh_token;
      expires_at = refreshedTokens.expires_at;
      console.log("Token refresh successful");
    } catch (refreshError) {
      console.error("Token refresh failed:", refreshError);
      throw new Error("GHL access token expired. Please reconnect your account.");
    }
  }

  return {
    access_token,
    location_id,
    refresh_token,
    expires_at
  };
}

export async function getAllCalendars(
  userId: string,
  options?: {
    locationId?: string;
    groupId?: string;
    showDrafted?: boolean;
  }
): Promise<GHLCalendar[]> {
  const connection = await getGHLConnection(userId);

  const params = new URLSearchParams();
  const locationId = options?.locationId || connection.location_id;
  if (locationId) params.append("locationId", locationId);
  if (options?.groupId) params.append("groupId", options.groupId);
  params.append("showDrafted", (options?.showDrafted !== false).toString());

  const response = await fetch(`${GHL_BASE_URL}/calendars/?${params.toString()}`, {
    method: "GET",
    headers: {
      "Authorization": `Bearer ${connection.access_token}`,
      "Version": "2021-04-15",
      "Accept": "application/json"
    }
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(`Failed to fetch calendars from GHL: ${response.status} ${response.statusText}`);
  }

  const data = await response.json();
  return data.calendars || [];
}

export async function getCalendarById(
  userId: string,
  calendarId: string
): Promise<GHLCalendar> {
  const connection = await getGHLConnection(userId);

  const response = await fetch(`${GHL_BASE_URL}/calendars/${calendarId}`, {
    method: "GET",
    headers: {
      "Authorization": `Bearer ${connection.access_token}`,
      "Version": "2021-04-15",
      "Accept": "application/json"
    }
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(`Failed to fetch calendar ${calendarId} from GHL: ${response.status} ${response.statusText}`);
  }

  const data = await response.json();
  return data.calendar;
}

export async function getAllContacts(userId: string): Promise<GHLContact[]> {
  const connection = await getGHLConnection(userId);

  const contactsUrl = `${GHL_BASE_URL}/contacts/?locationId=${connection.location_id}`;
  const response = await fetch(contactsUrl, {
    method: "GET",
    headers: {
      Authorization: `Bearer ${connection.access_token}`,
      Accept: "application/json",
      Version: "2021-07-28",
    },
  });

  if (!response.ok) {
    const errorData = await response.text();
    throw new Error(`Failed to fetch contacts from GHL: ${response.status} ${response.statusText}`);
  }

  const data = await response.json();
  const contacts = data.contacts || [];

  // console.log(`Fetched ${contacts.length} contacts from GHL:`, contacts.map(contact => ({
  //   id: contact.id,
  //   name: contact.contactName || contact.firstName || contact.lastName || 'No name',
  //   phone: contact.phone,
  //   email: contact.email
  // })));

  return contacts;
}

export async function getAllEvents(
  userId: string,
  options?: {
    locationId?: string;
    calendarId?: string;
    userId?: string;
    groupId?: string;
    startDate?: string;
    endDate?: string;
  }
): Promise<GHLEvent[]> {
  const connection = await getGHLConnection(userId);

  let startTime, endTime;
  if (options?.startDate && options?.endDate) {
    startTime = new Date(options.startDate).getTime().toString();
    endTime = new Date(options.endDate).getTime().toString();
  } else {
    startTime = "1262304000000"; // Jan 1, 2010
    endTime = "4102444800000"; // Jan 1, 2100
  }

  const params = new URLSearchParams();
  const locationId = options?.locationId || connection.location_id;
  params.append("locationId", locationId);
  params.append("startTime", startTime);
  params.append("endTime", endTime);

  if (options?.calendarId) {
    params.append("calendarId", options.calendarId);
  } else if (options?.userId) {
    params.append("userId", options.userId);
  } else if (options?.groupId) {
    params.append("groupId", options.groupId);
  }

  const response = await fetch(
    `${GHL_BASE_URL}/calendars/events?${params.toString()}`,
    {
      method: "GET",
      headers: {
        "Authorization": `Bearer ${connection.access_token}`,
        "Version": "2021-04-15",
        "Accept": "application/json"
      }
    }
  );

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(`Failed to fetch events from GHL: ${response.status} ${response.statusText}`);
  }

  const data = await response.json();
  const events = (data.events || []).map((event: any) => ({
    ...event,
    start: new Date(event.startTime),
    end: new Date(event.endTime || event.startTime),
    title: event.title || 'Untitled'
  }));

  return events;
}


export async function getAllUsersByLocationId(
  userId: string,
  locationId?: string
): Promise<GHLUser[]> {
  const connection = await getGHLConnection(userId);
  const targetLocationId = locationId || connection.location_id;

  if (!targetLocationId) {
    throw new Error("Location ID not available");
  }

  const response = await fetch(
    `${GHL_BASE_URL}/users/?locationId=${targetLocationId}`,
    {
      method: "GET",
      headers: {
        "Authorization": `Bearer ${connection.access_token}`,
        "Version": "2021-07-28",
        "Content-Type": "application/json",
      },
    }
  );

  if (!response.ok) {
    const errorText = await response.text();
    if (response.status === 401) {
      throw new Error("GHL access token expired. Please reconnect your account.");
    }
    throw new Error(`Failed to fetch users from GHL: ${response.status} ${response.statusText}`);
  }

  const data = await response.json();
  return data.users || [];
}

export async function getLocationById(
  userId: string,
  locationId?: string
): Promise<any> {
  const connection = await getGHLConnection(userId);
  const targetLocationId = locationId || connection.location_id;

  if (!targetLocationId) {
    throw new Error("Location ID not available");
  }

  const response = await fetch(
    `${GHL_BASE_URL}/locations/${targetLocationId}`,
    {
      method: "GET",
      headers: {
        "Authorization": `Bearer ${connection.access_token}`,
        "Version": "2021-07-28",
        "Accept": "application/json",
      },
    }
  );

  if (!response.ok) {
    const errorText = await response.text();

    if (response.status === 401) {
      throw new Error("GHL access token expired or insufficient permissions. Please reconnect your GoHighLevel account.");
    }
    throw new Error(`Failed to fetch location from GHL: ${response.status} ${response.statusText}`);
  }

  const data = await response.json();
  return data.location;
}

export async function createEvent(
  userId: string,
  payload: CreateEventPayload
): Promise<GHLEvent> {
  const connection = await getGHLConnection(userId);

  const appointmentPayload: any = {
    title: payload.title || "GHL Appointment",
    calendarId: payload.calendarId,
    locationId: payload.locationId || connection.location_id,
    contactId: payload.contactId,
    startTime: payload.startTime,
    appointmentStatus: payload.appointmentStatus || "confirmed",
    assignedUserId: payload.assignedUserId,
    meetingLocationType: payload.meetingLocationType || "custom",
    meetingLocationId: payload.meetingLocationId || "default",
    overrideLocationConfig: payload.overrideLocationConfig || false,
    address: payload.address,
    ignoreDateRange: payload.ignoreDateRange || false,
    toNotify: payload.toNotify !== false,
    ignoreFreeSlotValidation: payload.ignoreFreeSlotValidation || false,
    rrule: payload.rrule,
  };

  if (payload.endTime) {
    appointmentPayload.endTime = payload.endTime;
  }

  if (!appointmentPayload.calendarId) {
    throw new Error("Calendar ID is required");
  }
  if (!appointmentPayload.contactId) {
    throw new Error("Contact ID is required");
  }
  if (!appointmentPayload.startTime) {
    throw new Error("Start time is required");
  }

  const response = await fetch(
    `${GHL_BASE_URL}/calendars/events/appointments`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${connection.access_token}`,
        Version: "2021-04-15",
        "Content-Type": "application/json",
      },
      body: JSON.stringify(appointmentPayload),
    }
  );

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));

    // Extract specific error message from GHL API response
    let errorMessage = `Failed to create event in GHL: ${response.status} ${response.statusText}`;
    if (errorData.message) {
      errorMessage = errorData.message;
    }

    throw new Error(errorMessage);
  }

  const data = await response.json();
  return data;
}

export async function updateEvent(
  userId: string,
  eventId: string,
  payload: UpdateEventPayload
): Promise<GHLEvent> {
  const connection = await getGHLConnection(userId);

  const updatePayload: any = {};

  if (payload.title !== undefined) updatePayload.title = payload.title;
  if (payload.startTime !== undefined) updatePayload.startTime = payload.startTime;
  if (payload.endTime !== undefined) updatePayload.endTime = payload.endTime;
  if (payload.appointmentStatus !== undefined) updatePayload.appointmentStatus = payload.appointmentStatus;
  if (payload.address !== undefined) updatePayload.address = payload.address;
  if (payload.notes !== undefined) updatePayload.notes = payload.notes;
  if (payload.meetingLocationType !== undefined) updatePayload.meetingLocationType = payload.meetingLocationType;
  if (payload.meetingLocationId !== undefined) updatePayload.meetingLocationId = payload.meetingLocationId;
  if (payload.overrideLocationConfig !== undefined) updatePayload.overrideLocationConfig = payload.overrideLocationConfig;
  if (payload.assignedUserId !== undefined) updatePayload.assignedUserId = payload.assignedUserId;
  if (payload.calendarId !== undefined) updatePayload.calendarId = payload.calendarId;
  if (payload.ignoreDateRange !== undefined) updatePayload.ignoreDateRange = payload.ignoreDateRange;
  if (payload.toNotify !== undefined) updatePayload.toNotify = payload.toNotify;
  if (payload.ignoreFreeSlotValidation !== undefined) updatePayload.ignoreFreeSlotValidation = payload.ignoreFreeSlotValidation;
  if (payload.rrule !== undefined) updatePayload.rrule = payload.rrule;

  const response = await fetch(
    `${GHL_BASE_URL}/calendars/events/appointments/${eventId}`,
    {
      method: "PUT",
      headers: {
        Authorization: `Bearer ${connection.access_token}`,
        Version: "2021-04-15",
        "Content-Type": "application/json",
      },
      body: JSON.stringify(updatePayload),
    }
  );

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(`Failed to update event in GHL: ${response.status} ${response.statusText}`);
  }

  const data = await response.json();
  return data;
}

export async function deleteEvent(
  userId: string,
  eventId: string
): Promise<{ success: boolean; message: string }> {
  const connection = await getGHLConnection(userId);

  const response = await fetch(
    `${GHL_BASE_URL}/calendars/events/${eventId}`,
    {
      method: "DELETE",
      headers: {
        Authorization: `Bearer ${connection.access_token}`,
        Version: "2021-04-15",
      },
    }
  );

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(`Failed to delete event in GHL: ${response.status} ${response.statusText}`);
  }

  return {
    success: true,
    message: "Event deleted successfully",
  };
}