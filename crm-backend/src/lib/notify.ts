import { db } from "./admin";
import { sendMail, brandedEmail } from "./mailer";
import { logAutomation } from "./log";

export type NotifyType =
  | "lead_assigned" | "lead_won" | "followup_due" | "followup_overdue"
  | "quotation_accepted" | "quotation_rejected" | "invoice_created" | "invoice_overdue"
  | "payment_received" | "task_assigned" | "task_due_soon" | "digest";

interface NotifyInput {
  orgId: string;
  uid: string;
  type: NotifyType;
  title: string;
  body: string;
  link?: string;
  email?: string;
}

interface Prefs {
  emailEnabled?: boolean;
  inAppEnabled?: boolean;
  mutedTypes?: NotifyType[];
}

/** Map automation event types onto the frontend header's notification kinds. */
function toHeaderKind(type: NotifyType): "project" | "payment" | "support" | "meeting" | "system" {
  if (type === "payment_received" || type === "invoice_created" || type === "invoice_overdue") return "payment";
  if (type === "digest") return "system";
  return "project";
}

/**
 * Writes the in-app notification AND sends the email, honouring per-user prefs.
 * - At most one email per user per event (caller dedupes via idempotency keys).
 * - If email fails: in-app notification still created, failure logged to automationsLog.
 * - Never throws for email failure; never crashes the main automation.
 */
export async function notify(input: NotifyInput): Promise<{ inApp: boolean; emailSent: boolean; emailError?: string }> {
  const database = db();
  const prefsSnap = await database.ref(`/orgs/${input.orgId}/users/${input.uid}/notificationPrefs`).get();
  const prefs = (prefsSnap.val() ?? {}) as Prefs;
  const emailEnabled = prefs.emailEnabled !== false;
  const inAppEnabled = prefs.inAppEnabled !== false;
  const muted = new Set(prefs.mutedTypes ?? []);
  if (muted.has(input.type)) return { inApp: false, emailSent: false };

  let inApp = false;
  if (inAppEnabled) {
    // Flat shape read by the app header bell: orgs/{orgId}/notifications/{pushId}
    // with user_id + message fields.
    const ref = database.ref(`/orgs/${input.orgId}/notifications`).push();
    await ref.set({
      id: ref.key,
      user_id: input.uid,
      workspace_id: input.orgId,
      type: toHeaderKind(input.type),
      event: input.type,
      title: input.title,
      message: input.body,
      link: input.link ?? null,
      read: false,
      created_at: new Date().toISOString(),
    });
    inApp = true;
  }

  let emailSent = false;
  let emailError: string | undefined;
  if (emailEnabled && input.email) {
    try {
      await sendMail({
        to: input.email,
        subject: `[${process.env.MAIL_FROM_NAME ?? "CRM"}] ${input.title}`,
        html: brandedEmail(input.title, `<p>${input.body}</p>`, input.link),
      });
      emailSent = true;
    } catch (e) {
      // Never log full bodies/PII — only a short error code.
      emailError = e instanceof Error ? e.message.slice(0, 120) : "email failed";
      await logAutomation(input.orgId, { name: `notify:${input.type}`, status: "error", detail: `email failed for event ${input.type}`, emailSent: false, emailError });
    }
  }
  return { inApp, emailSent, emailError };
}
