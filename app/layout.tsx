import { Toaster } from '@/components/ui/toaster';
import { ThemeProvider } from '@/components/providers/theme-provider';
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

  if (agencyName) {
    return {
      title: `${agencyName}`,
      description: 'Your AI assistant',
      icons: agencyLogoUrl ? [
        { url: agencyLogoUrl, type: 'image/png', sizes: '32x32' },
      ] : [
        { url: '/magic.png', type: 'image/png', sizes: '32x32' },
      ],
    };
  }

  return {
    title: 'Magic Teams',
    description: 'Your AI assistant',
    icons: {
      icon: [
        { url: '/magic.png', type: 'image/png', sizes: '32x32' },
      ],
    },
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

  let initialBranding = null;
  
  if (agencyId && agencyName) {
    initialBranding = {
      id: agencyId,
      agency_name: agencyName,
      logo_url: agencyLogoUrl,
      custom_domain: null
    };
  }

  return (
    <html lang="en" suppressHydrationWarning>
      <body className={`${inter.className} min-h-screen bg-background text-foreground antialiased`}>
        <BrandingProvider initialBranding={initialBranding}>
          <ThemeProvider>
            {children}
            <Toaster />
          </ThemeProvider>
        </BrandingProvider>
      </body>
    </html>
  );
}
