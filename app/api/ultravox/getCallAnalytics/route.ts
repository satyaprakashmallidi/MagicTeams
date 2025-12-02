import {NextRequest, NextResponse} from 'next/server';

interface CallData {
    [date: string]: string[]; // date -> array of call IDs
}

interface CallAnalytics {
    [date: string]: {
        totalTalkTime: number; // in seconds
        totalCalls: number;
    };
}

export const runtime = "nodejs";

export async function POST(request: NextRequest) {
    try {
        const callData: CallData = await request.json();

        const analytics: CallAnalytics = {};
        
        // Process each date's calls
        for (const [date, callIds] of Object.entries(callData)) {
            let totalTalkTime = 0;
            const totalCalls = callIds.length;

            // Fetch details for each call
            const callPromises = callIds.map(async (callId) => {
                const response = await fetch(`${request.nextUrl.origin}/api/ultravox/getCall?callId=${callId}`);
                if (!response.ok) {
                    console.error(`Failed to fetch call ${callId}:`, response.statusText);
                    return null;
                }
                return response.json();
            });

            const callResults = await Promise.all(callPromises);

            // Calculate talk time for valid calls
            callResults.forEach(call => {
                if (call && call.created && call.ended) {
                    const startTime = new Date(call.created);
                    const endTime = new Date(call.ended);
                    const talkTime = (endTime.getTime() - startTime.getTime()) / 1000; // Convert to seconds
                    totalTalkTime += talkTime;
                }
            });

            analytics[date] = {
                totalTalkTime,
                totalCalls
            };
        }

        return NextResponse.json(analytics);
    } catch (error) {
        console.error('Error processing call analytics:', error);
        return NextResponse.json(
            { error: 'Failed to process call analytics' },
            { status: 500 }
        );
    }
}
