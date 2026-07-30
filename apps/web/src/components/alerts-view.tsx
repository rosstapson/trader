import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { Alert, AlertKind } from "@trader/shared";
import { deleteAlert, dismissAlert, listAlerts } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

const KIND_LABELS: Record<AlertKind, string> = {
  price_above: "Price above",
  price_below: "Price below",
  news: "New news",
  earnings: "Earnings within 7 days",
};

const STATUS_ORDER: Record<Alert["status"], number> = { triggered: 0, active: 1, dismissed: 2 };

export function AlertsView() {
  const queryClient = useQueryClient();
  const alertsQuery = useQuery({ queryKey: ["alerts"], queryFn: listAlerts });

  const dismissMutation = useMutation({
    mutationFn: dismissAlert,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["alerts"] }),
  });

  const deleteMutation = useMutation({
    mutationFn: deleteAlert,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["alerts"] }),
  });

  const sorted = [...(alertsQuery.data ?? [])].sort((a, b) => STATUS_ORDER[a.status] - STATUS_ORDER[b.status]);

  return (
    <div className="mx-auto flex max-w-2xl flex-col gap-4 p-6">
      <div>
        <h1 className="text-2xl font-semibold">Alerts</h1>
        <p className="text-sm text-neutral-500">
          Checked every 15 minutes. In-app only for now — no email or push notifications yet.
        </p>
      </div>

      {alertsQuery.isLoading && <p className="text-sm text-neutral-500">Loading…</p>}
      {alertsQuery.isError && <p className="text-sm text-red-600">{(alertsQuery.error as Error).message}</p>}

      <div className="flex flex-col gap-2">
        {sorted.map((alert) => (
          <Card key={alert.id} className={alert.status === "triggered" ? "border-red-300 dark:border-red-800" : ""}>
            <CardContent className="flex items-center justify-between gap-4 py-3 text-sm">
              <div>
                <p className="font-medium">
                  {alert.symbol} — {KIND_LABELS[alert.kind]}
                  {alert.threshold ? ` ${alert.threshold}` : ""}
                </p>
                {alert.triggeredMessage && <p className="text-neutral-500">{alert.triggeredMessage}</p>}
              </div>
              <div className="flex items-center gap-2">
                <Badge
                  className={
                    alert.status === "triggered"
                      ? "border-red-300 text-red-700 dark:border-red-800 dark:text-red-400"
                      : alert.status === "dismissed"
                        ? "text-neutral-400"
                        : ""
                  }
                >
                  {alert.status}
                </Badge>
                {alert.status !== "dismissed" && (
                  <Button variant="ghost" size="sm" onClick={() => dismissMutation.mutate(alert.id)}>
                    Dismiss
                  </Button>
                )}
                <Button variant="ghost" size="sm" onClick={() => deleteMutation.mutate(alert.id)}>
                  Delete
                </Button>
              </div>
            </CardContent>
          </Card>
        ))}
        {sorted.length === 0 && (
          <p className="text-sm text-neutral-500">
            No alerts yet — create one from a company page or a watchlist item.
          </p>
        )}
      </div>
    </div>
  );
}
