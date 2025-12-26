import { Toaster } from '@/components/ui/toaster';
import { ThemeProvider } from '@/components/providers/theme-provider';
import { AgencyThemeProvider } from '@/components/providers/agency-theme-provider';
import { BrandingProvider } from '@/contexts/branding-context';
import './globals.css';
import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import { headers } from 'next/headers';

const inter = Inter({ subsets: ['latin'] });

// Dynamic metadata function to handle agency branding
export async function generateMetadata(): Promise<Metadata> {
  const headersList = headers();
  const agencyName = headersList.get('x-agency-name');
  const agencyLogoUrl = headersList.get('x-agency-logo-url');
  const websiteTitle = headersList.get('x-agency-website-title');

  if (agencyName) {
    // Use website_title if set, otherwise fall back to agency_name
    const title = websiteTitle || agencyName;
    return {
      title: `${title}`,
      description: 'Your AI assistant',
      icons: agencyLogoUrl ? [
        { url: agencyLogoUrl, type: 'image/png', sizes: '32x32' },
      ] : [
        { url: '/magic.png', type: 'image/png', sizes: '32x32' },
      ],
    };
  }

  // Return empty defaults - the blocking script will apply cached values
  // This prevents flash of "Magic Teams"
  return {
    title: '',
    description: 'Your AI assistant',
  };
}

export default async function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const headersList = headers();
  const agencyId = headersList.get('x-agency-id');
  const agencyName = headersList.get('x-agency-name');
  const agencyLogoUrl = headersList.get('x-agency-logo-url');
  const agencyThemeId = headersList.get('x-agency-theme-id');
  const websiteTitle = headersList.get('x-agency-website-title');

  let initialBranding = null;

  if (agencyId && agencyName) {
    initialBranding = {
      id: agencyId,
      agency_name: agencyName,
      logo_url: agencyLogoUrl,
      custom_domain: null,
      theme_id: agencyThemeId,
      website_title: websiteTitle
    };
  }

  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        {/* Hide body until theme is applied to prevent flash */}
        <style dangerouslySetInnerHTML={{ __html: `body { opacity: 0; transition: opacity 0.1s; }` }} />
        {/* Blocking script to apply cached title, favicon, and theme BEFORE React hydration */}
        <script
          dangerouslySetInnerHTML={{
            __html: `
              (function() {
                try {
                  var cachedTitle = localStorage.getItem('agency-website-title');
                  if (cachedTitle) {
                    document.title = cachedTitle;
                  }
                  
                  var cachedFavicon = localStorage.getItem('agency-favicon-url');
                  if (cachedFavicon) {
                    var link = document.querySelector("link[rel~='icon']");
                    if (link) {
                      link.href = cachedFavicon;
                    } else {
                      link = document.createElement('link');
                      link.rel = 'icon';
                      link.href = cachedFavicon;
                      document.head.appendChild(link);
                    }
                  }
                  
                  // Apply cached theme (always light mode - dark not supported)
                  var cachedTheme = localStorage.getItem('agency-theme-cache');
                  if (cachedTheme) {
                    var themeData = JSON.parse(cachedTheme);
                    var vars = themeData.light; // Always use light theme
                    if (vars) {
                      var root = document.documentElement;
                      for (var key in vars) {
                        root.style.setProperty(key, vars[key]);
                      }
                    }
                  }
                } catch(e) {}
                
                // Show body after theme is applied
                document.addEventListener('DOMContentLoaded', function() {
                  document.body.style.opacity = '1';
                });
                // Fallback - show body after short delay in case DOMContentLoaded already fired
                setTimeout(function() {
                  if (document.body) document.body.style.opacity = '1';
                }, 50);
              })();
            `,
          }}
        />
      </head>
      <body className={`${inter.className} min-h-screen bg-background text-foreground antialiased`}>
        <BrandingProvider initialBranding={initialBranding}>
          <ThemeProvider>
            <AgencyThemeProvider themeId={agencyThemeId}>
              {children}
              <Toaster />
            </AgencyThemeProvider>
          </ThemeProvider>
        </BrandingProvider>
      </body>
    </html>
  );
}
