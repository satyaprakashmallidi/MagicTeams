import { NextResponse, NextRequest } from 'next/server';
import { supabase } from '@/lib/supabase';
import { AppointmentTool, AppointmentBooking } from '@/lib/types/appointment';

// Create a new appointment tool
export async function POST(request: NextRequest) {
  try {
    const body: Partial<AppointmentTool> = await request.json();
    
    const { data, error } = await supabase
      .from('appointment_tools')
      .insert([body])
      .select()
      .single();

    if (error) throw error;

    return NextResponse.json(data);
  } catch (error) {
    console.error('Error creating appointment tool:', error);
    return NextResponse.json(
      { error: 'Failed to create appointment tool' },
      { status: 500 }
    );
  }
}

// Get all appointment tools for a user
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const userId = searchParams.get('userId');

  if (!userId) {
    return NextResponse.json(
      { error: 'User ID is required' },
      { status: 400 }
    );
  }

  try {
    const { data, error } = await supabase
      .from('appointment_tools')
      .select('*')
      .eq('user_id', userId);

    if (error) throw error;

    return NextResponse.json(data);
  } catch (error) {
    console.error('Error fetching appointment tools:', error);
    return NextResponse.json(
      { error: 'Failed to fetch appointment tools' },
      { status: 500 }
    );
  }
}
