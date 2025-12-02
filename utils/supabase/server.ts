import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { type CookieOptions } from '@supabase/ssr'

//TODO: get from ENV

const supabaseUrl = 'https://usjdmsieclzehogkqlag.supabase.co';
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InVzamRtc2llY2x6ZWhvZ2txbGFnIiwicm9sZSI6ImFub24iLCJpYXQiOjE3MzMxMTIxOTQsImV4cCI6MjA0ODY4ODE5NH0.xZ8JFUjQ0hSprKpZLLPbe3gneRlCx5tTN_ed_5QZai0';
const supabaseServiceKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InVzamRtc2llY2x6ZWhvZ2txbGFnIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTczMzExMjE5NCwiZXhwIjoyMDQ4Njg4MTk0fQ.zMcR9bMMw4zOdV1hvwtIdCfdyNM9rmOatN2zeKgenUw';


export async function createClient() {
  const cookieStore = await cookies()

  return createServerClient(
    supabaseUrl,
    supabaseAnonKey,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll()
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            )
          } catch {
            // The `setAll` method was called from a Server Component.
            // This can be ignored if you have middleware refreshing
            // user sessions.
          }
        },
      },
    }
  )
}

// Admin client with service role key for admin operations (e.g., generating email links)
export async function createAdminClient() {
  const cookieStore = await cookies()

  return createServerClient(
    supabaseUrl,
    supabaseServiceKey, // Use service role key for admin API access
    {
      cookies: {
        getAll() {
          return cookieStore.getAll()
        },
        setAll(cookiesToSet: { name: string; value: string; options?: CookieOptions }[]) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            )
          } catch {
            // The `setAll` method was called from a Server Component.
            // This can be ignored if you have middleware refreshing
            // user sessions.
          }
        },
      },
    }
  )
}