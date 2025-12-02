import { createBrowserClient } from '@supabase/ssr'

const supabaseUrl = process.env.NEXT_WHITELABEL_SUPABASE_URL || '';
const supabaseAnonKey = process.env.NEXT_WHITELABEL_SUPABASE_ANON_KEY || '';

export function createWhitelabelClient() {
  return createBrowserClient(
    supabaseUrl,
    supabaseAnonKey
  )
}