import { env } from './env/getEnvVars';

const GOOGLE_CALENDAR_API = "https://www.googleapis.com/calendar/v3";

export async function getAccessToken(refreshToken: string) {
  try {
    console.log("🔄 Refreshing access token...");
    
    if (!refreshToken) {
      throw new Error("No refresh token provided");
    }
    
    console.log(`🔑 Using refresh token starting with: ${refreshToken.substring(0, 5)}...`);
    
    if (!env.GOOGLE_CLIENT_ID || !env.GOOGLE_CLIENT_SECRET) {
      console.error("❌ Missing Google OAuth credentials in environment variables");
      throw new Error("Server configuration error: Missing OAuth credentials");
    }
    
    const response = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: new URLSearchParams({
        client_id: env.GOOGLE_CLIENT_ID!,
        client_secret: env.GOOGLE_CLIENT_SECRET!,
        refresh_token: refreshToken,
        grant_type: "refresh_token",
      }),
    });

    if (!response.ok) {
      const errorData = await response.json();
      console.error("❌ Token refresh error response:", errorData);
      console.error(`❌ Status: ${response.status} ${response.statusText}`);
      throw new Error(`Failed to refresh token: ${errorData.error_description || errorData.error || response.statusText}`);
    }

    const data = await response.json();
    
    if (!data.access_token) {
      console.error("❌ OAuth response did not include an access token:", data);
      throw new Error("Invalid OAuth response: No access token returned");
    }
    
    console.log(`✅ Token refreshed successfully. New token starts with: ${data.access_token.substring(0, 8)}...`);
    console.log(`ℹ️ Token expires in: ${data.expires_in || 'unknown'} seconds`);
    
    return data.access_token;
  } catch (error) {
    console.error("❌ Failed to refresh access token:", error);
    throw error;
  }
}

export async function listEvents(accessToken: string, pageToken?: string) {
  try {
    const timeMin = new Date();
    timeMin.setMonth(timeMin.getMonth() - 1); // Get events from 1 month ago
    
    const params = new URLSearchParams({
      timeMin: timeMin.toISOString(),
      maxResults: '100',
      singleEvents: 'true',
      orderBy: 'startTime'
    });

    if (pageToken) {
      params.append('pageToken', pageToken);
    }

    const response = await fetch(
      `${GOOGLE_CALENDAR_API}/calendars/primary/events?${params.toString()}`,
      {
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
      }
    );

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error?.message || 'Failed to fetch calendar events');
    }

    const data = await response.json();
    
    // If there are more pages, fetch them recursively
    if (data.nextPageToken) {
      const nextPageData = await listEvents(accessToken, data.nextPageToken);
      data.items = [...data.items, ...nextPageData.items];
    }

    return data;
  } catch (error) {
    console.error("Error fetching calendar events:", error);
    throw error;
  }
}

export async function createEvent(accessToken: string, eventData: any) {
  const response = await fetch(
    `${GOOGLE_CALENDAR_API}/calendars/primary/events?sendUpdates=all`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(eventData),
    }
  );

  return response.json();
}

export async function deleteEvent(accessToken: string, eventId: string) {
  const response = await fetch(
    `${GOOGLE_CALENDAR_API}/calendars/primary/events/${eventId}?sendUpdates=all`,
    {
      method: "DELETE",
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    }
  );

  return response.status === 204;
}

export async function getEvent(accessToken: string, eventId: string) {
  const response = await fetch(
    `${GOOGLE_CALENDAR_API}/calendars/primary/events/${eventId}`,
    {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    }
  );

  return response.json();
}

interface CalendarEvent {
  summary: string;
  description: string;
  start: {
    dateTime: string;
    timeZone: string;
  };
  end: {
    dateTime: string;
    timeZone: string;
  };
  attendees: { email: string }[];
  reminders?: {
    useDefault: boolean;
  };
  metadata?: {
    status: string;
  };
}

export async function createCalendarEvent(event: CalendarEvent, accessToken: string) {
  try {
    console.log("Creating calendar event with data:", JSON.stringify(event, null, 2));
    console.log("Using access token:", accessToken.substring(0, 10) + "...");

    const response = await fetch(
      "https://www.googleapis.com/calendar/v3/calendars/primary/events",
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(event),
      }
    );

    const responseData = await response.json();
    console.log("Calendar API Response:", JSON.stringify(responseData, null, 2));

    if (!response.ok) {
      console.error("Calendar API Error Response:", responseData);
      throw new Error(responseData.error?.message || 'Failed to create calendar event');
    }

    return responseData;
  } catch (error) {
    console.error("Error creating calendar event:", error);
    throw error;
  }
}

