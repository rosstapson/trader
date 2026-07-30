import type { FairValueEstimate } from "./ai-output.js";

/**
 * Deterministic, single-stage valuation formulas — no LLM involved. An earlier version
 * asked the LLM to invent fair-value numbers directly, which is dishonest (LLMs are bad
 * at arithmetic and have no real basis for the figures) and unauditable. These are plain
 * finance formulas with fixed, clearly-labeled assumptions instead of company-specific
 * inputs the app doesn't have (a real cost of equity, a peer group, a multi-year FCF
 * forecast). Treat the assumptions as "obviously a simplification," not as tuned models.
 */

const ASSUMED_DIVIDEND_GROWTH_RATE = 0.03; // long-run assumption for a mature dividend payer
const ASSUMED_COST_OF_EQUITY = 0.08; // single flat discount rate, not derived via CAPM
const ASSUMED_FAIR_PE = 20; // rough long-run market-average P/E, not a peer/sector comparison
const ASSUMED_FCF_GROWTH_RATE = 0.04;
const ASSUMED_WACC = 0.09;

function toPositiveNumber(value: string | null | undefined): number | null {
  if (!value) return null;
  const n = Number(value);
  return Number.isFinite(n) && n > 0 ? n : null;
}

/** Gordon growth (single-stage dividend discount) model. Meaningless for non-payers, so returns null. */
export function dividendDiscountValue(dividendPerShare: string | null | undefined): FairValueEstimate | null {
  const d0 = toPositiveNumber(dividendPerShare);
  if (d0 === null || ASSUMED_COST_OF_EQUITY <= ASSUMED_DIVIDEND_GROWTH_RATE) return null;

  const d1 = d0 * (1 + ASSUMED_DIVIDEND_GROWTH_RATE);
  const estimate = d1 / (ASSUMED_COST_OF_EQUITY - ASSUMED_DIVIDEND_GROWTH_RATE);

  return {
    method: "dividend_discount",
    estimate: estimate.toFixed(2),
    confidence: "low",
    notes: `Gordon growth model assuming ${(ASSUMED_DIVIDEND_GROWTH_RATE * 100).toFixed(0)}% long-run dividend growth and ${(ASSUMED_COST_OF_EQUITY * 100).toFixed(0)}% cost of equity — fixed assumptions, not derived from this company's specifics. Highly sensitive to those two numbers.`,
  };
}

/** EPS × a flat benchmark P/E. A crude stand-in for a real peer/sector comparison, which the app doesn't have data for yet. */
export function comparablesValue(eps: string | null | undefined): FairValueEstimate | null {
  const e = toPositiveNumber(eps);
  if (e === null) return null;

  const estimate = e * ASSUMED_FAIR_PE;

  return {
    method: "comparables",
    estimate: estimate.toFixed(2),
    confidence: "medium",
    notes: `EPS × ${ASSUMED_FAIR_PE}, a rough long-run market-average P/E multiple — not a true peer or sector comparison.`,
  };
}

/** Single-stage free-cash-flow perpetuity-growth model, converted to a per-share estimate. */
export function dcfValue(
  freeCashFlow: string | null | undefined,
  sharesOutstanding: string | null | undefined,
): FairValueEstimate | null {
  const fcf0 = toPositiveNumber(freeCashFlow);
  const shares = toPositiveNumber(sharesOutstanding);
  if (fcf0 === null || shares === null || ASSUMED_WACC <= ASSUMED_FCF_GROWTH_RATE) return null;

  const fcf1 = fcf0 * (1 + ASSUMED_FCF_GROWTH_RATE);
  const enterpriseValue = fcf1 / (ASSUMED_WACC - ASSUMED_FCF_GROWTH_RATE);
  const perShare = enterpriseValue / shares;

  return {
    method: "dcf",
    estimate: perShare.toFixed(2),
    confidence: "low",
    notes: `Single-stage FCF perpetuity-growth model assuming ${(ASSUMED_FCF_GROWTH_RATE * 100).toFixed(0)}% FCF growth and ${(ASSUMED_WACC * 100).toFixed(0)}% WACC — a simplification of a full multi-year DCF, and ignores debt/cash adjustments to enterprise value.`,
  };
}

export interface ValuationInputs {
  eps: string | null | undefined;
  dividendPerShare: string | null | undefined;
  sharesOutstanding: string | null | undefined;
  freeCashFlow: string | null | undefined;
}

/** Runs every method that has enough data to produce a result; methods with missing inputs are simply omitted. */
export function computeValuations(inputs: ValuationInputs): FairValueEstimate[] {
  return [
    dividendDiscountValue(inputs.dividendPerShare),
    comparablesValue(inputs.eps),
    dcfValue(inputs.freeCashFlow, inputs.sharesOutstanding),
  ].filter((v): v is FairValueEstimate => v !== null);
}
