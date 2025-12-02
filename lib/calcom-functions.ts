import { createClient } from "@supabase/supabase-js";
import { CalComBooking, CalComEventType } from "@/lib/types";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "";
const supabase = createClient(supabaseUrl, supabaseKey);

const CALCOM_API_URL = "https://api.cal.com/v2";

interface CalcomAvailability {
  available: boolean;
  conflictingBookings: CalComBooking[];
}

interface CalcomAppointmentTypeDetails {
  eventTypeId: number;
  duration: number;
  name: string;
}

interface CalcomAttendee {
  name: string;
  email: string;
  timeZone: string;
}

interface CreateBookingPayload {
  eventTypeId: number;
  start: string;
  timeZone?: string;
  language?: string;
  metadata?: object;
  attendee: CalcomAttendee;
  bookingFieldsResponses?: {
    notes?: string;
  };
}

export async function createCalComBooking(
  payload: CreateBookingPayload,
  apiKey: string
) {
  if (!payload.eventTypeId || !payload.start || !payload.attendee) {
    throw new Error("Missing required fields in booking payload");
  }

  const eventTypeId = parseInt(payload.eventTypeId as any, 10);
  const v2Payload = {
    eventTypeId: eventTypeId,
    start: payload.start,
    attendee: {
      name: payload.attendee.name,
      email: payload.attendee.email,
      timeZone:
        payload.attendee.timeZone ||
        payload.timeZone ||
        Intl.DateTimeFormat().resolvedOptions().timeZone,
      language: payload.language || "en",
    },
  };

  console.log("--------v2 payload being sent--------", v2Payload);

  try {
    const response = await fetch(`${CALCOM_API_URL}/bookings`, {
      method: "POST",
      headers: {
        "cal-api-version": "2024-08-13",
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify(v2Payload),
    });

    const responseData = await response.json();
    if (!response.ok) {
      console.error("Cal.com API error creating booking:", responseData);
      console.error("Request payload that failed:", v2Payload);
      throw new Error(
        responseData.message || `Failed ${responseData?.error?.message}`
      );
    }

    return responseData.data || responseData;
  } catch (error) {
    console.error("Error in createCalComBooking:", error);
    console.error("Failed payload:", v2Payload);
    throw error;
  }
}

export async function cancelCalComBooking(
  bookingUid: string,
  apiKey: string,
  cancellationReason: string = "User requested cancellation"
) {
  if (!bookingUid) {
    throw new Error("Booking UID is required for cancellation");
  }

  const cancelPayload = {
    cancellationReason: cancellationReason,
  };

  console.log("---- cancel payload being sent ----", cancelPayload);

  try {
    const response = await fetch(
      `${CALCOM_API_URL}/bookings/${bookingUid}/cancel`,
      {
        method: "POST",
        headers: {
          "cal-api-version": "2024-08-13",
          "Content-Type": "application/json",
          Authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify(cancelPayload),
      }
    );

    const responseData = await response.json();
    console.log("-----cancel response data -----", responseData);

    if (!response.ok) {
      console.error("Cal.com API error cancelling booking:", responseData);
      throw new Error(
        responseData.message ||
          `Failed to cancel Cal.com booking: ${response.status} ${response.statusText}`
      );
    }

    return responseData;
  } catch (error) {
    console.error("Error in cancelCalComBooking:", error);
    throw error;
  }
}

export async function getCalComAppointmentDetails(
  appointmentToolId: string,
  appointmentTypeIdentifier: string
): Promise<CalcomAppointmentTypeDetails> {
  if (!appointmentToolId || !appointmentTypeIdentifier) {
    throw new Error(
      "Appointment tool ID and appointment type identifier are required."
    );
  }

  const { data, error } = await supabase
    .from("appointment_tools")
    .select("appointment_types")
    .eq("id", appointmentToolId)
    .single();

  if (error || !data) {
    console.error("Error fetching appointment tool for Cal.com:", error);
    throw new Error(`Appointment tool with ID ${appointmentToolId} not found.`);
  }

  let appointmentTypes: any[];
  try {
    appointmentTypes =
      typeof data.appointment_types === "string"
        ? JSON.parse(data.appointment_types)
        : data.appointment_types;
  } catch (e) {
    console.error("Error parsing appointment_types JSON:", e);
    throw new Error(
      "Failed to parse appointment types from the tool configuration."
    );
  }

  const normalizedIdentifier = appointmentTypeIdentifier.toLowerCase().replace(/\s+/g, "_");
  const appointmentTypeDetails = appointmentTypes.find(
    (type: any) =>
      type.slug?.toLowerCase() === normalizedIdentifier ||
      type.name?.toLowerCase().replace(/\s+/g, "_") === normalizedIdentifier
  );
  console.log("---- appointment type details ----", appointmentTypeDetails);

  if (!appointmentTypeDetails || !appointmentTypeDetails.eventId) {
    console.error(
      `Could not find matching Cal.com event type for identifier "${normalizedIdentifier}" in tool ${appointmentToolId} exsiting tools are ${appointmentTypes.map((type: any) => type.slug).join(", ")}`
    );
    throw new Error(
      `The appointment type "${appointmentTypeIdentifier}" is not configured for this tool.`
    );
  }

  return {
    eventTypeId: appointmentTypeDetails.eventId,
    duration: appointmentTypeDetails.duration,
    name: appointmentTypeDetails.name,
  };
}

export async function rescheduleCalcomBooking(
  bookingUid: string,
  apiKey: string,
  newStart: string,
  rescheduledBy: string = "admin",
  reschedulingReason: string
) {
  if (!bookingUid) {
    throw new Error("Booking UID is required for rescheduling");
  }

  if (!newStart) {
    throw new Error("New start time is required for rescheduling");
  }

  const reschedulePayload = {
    start: newStart,
    rescheduledBy: rescheduledBy,
    reschedulingReason:
      reschedulingReason.length > 0
        ? reschedulingReason
        : "admin requested reschedule",
  };

  console.log("---- reschedule payload being sent ----", reschedulePayload);

  try {
    const response = await fetch(
      `${CALCOM_API_URL}/bookings/${bookingUid}/reschedule`,
      {
        method: "POST",
        headers: {
          "cal-api-version": "2024-08-13",
          "Content-Type": "application/json",
          Authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify(reschedulePayload),
      }
    );

    const responseData = await response.json();
    console.log("-----reschedule response data -----", responseData);

    if (!response.ok) {
      console.error("Cal.com API error rescheduling booking:", responseData);
      throw new Error(
        responseData.message ||
          `Failed to reschedule Cal.com booking: ${response.status} ${response.statusText}`
      );
    }

    return responseData;
  } catch (error) {
    console.error("Error in rescheduleCalcomBooking:", error);
    throw error;
  }
}



export async function getUserInfo(apiKey: String) {
  try {
    const options = {
      method: "GET",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
    };
    // console.log("------ options for user info payload--------", options);
    const response = await fetch(`${CALCOM_API_URL}/me`, options);

    if (!response.ok) {
      throw new Error(`Failed to fetch user info: ${response.status}`);
    }

    const data = await response.json();
    console.log("Cal.com user info:", data);
    return data.data;
  } catch (err: any) {
    const errorMessage = err.message || "Failed to fetch Cal.com user info";
    console.error("Error while fetching user info:", errorMessage);
    throw new Error(errorMessage);
  }
}

export async function getAllBookings(apiKey: String) {
  try {
    const options = {
      method: "GET",
      headers: {
        "Content-Type": "application/json",
        "cal-api-version": "2024-08-13",
        Authorization: `Bearer ${apiKey}`,
      },
    };

    // console.log("------ options for bookings payload--------", options);

    const response = await fetch(`${CALCOM_API_URL}/bookings`, options);

    if (!response.ok)
      throw new Error(`Failed to fetch bookings: ${response.status}`);
    const data = await response.json();
    console.log("the bookings data", data);
    const transformedBookings: CalComBooking[] = data.data.map(
      (booking: any) => ({
        id: booking.id,
        title: booking.title || "Untitled Booking",
        description: booking.description || "",
        startTime: new Date(booking.start),
        endTime: new Date(booking.end),
        attendees: booking.attendees || [],
        status: booking.status,
        location: booking.location || "",
        uid: booking.uid,
        organizer: booking.hosts?.[0] || { email: "", name: "" },
        createdAt: new Date(booking.createdAt),
        updatedAt: new Date(booking.updatedAt),
      })
    );
    // console.log(
    //   "transformedBookings from teh calcom functions",
    //   transformedBookings
    // );
    return transformedBookings;
  } catch (err: any) {
    const errorMessage = err.message || "Failed to fetch Cal.com bookings";
    console.error("Error while fetching bookings:", errorMessage);
    throw new Error(errorMessage);
  }
}

export async function getAllEvents(apiKey: String, username: String) {
  try {
    const options = {
      method: "GET",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "cal-api-version": "2024-06-14",
        "Content-Type": "application/json",
      },
    };

    const response = await fetch(
      `${CALCOM_API_URL}/event-types?username=${username}`,
      options
    );
    if (!response.ok) {
      throw new Error(`Failed to fetch event types: ${response.status}`);
    }

    const data = await response.json();
    console.log("Cal.com event types:", data);

    if (data.status === 'success' && data.data) {
      const eventTypes: CalComEventType[] = data.data.map((event: any) => ({
        id: event.id,
        eventId: event.id, // same as id for consistency
        ownerId: event.ownerId,
        lengthInMinutes: event.lengthInMinutes,
        title: event.title,
        slug: event.slug,
        description: event.description || '',
        locations: event.locations || [],
        bookingFields: event.bookingFields || [],
        users: event.users || [],
      }));
      return eventTypes;
    }
    throw new Error("Failed to fetch event types");
    return [];
  } catch (err: any) {
    const errorMessage = err.message || "Failed to fetch Cal.com events";
    console.error("Error while fetching events:", errorMessage);
    throw new Error(errorMessage);
  }
}




export async function getMyProfile(apiKey: string) {
  try {
    const response = await fetch(`${CALCOM_API_URL}/me`, {
      headers: {
        "cal-api-version": "2024-08-13",
        "Authorization": `Bearer ${apiKey}`,
      },
    });

    const responseData = await response.json();
    
    if (!response.ok) {
      console.error("Cal.com API error getting profile:", responseData);
      throw new Error(
        responseData.message || `Failed to get Cal.com profile: ${response.status} ${response.statusText}`
      );
    }

    return responseData.data || responseData;
  } catch (error) {
    console.error("Error in getMyProfile:", error);
    throw error;
  }
}