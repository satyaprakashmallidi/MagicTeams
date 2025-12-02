'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'

import { createClient } from '@/utils/supabase/server'

export async function login(formData: FormData) {
  const supabase = await createClient()

  const data = {
    email: formData.get('email') as string,
    password: formData.get('password') as string,
  }

  const { error } = await supabase.auth.signInWithPassword(data)

  if (error) {
    return { error: error.message }
  }

  revalidatePath('/', 'layout')
  redirect('/dashboard/aiassistant')
}

export async function signup(formData: FormData) {
  const supabase = await createClient()

  // type-casting here for convenience
  // in practice, you should validate your inputs
  const data = {
    email: formData.get('email') as string,
    password: formData.get('password') as string,
  }

  const { error, data: signUpdata } = await supabase.auth.signUp({
    ...data,
    options: {
      emailRedirectTo: `${process.env.NEXT_PUBLIC_SITE_URL}/login`,
    }
  })

  if (error) {
    return { error: error.message }
  }

  if (signUpdata.user?.id) {
    const userEmail = signUpdata.user.email

    // Check if this specific user_id has pricing
    const { data: existingPricingByUserId } = await supabase
      .from('pricing')
      .select('*')
      .eq('user_id', signUpdata.user.id)
      .single()

    // If this user_id doesn't have pricing, check if email exists with different user_id (e.g., Google account)
    if (!existingPricingByUserId && userEmail) {
      // Check all auth users with this email to find existing pricing
      const { data: { users } } = await supabase.auth.admin.listUsers()
      const usersWithEmail = users?.filter(u => u.email === userEmail && u.id !== signUpdata.user.id)

      let existingPricingByEmail = null

      // Check if any other user with same email has pricing
      if (usersWithEmail && usersWithEmail.length > 0) {
        for (const user of usersWithEmail) {
          const { data: pricing } = await supabase
            .from('pricing')
            .select('*')
            .eq('user_id', user.id)
            .single()

          if (pricing) {
            existingPricingByEmail = pricing
            break
          }
        }
      }

      // If existing pricing found for same email (different auth method), link them
      if (existingPricingByEmail) {
        // Create pricing for this user_id with SAME values (linked accounts)
        await supabase.from('pricing').insert({
          user_id: signUpdata.user.id,
          is_twilio_allowed: existingPricingByEmail.is_twilio_allowed,
          time_rem: existingPricingByEmail.time_rem,
          cost: existingPricingByEmail.cost
        })
      } else {
        // Truly new user - create default pricing
        await supabase.from('pricing').insert({
          user_id: signUpdata.user.id,
          is_twilio_allowed: true,
          time_rem: 600,
          cost: 15
        })
      }
    }
  }

  return { success: 'Registration successful! Please check your email for verification.' }
}

export async function signInWithGoogle() {
  const supabase = await createClient()

  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: 'google',
    options: {
      redirectTo: `${process.env.NEXT_PUBLIC_SITE_URL}/auth/callback`,
      queryParams: {
        access_type: 'offline',
        prompt: 'consent',
      },
    }
  })
  

  if (error) {
    return { error: error.message }
  }

  if (data.url) {
    redirect(data.url) // Redirect to Google OAuth
  }
}