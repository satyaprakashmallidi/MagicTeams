import { NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";

export async function GET() {
  try {
    
    const supabase = await createClient();
    
    const user = (await supabase.auth.getUser()).data.user;
    
    if (!user) {
      return NextResponse.json({ connected: false }, { status: 401 });
    }

    // Check if we have a valid GHL connection
    const { data: connection, error } = await supabase
      .from("ghl_connections")
      .select("*")
      .eq("user_id", user.id)
      .single();

    if (error || !connection) {
      return NextResponse.json({ connected: false });
    }

    // Check if token is expired
    const isExpired = new Date(connection.expires_at) <= new Date();

    if (isExpired) {
      // TODO: Implement token refresh logic here
      return NextResponse.json({ connected: false });
    }
    // console.log("Connection Data:", connection);
    return NextResponse.json({ connected: true });
  } catch (error) {
    console.error("Error checking GHL status:", error);
    return NextResponse.json({ connected: false }, { status: 500 });
  }
}
