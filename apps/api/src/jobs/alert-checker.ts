import { eq } from "drizzle-orm";
import { Decimal } from "decimal.js";
import { db, alerts } from "@trader/db";
import { getMarketDataProvider } from "../providers.js";

const CHECK_INTERVAL_MS = 15 * 60 * 1000;

/**
 * In-process interval checker — no separate worker/queue infra yet (see ARCHITECTURE.md
 * "boring infra until proven necessary"). Alerts are in-app only: this flips status to
 * "triggered" for the UI to surface, it doesn't send email/SMS/push.
 */
async function checkAlert(alert: typeof alerts.$inferSelect): Promise<void> {
  const provider = getMarketDataProvider();
  const now = new Date();
  let triggeredMessage: string | null = null;

  try {
    if (alert.kind === "price_above" || alert.kind === "price_below") {
      if (!alert.threshold) return;
      const quote = await provider.getQuote(alert.symbol);
      const price = new Decimal(quote.price);
      const threshold = new Decimal(alert.threshold);
      const crossed = alert.kind === "price_above" ? price.gt(threshold) : price.lt(threshold);
      if (crossed) {
        triggeredMessage = `${alert.symbol} is ${alert.kind === "price_above" ? "above" : "below"} ${threshold.toFixed(2)} — now ${price.toFixed(2)}`;
      }
    } else if (alert.kind === "news") {
      const news = await provider.getNews(alert.symbol);
      const since = alert.lastCheckedAt ?? alert.createdAt;
      const fresh = news.find((n) => new Date(n.publishedAt) > since);
      if (fresh) {
        triggeredMessage = `New news for ${alert.symbol}: ${fresh.title}`;
      }
    } else if (alert.kind === "earnings") {
      const earnings = await provider.getNextEarnings(alert.symbol);
      if (earnings.nextReportDate) {
        // Compare calendar dates, not exact timestamps — a report "today" must count as
        // 0 days away regardless of what time of day the check happens to run.
        const [reportYear, reportMonth, reportDay] = earnings.nextReportDate.split("-").map(Number) as [
          number,
          number,
          number,
        ];
        const todayUtc = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate());
        const reportUtc = Date.UTC(reportYear, reportMonth - 1, reportDay);
        const daysAway = (reportUtc - todayUtc) / (1000 * 60 * 60 * 24);
        if (daysAway >= 0 && daysAway <= 7) {
          triggeredMessage = `${alert.symbol} reports earnings on ${earnings.nextReportDate}`;
        }
      }
    }
  } catch (err) {
    // A transient provider failure shouldn't trigger or dismiss the alert — just skip this cycle.
    console.error(`Alert check failed for ${alert.symbol} (${alert.kind}):`, err instanceof Error ? err.message : err);
    return;
  }

  await db
    .update(alerts)
    .set({
      lastCheckedAt: now,
      ...(triggeredMessage ? { status: "triggered" as const, triggeredAt: now, triggeredMessage } : {}),
    })
    .where(eq(alerts.id, alert.id));
}

export async function runAlertCheck(): Promise<void> {
  const activeAlerts = await db.select().from(alerts).where(eq(alerts.status, "active"));
  for (const alert of activeAlerts) {
    await checkAlert(alert);
  }
}

export function startAlertChecker(): void {
  runAlertCheck().catch((err) => console.error("Initial alert check failed:", err));
  setInterval(() => {
    runAlertCheck().catch((err) => console.error("Alert check failed:", err));
  }, CHECK_INTERVAL_MS);
}
