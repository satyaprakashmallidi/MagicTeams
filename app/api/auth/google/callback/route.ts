import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs';
import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    const requestUrl = new URL(request.url);
    const code = requestUrl.searchParams.get('code');
    let redirectPath = requestUrl.searchParams.get('redirect') || '/dashboard/aiassistant';

    if (!code) {
      console.error('No code provided in callback');
      return NextResponse.redirect(new URL('/login?error=no_code', requestUrl.origin));
    }

    // Create a Supabase client configured to use cookies
    const cookieStore = cookies();
    const supabase = createRouteHandlerClient({ cookies: () => cookieStore });

    // Exchange the code for a session
    const { data, error } = await supabase.auth.exchangeCodeForSession(code);

    if (error) {
      console.error('Error exchanging code for session:', error);
      return NextResponse.redirect(
        new URL(`/login?error=${encodeURIComponent(error.message)}`, requestUrl.origin)
      );
    }

    // Ensure we have a session
    if (!data.session) {
      console.error('No session returned from exchangeCodeForSession');
      return NextResponse.redirect(
        new URL('/login?error=no_session', requestUrl.origin)
      );
    }

    // Create a response with the redirect
    const response = NextResponse.redirect(new URL(redirectPath, requestUrl.origin));

    // Set cookie with session
    await supabase.auth.setSession(data.session);

    return response;
  } catch (error) {
    console.error('Error in Google callback:', error);
    return NextResponse.redirect(
      new URL('/login?error=server_error', request.url)
    );
  }
}
