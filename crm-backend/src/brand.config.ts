// Backend brand config — same keys as frontend, read from server env.
// No NEXT_PUBLIC_* here; secrets never leak through this file.
export interface BackendBrand {
  appName: string;
  logo: string;
  primaryColor: string;
  secondaryColor: string;
  supportEmail: string;
  currency: string;
  locale: string;
  mailFromName: string;
}

function env(name: string, fallback: string): string {
  const v = process.env[name];
  return v && v.trim() !== "" ? v : fallback;
}

export const brand: BackendBrand = {
  appName: env("APP_NAME", env("MAIL_FROM_NAME", "Your CRM")),
  logo: env("APP_LOGO_URL", "/logo.svg"),
  primaryColor: env("PRIMARY_COLOR", "#4f46e5"),
  secondaryColor: env("SECONDARY_COLOR", "#0ea5e9"),
  supportEmail: env("SUPPORT_EMAIL", "support@example.com"),
  currency: env("CURRENCY", "USD"),
  locale: env("LOCALE", "en-US"),
  mailFromName: env("MAIL_FROM_NAME", "Your CRM"),
};
