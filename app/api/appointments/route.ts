import { NextResponse, NextRequest } from 'next/server';
import { supabase } from '@/lib/supabase';
import { Appointment } from '@/lib/types';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { data, error } = await supabase
      .from('appointments')
      .insert([body])
      .select()
      .single();

    if (error) throw error;

    // If appointment is created, schedule a confirmation call
    if (data) {
      const callConfig = {
        phoneNumber: data.customer_phone,
        systemPrompt: `You are a friendly AI assistant confirming an appointment. The appointment is scheduled for ${new Date(data.date).toLocaleDateString()} at ${data.time}. Ask if this time works for them and update the appointment status accordingly.`,
        // Add any other necessary configuration
      };

      // Make the confirmation call using Ultravox
      const ultravoxResponse = await fetch('/api/ultravox', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(callConfig),
      });

      if (!ultravoxResponse.ok) {
        console.error('Failed to schedule confirmation call');
      }
    }

    return NextResponse.json(data);
  } catch (error) {
    console.error('Error in API route:', error);
    return NextResponse.json(
      { error: 'Failed to create appointment' },
      { status: 500 }
    );
  }
}

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const botId = searchParams.get('botId');

  if (!botId) {
    return NextResponse.json(
      { error: 'Bot ID is required' },
      { status: 400 }
    );
  }

  try {
    const { data, error } = await supabase
      .from('appointments')
      .select('*')
      .eq('bot_id', botId)
      .order('date', { ascending: true });

    if (error) throw error;

    return NextResponse.json(data);
  } catch (error) {
    console.error('Error in API route:', error);
    return NextResponse.json(
      { error: 'Failed to fetch appointments' },
      { status: 500 }
    );
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const body = await request.json();
    const { id, status } = body;

    const { data, error } = await supabase
      .from('appointments')
      .update({ status })
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;

    return NextResponse.json(data);
  } catch (error) {
    console.error('Error in API route:', error);
    return NextResponse.json(
      { error: 'Failed to update appointment' },
      { status: 500 }
    );
  }
}
