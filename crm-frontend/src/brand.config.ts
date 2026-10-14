// Single white-label brand config. Env vars override defaults so one
// deployment can be rebranded without code changes.
export interface BrandModuleFlags {
  dashboard: boolean;
  crm: boolean;
  sales: boolean;
  projects: boolean;
  marketing: boolean;
  calendar: boolean;
  notifications: boolean;
}

export interface BrandConfig {
  appName: string;
  logo: string;
  favicon: string;
  primaryColor: string;
  secondaryColor: string;
  font: string;
  supportEmail: string;
  currency: string;
  locale: string;
  modules: BrandModuleFlags;
}

function env(name: string, fallback: string): string {
  const v = process.env[name];
  return v && v.trim() !== "" ? v : fallback;
}

function envFlag(name: string, fallback: boolean): boolean {
  const v = process.env[name];
  if (v === undefined || v === "") return fallback;
  return v === "1" || v.toLowerCase() === "true";
}

export const brand: BrandConfig = {
  appName: env("NEXT_PUBLIC_APP_NAME", "Your CRM"),
  logo: env("NEXT_PUBLIC_LOGO", "/logo.svg"),
  favicon: env("NEXT_PUBLIC_FAVICON", "/favicon.ico"),
  primaryColor: env("NEXT_PUBLIC_PRIMARY_COLOR", "#4f46e5"),
  secondaryColor: env("NEXT_PUBLIC_SECONDARY_COLOR", "#0ea5e9"),
  font: env("NEXT_PUBLIC_FONT", "Inter, system-ui, sans-serif"),
  supportEmail: env("NEXT_PUBLIC_SUPPORT_EMAIL", "support@example.com"),
  currency: env("NEXT_PUBLIC_CURRENCY", "USD"),
  locale: env("NEXT_PUBLIC_LOCALE", "en-US"),
  modules: {
    dashboard: envFlag("NEXT_PUBLIC_MODULE_DASHBOARD", true),
    crm: envFlag("NEXT_PUBLIC_MODULE_CRM", true),
    sales: envFlag("NEXT_PUBLIC_MODULE_SALES", true),
    projects: envFlag("NEXT_PUBLIC_MODULE_PROJECTS", true),
    marketing: envFlag("NEXT_PUBLIC_MODULE_MARKETING", true),
    calendar: envFlag("NEXT_PUBLIC_MODULE_CALENDAR", true),
    notifications: envFlag("NEXT_PUBLIC_MODULE_NOTIFICATIONS", true),
  },
};

export function brandCssVars(): Record<string, string> {
  return {
    "--brand-primary": brand.primaryColor,
    "--brand-secondary": brand.secondaryColor,
    "--brand-font": brand.font,
  };
}
