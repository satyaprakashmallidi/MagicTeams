'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'

import { createClient, createAdminClient } from '@/utils/supabase/server'
import { createWhitelabelAdminClient } from '@/utils/supabase-whitelabel/server'
import { sendVerificationEmail, sendPasswordResetEmail } from '@/lib/services/email-service'

//users-login
export async function agencyLogin(formData: FormData, agencyId: string) {
  const supabase = await createClient()
  const whitelabelSupabase = await createWhitelabelAdminClient()

  const data = {
    email: formData.get('email') as string,
    password: formData.get('password') as string,
  }

  //validating agency
  const { data: agencyData, error: agencyError } = await whitelabelSupabase
    .from('agencies')
    .select('id, agency_name')
    .eq('id', agencyId)
    .single()

  if (agencyError || !agencyData) {
    redirect('/error?message=Invalid+agency')
  }

  //jenny Supabase 
  const { error } = await supabase.auth.signInWithPassword({
    email: data.email,
    password: data.password,
  })
  
  // Update user metadata
  if (!error) {
    await supabase.auth.updateUser({
      data: {
        agency_id: agencyData.id,
        agency_name: agencyData.agency_name
      }
    })
  }

  if (error) {
    return { error: error.message || 'Invalid login credentials' }
  }

  revalidatePath('/', 'layout')
  redirect('/dashboard/aiassistant')
  
  return { success: 'Login successful' }
}


//user sign-up,
//1. validate agency, 
//2. insert user details into agency_users table (jenny-supabase)
//3. with the default values of markup, balance minutes
//4. update the agency stats (minutes, users)

export async function agencySignup(formData: FormData, agencyId: string) {
  const supabase = await createClient()
  const whitelabelSupabase = await createWhitelabelAdminClient()

  const data = {
    email: formData.get('email') as string,
    password: formData.get('password') as string,
  }
  
  // 1. Get basic agency data first
  const { data: agencyData, error: agencyError } = await whitelabelSupabase
    .from('agencies')
    .select('id, agency_name, total_users, used_minutes, total_minutes')
    .eq('id', agencyId)
    .single()

  if (agencyError || !agencyData) {
    redirect('/error?message=Invalid+agency')
  }
  
  // 2. Fetch pricing data from pricing table
  const { data: pricingData, error: pricingError } = await whitelabelSupabase
    .from('pricing')
    .select('default_min, default_markup')
    .eq('agency_id', agencyId)
    .single()
    
  if (pricingError || !pricingData) {
    console.error('Error fetching pricing data:', pricingError)
    redirect('/error?message=Pricing+information+not+available')
  }
  
  // 3. Check if agency has enough balance
  const defaultMinutes = pricingData.default_min
  const markupPerMin = pricingData.default_markup
  
  // Verify agency has enough remaining minutes
  const currentUsedMinutes = agencyData.used_minutes || 0
  const totalAgencyMinutes = agencyData.total_minutes || 0
  
  // Calculate remaining minutes
  const remainingMinutes = totalAgencyMinutes - currentUsedMinutes
  
  // Check if enough minutes are available
  if (remainingMinutes < defaultMinutes) {
    return { 
      error: 'Does not have enough balance. Please contact your administrator.'
    }
  }

  //sign-up (jenny supabase) - Use admin API to create user WITHOUT auto email
  // This prevents Supabase from sending automatic confirmation email
  const supabaseAdmin = await createAdminClient();

  const { error, data: userData } = await supabaseAdmin.auth.admin.createUser({
    email: data.email,
    password: data.password,
    email_confirm: false, // User needs to verify email first
    user_metadata: {
      agency_id: agencyData.id,
      agency_name: agencyData.agency_name
    }
  })

  if (error) {
    console.error('[SIGNUP] Error creating user:', error);
    return { error: error.message || 'Signup failed' }
  }

  // If signup is successful, add user to agency_users table
  if (userData?.user) {
    console.log("[SIGNUP] Creating new user:", userData.user.id)
    try {
      // Check if user already exists in agency_users table
      const { data: existingUser } = await supabase
        .from('agency_users')
        .select('id')
        .eq('user_id', userData.user.id)
        .eq('agency_id', agencyId)
        .maybeSingle();

      if (existingUser) {
        console.log('[SIGNUP] User already exists in agency_users table, skipping insert');
      } else {
        //insert into agency_users table with pricing data from pricing table
        const { error: insertError } = await supabase
          .from('agency_users')
          .insert({
            user_id: userData.user.id,
            agency_id: agencyId,
            email: userData.user.email,
            total_minutes: defaultMinutes,
            used_minutes: 0,
            markup_per_min: markupPerMin
          });

        if (insertError) {
          console.error('[SIGNUP] Error adding user to agency_users:', insertError);
        } else {
          // update agency stats
          const { error: updateError } = await whitelabelSupabase
            .from('agencies')
            .update({
              total_users: (agencyData.total_users) + 1,
              used_minutes: (agencyData.used_minutes) + defaultMinutes
            })
            .eq('id', agencyId);

          if (updateError) {
            console.error('[SIGNUP] Error updating agency stats:', updateError);
          }

          // 🆕 SYNC TO WHITE LABEL DB - Add user to agency_sub_users table
          // This allows agency owner to see and manage this user in their dashboard
          try {
            console.log('[SIGNUP] Syncing user to whitelabel database...');

            // Check if user already exists in agency_sub_users
            const { data: existingSubUser } = await whitelabelSupabase
              .from('agency_sub_users')
              .select('id')
              .eq('external_user_id', userData.user.id)
              .eq('agency_id', agencyId)
              .maybeSingle();

            if (existingSubUser) {
              console.log('[SIGNUP] User already synced to whitelabel, skipping');
            } else {
              // Insert into white label database (metadata only - NOT minute balances!)
              const { error: syncError } = await whitelabelSupabase
                .from('agency_sub_users')
                .insert({
                  agency_id: agencyId,
                  email: userData.user.email,
                  full_name: null, // User can update later in profile
                  phone: null,
                  company_name: null,
                  // NOTE: Do NOT store allocated_minutes/used_minutes here!
                  // Jenny DB is the source of truth for minute balances
                  status: 'active',
                  external_user_id: userData.user.id, // CRITICAL: Links to Jenny user_id
                  metadata: {
                    signup_source: 'agency_signup',
                    jenny_user_id: userData.user.id,
                    initial_allocation: defaultMinutes,
                    markup_per_min: markupPerMin
                  },
                  created_by: null, // System created
                });

              if (syncError) {
                console.error('[SIGNUP] ❌ Error syncing to whitelabel:', syncError);
                // Don't fail signup if sync fails - can be manually synced later
              } else {
                console.log('[SIGNUP] ✅ User synced to whitelabel database successfully');

                // Update agency's allocated_minutes counter
                const { error: allocateError } = await whitelabelSupabase
                  .from('agencies')
                  .update({
                    allocated_minutes: agencyData.allocated_minutes + defaultMinutes
                  })
                  .eq('id', agencyId);

                if (allocateError) {
                  console.error('[SIGNUP] Error updating allocated_minutes:', allocateError);
                }
              }
            }
          } catch (syncErr) {
            console.error('[SIGNUP] Exception during whitelabel sync:', syncErr);
            // Continue with signup flow even if sync fails
          }
        }
      }

      // Generate verification link using Supabase Admin API (reuse admin client from above)
      console.log('[SIGNUP] Generating verification link for:', data.email);
      const { data: linkData, error: linkError } = await supabaseAdmin.auth.admin.generateLink({
        type: 'signup',
        email: data.email,
        options: {
          redirectTo: `${process.env.NEXT_PUBLIC_SITE_URL}/agency/${agencyId}/verify`
        }
      });

      if (linkError) {
        console.error('[SIGNUP] Error generating verification link:', linkError);
        // Don't fail signup if email fails - user can request resend
      } else if (linkData?.properties?.action_link) {
        // Send verification email via Resend (if configured) or Supabase (fallback)
        console.log('[SIGNUP] Sending verification email via email service');
        const emailResult = await sendVerificationEmail(
          data.email,
          linkData.properties.action_link,
          agencyId
        );

        console.log('[SIGNUP] Email sent via:', emailResult.provider);
      }

    } catch (err) {
      console.error('[SIGNUP] Error in agency_users processing:', err);
    }
  }


}

