import { db, companies } from "@trader/db";
import type { CompanyProfile } from "@trader/shared";

/** Upserts the reference-data cache row for a symbol; called whenever we've just fetched a fresh profile. */
export async function upsertCompanyProfile(profile: CompanyProfile): Promise<void> {
  await db
    .insert(companies)
    .values({
      symbol: profile.symbol,
      name: profile.name,
      exchange: profile.exchange,
      sector: profile.sector,
      industry: profile.industry,
      description: profile.description,
    })
    .onConflictDoUpdate({
      target: companies.symbol,
      set: {
        name: profile.name,
        exchange: profile.exchange,
        sector: profile.sector,
        industry: profile.industry,
        description: profile.description,
        updatedAt: new Date(),
      },
    });
}
