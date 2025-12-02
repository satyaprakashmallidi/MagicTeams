import { getAuthUrl } from '@/lib/google-calendar';

// Configure to use Node.js runtime
export const runtime = 'nodejs';

export async function GET() {
  try {
    const url = getAuthUrl();
    return new Response(JSON.stringify({ url }), {
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('Error generating auth URL:', error);
    return new Response(
      JSON.stringify({ error: 'Failed to generate auth URL' }),
      {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      }
    );
  }
}
