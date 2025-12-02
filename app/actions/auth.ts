'use server';

import { cookies } from 'next/headers';
import { createServerActionClient } from '@supabase/auth-helpers-nextjs';

export async function signOut() {
  const supabase = createServerActionClient({ cookies });
  const { error } = await supabase.auth.signOut();
  return { error };
}
