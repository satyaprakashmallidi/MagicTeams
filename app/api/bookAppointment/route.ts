import { createCalendarEvent, checkSlotAvailability, getAccessToken } from '@/lib/edge-calendar';
import { NextResponse , NextRequest } from 'next/server';
import { convertTimezone, normalizeTimezone } from '@/lib/utils/timezone';
import { createClient } from '@supabase/supabase-js';

export const runtime = 'edge';

// Initialize Supabase client
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';
const supabase = createClient(supabaseUrl, supabaseKey);

// Helper function to get appointment duration from appointment type
async function getAppointmentDuration(calendarId: string, appointmentType: string): Promise<number | null> {
  try {
    if (!calendarId || !appointmentType) return null;
    
    // Fetch the appointment tool data
    const { data, error } = await supabase
      .from('appointment_tools')
      .select('appointment_types')
      .eq('calendar_account_id', calendarId)
      .single();
    
    if (error || !data) {
      console.error('Error fetching appointment tool:', error);
      return null;
    }
    
    // Parse appointment types
    let appointmentTypes;
    try {
      if (typeof data.appointment_types === 'string') {
        appointmentTypes = JSON.parse(data.appointment_types);
      } else {
        appointmentTypes = data.appointment_types;
      }
      
      // Normalize the appointment type ID format
      const normalizedRequestedType = appointmentType.toLowerCase().replace(/\s+/g, '_');
      
      // Find the matching appointment type
      const matchingType = appointmentTypes.find(
        (type: any) => type.name.toLowerCase().replace(/\s+/g, '_') === normalizedRequestedType
      );
      
      if (matchingType) {
        console.log(`Found matching appointment type: ${matchingType.name} with duration: ${matchingType.duration} minutes`);
        return matchingType.duration;
      }
    } catch (error) {
      console.error('Error parsing appointment types:', error);
    }
    
    return null;
  } catch (error) {
    console.error('Error in getAppointmentDuration:', error);
    return null;
  }
}

