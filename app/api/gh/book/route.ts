import { NextResponse, NextRequest } from "next/server";
import { getLocationById, getAllContacts, createEvent } from "@/lib/ghl-functions";
import { convertTimezone, normalizeTimezone } from "@/lib/utils/timezone";
import { createClient } from "@supabase/supabase-js";

export const runtime = "edge";


function normalizePhoneNumber(phone: string): string {
  // Remove all non-digit characters
  const digitsOnly = phone.replace(/\D/g, '');

  // Always take the last 10 digits for comparison (removes country codes)
  if (digitsOnly.length >= 10) {
    return digitsOnly.slice(-10);
  }

  // If less than 10 digits, return as is
  return digitsOnly;
}

// Helper function to find contact by phone number
function findContactByPhone(contacts: any[], targetPhone: string): any | null {
  const normalizedTarget = normalizePhoneNumber(targetPhone);

  console.log(`Searching for phone: ${targetPhone} (normalized: ${normalizedTarget})`);
  console.log('Available contacts:', contacts.map(contact => ({
    id: contact.id,
    name: contact.contactName || contact.firstName || contact.lastName || 'No name',
    phone: contact.phone,
    normalizedPhone: contact.phone ? normalizePhoneNumber(contact.phone) : 'No phone'
  })));

  const matchedContact = contacts.find(contact => {
    if (!contact.phone) return false;

    const normalizedContact = normalizePhoneNumber(contact.phone);

    console.log(`Comparing: ${normalizedTarget} vs ${normalizedContact}`);

    // Check if last 8-10 digits match (flexible matching)
    if (normalizedTarget.length >= 8 && normalizedContact.length >= 8) {
      const minLength = Math.min(8, Math.min(normalizedTarget.length, normalizedContact.length));
      const targetSuffix = normalizedTarget.slice(-minLength);
      const contactSuffix = normalizedContact.slice(-minLength);

      console.log(`Suffix comparison: ${targetSuffix} vs ${contactSuffix}`);

      if (targetSuffix === contactSuffix) {
        console.log('Found match via suffix comparison');
        return true;
      }
    }

    // Exact match after normalization
    const exactMatch = normalizedTarget === normalizedContact;
    if (exactMatch) {
      console.log('Found exact match');
    }

    return exactMatch;
  });

  console.log('Match result:', matchedContact ? {
    id: matchedContact.id,
    name: matchedContact.contactName || matchedContact.firstName || matchedContact.lastName,
    phone: matchedContact.phone
  } : 'No match found');

  return matchedContact || null;
}

// Helper function to convert time format
function convertTimeFormat(timeStr: string): string {
  // Convert "11:00 AM" to "11:00"
  const time = timeStr.trim().toUpperCase();

  // Parse 12-hour format to 24-hour format
  const match = time.match(/^(\d{1,2}):(\d{2})\s?(AM|PM)$/);
  if (match) {
    let hour = parseInt(match[1]);
    const minute = match[2];
    const period = match[3];

    if (period === 'AM' && hour === 12) {
      hour = 0;
    } else if (period === 'PM' && hour !== 12) {
      hour += 12;
    }

    return `${hour.toString().padStart(2, '0')}:${minute}`;
  }

  // Return as is if already in 24-hour format
  return time;
}

