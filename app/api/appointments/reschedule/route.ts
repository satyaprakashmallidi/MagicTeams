import { NextRequest, NextResponse } from 'next/server';
import { updateEvent, getEvent } from '@/lib/google-calendar';
import { checkSlotAvailability } from '@/lib/edge-calendar';

// export const runtime = 'edge';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { eventId, newDate, newTime, timezone } = body;

    const accessToken = request.nextUrl.searchParams.get('access_token');
    const refreshToken = request.nextUrl.searchParams.get('refresh_token');
    const calendarId = request.nextUrl.searchParams.get('calendar_id');

    console.log('accessToken', accessToken);

    if (!eventId || !accessToken || !newDate || !newTime || !timezone) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    // Build new start and end times (assume 1 hour duration for now)
    const startDateTime = new Date(`${newDate}T${newTime}:00${timezone === 'UTC' ? 'Z' : ''}`);
    const endDateTime = new Date(startDateTime.getTime() + 60 * 60 * 1000); // +1 hour

    // Check slot availability before updating
    const slotResult = await checkSlotAvailability(startDateTime.toISOString(), endDateTime.toISOString(), accessToken);
    console.log('slotResult', slotResult);
    if (!slotResult.available) {
      return NextResponse.json({
        error: 'The requested time slot is already booked',
        conflicts: slotResult.conflictingEvents,
        status: 'unavailable',
        requestedSlot: {
          start: startDateTime.toISOString(),
          end: endDateTime.toISOString(),
          duration: '60 minutes'
        }
      }, { status: 409 });
    }

    // Fetch the existing event from Google Calendar
    let existingEvent;
    try {
      existingEvent = await getEvent(accessToken, eventId, 'primary');
    } catch (error: any) {
      console.error('Error fetching existing event:', error);
      return NextResponse.json({ error: 'Failed to fetch existing event', details: error.message }, { status: 500 });
    }

    // Merge new start/end into the existing event
    const updatedEvent = {
      ...existingEvent,
      start: {
        dateTime: startDateTime.toISOString(),
        timeZone: timezone,
      },
      end: {
        dateTime: endDateTime.toISOString(),
        timeZone: timezone,
      },
      id: eventId,
      status: existingEvent.status,
      created: existingEvent.created,
      creator: existingEvent.creator,
      organizer: existingEvent.organizer,
    };

    // Update the event in Google Calendar
    try {
      const updated = await updateEvent(accessToken, eventId, updatedEvent, 'primary');
      return NextResponse.json({ event: updated });
    } catch (error: any) {
      console.error('Error updating event in Google Calendar:', error);
      if (error.response?.status === 401 || error.code === 401) {
        return NextResponse.json({
          error: 'Authentication failed',
          details: {
            error: {
              code: 401,
              message: 'Invalid or expired access token'
            }
          }
        }, { status: 401 });
      }
      return NextResponse.json({
        error: error.message || 'Failed to update event in Google Calendar',
        details: error.response?.data || error
      }, { status: 500 });
    }
  } catch (error) {
    console.error('Error rescheduling appointment:', error);
    return NextResponse.json({ error: 'Failed to reschedule appointment' }, { status: 500 });
  }
} 