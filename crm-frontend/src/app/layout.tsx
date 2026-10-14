import type { Metadata } from "next";
import { ThemeProvider } from "next-themes";
import { brand, brandCssVars } from "@/brand.config";
import { AuthProvider } from "@/lib/auth-context";
import "./globals.css";

export const metadata: Metadata = {
  title: brand.appName,
  description: `${brand.appName} — white-labelled CRM`,
  icons: { icon: brand.favicon },
};

export default function RootLayout({ children }: { children: React.ReactNode }): JSX.Element {
  const vars = brandCssVars();
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <style>{`:root{--brand-primary:${vars["--brand-primary"]};--brand-secondary:${vars["--brand-secondary"]};--brand-font:${vars["--brand-font"]};}`}</style>
      </head>
      <body className="bg-background text-foreground antialiased">
        <ThemeProvider attribute="class" defaultTheme="system" enableSystem>
          <AuthProvider>{children}</AuthProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
