import { NextResponse, NextRequest } from "next/server";
import {
  convertTimezone,
  getUtcIsoStringFromLocalInput,
  normalizeTimezone,
} from "@/lib/utils/timezone";
import {
  createCalComBooking,
  getCalComAppointmentDetails,
  getMyProfile,
} from "@/lib/calcom-functions";

export const runtime = "edge";

export async function POST(request: NextRequest) {
  try {
    console.log("------API CALLED: POST /api/calcom-appointments/book------");

    const searchParams = request.nextUrl.searchParams;
    const apiKey = searchParams.get("apiKey");
    const appointmentToolId = searchParams.get("appointmentToolId");

    if (!apiKey) {
      return NextResponse.json(
        { error: "Cal.com API key not provided" },
        { status: 401 }
      );
    }
    if (!appointmentToolId) {
      return NextResponse.json(
        { error: "Appointment Tool ID not provided" },
        { status: 400 }
      );
    }

    const body = await request.json();
    const { appointmentDetails: details } = body;

   

    if (!details) {
      return NextResponse.json(
        { error: "Appointment details not provided" },
        { status: 400 }
      );
    }

    // --- Get User Profile for Timezone ---
    let userProfile;
    try {
      userProfile = await getMyProfile(apiKey);
      console.log("Cal.com user profile:", userProfile);
    } catch (profileError: any) {
      console.error("Error getting user profile:", profileError);
      return NextResponse.json(
        { error: "Failed to get user profile from Cal.com" },
        { status: 500 }
      );
    }

    // --- Time and Date Processing ---
    let startDateTime: string;
    let normalizedTimezone: string;

    try {
      // Use the user's Cal.com timezone for booking configuration
      const userTimezone = userProfile.timeZone || "UTC";
      normalizedTimezone = normalizeTimezone(userTimezone);

      startDateTime = getUtcIsoStringFromLocalInput(
        details.preferredDate,
        details.preferredTime,
        userTimezone
      );
      console.log("startDateTime after conversion", startDateTime);
      console.log("Using user's Cal.com timezone:", userTimezone);

      // Check if appointment is in the past
      if (new Date(startDateTime) < new Date()) {
        return NextResponse.json(
          { error: "Cannot book appointments in the past" },
          { status: 400 }
        );
      }
    } catch (timezoneError: any) {
      console.error("Timezone conversion error:", timezoneError);
      return NextResponse.json(
        {
          error: timezoneError.message || "Invalid date or time format",
        },
        { status: 400 }
      );
    }

    let eventTypeId, name;
    try {
      const appointmentDetails = await getCalComAppointmentDetails(
        appointmentToolId,
        details.appointmentType
      );
      eventTypeId = appointmentDetails.eventTypeId;

      name = appointmentDetails.name;
    } catch (appointmentError: any) {
      console.error("Appointment type not found:", appointmentError);
      return NextResponse.json(
        {
          error:
            appointmentError.message ||
            `Could not find matching appointment type for identifier "${details.appointmentType}"`,
        },
        { status: 400 }
      );
    }

    details.appointmentType = name;

    try {
      // --- Create Booking ---
      const bookingPayload = {
        eventTypeId,
        start: startDateTime,
        attendee: {
          name:
            `${details.firstName} ${details.lastName || ""}`.trim() || "test",
          email: details.email,
          timeZone: normalizedTimezone,
        },
        // bookingFieldsResponses: {
        //     notes: details.notes || undefined,
        // },
      };
      console.log("bookingPayload being sent to calcom", bookingPayload);

      let booking;
      try {
        booking = await createCalComBooking(bookingPayload, apiKey);
      } catch (bookingError: any) {
        console.error("Cal.com booking error:", bookingError);

        const errorMessage = bookingError.message || "";
        if (
          errorMessage.includes(
            "User either already has booking at this time or is not available"
          ) ||
          errorMessage.includes("not available") ||
          errorMessage.includes("already has booking")
        ) {
          return NextResponse.json(
            {
              error: errorMessage,
            },
            { status: 400 }
          );
        } else if (bookingError.statusCode === 400) {
          return NextResponse.json(
            {
              error: errorMessage,
            },
            { status: 400 }
          );
        }

        throw bookingError;
      }

      console.log("-----booking result from calcom -----", booking);

      return NextResponse.json(
        {
          success: true,
          message: "Appointment booked successfully with Cal.com",
          booking: booking,
          appointmentId: booking?.id,
          appointmentUid: booking?.uid,
        },
        { status: 200 }
      );
    } catch (error: any) {
      console.error("Error in Cal.com booking process:", error);
      return NextResponse.json(
        { error: error.message || "Failed to book appointment with Cal.com" },
        { status: 500 }
      );
    }
  } catch (error: any) {
    console.error("Critical error in /api/calcom-appointments/book:", error);
    return NextResponse.json(
      { error: "An unexpected error occurred." },
      { status: 500 }
    );
  }
}