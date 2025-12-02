import { NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";

export async function GET(request: Request) {
  try {
    // Create server-side Supabase client
    const supabase = await createClient();

    const user = (await supabase.auth.getUser()).data.user;

    // Get the origin from the request headers for dynamic URL construction
    const origin = request.headers.get('origin') || process.env.NEXT_PUBLIC_APP_URL || '';

    if (!user) {
      return NextResponse.redirect(`${origin}/dashboard/ghl-calendar?error=unauthorized`);
    }

    // Delete the GHL connection
    const { error } = await supabase
      .from("ghl_connections")
      .delete()
      .eq("user_id", user.id);

    if (error) {
      throw error;
    }

    return NextResponse.redirect(`${origin}/dashboard/ghl-calendar?disconnected=true`);
  } catch (error) {
    console.error("Error disconnecting GHL:", error);
    const origin = request.headers.get('origin') || process.env.NEXT_PUBLIC_APP_URL || '';
    return NextResponse.redirect(`${origin}/dashboard/ghl-calendar?error=disconnect_failed`);
  }
}