//password reset with custom email service
export async function agencyPasswordReset(email: string, agencyId: string) {
  const supabase = await createClient()
  const whitelabelSupabase = await createWhitelabelAdminClient()

  try {
    // 1. Validate agency exists
    const { data: agencyData, error: agencyError } = await whitelabelSupabase
      .from('agencies')
      .select('id, agency_name')
      .eq('id', agencyId)
      .single()

    if (agencyError || !agencyData) {
      return { error: 'Invalid agency' }
    }

    // 2. Generate password reset link using Supabase Admin API
    console.log('[PASSWORD-RESET] Generating reset link for:', email);
    const supabaseAdmin = await createAdminClient(); // Use admin client with service role
    const { data: linkData, error: linkError } = await supabaseAdmin.auth.admin.generateLink({
      type: 'recovery',
      email: email,
      options: {
        redirectTo: `${process.env.NEXT_PUBLIC_SITE_URL}/agency/${agencyId}/login/update-password`
      }
    });

    if (linkError) {
      console.error('[PASSWORD-RESET] Error generating reset link:', linkError);
      return { error: 'Failed to generate password reset link' }
    }

    if (!linkData?.properties?.action_link) {
      return { error: 'Failed to generate password reset link' }
    }

    // 3. Send password reset email via Resend (if configured) or Supabase (fallback)
    console.log('[PASSWORD-RESET] Sending password reset email via email service');
    const emailResult = await sendPasswordResetEmail(
      email,
      linkData.properties.action_link,
      agencyId
    );

    console.log('[PASSWORD-RESET] Email sent via:', emailResult.provider);

    return {
      success: true,
      message: 'Password reset instructions have been sent to your email. Please check your inbox.',
      provider: emailResult.provider
    }

  } catch (err) {
    console.error('[PASSWORD-RESET] Error:', err);
    return { error: 'An error occurred while requesting password reset' }
  }
}
