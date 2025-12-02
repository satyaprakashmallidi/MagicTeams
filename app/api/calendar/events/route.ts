import { NextRequest, NextResponse } from 'next/server';
import { createEvent, listEvents, refreshAccessToken, deleteEvent, listCalendars, listAllEventsInCalendar } from '@/lib/google-calendar';
import { supabase } from '@/lib/supabase';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  try {
    const searchParams = req.nextUrl.searchParams;
    const accountId = searchParams.get('accountId');
    const timeMin = searchParams.get('timeMin');
    const timeMax = searchParams.get('timeMax');

    console.log('GET /api/calendar/events', { accountId, timeMin, timeMax });

    if (!accountId) {
      console.error('No accountId provided');
      return new NextResponse(
        JSON.stringify({ error: 'Calendar account ID is required' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // Parse and validate date ranges
    let parsedTimeMin: Date, parsedTimeMax: Date;
    try {
      parsedTimeMin = timeMin ? new Date(timeMin) : new Date();
      parsedTimeMax = timeMax ? new Date(timeMax) : new Date();
      parsedTimeMax.setFullYear(parsedTimeMin.getFullYear() + 1); // Default to 1 year range
      
      // Validate dates are reasonable
      const now = new Date();
      const minDate = new Date(now);
      minDate.setFullYear(now.getFullYear() - 2); // Max 2 years in past
      const maxDate = new Date(now);
      maxDate.setFullYear(now.getFullYear() + 2); // Max 2 years in future
      
      if (parsedTimeMin < minDate) parsedTimeMin = minDate;
      if (parsedTimeMax > maxDate) parsedTimeMax = maxDate;
    } catch (error) {
      console.error('Invalid date range:', error);
      return new NextResponse(
        JSON.stringify({ error: 'Invalid date range provided' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    const { data: account, error: accountError } = await supabase
      .from('user_calendar_accounts')
      .select('*')
      .eq('id', accountId)
      .single();

    if (accountError) {
      console.error('Error fetching account:', accountError);
      return new NextResponse(
        JSON.stringify({ error: 'Error fetching calendar account' }),
        { status: 500, headers: { 'Content-Type': 'application/json' } }
      );
    }

    if (!account) {
      console.error('Account not found:', accountId);
      return new NextResponse(
        JSON.stringify({ error: 'Calendar account not found' }),
        { status: 404, headers: { 'Content-Type': 'application/json' } }
      );
    }

    console.log('Found account:', account.calendar_email);

    // Check if token is expired
    const now = new Date();
    const expiresAt = new Date(account.expires_at);
    
    let accessToken = account.access_token;
    if (now > expiresAt && account.refresh_token) {
      console.log('Token expired, refreshing...');
      try {
        const newToken = await refreshAccessToken(account.refresh_token);
        accessToken = newToken.access_token;
        
        // Update token in database
        const { error: updateError } = await supabase
          .from('user_calendar_accounts')
          .update({
            access_token: newToken.access_token,
            refresh_token: newToken.refresh_token,
            expires_at: new Date(Date.now() + newToken.expires_in * 1000).toISOString(),
          })
          .eq('id', accountId);

        if (updateError) {
          console.error('Error updating token:', updateError);
          throw updateError;
        }
      } catch (error) {
        console.error('Error refreshing token:', error);
        return new NextResponse(
          JSON.stringify({ error: 'Failed to refresh access token' }),
          { status: 401, headers: { 'Content-Type': 'application/json' } }
        );
      }
    }

    // Fetch all calendars associated with the account
    const calendars = await listCalendars(accessToken);

    // Fetch all events for each calendar
    const eventsPromises = calendars.map((calendar: any) =>
      listAllEventsInCalendar(accessToken, calendar.id)
    );

    const allEvents = await Promise.all(eventsPromises);
    const flattenedEvents = allEvents.flat().map((event: any) => ({
      ...event,
      calendarId: event.organizer.email,
      _calendarId: event.organizer.email,
    }));

    return new NextResponse(JSON.stringify({
      calendars,
      events: flattenedEvents
    }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('Unexpected error:', error);
    return new NextResponse(
      JSON.stringify({ error: 'An unexpected error occurred' }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
}

export async function POST(req: NextRequest) {
  try {
    const { event } = await req.json();
    const accountId = new URL(req.url).searchParams.get('accountId');

    if (!accountId) {
      return new NextResponse(
        JSON.stringify({ error: 'Calendar account ID is required' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    const { data: account, error: accountError } = await supabase
      .from('user_calendar_accounts')
      .select('*')
      .eq('id', accountId)
      .single();

    if (accountError) {
      console.error('Error fetching account:', accountError);
      return new NextResponse(
        JSON.stringify({ error: 'Error fetching calendar account' }),
        { status: 500, headers: { 'Content-Type': 'application/json' } }
      );
    }

    if (!account) {
      return new NextResponse(
        JSON.stringify({ error: 'Calendar account not found' }),
        { status: 404, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // Check if token is expired and refresh if needed
    const now = new Date();
    const expiresAt = new Date(account.expires_at);
    
    let accessToken = account.access_token;
    if (now > expiresAt && account.refresh_token) {
      try {
        const newToken = await refreshAccessToken(account.refresh_token);
        accessToken = newToken.access_token;
        
        await supabase
          .from('user_calendar_accounts')
          .update({
            access_token: newToken.access_token,
            refresh_token: newToken.refresh_token,
            expires_at: new Date(Date.now() + newToken.expires_in * 1000).toISOString(),
          })
          .eq('id', accountId);
      } catch (error) {
        console.error('Error refreshing token:', error);
        return new NextResponse(
          JSON.stringify({ error: 'Failed to refresh access token' }),
          { status: 401, headers: { 'Content-Type': 'application/json' } }
        );
      }
    }

    // Format event data for Google Calendar API
    const formattedEvent = {
      summary: event.summary,
      description: event.description,
      start: {
        dateTime: event.start.dateTime,
        timeZone: event.start.timeZone || Intl.DateTimeFormat().resolvedOptions().timeZone,
      },
      end: {
        dateTime: event.end.dateTime,
        timeZone: event.end.timeZone || Intl.DateTimeFormat().resolvedOptions().timeZone,
      }
    };

    // Create event with retry logic
    const newEvent = await createEvent(accessToken, formattedEvent);
    console.log('Event created:', newEvent);

    return new NextResponse(JSON.stringify(newEvent), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (error: any) {
    console.error('Error creating event:', error);
    
    // Handle rate limit errors specifically
    if (error?.response?.status === 429 || error?.message?.includes('rate limit')) {
      return new NextResponse(
        JSON.stringify({ 
          error: 'Rate limit exceeded. Please try again later.',
          retryAfter: error?.response?.headers?.['retry-after'] || 60
        }),
        { status: 429, headers: { 'Content-Type': 'application/json' } }
      );
    }

    return new NextResponse(
      JSON.stringify({ error: 'Failed to create event', details: error.message }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const { eventId } = await req.json();
    const accountId = new URL(req.url).searchParams.get('accountId');

    if (!accountId || !eventId) {
      return new NextResponse(
        JSON.stringify({ error: 'Calendar account ID and event ID are required' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    const { data: account, error: accountError } = await supabase
      .from('user_calendar_accounts')
      .select('*')
      .eq('id', accountId)
      .single();

    if (accountError) {
      console.error('Error fetching account:', accountError);
      return new NextResponse(
        JSON.stringify({ error: 'Error fetching calendar account' }),
        { status: 500, headers: { 'Content-Type': 'application/json' } }
      );
    }

    if (!account) {
      return new NextResponse(
        JSON.stringify({ error: 'Calendar account not found' }),
        { status: 404, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // Check if token is expired and refresh if needed
    const now = new Date();
    const expiresAt = new Date(account.expires_at);
    
    let accessToken = account.access_token;
    if (now > expiresAt && account.refresh_token) {
      try {
        const newToken = await refreshAccessToken(account.refresh_token);
        accessToken = newToken.access_token;
        
        await supabase
          .from('user_calendar_accounts')
          .update({
            access_token: newToken.access_token,
            refresh_token: newToken.refresh_token,
            expires_at: new Date(Date.now() + newToken.expires_in * 1000).toISOString(),
          })
          .eq('id', accountId);
      } catch (error) {
        console.error('Error refreshing token:', error);
        return new NextResponse(
          JSON.stringify({ error: 'Failed to refresh access token' }),
          { status: 401, headers: { 'Content-Type': 'application/json' } }
        );
      }
    }

    // Delete event with retry logic
    await deleteEvent(accessToken, eventId);

    return new NextResponse(JSON.stringify({ success: true }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (error: any) {
    console.error('Error deleting event:', error);
    
    // Handle rate limit errors specifically
    if (error?.response?.status === 429 || error?.message?.includes('rate limit')) {
      return new NextResponse(
        JSON.stringify({ 
          error: 'Rate limit exceeded. Please try again later.',
          retryAfter: error?.response?.headers?.['retry-after'] || 60
        }),
        { status: 429, headers: { 'Content-Type': 'application/json' } }
      );
    }

    return new NextResponse(
      JSON.stringify({ error: 'Failed to delete event' }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
}
