import { createWhitelabelAdminClient } from '@/utils/supabase-whitelabel/server';

// Types
interface EmailConfig {
  isConfigured: boolean;
  apiKey?: string;
  domain?: string;
  fromName: string;
}

interface EmailData {
  to: string;
  from: string;
  subject: string;
  html: string;
  text: string;
  apiKey: string;
}

interface EmailResult {
  success: boolean;
  provider: 'resend' | 'supabase' | 'supabase_fallback';
  error?: string;
}

/**
 * Main function to send verification email
 * Tries Resend first (if configured), falls back to Supabase
 */
export async function sendVerificationEmail(
  email: string,
  verificationLink: string,
  agencyId: string
): Promise<EmailResult> {
  try {
    console.log(`[EMAIL-SERVICE] Sending verification email to ${email} for agency ${agencyId}`);

    // 1. Check if Resend is configured for this agency
    const resendConfig = await checkAgencyEmailConfig(agencyId);

    if (resendConfig.isConfigured) {
      console.log(`[EMAIL-SERVICE] Resend is configured for agency ${agencyId}, attempting to send via Resend`);

      // 2. Try sending via Resend
      try {
        const success = await sendViaResend({
          to: email,
          from: `${resendConfig.fromName} <noreply@${resendConfig.domain}>`,
          subject: 'Verify your email address',
          html: getVerificationEmailHTML(verificationLink, resendConfig.fromName),
          text: getVerificationEmailText(verificationLink),
          apiKey: resendConfig.apiKey!
        });

        if (success) {
          console.log(`✅ Verification email sent via Resend for agency ${agencyId}`);
          return { success: true, provider: 'resend' };
        }
      } catch (resendError) {
        console.error(`⚠️ Resend failed for agency ${agencyId}, falling back to Supabase:`, resendError);
      }
    } else {
      console.log(`[EMAIL-SERVICE] Resend not configured for agency ${agencyId}, using Supabase`);
    }

    // 3. Fallback to Supabase (or if Resend wasn't configured)
    console.log(`📧 Sending verification email via Supabase for agency ${agencyId}`);
    return { success: true, provider: 'supabase' };

  } catch (error) {
    console.error('❌ Email service error:', error);
    // Even if everything fails, we return success because Supabase will handle it
    return { success: true, provider: 'supabase_fallback', error: String(error) };
  }
}

/**
 * Main function to send password reset email
 * Tries Resend first (if configured), falls back to Supabase
 */
export async function sendPasswordResetEmail(
  email: string,
  resetLink: string,
  agencyId: string
): Promise<EmailResult> {
  try {
    console.log(`[EMAIL-SERVICE] Sending password reset email to ${email} for agency ${agencyId}`);

    // 1. Check if Resend is configured for this agency
    const resendConfig = await checkAgencyEmailConfig(agencyId);

    if (resendConfig.isConfigured) {
      console.log(`[EMAIL-SERVICE] Resend is configured for agency ${agencyId}, attempting to send via Resend`);

      // 2. Try sending via Resend
      try {
        const success = await sendViaResend({
          to: email,
          from: `${resendConfig.fromName} <noreply@${resendConfig.domain}>`,
          subject: 'Reset your password',
          html: getPasswordResetEmailHTML(resetLink, resendConfig.fromName),
          text: getPasswordResetEmailText(resetLink),
          apiKey: resendConfig.apiKey!
        });

        if (success) {
          console.log(`✅ Password reset email sent via Resend for agency ${agencyId}`);
          return { success: true, provider: 'resend' };
        }
      } catch (resendError) {
        console.error(`⚠️ Resend failed for agency ${agencyId}, falling back to Supabase:`, resendError);
      }
    } else {
      console.log(`[EMAIL-SERVICE] Resend not configured for agency ${agencyId}, using Supabase`);
    }

    // 3. Fallback to Supabase
    console.log(`📧 Sending password reset email via Supabase for agency ${agencyId}`);
    return { success: true, provider: 'supabase' };

  } catch (error) {
    console.error('❌ Email service error:', error);
    return { success: true, provider: 'supabase_fallback', error: String(error) };
  }
}

