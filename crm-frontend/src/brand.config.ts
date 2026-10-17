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
  /** True when the logo art is white (inverts in light mode). */
  logoWhiteArt: boolean;
  /** True when the logo art is black (inverts in dark mode). Colored art needs neither. */
  logoBlackArt: boolean;
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
  logo: env("NEXT_PUBLIC_LOGO", "/logo.png"),
  favicon: env("NEXT_PUBLIC_FAVICON", "/logo.png"),
  logoWhiteArt: envFlag("NEXT_PUBLIC_LOGO_WHITE", false),
  logoBlackArt: envFlag("NEXT_PUBLIC_LOGO_BLACK", false),
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

/** Tailwind filter classes keeping monochrome logo art visible in both themes. */
export function logoFilterClass(): string {
  if (brand.logoWhiteArt) return "invert dark:invert-0";
  if (brand.logoBlackArt) return "dark:invert";
  return "";
}
