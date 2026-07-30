import { useQuery } from "@tanstack/react-query";
import type { Confidence } from "@trader/shared";
import { getCompanyOverview, getCompanySummary } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Disclaimer } from "@/components/disclaimer";

const CONFIDENCE_COLOR: Record<Confidence, string> = {
  low: "border-red-300 text-red-700 dark:border-red-800 dark:text-red-400",
  medium: "border-amber-300 text-amber-700 dark:border-amber-800 dark:text-amber-400",
  high: "border-green-300 text-green-700 dark:border-green-800 dark:text-green-400",
};

export function CompanyView({ symbol, onBack }: { symbol: string; onBack: () => void }) {
  const overviewQuery = useQuery({
    queryKey: ["overview", symbol],
    queryFn: () => getCompanyOverview(symbol),
  });

  const summaryQuery = useQuery({
    queryKey: ["summary", symbol],
    queryFn: () => getCompanySummary(symbol),
    enabled: false,
  });

  const overview = overviewQuery.data;

  return (
    <div className="mx-auto flex max-w-2xl flex-col gap-4 p-6">
      <Button variant="ghost" size="sm" className="w-fit" onClick={onBack}>
        ← Back to search
      </Button>

      {overviewQuery.isLoading && <p className="text-sm text-neutral-500">Loading…</p>}
      {overviewQuery.isError && (
        <p className="text-sm text-red-600">{(overviewQuery.error as Error).message}</p>
      )}

      {overview && (
        <>
          <div>
            <h1 className="text-2xl font-semibold">
              {overview.profile.name} <span className="text-neutral-400">({overview.profile.symbol})</span>
            </h1>
            <p className="text-sm text-neutral-500">
              {overview.profile.sector} · {overview.profile.industry}
            </p>
          </div>

          <Card>
            <CardHeader>
              <CardTitle>Quote</CardTitle>
            </CardHeader>
            <CardContent className="flex gap-6 text-sm">
              <span>Price: {overview.quote.price}</span>
              <span>Change: {overview.quote.changePercent}%</span>
              <span className="text-neutral-400">as of {overview.quote.asOf}</span>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Fundamentals</CardTitle>
            </CardHeader>
            <CardContent className="grid grid-cols-2 gap-x-6 gap-y-1 text-sm">
              <span>P/E: {overview.financials.peRatio ?? "n/a"}</span>
              <span>EPS: {overview.financials.eps ?? "n/a"}</span>
              <span>Dividend/share: {overview.financials.dividendPerShare ?? "n/a"}</span>
              <span>Dividend yield: {overview.financials.dividendYield ?? "n/a"}</span>
              <span>Market cap: {overview.financials.marketCap ?? "n/a"}</span>
              <span>Revenue (TTM): {overview.financials.revenueTtm ?? "n/a"}</span>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Recent news</CardTitle>
            </CardHeader>
            <CardContent className="flex flex-col gap-2 text-sm">
              {overview.news.slice(0, 5).map((item) => (
                <a
                  key={item.url}
                  href={item.url}
                  target="_blank"
                  rel="noreferrer"
                  className="hover:underline"
                >
                  {item.title}
                  <span className="ml-2 text-xs text-neutral-400">{item.source}</span>
                </a>
              ))}
              {overview.news.length === 0 && <p className="text-neutral-500">No recent news.</p>}
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex-row items-center justify-between">
              <CardTitle>AI Research Summary</CardTitle>
              <Button size="sm" onClick={() => summaryQuery.refetch()} disabled={summaryQuery.isFetching}>
                {summaryQuery.isFetching ? "Generating…" : "Generate"}
              </Button>
            </CardHeader>
            <CardContent className="flex flex-col gap-3 text-sm">
              {summaryQuery.isError && (
                <p className="text-red-600">{(summaryQuery.error as Error).message}</p>
              )}
              {summaryQuery.data && (
                <>
                  <div className="flex items-center gap-2">
                    <Badge className={CONFIDENCE_COLOR[summaryQuery.data.overallConfidence]}>
                      {summaryQuery.data.overallConfidence} confidence
                    </Badge>
                    {summaryQuery.data.cached && <Badge>cached</Badge>}
                  </div>
                  <p>{summaryQuery.data.summary}</p>

                  <div>
                    <p className="font-medium">Bull case</p>
                    <ul className="list-disc pl-5">
                      {summaryQuery.data.bullCase.map((point, i) => (
                        <li key={i}>{point}</li>
                      ))}
                    </ul>
                  </div>

                  <div>
                    <p className="font-medium">Bear case</p>
                    <ul className="list-disc pl-5">
                      {summaryQuery.data.bearCase.map((point, i) => (
                        <li key={i}>{point}</li>
                      ))}
                    </ul>
                  </div>

                  <div>
                    <p className="font-medium">Risks</p>
                    <ul className="list-disc pl-5">
                      {summaryQuery.data.risks.map((point, i) => (
                        <li key={i}>{point}</li>
                      ))}
                    </ul>
                  </div>

                  {summaryQuery.data.fairValueEstimates.length > 0 && (
                    <div>
                      <p className="font-medium">Fair value estimates</p>
                      <ul className="list-disc pl-5">
                        {summaryQuery.data.fairValueEstimates.map((fv, i) => (
                          <li key={i}>
                            {fv.method}: {fv.estimate}{" "}
                            <Badge className={CONFIDENCE_COLOR[fv.confidence]}>{fv.confidence}</Badge> —{" "}
                            {fv.notes}
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}

                  <Disclaimer />
                </>
              )}
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}
