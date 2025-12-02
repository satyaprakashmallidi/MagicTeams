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

        const response = await fetch(`https://api.ultravox.ai/api/calls/${callId}/recording`, {
            method: 'GET',
            headers: {
                'X-API-Key': env.ULTRAVOX_API_KEY,
            },
        });

        if (!response.ok) {
            const errorData = await response.json();
            console.error('Error fetching recording:', errorData);
            return NextResponse.json({ error: errorData }, { status: response.status });
        }

        // Get the audio data as an array buffer
        const audioBuffer = await response.arrayBuffer();

        // Create a new response with the audio data
        return new NextResponse(audioBuffer, {
            status: 200,
            headers: {
                'Content-Type': 'audio/wav',
                'Content-Disposition': `attachment; filename="recording-${callId}.wav"`,
            },
        });
    } catch (error) {
        console.error('Error fetching recording:', error);
        return NextResponse.json(
            { error: 'Failed to fetch recording' },
            { status: 500 }
        );
    }
}