import { NextRequest, NextResponse } from 'next/server';
import { checkSlotAvailability } from '@/lib/edge-calendar';

// export const runtime = 'edge';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { email, date, time, timezone } = body;

    const accessToken = request.nextUrl.searchParams.get('access_token');
    const calendarId = request.nextUrl.searchParams.get('calendar_id');

    console.log('accessToken', accessToken);
    console.log('calendarId', calendarId);

    if (!email || !date || !time || !timezone || !accessToken || !calendarId || typeof calendarId !== 'string' || !calendarId.trim()) {
      console.error('Invalid or missing calendarId:', calendarId);
      return NextResponse.json({ error: 'Missing or invalid required fields (email, date, time, timezone, accessToken, calendarId)' }, { status: 400 });
    }

    // Build the time window for the search (±2 hours around the requested time)
    const startDateTime = new Date(`${date}T${time}:00${timezone === 'UTC' ? 'Z' : ''}`);
    const timeMin = new Date(startDateTime.getTime() - 2 * 60 * 60 * 1000).toISOString();
    const timeMax = new Date(startDateTime.getTime() + 2 * 60 * 60 * 1000).toISOString();

    console.log(`Google Calendar API: Will search events in calendarId=${calendarId} from ${timeMin} to ${timeMax}`);

    // Use checkSlotAvailability to get all events in the window
    const slotResult = await checkSlotAvailability(timeMin, timeMax, accessToken);
    const events = slotResult.conflictingEvents || [];

    console.log('slot result', slotResult);

    // Find a matching event by attendee email and start time
    const found = events.find((event: any) => {
      const eventStart = event.start || event.originalStart;
      const eventAttendees = (event.attendees?.map((a: any) => a.email)) || [];
      return (
        eventStart &&
        eventAttendees.includes(email) &&
        eventStart.startsWith(date)
      );
    });

    if (!found) {
      return NextResponse.json({ error: 'No matching event found' }, { status: 404 });
    }

    return NextResponse.json({ eventId: found.id, event: found });
  } catch (error) {
    console.error('Error in appointment lookup:', error);
    return NextResponse.json({ error: 'Failed to lookup appointment' }, { status: 500 });
  }
} 