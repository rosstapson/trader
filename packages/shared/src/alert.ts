import { z } from "zod";

export const alertKindSchema = z.enum(["price_above", "price_below", "news", "earnings"]);
export type AlertKind = z.infer<typeof alertKindSchema>;

export const alertStatusSchema = z.enum(["active", "triggered", "dismissed"]);
export type AlertStatus = z.infer<typeof alertStatusSchema>;

export const alertSchema = z.object({
  id: z.string(),
  symbol: z.string(),
  kind: alertKindSchema,
  threshold: z.string().nullable(),
  status: alertStatusSchema,
  triggeredAt: z.string().nullable(),
  triggeredMessage: z.string().nullable(),
  createdAt: z.string(),
});
export type Alert = z.infer<typeof alertSchema>;

export const createAlertRequestSchema = z
  .object({
    symbol: z.string().min(1).max(20),
    kind: alertKindSchema,
    threshold: z.number().optional(),
  })
  .refine((v) => (v.kind === "price_above" || v.kind === "price_below" ? v.threshold !== undefined : true), {
    message: "threshold is required for price_above and price_below alerts",
    path: ["threshold"],
  });
export type CreateAlertRequest = z.infer<typeof createAlertRequestSchema>;
