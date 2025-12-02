import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { type CookieOptions } from '@supabase/ssr'

// Use environment variables with fallback values for whitelabel Supabase
const supabaseUrl = process.env.NEXT_WHITELABEL_SUPABASE_URL || '';
const supabaseAnonKey = process.env.NEXT_WHITELABEL_SUPABASE_ANON_KEY || '';
const supabaseServiceRoleKey = process.env.NEXT_WHITELABEL_SUPABASE_SERVICE_KEY || '';


// Validation with service role key fallback for admin operations
if (!supabaseUrl || (!supabaseAnonKey && !supabaseServiceRoleKey)) {
  throw new Error("Missing Whitelabel Supabase credentials");
}

export async function createWhitelabelClient() {
  const cookieStore = await cookies()

  return createServerClient(
    supabaseUrl,
    supabaseAnonKey,
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

// Admin client with service role key for bypassing RLS
export async function createWhitelabelAdminClient() {
  const cookieStore = await cookies()

  return createServerClient(
    supabaseUrl,
    supabaseServiceRoleKey,
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
