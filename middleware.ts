import { type NextRequest, NextResponse } from 'next/server'
import { updateSession } from '@/utils/supabase/middleware'
import { createClient } from '@supabase/supabase-js'
import { getAgencyBranding, getAgencyBrandingByDomain } from '@/lib/branding'

// Default domains that should not trigger custom domain lookup
const DEFAULT_DOMAINS = [
  'app.magicteams.ai',
  'localhost',
  '127.0.0.1'
];

// Function to create Supabase client for whitelabel database
function getWhitelabelSupabase() {
  const url = process.env.NEXT_WHITELABEL_SUPABASE_URL;
  const serviceKey = process.env.NEXT_WHITELABEL_SUPABASE_SERVICE_KEY;

  if (!url || !serviceKey) {
    console.error('Whitelabel Supabase environment variables not configured');
    return null;
  }

  return createClient(url, serviceKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false
    }
  });
}

async function checkCustomDomain(hostname: string): Promise<{ agency_id?: string; agency_name?: string } | null> {
  try {
    const whitelabelSupabase = getWhitelabelSupabase();

    if (!whitelabelSupabase) {
      console.error('Unable to create whitelabel Supabase client');
      return null;
    }

    // Normalize hostname
    const normalizedHostname = hostname.toLowerCase()
      .replace(/^www\./, '')
      .trim();
    console.log('🔎 Checking domain in database:', normalizedHostname)

    // First, let's check if the domain exists at all (for debugging)
    const { data: checkDomain, error: checkError } = await whitelabelSupabase
      .from('agency_domain')
      .select('*')
      .eq('domain', normalizedHostname);

    console.log('📊 Domain check result:', {
      found: checkDomain?.length || 0,
      data: checkDomain,
      error: checkError
    });

    // Query the agency_domain table directly
    const { data: domainRecord, error } = await whitelabelSupabase
      .from('agency_domain')
      .select(`
        *,
        agencies!inner(id, agency_name)
      `)
      .eq('domain', normalizedHostname)
      .eq('verification_status', 'verified')
      .single();

    if (error) {
      console.log('❌ Database error:', {
        message: error.message,
        details: error.details,
        hint: error.hint,
        code: error.code
      });
      return null;
    }

    if (!domainRecord) {
      console.log('❌ Domain not found or not verified for:', normalizedHostname);
      return null;
    }

    console.log('✅ Domain found:', {
      domain: domainRecord.domain,
      agency_id: domainRecord.agencies.id,
      agency_name: domainRecord.agencies.agency_name,
      verification_status: domainRecord.verification_status
    });

    return {
      agency_id: domainRecord.agencies.id,
      agency_name: domainRecord.agencies.agency_name
    };
  } catch (error) {
    console.error('❌ Unexpected error checking custom domain:', error);
    return null;
  }
}

async function getAgencyInfoForRequest(request: NextRequest): Promise<{ agency_id?: string; agency_name?: string; logo_url?: string | null; theme_id?: string | null; website_title?: string | null } | null> {
  const pathname = request.nextUrl.pathname;
  const hostname = request.nextUrl.hostname;

  // Check if this is an agency route
  const agencyMatch = pathname.match(/^\/agency\/([^\/]+)/);
  if (agencyMatch) {
    const agencyId = agencyMatch[1];
    console.log('🔍 Agency route detected, fetching agency info for:', agencyId);

    const branding = await getAgencyBranding(agencyId);
    if (branding) {
      return {
        agency_id: branding.id,
        agency_name: branding.agency_name,
        logo_url: branding.logo_url || null,
        theme_id: branding.theme_id || null,
        website_title: branding.website_title || null
      };
    }
  }

  // Check if this is a custom domain
  const isCustomDomain = !DEFAULT_DOMAINS.some(defaultDomain =>
    hostname.includes(defaultDomain)
  );

  if (isCustomDomain) {
    console.log('🔍 Custom domain detected:', hostname);
    const branding = await getAgencyBrandingByDomain(hostname);
    if (branding) {
      return {
        agency_id: branding.id,
        agency_name: branding.agency_name,
        logo_url: branding.logo_url || null,
        theme_id: branding.theme_id || null,
        website_title: branding.website_title || null
      };
    }
  }

  return null;
}

export async function middleware(request: NextRequest) {
  // Log the visited URL
  console.log('🌐 Middleware - URL visited:', request.nextUrl.toString());

  // Exclude API routes from session middleware
  if (request.nextUrl.pathname.startsWith('/api')) {
    return NextResponse.next();
  }

  // Get agency information for branding
  const agencyInfo = await getAgencyInfoForRequest(request);

  // Get the hostname from the request
  const hostname = request.nextUrl.hostname;

  // Check if this is a custom domain (not one of our default domains)
  const isCustomDomain = !DEFAULT_DOMAINS.some(defaultDomain =>
    hostname.includes(defaultDomain)
  );

  let response: NextResponse;

  if (isCustomDomain) {
    console.log('🔍 Custom domain detected:', hostname);

    // Check if this custom domain is registered and verified
    const domainInfo = await checkCustomDomain(hostname);

    if (domainInfo?.agency_id) {
      console.log('✅ Verified custom domain for agency:', domainInfo.agency_id);

      // Rewrite the URL internally to route to /agency/[agencyId] without changing the visible URL
      const rewriteUrl = new URL(request.nextUrl);

      // If the path is root or doesn't start with /agency, prepend /agency/[agencyId]
      if (request.nextUrl.pathname === '/' || request.nextUrl.pathname === '/login') {
        // For root or login route → go to agency login page
        rewriteUrl.pathname = `/agency/${domainInfo.agency_id}/login`;
      } else {
        // For all other routes → go to global app routes
        rewriteUrl.pathname = request.nextUrl.pathname;
      }

      console.log('🔄 Internally routing to:', rewriteUrl.pathname);

      // Use NextResponse.rewrite to keep the custom domain in the URL bar
      response = NextResponse.rewrite(rewriteUrl);
    } else {
      console.log('❌ Custom domain not verified or not found:', hostname);
      response = NextResponse.next();
    }
  } else {
    response = await updateSession(request);
  }

  // Add agency information to headers if available
  if (agencyInfo) {
    response.headers.set('x-agency-id', agencyInfo.agency_id || '');
    response.headers.set('x-agency-name', agencyInfo.agency_name || '');
    response.headers.set('x-agency-logo-url', agencyInfo.logo_url || '');
    response.headers.set('x-agency-theme-id', agencyInfo.theme_id || '');
    response.headers.set('x-agency-website-title', agencyInfo.website_title || '');
  }

  return response;
}

export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * Feel free to modify this pattern to include more paths.
     */
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
}