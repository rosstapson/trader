import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import type { AlertKind } from "@trader/shared";
import { createAlert } from "@/lib/api";
import { Button } from "@/components/ui/button";

const KIND_LABELS: Record<AlertKind, string> = {
  price_above: "Price above",
  price_below: "Price below",
  news: "New news",
  earnings: "Earnings within 7 days",
};

export function CreateAlertButton({ symbol }: { symbol: string }) {
  const [open, setOpen] = useState(false);
  const [kind, setKind] = useState<AlertKind>("price_above");
  const [threshold, setThreshold] = useState("");
  const [status, setStatus] = useState<string | null>(null);
  const queryClient = useQueryClient();

  const needsThreshold = kind === "price_above" || kind === "price_below";

  const mutation = useMutation({
    mutationFn: () =>
      createAlert({
        symbol,
        kind,
        threshold: needsThreshold ? Number(threshold) : undefined,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["alerts"] });
      setStatus("Alert created.");
      setThreshold("");
    },
    onError: (err) => setStatus(err instanceof Error ? err.message : "Failed to create alert"),
  });

  if (!open) {
    return (
      <Button variant="ghost" size="sm" onClick={() => setOpen(true)}>
        + Alert
      </Button>
    );
  }

  return (
    <div className="flex flex-col gap-2 rounded-md border border-neutral-200 p-2 text-xs dark:border-neutral-800">
      <select
        className="h-8 rounded-md border border-neutral-300 bg-transparent px-2 dark:border-neutral-700"
        value={kind}
        onChange={(e) => setKind(e.target.value as AlertKind)}
      >
        {Object.entries(KIND_LABELS).map(([value, label]) => (
          <option key={value} value={value}>
            {label}
          </option>
        ))}
      </select>
      {needsThreshold && (
        <input
          type="number"
          step="0.01"
          placeholder="Threshold price"
          value={threshold}
          onChange={(e) => setThreshold(e.target.value)}
          className="h-8 rounded-md border border-neutral-300 bg-transparent px-2 dark:border-neutral-700"
        />
      )}
      <div className="flex gap-2">
        <Button
          size="sm"
          disabled={(needsThreshold && !threshold) || mutation.isPending}
          onClick={() => mutation.mutate()}
        >
          Create
        </Button>
        <Button size="sm" variant="ghost" onClick={() => setOpen(false)}>
          Close
        </Button>
      </div>
      {status && <p className="text-neutral-500">{status}</p>}
    </div>
  );
}
