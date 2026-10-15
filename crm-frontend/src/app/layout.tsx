import './globals.css';
import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import { brand, brandCssVars } from '@/brand.config';
import { AuthProvider } from '@/lib/firebase/auth-context';
import { ThemeProvider } from '@/components/theme-provider';
import { WorkspaceProvider } from '@/lib/settings/workspace-context';
import { EventBridgeProvider } from '@/components/providers/event-bridge-provider';
import { Toaster } from '@/components/ui/sonner';

const inter = Inter({ subsets: ['latin'] });

export const metadata: Metadata = {
  title: brand.appName,
  description: `${brand.appName} — white-labelled CRM for leads, sales, projects and marketing`,
  icons: { icon: brand.favicon },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const vars = brandCssVars();
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <style>{`:root{--brand-primary:${vars['--brand-primary']};--brand-secondary:${vars['--brand-secondary']};--brand-font:${vars['--brand-font']};}`}</style>
      </head>
      <body className={inter.className}>
        <ThemeProvider
          attribute="class"
          defaultTheme="system"
          enableSystem
          disableTransitionOnChange
        >
          <AuthProvider>
            <WorkspaceProvider>
              <EventBridgeProvider>
                {children}
              </EventBridgeProvider>
              <Toaster />
            </WorkspaceProvider>
          </AuthProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
