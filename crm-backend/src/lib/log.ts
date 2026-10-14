import { db } from "./admin";

export async function logAutomation(
  orgId: string,
  entry: { name: string; status: "ok" | "error" | "skipped"; detail?: string; emailSent?: boolean; emailError?: string },
): Promise<void> {
  try {
    const ref = db().ref(`/orgs/${orgId}/automationsLog`).push();
    await ref.set({ id: ref.key, ...entry, createdAt: new Date().toISOString() });
  } catch {
    // Logging must never crash the automation.
  }
}