/**
 * Check if a time slot is available in the calendar
 * @param startTime ISO string for the start time
 * @param endTime ISO string for the end time
 * @param accessToken Google Calendar access token
 * @returns Object with availability status and conflicting events if any
 */
export async function checkSlotAvailability(startTime: string, endTime: string, accessToken: string) {
  try {
    console.log(`=== AVAILABILITY CHECK ===`);
    console.log(`Checking availability for slot: ${startTime} to ${endTime}`);
    
    // Log token information for debugging
    if (!accessToken) {
      console.error("❌ ACCESS TOKEN MISSING - No token provided to checkSlotAvailability");
      throw new Error("No access token provided");
    }
    
    console.log(`🔑 Token format check: ${accessToken.length} chars, starts with: ${accessToken.substring(0, 10)}...`);
    
    // Check if token looks like a JWT (typical OAuth2 format)
    const hasJwtFormat = accessToken.split('.').length === 3;
    console.log(`🔑 Token has JWT format: ${hasJwtFormat ? 'Yes' : 'No'}`);
    
    // Ensure we're working with valid ISO strings
    const startTimeUTC = new Date(startTime).toISOString();
    const endTimeUTC = new Date(endTime).toISOString();
    
    console.log(`Normalized UTC start time: ${startTimeUTC}`);
    console.log(`Normalized UTC end time: ${endTimeUTC}`);
    
    // Build the query parameters - use normalized UTC times
    const params = new URLSearchParams({
      timeMin: startTimeUTC,
      timeMax: endTimeUTC,
      singleEvents: 'true',
      maxResults: '10'
    });
    
    // Query Google Calendar API for events in this time range
    console.log(`🔍 Sending request to Google Calendar API with Authorization: Bearer ${accessToken.substring(0, 5)}...${accessToken.substring(accessToken.length - 5)}`);
    
    const response = await fetch(
      `${GOOGLE_CALENDAR_API}/calendars/primary/events?${params.toString()}`,
      {
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
      }
    );
    
    if (!response.ok) {
      const error = await response.json();
      console.error(`❌ Google Calendar API Error:`, error);
      console.error(`❌ Response status: ${response.status} ${response.statusText}`);
      
      // Check if error is related to token expiration
      if (response.status === 401 || (error.error && (
          error.error.message?.includes('invalid_token') || 
          error.error.message?.includes('expired') ||
          error.error.message?.includes('Invalid Credentials')))) {
        throw new Error("Access token expired or invalid - token refresh required");
      }
      
      throw new Error(error.error?.message || 'Failed to check calendar availability');
    }
    
    const data = await response.json();
    const events = data.items || [];
    
    console.log(`Found ${events.length} events in the requested time range`);
    
    // Log all events for debugging
    if (events.length > 0) {
      console.log(`=== ALL EVENTS IN TIME RANGE ===`);
      events.forEach((event: any, index: number) => {
        // console.log('event', event);
        console.log(`Event #${index + 1}:`);
        console.log(`- Summary: ${event.summary || 'Unnamed event'}`);
        console.log(`- Description: ${event.description ? event.description.substring(0, 100) + '...' : 'No description'}`);
        console.log(`- Start: ${event.start?.dateTime || event.start?.date || 'Unknown'}`);
        console.log(`- End: ${event.end?.dateTime || event.end?.date || 'Unknown'}`);
        console.log(`- Status: ${event.status || 'Unknown'}`);
        console.log(`- Created: ${event.created || 'Unknown'}`);
        console.log(`- Updated: ${event.updated || 'Unknown'}`);
        console.log(`- Organizer: ${event.organizer?.email || 'Unknown'}`);
        console.log(`- Self: ${event.organizer?.self ? 'Yes' : 'No'}`);
        console.log(`- Creator: ${event.creator?.email || 'Unknown'}`);
        console.log(`- iCalUID: ${event.iCalUID || 'Unknown'}`);
        console.log(`- Attendees: ${(event.attendees && event.attendees.length) ? event.attendees.length : 'None'}`);
        console.log(`------`);
      });
    }
    
    // Check if there are any events that overlap with our time slot
    const conflictingEvents = events.filter((event: any) => {
      // Skip events that don't have start/end times
      if (!event.start?.dateTime || !event.end?.dateTime) {
        console.log(`Skipping event without dateTime: ${event.summary || 'Unnamed event'}`);
        return false;
      }
      
      // Convert event times to UTC ISO strings for consistent comparison
      const eventStartUTC = new Date(event.start.dateTime).toISOString();
      const eventEndUTC = new Date(event.end.dateTime).toISOString();
      
      // An event conflicts if it starts before our slot ends AND ends after our slot starts
      const isConflicting = eventStartUTC < endTimeUTC && eventEndUTC > startTimeUTC;
      
      if (isConflicting) {
        console.log(`=== CONFLICT DETECTED ===`);
        console.log(`Event: ${event.summary || 'Unnamed event'}`);
        console.log(`Description: ${event.description ? event.description.substring(0, 100) + '...' : 'No description'}`);
        console.log(`Event time (UTC): ${eventStartUTC} to ${eventEndUTC}`);
        console.log(`Requested slot (UTC): ${startTimeUTC} to ${endTimeUTC}`);
        console.log(`Status: ${event.status || 'Unknown'}`);
        console.log(`Organizer: ${event.organizer?.email || 'Unknown'}`);
        console.log(`Created: ${new Date(event.created).toLocaleString() || 'Unknown'}`);
        
        // Calculate overlap duration
        const overlapStart = new Date(Math.max(new Date(startTimeUTC).getTime(), new Date(eventStartUTC).getTime()));
        const overlapEnd = new Date(Math.min(new Date(endTimeUTC).getTime(), new Date(eventEndUTC).getTime()));
        const overlapDuration = Math.round((overlapEnd.getTime() - overlapStart.getTime()) / 60000); // in minutes
        
        console.log(`Overlap duration: ${overlapDuration} minutes`);
        console.log(`Overlap period: ${overlapStart.toISOString()} to ${overlapEnd.toISOString()}`);
      }
      
      return isConflicting;
    });
    
    const isAvailable = conflictingEvents.length === 0;
    console.log(`=== AVAILABILITY RESULT ===`);
    console.log(`Slot availability: ${isAvailable ? 'AVAILABLE ✅' : 'NOT AVAILABLE ❌'}`);
    console.log(`Found ${conflictingEvents.length} conflicting events`);
    
    if (!isAvailable) {
      // Summarize conflicting events
      console.log(`=== CONFLICT SUMMARY ===`);
      conflictingEvents.forEach((event: any, index: number) => {
        const eventStartUTC = new Date(event.start.dateTime).toISOString();
        const eventEndUTC = new Date(event.end.dateTime).toISOString();
        console.log(`Conflict #${index + 1}: "${event.summary || 'Unnamed event'}"`);
        console.log(`- Time: ${eventStartUTC} to ${eventEndUTC} (UTC)`);
        console.log(`- Duration: ${Math.round((new Date(eventEndUTC).getTime() - new Date(eventStartUTC).getTime()) / 60000)} minutes`);
        console.log(`- Status: ${event.status || 'Unknown'}`);
      });
    }
    
    return {
      available: isAvailable,
      conflictingEvents: conflictingEvents.map((event: any) => ({
        id: event.id,
        summary: event.summary || 'Unnamed event',
        description: event.description ? event.description.substring(0, 150) + (event.description.length > 150 ? '...' : '') : 'No description',
        start: new Date(event.start.dateTime).toISOString(),
        end: new Date(event.end.dateTime).toISOString(),
        originalStart: event.start.dateTime,
        originalEnd: event.end.dateTime,
        status: event.status || 'Unknown',
        organizer: event.organizer?.email || 'Unknown',
        created: event.created || 'Unknown',
        updated: event.updated || 'Unknown',
        attendees: event.attendees || [],
        overlapInfo: {
          start: new Date(Math.max(new Date(startTimeUTC).getTime(), new Date(event.start.dateTime).getTime())).toISOString(),
          end: new Date(Math.min(new Date(endTimeUTC).getTime(), new Date(event.end.dateTime).getTime())).toISOString(),
          durationMinutes: Math.round(
            (Math.min(new Date(endTimeUTC).getTime(), new Date(event.end.dateTime).getTime()) - 
             Math.max(new Date(startTimeUTC).getTime(), new Date(event.start.dateTime).getTime())) / 60000
          )
        }
      }))
    };
  } catch (error) {
    console.error("Error checking slot availability:", error);
    throw error;
  }
}
