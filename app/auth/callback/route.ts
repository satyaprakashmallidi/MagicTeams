import { createClient } from '@/utils/supabase/server'
import { NextResponse } from 'next/server'

export async function GET(request: Request) {
  const requestUrl = new URL(request.url)
  const code = requestUrl.searchParams.get('code')
  const origin = requestUrl.origin

  if (code) {
    const supabase = await createClient()
    const { error, data } = await supabase.auth.exchangeCodeForSession(code)

    if (!error && data.user) {
      const userEmail = data.user.email

      // First, check if this specific user_id has pricing
      const { data: existingPricingByUserId } = await supabase
        .from('pricing')
        .select('*')
        .eq('user_id', data.user.id)
        .single()

      // If this user_id doesn't have pricing, check if email exists with different user_id
      if (!existingPricingByUserId && userEmail) {
        // Check all auth users with this email to find existing pricing
        const { data: { users } } = await supabase.auth.admin.listUsers()
        const usersWithEmail = users?.filter(u => u.email === userEmail && u.id !== data.user.id)

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
            user_id: data.user.id,
            is_twilio_allowed: existingPricingByEmail.is_twilio_allowed,
            time_rem: existingPricingByEmail.time_rem,
            cost: existingPricingByEmail.cost
          })
        } else {
          // Truly new user - create default pricing
          await supabase.from('pricing').insert({
            user_id: data.user.id,
            is_twilio_allowed: true,
            time_rem: 600,
            cost: 15
          })
        }
      }
    }
  }

  // URL to redirect to after sign in process completes
  return NextResponse.redirect(`${origin}/dashboard/aiassistant`)
}
