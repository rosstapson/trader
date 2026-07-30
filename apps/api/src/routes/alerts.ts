import { Router } from "express";
import { z } from "zod";
import { and, desc, eq } from "drizzle-orm";
import { db, alerts } from "@trader/db";
import { createAlertRequestSchema, type Alert } from "@trader/shared";
import { getDefaultUserId } from "../user.js";

export const alertsRouter: Router = Router();

const idParamSchema = z.object({ id: z.string().uuid() });

function toAlert(row: typeof alerts.$inferSelect): Alert {
  return {
    id: row.id,
    symbol: row.symbol,
    kind: row.kind,
    threshold: row.threshold,
    status: row.status,
    triggeredAt: row.triggeredAt?.toISOString() ?? null,
    triggeredMessage: row.triggeredMessage,
    createdAt: row.createdAt.toISOString(),
  };
}

alertsRouter.get("/", async (_req, res, next) => {
  try {
    const userId = await getDefaultUserId();
    const rows = await db.select().from(alerts).where(eq(alerts.userId, userId)).orderBy(desc(alerts.createdAt));
    res.json(rows.map(toAlert));
  } catch (err) {
    next(err);
  }
});

alertsRouter.post("/", async (req, res, next) => {
  try {
    const body = createAlertRequestSchema.parse(req.body);
    const userId = await getDefaultUserId();

    const [created] = await db
      .insert(alerts)
      .values({
        userId,
        symbol: body.symbol.toUpperCase(),
        kind: body.kind,
        threshold: body.threshold?.toString(),
      })
      .returning();
    if (!created) throw new Error("Failed to create alert");

    res.status(201).json(toAlert(created));
  } catch (err) {
    next(err);
  }
});

alertsRouter.patch("/:id/dismiss", async (req, res, next) => {
  try {
    const { id } = idParamSchema.parse(req.params);
    const userId = await getDefaultUserId();

    const [updated] = await db
      .update(alerts)
      .set({ status: "dismissed" })
      .where(and(eq(alerts.id, id), eq(alerts.userId, userId)))
      .returning();
    if (!updated) {
      res.status(404).json({ error: "not_found", message: "Alert not found" });
      return;
    }
    res.json(toAlert(updated));
  } catch (err) {
    next(err);
  }
});

alertsRouter.delete("/:id", async (req, res, next) => {
  try {
    const { id } = idParamSchema.parse(req.params);
    const userId = await getDefaultUserId();

    const [deleted] = await db
      .delete(alerts)
      .where(and(eq(alerts.id, id), eq(alerts.userId, userId)))
      .returning();
    if (!deleted) {
      res.status(404).json({ error: "not_found", message: "Alert not found" });
      return;
    }
    res.status(204).send();
  } catch (err) {
    next(err);
  }
});
