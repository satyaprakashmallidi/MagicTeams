import { NextResponse } from 'next/server';

// In-memory storage for conversation state
const conversationStates = new Map<string, any>();

export async function POST(req: Request) {
  try {
    const { action, data } = await req.json();
    const callId = req.headers.get('x-call-id');

    if (!callId) {
      return NextResponse.json({ error: 'Call ID is required' }, { status: 400 });
    }

    switch (action) {
      case 'get':
        const state = conversationStates.get(callId) || {};
        return NextResponse.json({ state });

      case 'update':
        const currentState = conversationStates.get(callId) || {};
        const newState = {
          ...currentState,
          ...data,
          confirmedFields: [
            ...(currentState.confirmedFields || []),
            ...(data.confirmedFields || [])
          ].filter((value, index, self) => self.indexOf(value) === index) // Remove duplicates
        };
        conversationStates.set(callId, newState);
        return NextResponse.json({ state: newState });

      case 'clear':
        conversationStates.delete(callId);
        return NextResponse.json({ success: true });

      default:
        return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
    }
  } catch (error) {
    console.error('Error managing conversation state:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
} 