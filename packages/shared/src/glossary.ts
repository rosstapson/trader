/** Plain-English definitions for the fundamentals shown on a company page. Static content — no LLM call needed. */
export const GLOSSARY = {
  peRatio: "Price-to-Earnings ratio. The share price divided by earnings per share — roughly, how many years of current profit you're paying for.",
  eps: "Earnings Per Share. The company's profit divided by its number of shares — the portion of profit each share represents.",
  dividendPerShare: "The total cash dividend paid per share over the last year.",
  dividendYield: "Annual dividend per share divided by the share price — the cash return you'd get from dividends alone at the current price.",
  marketCap: "Market Capitalization. The total value of all the company's shares — share price × number of shares.",
  revenueTtm: "Trailing Twelve Months revenue — total sales over the most recent full year of reporting, updated quarterly.",
  profitMargin: "Net profit as a percentage of revenue — how much of each dollar of sales the company keeps as profit.",
  sharesOutstanding: "The total number of shares currently issued and held by all shareholders.",
} as const;

export type GlossaryTerm = keyof typeof GLOSSARY;
