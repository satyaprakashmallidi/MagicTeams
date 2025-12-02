import { NextRequest } from 'next/server';
import { updateEvent, deleteEvent, getEvent, refreshAccessToken } from '@/lib/google-calendar';
import { supabase } from '@/lib/supabase';

export const dynamic = 'force-dynamic';

export async function PUT(
  req: NextRequest,
  { params }: { params: { eventId: string } }
) {
  try {
    const accountId = new URL(req.url).searchParams.get('accountId');
    const { event } = await req.json();

    if (!accountId) {
      return new Response(
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
      return new Response(
        JSON.stringify({ error: 'Error fetching calendar account' }),
        { status: 500, headers: { 'Content-Type': 'application/json' } }
      );
    }

    if (!account) {
      return new Response(
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
        console.log('Token expired, attempting to refresh...');
        const newToken = await refreshAccessToken(account.refresh_token);
        accessToken = newToken.access_token;
        
        await supabase
          .from('user_calendar_accounts')
          .update({
            access_token: newToken.access_token,
            refresh_token: newToken.refresh_token || account.refresh_token,
            expires_at: new Date(Date.now() + (newToken.expires_in * 1000)).toISOString(),
          })
          .eq('id', accountId);
          
        console.log('Token refreshed successfully');
      } catch (error) {
        console.error('Error refreshing token:', error);
        return new Response(
          JSON.stringify({ 
            error: 'Authentication failed',
            details: {
              error: {
                code: 401,
                message: 'Failed to refresh access token'
              }
            }
          }),
          { status: 401, headers: { 'Content-Type': 'application/json' } }
        );
      }
    }

    try {
      // First get the existing event
      const existingEvent = await getEvent(
        accessToken,
        params.eventId,
        'primary'
      );

      // Merge the existing event with the updates
      const updatedEvent = {
        ...existingEvent,
        ...event,
        // Ensure these fields are preserved
        id: params.eventId,
        status: event.status || existingEvent.status,
        created: existingEvent.created,
        creator: existingEvent.creator,
        organizer: existingEvent.organizer,
      };

      const result = await updateEvent(
        accessToken,
        params.eventId,
        updatedEvent,
        'primary'
      );

      return new Response(JSON.stringify(result), {
        headers: { 'Content-Type': 'application/json' },
      });
    } catch (error: any) {
      console.error('Error updating event in Google Calendar:', error);
      
      // Check if it's an authentication error
      if (error.response?.status === 401 || error.code === 401) {
        return new Response(
          JSON.stringify({ 
            error: 'Authentication failed',
            details: {
              error: {
                code: 401,
                message: 'Invalid or expired access token'
              }
            }
          }),
          { status: 401, headers: { 'Content-Type': 'application/json' } }
        );
      }

      return new Response(
        JSON.stringify({ 
          error: error.message || 'Failed to update event in Google Calendar',
          details: error.response?.data || error
        }),
        { status: 500, headers: { 'Content-Type': 'application/json' } }
      );
    }
  } catch (error: any) {
    console.error('Error in update event handler:', error);
    return new Response(
      JSON.stringify({ error: 'Failed to update event', details: error.message }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: { eventId: string } }
) {
  try {
    const accountId = new URL(req.url).searchParams.get('accountId');

    if (!accountId) {
      return new Response(
        JSON.stringify({ error: 'Calendar account ID is required' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    const { data: account } = await supabase
      .from('user_calendar_accounts')
      .select('*')
      .eq('id', accountId)
      .single();

    if (!account) {
      return new Response(
        JSON.stringify({ error: 'Calendar account not found' }),
        { status: 404, headers: { 'Content-Type': 'application/json' } }
      );
    }

    await deleteEvent(account.access_token, params.eventId);
    
    return new Response(JSON.stringify({ success: true }), {
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (error: any) {
    console.error('Error deleting event:', error);
    return new Response(
      JSON.stringify({ error: 'Failed to delete event', details: error.message }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
}
