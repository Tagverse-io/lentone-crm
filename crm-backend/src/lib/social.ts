import type { SocialPlatform } from "./social-types";

// ---------------------------------------------------------------------------
// SocialProvider adapter interface.
// STUBBED: implementations below store accounts/posts in RTDB only and do NOT
// call any live platform API. See README "Social integrations (stubbed)".
// ---------------------------------------------------------------------------

export interface SocialAccountRecord {
  id: string;
  platform: SocialPlatform;
  handle: string;
  connected: boolean;
}

export interface ScheduledPost {
  id?: string;
  platform: SocialPlatform | "all";
  content: string;
  scheduledAt?: string;
}

export interface SocialProvider {
  readonly platform: SocialPlatform;
  /** Stub: records the connection in RTDB; no OAuth performed. */
  connect(orgId: string, handle: string): Promise<SocialAccountRecord>;
  /** Stub: persists the post as scheduled; nothing is published. */
  schedulePost(orgId: string, post: ScheduledPost): Promise<{ id: string; status: "scheduled" }>;
}

function stubProvider(platform: SocialPlatform): SocialProvider {
  // Dynamic import keeps this module importable without env (db validated on use).
  const getDb = async (): Promise<typeof import("./admin")> => import("./admin");
  return {
    platform,
    async connect(orgId: string, handle: string): Promise<SocialAccountRecord> {
      const { db } = await getDb();
      const ref = db().ref(`/orgs/${orgId}/socialAccounts`).push();
      const record: SocialAccountRecord = { id: ref.key as string, platform, handle, connected: true };
      await ref.set({ ...record, createdAt: new Date().toISOString() });
      return record;
    },
    async schedulePost(orgId: string, post: ScheduledPost): Promise<{ id: string; status: "scheduled" }> {
      const { db } = await getDb();
      const ref = db().ref(`/orgs/${orgId}/posts`).push();
      await ref.set({ id: ref.key, ...post, status: "scheduled (stub — not published)", createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() });
      return { id: ref.key as string, status: "scheduled" };
    },
  };
}

export const socialProviders: Record<SocialPlatform, SocialProvider> = {
  facebook: stubProvider("facebook"),
  instagram: stubProvider("instagram"),
  linkedin: stubProvider("linkedin"),
  x: stubProvider("x"),
  youtube: stubProvider("youtube"),
};
