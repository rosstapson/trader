import { z } from "zod";

/** Confidence is a coarse self-reported signal, not a calibrated probability — surfaced to set user expectations. */
export const confidenceSchema = z.enum(["low", "medium", "high"]);
export type Confidence = z.infer<typeof confidenceSchema>;

export const fairValueEstimateSchema = z.object({
  method: z.enum(["dcf", "comparables", "dividend_discount"]),
  estimate: z.string(), // decimal-as-string
  confidence: confidenceSchema,
  notes: z.string(),
});
export type FairValueEstimate = z.infer<typeof fairValueEstimateSchema>;

export const researchSummarySchema = z.object({
  symbol: z.string(),
  summary: z.string(),
  bullCase: z.array(z.string()),
  bearCase: z.array(z.string()),
  risks: z.array(z.string()),
  fairValueEstimates: z.array(fairValueEstimateSchema),
  overallConfidence: confidenceSchema,
  disclaimerVersion: z.string(),
  generatedAt: z.string(),
});
export type ResearchSummary = z.infer<typeof researchSummarySchema>;
