import { NextResponse, NextRequest } from 'next/server';
import { supabase } from '@/lib/supabase';
import { BotAppointmentConfig, AppointmentBooking } from '@/lib/types/appointment';

// Configure a bot to use an appointment tool
export async function POST(request: NextRequest) {
  try {
    const config: Partial<BotAppointmentConfig> = await request.json();
    
    const { data, error } = await supabase
      .from('bot_appointment_configs')
      .insert([config])
      .select()
      .single();

    if (error) throw error;

    return NextResponse.json(data);
  } catch (error) {
    console.error('Error configuring bot appointment:', error);
    return NextResponse.json(
      { error: 'Failed to configure bot appointment' },
      { status: 500 }
    );
  }
}

// Get appointment configuration for a bot
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
      .from('bot_appointment_configs')
      .select(`
        *,
        appointment_tools (*)
      `)
      .eq('bot_id', botId)
      .single();

    if (error) throw error;

    return NextResponse.json(data);
  } catch (error) {
    console.error('Error fetching bot appointment config:', error);
    return NextResponse.json(
      { error: 'Failed to fetch bot appointment configuration' },
      { status: 500 }
    );
  }
}

// Update bot's appointment configuration
export async function PATCH(request: NextRequest) {
  try {
    const { id, ...updates }: Partial<BotAppointmentConfig> = await request.json();
    
    if (!id) {
      return NextResponse.json(
        { error: 'Configuration ID is required' },
        { status: 400 }
      );
    }

    const { data, error } = await supabase
      .from('bot_appointment_configs')
      .update(updates)
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;

    return NextResponse.json(data);
  } catch (error) {
    console.error('Error updating bot appointment config:', error);
    return NextResponse.json(
      { error: 'Failed to update bot appointment configuration' },
      { status: 500 }
    );
  }
}
