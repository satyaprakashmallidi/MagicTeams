import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { google } from 'googleapis';
import { env } from '@/lib/env/getEnvVars';
import { createClient } from '@/utils/supabase/server';

const oauth2Client = new google.auth.OAuth2(
  env.GOOGLE_CLIENT_ID,
  env.GOOGLE_CLIENT_SECRET,
  `${env.NEXT_PUBLIC_APP_URL}/api/calendar/callback`
);

export async function GET(request: NextRequest) {
  try {
    const requestUrl = new URL(request.url);
    const code = requestUrl.searchParams.get('code');
    let redirectPath = requestUrl.searchParams.get('redirect') || '/dashboard/aiassistant';

    if (!code) {
      console.error('No code provided in calendar callback');
      return NextResponse.redirect(new URL('/dashboard/aiassistant?error=no_code', requestUrl.origin));
    }

    // Get the current user from Supabase
    const supabase = await createClient();
    const { data: { user }, error: userError } = await supabase.auth.getUser();
    
    if (userError || !user) {
      console.error('Not authenticated');
      return NextResponse.redirect(new URL('/login', requestUrl.origin));
    }

    try {
      // Get tokens from Google
      const { tokens } = await oauth2Client.getToken(code);
      
      if (!tokens.access_token || !tokens.refresh_token || !tokens.expiry_date) {
        throw new Error('Invalid token response from Google');
      }

      // Get user's calendar email
      oauth2Client.setCredentials(tokens);
      const calendar = google.calendar({ version: 'v3', auth: oauth2Client });
      const { data: calendarList } = await calendar.calendarList.list();
      const primaryCalendar = calendarList.items?.find(cal => cal.primary);
      
      if (!primaryCalendar?.id) {
        throw new Error('Could not find primary calendar');
      }

      // Store the tokens in Supabase
      const { error: insertError } = await supabase
        .from('user_calendar_accounts')
        .upsert({
          user_id: user.id,
          access_token: tokens.access_token,
          refresh_token: tokens.refresh_token,
          calendar_email: primaryCalendar.id,
          expires_at: new Date(tokens.expiry_date).toISOString(),
        }, {
          onConflict: 'user_id,calendar_email'
        });

      if (insertError) {
        throw insertError;
      }

      return NextResponse.redirect(new URL(redirectPath, requestUrl.origin));
    } catch (error) {
      console.error('Error setting up calendar:', error);
      return NextResponse.redirect(
        new URL(`${redirectPath}?calendar_error=${encodeURIComponent(error.message)}`, requestUrl.origin)
      );
    }
  } catch (error) {
    console.error('Error in calendar callback:', error);
    return NextResponse.redirect(
      new URL('/dashboard/aiassistant?error=calendar_setup_failed', request.url)
    );
  }
}
