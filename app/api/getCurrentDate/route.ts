import { NextResponse } from 'next/server';

export const runtime = 'edge';

export async function GET() {
  try {
    const now = new Date();
    
    console.log("---------------> Current Date api:", now.toISOString());
    return NextResponse.json({
      currentDate: now.toISOString(),
      formattedDate: now.toLocaleDateString('en-US', {
        weekday: 'long',
        year: 'numeric',
        month: 'long',
        day: 'numeric'
      }),
      formattedTime: now.toLocaleTimeString('en-US', {
        hour: '2-digit',
        minute: '2-digit',
        hour12: true
      }),
      unixTimestamp: Math.floor(now.getTime() / 1000),
      year: now.getFullYear(),
      month: now.getMonth() + 1, // JavaScript months are 0-indexed
      day: now.getDate(),
      dayOfWeek: now.getDay(), // 0 = Sunday, 6 = Saturday
      hour: now.getHours(),
      minute: now.getMinutes(),
      second: now.getSeconds()
    });
  } catch (error) {
    console.error('Error in getCurrentDate:', error);
    return NextResponse.json(
      { error: 'Failed to get current date' },
      { status: 500 }
    );
  }
} 