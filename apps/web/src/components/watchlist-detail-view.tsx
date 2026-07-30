import { useState } from "react";
import { useNavigate, useParams, Link } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  addWatchlistItem,
  deleteWatchlist,
  getWatchlist,
  removeWatchlistItem,
  renameWatchlist,
  updateWatchlistItemShares,
} from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { CreateAlertButton } from "@/components/create-alert-button";

function GainLoss({ value }: { value: string | null }) {
  if (value === null) return <span className="text-neutral-400">—</span>;
  const n = Number(value);
  return <span className={n > 0 ? "text-green-600" : n < 0 ? "text-red-600" : ""}>{value}</span>;
}

export function WatchlistDetailView() {
  const { id = "" } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [symbolInput, setSymbolInput] = useState("");
  const [renameValue, setRenameValue] = useState<string | null>(null);

  const watchlistQuery = useQuery({ queryKey: ["watchlist", id], queryFn: () => getWatchlist(id) });

  const invalidate = () => queryClient.invalidateQueries({ queryKey: ["watchlist", id] });

  const addItemMutation = useMutation({
    mutationFn: (symbol: string) => addWatchlistItem(id, symbol),
    onSuccess: () => {
      setSymbolInput("");
      invalidate();
    },
  });

  const removeItemMutation = useMutation({
    mutationFn: (itemId: string) => removeWatchlistItem(id, itemId),
    onSuccess: invalidate,
  });

  const sharesMutation = useMutation({
    mutationFn: ({ itemId, shares }: { itemId: string; shares: number | null }) =>
      updateWatchlistItemShares(id, itemId, shares),
    onSuccess: invalidate,
  });

  const renameMutation = useMutation({
    mutationFn: (name: string) => renameWatchlist(id, name),
    onSuccess: () => {
      setRenameValue(null);
      invalidate();
      queryClient.invalidateQueries({ queryKey: ["watchlists"] });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: () => deleteWatchlist(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["watchlists"] });
      navigate("/watchlists");
    },
  });

  const watchlist = watchlistQuery.data;

  return (
    <div className="mx-auto flex max-w-2xl flex-col gap-4 p-6">
      <Button variant="ghost" size="sm" className="w-fit" onClick={() => navigate("/watchlists")}>
        ← Back to watchlists
      </Button>

      {watchlistQuery.isLoading && <p className="text-sm text-neutral-500">Loading…</p>}
      {watchlistQuery.isError && <p className="text-sm text-red-600">{(watchlistQuery.error as Error).message}</p>}

      {watchlist && (
        <>
          <div className="flex items-center justify-between gap-4">
            {renameValue !== null ? (
              <form
                className="flex flex-1 gap-2"
                onSubmit={(e) => {
                  e.preventDefault();
                  if (renameValue.trim()) renameMutation.mutate(renameValue.trim());
                }}
              >
                <Input value={renameValue} onChange={(e) => setRenameValue(e.target.value)} autoFocus />
                <Button type="submit" size="sm">
                  Save
                </Button>
                <Button type="button" size="sm" variant="ghost" onClick={() => setRenameValue(null)}>
                  Cancel
                </Button>
              </form>
            ) : (
              <h1
                className="cursor-pointer text-2xl font-semibold hover:underline"
                onClick={() => setRenameValue(watchlist.name)}
              >
                {watchlist.name}
              </h1>
            )}
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                if (confirm(`Delete "${watchlist.name}"?`)) deleteMutation.mutate();
              }}
            >
              Delete watchlist
            </Button>
          </div>

          <form
            className="flex gap-2"
            onSubmit={(e) => {
              e.preventDefault();
              if (symbolInput.trim()) addItemMutation.mutate(symbolInput.trim().toUpperCase());
            }}
          >
            <Input
              placeholder="Add symbol, e.g. AAPL"
              value={symbolInput}
              onChange={(e) => setSymbolInput(e.target.value)}
            />
            <Button type="submit" disabled={!symbolInput.trim() || addItemMutation.isPending}>
              Add
            </Button>
          </form>
          {addItemMutation.isError && (
            <p className="text-sm text-red-600">{(addItemMutation.error as Error).message}</p>
          )}

          <div className="flex flex-col gap-2">
            {watchlist.items.map((item) => (
              <Card key={item.id}>
                <CardContent className="flex flex-col gap-2 py-3 text-sm">
                  <div className="flex items-center justify-between">
                    <Link to={`/company/${item.symbol}`} className="font-medium hover:underline">
                      {item.symbol} <span className="font-normal text-neutral-500">{item.name}</span>
                    </Link>
                    <Button variant="ghost" size="sm" onClick={() => removeItemMutation.mutate(item.id)}>
                      Remove
                    </Button>
                  </div>

                  {item.quoteError ? (
                    <p className="text-red-600">{item.quoteError}</p>
                  ) : (
                    <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-neutral-600 dark:text-neutral-400">
                      <span>Price: {item.price}</span>
                      <span>
                        Change: <GainLoss value={item.changePercent} />%
                      </span>
                      <label className="flex items-center gap-1">
                        Shares:
                        <input
                          type="number"
                          step="0.0001"
                          defaultValue={item.shares ?? ""}
                          className="h-7 w-24 rounded border border-neutral-300 bg-transparent px-1 dark:border-neutral-700"
                          onBlur={(e) => {
                            const raw = e.target.value.trim();
                            sharesMutation.mutate({ itemId: item.id, shares: raw === "" ? null : Number(raw) });
                          }}
                        />
                      </label>
                      {item.positionValue && <span>Value: {item.positionValue}</span>}
                      {item.positionDayGainLoss && (
                        <span>
                          Day gain/loss: <GainLoss value={item.positionDayGainLoss} />
                        </span>
                      )}
                    </div>
                  )}

                  <CreateAlertButton symbol={item.symbol} />
                </CardContent>
              </Card>
            ))}
            {watchlist.items.length === 0 && (
              <p className="text-sm text-neutral-500">No companies yet — add one above.</p>
            )}
          </div>

          {(watchlist.totalPositionValue || watchlist.totalDayGainLoss) && (
            <Card>
              <CardContent className="flex gap-6 py-3 text-sm font-medium">
                {watchlist.totalPositionValue && <span>Total value: {watchlist.totalPositionValue}</span>}
                {watchlist.totalDayGainLoss && (
                  <span>
                    Total day gain/loss: <GainLoss value={watchlist.totalDayGainLoss} />
                  </span>
                )}
              </CardContent>
            </Card>
          )}
        </>
      )}
    </div>
  );
}