export async function POST(request: NextRequest) {
  try {
    console.log("------API CALLED: POST /api/gh/book------");

    // Step 1: Get parameters and validate
    const searchParams = request.nextUrl.searchParams;
    const appointmentToolId = searchParams.get("appointmentToolId");
    const toNumber = searchParams.get("toNumber");

    if (!appointmentToolId) {
      return NextResponse.json(
        { error: "Appointment Tool ID not provided" },
        { status: 400 }
      );
    }

    const body = await request.json();
    const { appointmentDetails } = body;

    if (!appointmentDetails) {
      return NextResponse.json(
        { error: "Appointment details not provided" },
        { status: 400 }
      );
    }

    console.log("------Appointment details received:", appointmentDetails);

    try {
      // Step 2: Get appointment tool configuration from database
    //   console.log("Step 2: Getting appointment tool configuration...");
      const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
      const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "";
      const supabase = createClient(supabaseUrl, supabaseKey);

      const { data: appointmentTool, error: toolError } = await supabase
        .from("appointment_tools")
        .select("ghl_calendar_id, staffid_ghl, business_hours, appointment_duration, user_id")
        .eq("id", appointmentToolId)
        .eq("is_ghl", true)
        .eq("is_deleted", false)
        .single();

      if (toolError || !appointmentTool) {
        console.error("Error fetching appointment tool:", toolError);
        return NextResponse.json(
          { error: "Appointment tool not found or not configured for GHL" },
          { status: 404 }
        );
      }

      if (!appointmentTool.ghl_calendar_id) {
        return NextResponse.json(
          { error: "GHL calendar ID not configured for this appointment tool" },
          { status: 400 }
        );
      }

      const userId = appointmentTool.user_id;
      if (!userId) {
        return NextResponse.json(
          { error: "User ID not found in appointment tool configuration" },
          { status: 400 }
        );
      }

    //   console.log("Appointment tool configuration:", {
    //     calendarId: appointmentTool.ghl_calendar_id,
    //     staffId: appointmentTool.staffid_ghl,
    //     duration: appointmentTool.appointment_duration,
    //     userId: userId
    //   });

      // Step 3: Validate GHL connection exists (this will be handled by getGHLConnection)
    //   console.log("Step 3: Validating GHL connection for user:", userId);

      // Step 4: Get admin's location timezone
    //   console.log("Step 4: Getting admin timezone from GHL location...");
      const location = await getLocationById(userId);
      const adminTimezone = location.timezone || "UTC";
      console.log("Admin timezone from GHL:", adminTimezone);

      // Step 5: Get all contacts to find the matching contact ID
    //   console.log("Step 5: Getting all contacts to find matching contact...");
      const contacts = await getAllContacts(userId);

      let contactId = null;
      if (toNumber) {
        const matchedContact = findContactByPhone(contacts, toNumber);
        if (matchedContact) {
          contactId = matchedContact.id;
        //   console.log("Found matching contact:", { id: contactId, phone: matchedContact.phone, name: matchedContact.name });
        } else {
        //   console.log("No matching contact found for phone:", toNumber);
          return NextResponse.json(
            { error: `No contact found matching phone number: ${toNumber}` },
            { status: 400 }
          );
        }
      }

      if (!contactId) {
        return NextResponse.json(
          { error: "Contact ID could not be determined" },
          { status: 400 }
        );
      }

      // Step 6: Convert user timezone to admin timezone
    //   console.log("Step 6: Converting timezone...");
      const userTimezone = normalizeTimezone(appointmentDetails.timezone);
      const normalizedAdminTimezone = normalizeTimezone(adminTimezone);

      console.log(`Converting from user timezone: ${userTimezone} to admin timezone: ${normalizedAdminTimezone}`);

      // Convert time format from "11:00 AM" to "11:00"
      const timeIn24Hour = convertTimeFormat(appointmentDetails.time);

      const convertedTime = convertTimezone(
        appointmentDetails.date,
        timeIn24Hour,
        userTimezone,
        normalizedAdminTimezone
      );

      console.log("Time conversion result:", {
        original: `${appointmentDetails.date} ${appointmentDetails.time} (${userTimezone})`,
        converted: `${convertedTime.date} ${convertedTime.time} (${normalizedAdminTimezone})`
      });

      // Step 7: Create the appointment
    //   console.log("Step 7: Creating GHL appointment...");

      // Create startTime in ISO 8601 format (GHL expects ISO 8601 date string)
      const appointmentDateTime = new Date(`${convertedTime.date}T${convertedTime.time}:00`);
      const startTime = appointmentDateTime.toISOString();

      // Use duration from appointment tool configuration
      const duration = appointmentTool.appointment_duration || appointmentDetails.appointmentDuration || 30;
      const endDateTime = new Date(appointmentDateTime.getTime() + (duration * 60 * 1000));
      const endTime = endDateTime.toISOString();

      const appointmentPayload = {
        title: `${appointmentDetails.appointmentType || "Appointment"} - ${appointmentDetails.firstName} ${appointmentDetails.lastName}`.trim(),
        calendarId: appointmentTool.ghl_calendar_id,
        contactId: contactId,
        startTime: startTime,
        appointmentStatus: "confirmed",
        assignedUserId: appointmentTool.staffid_ghl,
        meetingLocationType: "custom",
        toNotify: true,
        ignoreFreeSlotValidation: false,
      };

      console.log("---------- payload:", appointmentPayload);

      const appointment = await createEvent(userId, appointmentPayload);

      console.log("-------GHL appointment created:", appointment);

      return NextResponse.json(
        {
          success: true,
          message: "Appointment booked successfully with GoHighLevel",
          appointment: appointment,
          appointmentId: appointment.id,
          details: {
            date: convertedTime.date,
            time: convertedTime.time,
            timezone: normalizedAdminTimezone,
            duration: duration,
            contact: {
              id: contactId,
              phone: toNumber
            },
            calendar: {
              id: appointmentTool.ghl_calendar_id,
              staffId: appointmentTool.staffid_ghl
            }
          }
        },
        { status: 200 }
      );

    } catch (ghlError: any) {
      console.error("GHL booking error:", ghlError);

      // Handle specific GHL API errors
      if (ghlError.message) {
        if (ghlError.message.includes("not found")) {
          return NextResponse.json(
            { error: "Resource not found in GoHighLevel" },
            { status: 404 }
          );
        } else if (ghlError.message.includes("expired")) {
          return NextResponse.json(
            { error: "GHL access token expired. Please reconnect your account." },
            { status: 401 }
          );
        } else if (ghlError.message.includes("already booked") || ghlError.message.includes("not available")) {
          return NextResponse.json(
            { error: ghlError.message },
            { status: 400 }
          );
        }
      }

      return NextResponse.json(
        { error: ghlError.message || "Failed to book appointment with GoHighLevel" },
        { status: 500 }
      );
    }

  } catch (error: any) {
    console.error("Critical error in /api/gh/book:", error);
    return NextResponse.json(
      { error: "An unexpected error occurred while booking the appointment" },
      { status: 500 }
    );
  }
}