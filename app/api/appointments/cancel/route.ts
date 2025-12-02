import { NextRequest, NextResponse } from 'next/server';
import { deleteEvent, refreshAccessToken } from '@/lib/google-calendar';
import { supabase } from '@/lib/supabase';


export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { eventId } = body;

    const accessTokn = request.nextUrl.searchParams.get('access_token');
    const refreshToken = request.nextUrl.searchParams.get('refresh_token');
    const calendarId = request.nextUrl.searchParams.get('calendar_id');

    if (!eventId || !accessTokn || !refreshToken || !calendarId) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    const accountId = calendarId;

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

    const now = new Date();
    const expiresAt = new Date(account.expires_at);
    
    let accessToken = account.access_token;
    if (now > expiresAt && account.refresh_token) {
      try {
        console.log('Token expired, attempting to refresh...');
        const newToken = await refreshAccessToken(account.refresh_token);
        accessToken = newToken.access_token;
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
    await deleteEvent(accessToken, eventId);
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error cancelling appointment:', error);
    return NextResponse.json({ error: 'Failed to cancel appointment' }, { status: 500 });
  }
} 