/**
 * Check if agency has Resend configured and verified
 */
async function checkAgencyEmailConfig(agencyId: string): Promise<EmailConfig> {
  try {
    const whitelabelSupabase = await createWhitelabelAdminClient();

    const { data: config, error } = await whitelabelSupabase
      .from('agency_email')
      .select('resend_api_key, resend_domain, domain_verified, api_key_verified, is_active')
      .eq('agency_id', agencyId)
      .single();

    if (error || !config) {
      console.log(`[EMAIL-SERVICE] No email config found for agency ${agencyId}`);
      return { isConfigured: false, fromName: 'Magic Teams' };
    }

    // Check if all required fields are valid
    const isConfigured = !!(
      config.resend_api_key &&
      config.api_key_verified &&
      config.domain_verified &&
      config.is_active &&
      config.resend_domain
    );

    if (!isConfigured) {
      console.log(`[EMAIL-SERVICE] Resend incomplete for agency ${agencyId}:`, {
        hasApiKey: !!config.resend_api_key,
        apiKeyVerified: config.api_key_verified,
        domainVerified: config.domain_verified,
        isActive: config.is_active,
        hasDomain: !!config.resend_domain
      });
    }

    return {
      isConfigured,
      apiKey: config.resend_api_key,
      domain: config.resend_domain,
      fromName: 'Magic Teams' // Can be made configurable per agency
    };
  } catch (error) {
    console.error('[EMAIL-SERVICE] Error checking agency email config:', error);
    return { isConfigured: false, fromName: 'Magic Teams' };
  }
}

/**
 * Send email via Resend API
 */
