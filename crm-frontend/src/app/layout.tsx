import './globals.css';
import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import { brand, brandCssVars } from '@/brand.config';
import { AuthProvider } from '@/lib/firebase/auth-context';
import { ThemeProvider } from '@/components/theme-provider';
import { Toaster } from '@/components/ui/sonner';

import { WorkspaceProvider } from '@/lib/settings/workspace-context';

const inter = Inter({ subsets: ['latin'] });

export const metadata: Metadata = {
  title: brand.appName,
  description: `${brand.appName} — field-force CRM for visits, deliveries and revenue`,
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
              {children}
              <Toaster />
            </WorkspaceProvider>
          </AuthProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
