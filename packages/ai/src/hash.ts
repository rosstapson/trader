import { createHash } from "node:crypto";

/** Hashes the data that actually determines whether an agent's output is still valid — never wall-clock time. */
export function hashInput(parts: Record<string, string | number | null | undefined>): string {
  const stable = Object.keys(parts)
    .sort()
    .map((key) => `${key}=${parts[key] ?? ""}`)
    .join("&");
  return createHash("sha256").update(stable).digest("hex").slice(0, 16);
}