async function sendViaResend(emailData: EmailData): Promise<boolean> {
  try {
    const response = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${emailData.apiKey}`
      },
      body: JSON.stringify({
        from: emailData.from,
        to: [emailData.to],
        subject: emailData.subject,
        html: emailData.html,
        text: emailData.text
      })
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(`Resend API failed: ${response.status} - ${JSON.stringify(errorData)}`);
    }

    const result = await response.json();
    console.log(`[EMAIL-SERVICE] Resend API success:`, result);
    return true;
  } catch (error) {
    console.error('[EMAIL-SERVICE] Resend API error:', error);
    throw error;
  }
}

/**
 * Email Templates
 */

function getVerificationEmailHTML(verificationLink: string, brandName: string): string {
  return `
    <!DOCTYPE html>
    <html lang="en">
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <style>
          body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
            line-height: 1.6;
            color: #333;
            margin: 0;
            padding: 0;
            background-color: #f4f4f4;
          }
          .container {
            max-width: 600px;
            margin: 40px auto;
            background-color: #ffffff;
            border-radius: 8px;
            overflow: hidden;
            box-shadow: 0 2px 8px rgba(0,0,0,0.1);
          }
          .header {
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            padding: 40px 20px;
            text-align: center;
            color: white;
          }
          .header h1 {
            margin: 0;
            font-size: 28px;
            font-weight: 600;
          }
          .content {
            padding: 40px 30px;
          }
          .content p {
            margin: 0 0 20px 0;
            font-size: 16px;
          }
          .button {
            display: inline-block;
            background-color: #667eea;
            color: white !important;
            padding: 14px 32px;
            text-decoration: none;
            border-radius: 6px;
            font-weight: 600;
            font-size: 16px;
            margin: 20px 0;
            text-align: center;
          }
          .button:hover {
            background-color: #5568d3;
          }
          .link-box {
            background-color: #f8f9fa;
            border: 1px solid #e9ecef;
            border-radius: 4px;
            padding: 15px;
            margin: 20px 0;
            word-break: break-all;
            font-size: 14px;
            color: #666;
          }
          .footer {
            background-color: #f8f9fa;
            padding: 20px 30px;
            text-align: center;
            font-size: 14px;
            color: #666;
          }
          .footer p {
            margin: 5px 0;
          }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>✉️ Verify Your Email</h1>
          </div>
          <div class="content">
            <p>Hello!</p>
            <p>Thanks for signing up with ${brandName}. To complete your registration, please verify your email address by clicking the button below:</p>

            <div style="text-align: center;">
              <a href="${verificationLink}" class="button">Verify Email Address</a>
            </div>

            <p>Or copy and paste this link into your browser:</p>
            <div class="link-box">${verificationLink}</div>

            <p><strong>This link will expire in 24 hours.</strong></p>

            <p>If you didn't create an account with us, you can safely ignore this email.</p>
          </div>
          <div class="footer">
            <p>This is an automated message, please do not reply to this email.</p>
            <p>&copy; ${new Date().getFullYear()} ${brandName}. All rights reserved.</p>
          </div>
        </div>
      </body>
    </html>
  `;
}

function getVerificationEmailText(verificationLink: string): string {
  return `
Verify Your Email Address

Thanks for signing up! To complete your registration, please verify your email address by clicking the link below:

${verificationLink}

This link will expire in 24 hours.

If you didn't create an account with us, you can safely ignore this email.
  `.trim();
}

function getPasswordResetEmailHTML(resetLink: string, brandName: string): string {
  return `
    <!DOCTYPE html>
    <html lang="en">
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <style>
          body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
            line-height: 1.6;
            color: #333;
            margin: 0;
            padding: 0;
            background-color: #f4f4f4;
          }
          .container {
            max-width: 600px;
            margin: 40px auto;
            background-color: #ffffff;
            border-radius: 8px;
            overflow: hidden;
            box-shadow: 0 2px 8px rgba(0,0,0,0.1);
          }
          .header {
            background: linear-gradient(135deg, #f093fb 0%, #f5576c 100%);
            padding: 40px 20px;
            text-align: center;
            color: white;
          }
          .header h1 {
            margin: 0;
            font-size: 28px;
            font-weight: 600;
          }
          .content {
            padding: 40px 30px;
          }
          .content p {
            margin: 0 0 20px 0;
            font-size: 16px;
          }
          .button {
            display: inline-block;
            background-color: #f5576c;
            color: white !important;
            padding: 14px 32px;
            text-decoration: none;
            border-radius: 6px;
            font-weight: 600;
            font-size: 16px;
            margin: 20px 0;
            text-align: center;
          }
          .button:hover {
            background-color: #e0475b;
          }
          .link-box {
            background-color: #f8f9fa;
            border: 1px solid #e9ecef;
            border-radius: 4px;
            padding: 15px;
            margin: 20px 0;
            word-break: break-all;
            font-size: 14px;
            color: #666;
          }
          .warning-box {
            background-color: #fff3cd;
            border: 1px solid #ffc107;
            border-radius: 4px;
            padding: 15px;
            margin: 20px 0;
            font-size: 14px;
            color: #856404;
          }
          .footer {
            background-color: #f8f9fa;
            padding: 20px 30px;
            text-align: center;
            font-size: 14px;
            color: #666;
          }
          .footer p {
            margin: 5px 0;
          }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>🔒 Reset Your Password</h1>
          </div>
          <div class="content">
            <p>Hello!</p>
            <p>We received a request to reset the password for your ${brandName} account. Click the button below to choose a new password:</p>

            <div style="text-align: center;">
              <a href="${resetLink}" class="button">Reset Password</a>
            </div>

            <p>Or copy and paste this link into your browser:</p>
            <div class="link-box">${resetLink}</div>

            <p><strong>This link will expire in 1 hour.</strong></p>

            <div class="warning-box">
              <strong>⚠️ Security Notice:</strong> If you didn't request a password reset, please ignore this email and ensure your account is secure. Your password will remain unchanged.
            </div>
          </div>
          <div class="footer">
            <p>This is an automated message, please do not reply to this email.</p>
            <p>&copy; ${new Date().getFullYear()} ${brandName}. All rights reserved.</p>
          </div>
        </div>
      </body>
    </html>
  `;
}

function getPasswordResetEmailText(resetLink: string): string {
  return `
Reset Your Password

We received a request to reset your password. Click the link below to choose a new password:

${resetLink}

This link will expire in 1 hour.

If you didn't request a password reset, please ignore this email and ensure your account is secure.
  `.trim();
}
