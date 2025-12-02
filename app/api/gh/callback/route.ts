import { NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";


export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const code = searchParams.get("code");

  // Get the origin from the request headers for dynamic URL construction
  const origin = request.headers.get('origin') || new URL(request.url).origin || process.env.NEXT_PUBLIC_APP_URL || '';

  if (!code) {
    return NextResponse.redirect(`${origin}/dashboard/ghl-calendar?error=missing_params`);
  }
  // console.log("GHL Callback Code:", code);

  try {
    const supabase = await createClient();
    const client_id = process.env.NEXT_PUBLIC_GHL_CLIENT_ID;
    const client_secret = process.env.NEXT_PUBLIC_GHL_CLIENT_SECRET;

    const params = new URLSearchParams();
    params.append("client_id", client_id || "");
    params.append("client_secret", client_secret || "");
    params.append("grant_type", "authorization_code");
    params.append("code", code);


    const tokenResponse = await fetch("https://services.leadconnectorhq.com/oauth/token", {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: params.toString(),
    });

    const tokenData = await tokenResponse.json();
    // console.log("Token Data:", tokenData);

    if (!tokenResponse.ok) {
      throw new Error(tokenData.message || "Failed to get access token");
    }

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      throw new Error("User not authenticated");
    }

    const { data: connectionData, error: dbError } = await supabase
      .from("ghl_connections")
      .upsert({
        user_id: user.id,
        location_id: tokenData.locationId,
        access_token: tokenData.access_token,
        refresh_token: tokenData.refresh_token,
        expires_at: new Date(Date.now() + tokenData.expires_in * 1000).toISOString(),
      }, { onConflict: 'user_id' })
      .select();

    // console.log("Connection Data has been saved to db:", connectionData);

    if (dbError) {
      console.error("Database Error:", dbError);
      throw dbError;
    }

    return NextResponse.redirect(`${origin}/dashboard/ghl-calendar?success=true`);
  } catch (error) {
    console.error("GHL OAuth Error:", error);
    return NextResponse.redirect(`${origin}/dashboard/ghl-calendar?error=oauth_failed`);
  }
}
