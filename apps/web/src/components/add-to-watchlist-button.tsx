import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { addWatchlistItem, createWatchlist, listWatchlists } from "@/lib/api";
import { Button } from "@/components/ui/button";

export function AddToWatchlistButton({ symbol }: { symbol: string }) {
  const [open, setOpen] = useState(false);
  const [selectedId, setSelectedId] = useState("");
  const [newName, setNewName] = useState("");
  const [status, setStatus] = useState<string | null>(null);
  const queryClient = useQueryClient();

  const watchlistsQuery = useQuery({ queryKey: ["watchlists"], queryFn: listWatchlists, enabled: open });

  const addMutation = useMutation({
    mutationFn: (watchlistId: string) => addWatchlistItem(watchlistId, symbol),
    onSuccess: (_data, watchlistId) => {
      queryClient.invalidateQueries({ queryKey: ["watchlist", watchlistId] });
      setStatus("Added.");
    },
    onError: (err) => setStatus(err instanceof Error ? err.message : "Failed to add"),
  });

  const createAndAddMutation = useMutation({
    mutationFn: async (name: string) => {
      const watchlist = await createWatchlist(name);
      await addWatchlistItem(watchlist.id, symbol);
      return watchlist;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["watchlists"] });
      setNewName("");
      setStatus("Added to new watchlist.");
    },
    onError: (err) => setStatus(err instanceof Error ? err.message : "Failed to create watchlist"),
  });

  if (!open) {
    return (
      <Button variant="outline" size="sm" onClick={() => setOpen(true)}>
        + Add to watchlist
      </Button>
    );
  }

  return (
    <div className="flex flex-col gap-2 rounded-md border border-neutral-200 p-3 text-sm dark:border-neutral-800">
      {watchlistsQuery.isLoading && <p className="text-neutral-500">Loading watchlists…</p>}
      {watchlistsQuery.data && watchlistsQuery.data.length > 0 && (
        <div className="flex gap-2">
          <select
            className="h-9 flex-1 rounded-md border border-neutral-300 bg-transparent px-2 dark:border-neutral-700"
            value={selectedId}
            onChange={(e) => setSelectedId(e.target.value)}
          >
            <option value="">Choose a watchlist…</option>
            {watchlistsQuery.data.map((w) => (
              <option key={w.id} value={w.id}>
                {w.name}
              </option>
            ))}
          </select>
          <Button
            size="sm"
            disabled={!selectedId || addMutation.isPending}
            onClick={() => selectedId && addMutation.mutate(selectedId)}
          >
            Add
          </Button>
        </div>
      )}

      <div className="flex gap-2">
        <input
          placeholder="Or create a new watchlist…"
          value={newName}
          onChange={(e) => setNewName(e.target.value)}
          className="h-9 flex-1 rounded-md border border-neutral-300 bg-transparent px-2 text-sm dark:border-neutral-700"
        />
        <Button
          size="sm"
          variant="outline"
          disabled={!newName.trim() || createAndAddMutation.isPending}
          onClick={() => createAndAddMutation.mutate(newName.trim())}
        >
          Create &amp; add
        </Button>
      </div>

      {status && <p className="text-neutral-500">{status}</p>}
      <Button variant="ghost" size="sm" className="w-fit" onClick={() => setOpen(false)}>
        Close
      </Button>
    </div>
  );
}