export async function POST(request: NextRequest) {
    try {
      console.log('================> 🔍 API CALLED: POST /api/bookAppointment');
      console.log('================> 📝 Request URL:', request.url);
      
      // Get tokens from query parameters
      const searchParams = request.nextUrl.searchParams;
      const accessToken = searchParams.get("access_token");
      const refreshToken = searchParams.get("refresh_token");

      console.log('POST /api/bookAppointment', { 
        accessToken: accessToken ? `${accessToken.substring(0, 8)}...` : 'missing', 
        refreshToken: refreshToken ? 'provided' : 'missing' 
      });
  
      if (!accessToken || !refreshToken) {
        return NextResponse.json(
          { error: "Calendar tokens not provided" },
          { status: 401 }
        );
      }

      // Initialize token variables with original values
      let currentAccessToken = accessToken;
      let tokenRefreshed = false;
  
      const body = await request.json();
      const { appointmentDetails: details } = body;

      console.log("POST /api/bookAppointment body", body);
  
      if (!details) {
        return NextResponse.json(
          { error: "Appointment details not provided" },
          { status: 400 }
        );
      }
  
      // Handle relative dates
      let preferredDate = details.preferredDate;
      if (preferredDate.toLowerCase() === 'tomorrow') {
        const tomorrow = new Date();
        tomorrow.setDate(tomorrow.getDate() + 1);
        preferredDate = tomorrow.toISOString().split('T')[0];
      }
  
      // Convert 12-hour time to 24-hour time
      let preferredTime = details.preferredTime;
      if (preferredTime && preferredTime.includes(' ')) {
        const [time, period] = preferredTime.split(' ');
        const [hours, minutes] = time.split(':').map(Number);
        
        let hour24 = hours;
        if (period === 'PM' && hours !== 12) {
          hour24 = hours + 12;
        } else if (period === 'AM' && hours === 12) {
          hour24 = 0;
        }
  
        preferredTime = `${hour24.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}`;
      }

      // Get and validate user timezone 
      const userTimezone = details.timezone || 'UTC';
      console.log(`Raw user timezone provided: ${userTimezone}`);
      
      // Normalize the timezone to check if it's valid
      const normalizedTimezone = normalizeTimezone(userTimezone);
      if (normalizedTimezone === 'Etc/UTC' && userTimezone.toUpperCase() !== 'UTC') {
        console.warn(`Could not normalize timezone: ${userTimezone}, defaulted to UTC. This might indicate a timezone handling error.`);
      }
      
      console.log(`Normalized user timezone: ${normalizedTimezone}`);
      
      // Store the original user time for reference
      const originalUserTime = {
        date: preferredDate,
        time: preferredTime,
        timezone: userTimezone
      };
      
      // Convert to UTC for storage
      try {
        const { date: utcDate, time: utcTime } = convertTimezone(
          preferredDate,
          preferredTime,
          userTimezone,
          'UTC'
        );
        
        console.log(`Converted time from ${userTimezone} to UTC: ${preferredDate} ${preferredTime} -> ${utcDate} ${utcTime}`);
        
        // Update to UTC time
        preferredDate = utcDate;
        preferredTime = utcTime;
        
        // Log the final UTC time that will be used
        console.log(`Final UTC time for calendar entry: ${preferredDate}T${preferredTime}`);
      } catch (error) {
        console.error('Error converting timezone:', error);
        return NextResponse.json(
          { error: `Failed to process timezone: ${userTimezone}. Please try again with a standard timezone format.` },
          { status: 400 }
        );
      }
  
      // Convert the date and time to a DateTime object
      // IMPORTANT: Use UTC constructor to avoid timezone offset issues
      const [year, month, day] = preferredDate.split('-').map(Number);
      const [hour, minute] = preferredTime.split(':').map(Number);
      
      // Create date objects using UTC methods to ensure no timezone offsets
      const startDateTime = new Date(Date.UTC(year, month - 1, day, hour, minute));
      console.log(`Created UTC startDateTime: ${startDateTime.toISOString()}`);
      
      const endDateTime = new Date(startDateTime.getTime()); // Clone the start time
  
      console.log('Current server time:', new Date().toISOString());
      console.log('Appointment startDateTime:', startDateTime.toISOString());
  
      // Validate the date is not in the past
      if (startDateTime < new Date()) {
        return NextResponse.json(
          { error: "Cannot book appointments in the past" },
          { status: 400 }
        );
      }
  
      // Get appointment duration from the appointmentDetails or use default
      let duration = 60; // Default duration
      
      // Get the appointment type from the request
      const appointmentType = details.appointmentType?.toLowerCase();
      console.log(`Appointment type requested: "${appointmentType}"`);
      
      // Extract the calendar ID from the URL, assuming it's passed as a search param
      const calendarId = searchParams.get("calendar_id");
      
      // Set duration based on appointment type
      if (details.appointmentDuration) {
        // If the duration is explicitly provided in the request
        duration = parseInt(details.appointmentDuration);
        console.log(`Using explicitly provided duration: ${duration} minutes`);
      } else {
        // Try to get the duration from the appointment tool configuration
        if (calendarId) {
          const configuredDuration = await getAppointmentDuration(calendarId, appointmentType);
          if (configuredDuration) {
            duration = configuredDuration;
            console.log(`Using configured duration from appointment tool: ${duration} minutes`);
          } else {
            // Fallback to defaults
            const durationMap: Record<string, number> = {
              consultation: 60,
              follow_up: 30,
              general: 45,
              urgent: 30,
            };
            
            duration = durationMap[appointmentType as keyof typeof durationMap] || 60;
            console.log(`Using default duration (${duration} minutes) for appointment type: ${appointmentType}`);
          }
        } else {
          // No calendar ID provided, fall back to defaults
          console.warn("No calendar_id provided, using default duration map");
          const durationMap: Record<string, number> = {
            consultation: 60,
            follow_up: 30,
            general: 45,
            urgent: 30,
          };
          
          duration = durationMap[appointmentType as keyof typeof durationMap] || 60;
          console.log(`Using default duration (${duration} minutes) for appointment type: ${appointmentType}`);
        }
      }
      
      endDateTime.setMinutes(endDateTime.getMinutes() + duration);

      // Create event object
      let eventStartISOString = startDateTime.toISOString();
      let eventEndISOString = endDateTime.toISOString();
      
      console.log(`Using these ISO strings for the calendar event:`);
      console.log(`- Start: ${eventStartISOString}`);
      console.log(`- End: ${eventEndISOString}`);
      
      // Validate that the times are properly formatted ISO strings in UTC
      console.log("Validating ISO strings...");
      try {
        const validStart = new Date(eventStartISOString).toISOString();
        const validEnd = new Date(eventEndISOString).toISOString();
        
        // Verify they match what we expect
        if (validStart !== eventStartISOString || validEnd !== eventEndISOString) {
          console.warn("ISO string validation found inconsistencies, correcting:");
          console.log(`- Original start: ${eventStartISOString} -> Corrected: ${validStart}`);
          console.log(`- Original end: ${eventEndISOString} -> Corrected: ${validEnd}`);
          
          // Update to the validated strings
          eventStartISOString = validStart;
          eventEndISOString = validEnd;
        } else {
          console.log("ISO strings are valid and in proper UTC format");
        }
      } catch (error) {
        console.error("Error validating ISO strings:", error);
        return NextResponse.json(
          { error: "Invalid date/time format provided" },
          { status: 400 }
        );
      }
      
      // Log detailed information about the appointment we're trying to book
      console.log("=== APPOINTMENT BOOKING DETAILS ===");
      console.log(`Type: ${details.appointmentType}`);
      console.log(`Duration: ${duration} minutes`);
      console.log(`For: ${details.firstName} ${details.lastName} (${details.email})`);
      console.log(`Date/Time: ${originalUserTime.date} ${originalUserTime.time} (${userTimezone})`);
      console.log(`UTC Time: ${preferredDate} ${preferredTime} (UTC)`);
      console.log(`Calendar ID: ${calendarId || 'Not provided'}`);
      if (details.notes) {
        console.log(`Notes: ${details.notes}`);
      }
      
      // Create calendar event details for logging
      const eventSummary = `${details.appointmentType.toUpperCase()} - ${details.firstName} ${details.lastName}`;
      const eventDescription = `Appointment Type: ${details.appointmentType}
Duration: ${duration} minutes
User Timezone: ${userTimezone}
Original Requested Time: ${originalUserTime.date} ${originalUserTime.time} (${userTimezone})
UTC Time: ${preferredDate} ${preferredTime} (UTC)
Notes: ${details.notes || "None"}`;
      
      console.log("=== CALENDAR EVENT DETAILS ===");
      console.log(`Summary: ${eventSummary}`);
      console.log(`Description: ${eventDescription}`);
      console.log(`Start: ${eventStartISOString} (UTC)`);
      console.log(`End: ${eventEndISOString} (UTC)`);
      console.log(`Attendees: ${details.email}`);
      
      // Function to handle token refresh
      const refreshAndRetry = async (operation: string, func: Function, ...args: any[]) => {
        try {
          return await func(...args);
        } catch (error: any) {
          if (error.message?.includes('token expired') || 
              error.message?.includes('token refresh required') || 
              error.message?.includes('invalid authentication credentials')) {
            
            console.log(`🔄 Token appears to be expired or invalid. Attempting refresh for ${operation}...`);
            
            if (!refreshToken) {
              throw new Error("No refresh token available to renew access token");
            }
            
            try {
              // Get a new access token
              currentAccessToken = await getAccessToken(refreshToken);
              tokenRefreshed = true;
              
              console.log(`✅ Successfully refreshed access token. New token starts with: ${currentAccessToken.substring(0, 8)}...`);
              
              // Retry the operation with the new token
              const result = await func(...args.slice(0, -1), currentAccessToken);
              console.log(`✅ Successfully retried ${operation} with new token`);
              return result;
            } catch (refreshError: any) {
              console.error(`❌ Failed to refresh token:`, refreshError);
              throw new Error(`Token refresh failed: ${refreshError.message}`);
            }
          }
          // If error is not token-related, rethrow
          throw error;
        }
      };
      
      // Check if the slot is available with token refresh capability
      console.log("=== STARTING AVAILABILITY CHECK ===");
      let availabilityCheck;
      try {
        availabilityCheck = await refreshAndRetry(
          "availability check",
          checkSlotAvailability,
          eventStartISOString,
          eventEndISOString,
          currentAccessToken
        );
      } catch (error: any) {
        console.error("Error during availability check:", error);
        return NextResponse.json(
          { error: error.message || "Failed to check calendar availability" },
          { status: error.status || 500 }
        );
      }
      
      if (!availabilityCheck.available) {
        console.log("=== AVAILABILITY CHECK RESULT: UNAVAILABLE ❌ ===");
        console.log(`Requested slot (${eventStartISOString} to ${eventEndISOString}) is unavailable due to conflicts`);
        console.log("Conflicting events details:", JSON.stringify(availabilityCheck.conflictingEvents, null, 2));
        
        // Check if any conflict completely blocks the slot or only partially overlaps
        const completeBlockers = availabilityCheck.conflictingEvents.filter(
          (conflict: {overlapInfo: {durationMinutes: number}}) => conflict.overlapInfo.durationMinutes >= duration * 0.8 // Consider 80%+ overlap as a complete blocker
        );
        
        if (completeBlockers.length > 0) {
          console.log(`Found ${completeBlockers.length} events that completely block the requested slot`);
        } else {
          console.log("Requested slot is partially blocked, but no complete blockers found");
        }
        
        return NextResponse.json(
          { 
            error: "The requested time slot is already booked", 
            conflicts: availabilityCheck.conflictingEvents,
            status: "unavailable",
            requestedSlot: {
              start: eventStartISOString,
              end: eventEndISOString,
              duration: `${duration} minutes`
            },
            completelyBlocked: completeBlockers.length > 0
          },
          { status: 409 } // Conflict status code
        );
      }
      
      console.log("=== AVAILABILITY CHECK RESULT: AVAILABLE ✅ ===");
      console.log("Slot is available, proceeding with booking");
      
      const event = {
        summary: eventSummary,
        description: eventDescription,
        start: {
          dateTime: eventStartISOString,
          timeZone: "UTC", // Store in UTC
        },
        end: {
          dateTime: eventEndISOString,
          timeZone: "UTC", // Store in UTC
        },
        attendees: [{ email: details.email }],
        reminders: {
          useDefault: true,
        },
      };
  
      // Create the calendar event using the provided access token with refresh capability
      console.log("Attempting to create calendar event with:", {
        startDateTime: eventStartISOString,
        endDateTime: eventEndISOString,
        duration,
        appointmentType: details.appointmentType,
        userTimezone
      });

      // Log the exact event data being sent to the API
      console.log("Creating calendar event with data:", JSON.stringify(event, null, 2));
      
      // Log the access token being used (partial for security)
      console.log(`Using access token: ${currentAccessToken.substring(0, 8)}...${currentAccessToken.substring(currentAccessToken.length - 5)}`);
      
      let calendarEvent;
      try {
        calendarEvent = await refreshAndRetry(
          "calendar event creation", 
          createCalendarEvent, 
          event, 
          currentAccessToken
        );
      } catch (error: any) {
        console.error("Error creating calendar event:", error);
        return NextResponse.json(
          { error: error.message || "Failed to create calendar event" },
          { status: error.status || 500 }
        );
      }

      console.log("Calendar event created successfully:", calendarEvent);

      if (!calendarEvent.id) {
        throw new Error("Calendar event was created but no event ID was returned");
      }

      return NextResponse.json(
        {
          success: true,
          message: "Appointment booked successfully",
          event: calendarEvent,
          tokenRefreshed
        },
        { status: 200 }
      );
    } catch (error: any) {
      console.error("Error booking appointment:", {
        message: error.message,
        stack: error.stack,
        status: error.status
      });
      const response = NextResponse.json(
        { error: error.message || "Failed to book appointment" },
        { status: error.status || 500 }
      );

      console.log("response", { error: error.message || "Failed to book appointment" },
        { status: error.status || 500 });
      return response;
    }
  }