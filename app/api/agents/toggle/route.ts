import { createClient } from "@/utils/supabase/server";
import { NextResponse } from "next/server";

export async function POST(request: Request) {
    try {
        const supabase = createClient();
        const { botId, isEnabled } = await request.json();

        if (!botId) {
            return NextResponse.json(
                { error: "Bot ID is required" },
                { status: 400 }
            );
        }

        const { data, error } = await supabase
            .from("bots")
            .update({ is_enabled: isEnabled })
            .eq("id", botId)
            .select()
            .single();

        if (error) {
            console.error("Error updating bot status:", error);
            return NextResponse.json(
                { error: "Failed to update bot status" },
                { status: 500 }
            );
        }

        return NextResponse.json({ data });
    } catch (error) {
        console.error("Error in toggle agent route:", error);
        return NextResponse.json(
            { error: "Internal server error" },
            { status: 500 }
        );
    }
}
