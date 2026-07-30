import { eq } from "drizzle-orm";
import { db, users } from "@trader/db";

/**
 * Placeholder for real local auth (signup/login/sessions), which isn't built yet.
 * Every table is already user_id-scoped (see ARCHITECTURE.md §1.4), so swapping
 * this out for a real session-derived user id later touches nothing else.
 */
const SINGLE_USER_EMAIL = "local@trader.dev";

let cachedUserId: string | undefined;

export async function getDefaultUserId(): Promise<string> {
  if (cachedUserId) return cachedUserId;

  const [existing] = await db.select().from(users).where(eq(users.email, SINGLE_USER_EMAIL)).limit(1);
  if (existing) {
    cachedUserId = existing.id;
    return existing.id;
  }

  const [created] = await db
    .insert(users)
    .values({ email: SINGLE_USER_EMAIL, passwordHash: "no-auth-yet" })
    .returning();
  if (!created) throw new Error("Failed to create default user");

  cachedUserId = created.id;
  return created.id;
}
