import { NextRequest, NextResponse } from 'next/server';
import { env } from '@/lib/env/getEnvVars';

export const runtime = "nodejs"; // Specify Node.js runtime

export async function GET(request: NextRequest) {
    try {
        const { searchParams } = new URL(request.url);
        const callId = searchParams.get('callId');

        if (!callId) {
            return NextResponse.json({ error: 'Call ID is required' }, { status: 400 });
        }

        const response = await fetch(`https://api.ultravox.ai/api/calls/${callId}`, {
            method: 'GET',
            headers: {
                'Content-Type': 'application/json',
                'X-API-Key': env.ULTRAVOX_API_KEY,
            },
        });

        if (!response.ok) {
            const errorData = await response.json();
            return NextResponse.json({ error: errorData }, { status: response.status });
        }

        const data = await response.json();
        return NextResponse.json(data);
    } catch (error) {
        console.error('Error fetching call:', error);
        return NextResponse.json(
            { error: 'Failed to fetch call details' },
            { status: 500 }
        );
    }
}