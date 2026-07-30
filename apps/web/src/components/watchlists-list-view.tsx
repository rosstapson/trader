import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createWatchlist, deleteWatchlist, listWatchlists } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";

export function WatchlistsListView() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [name, setName] = useState("");

  const watchlistsQuery = useQuery({ queryKey: ["watchlists"], queryFn: listWatchlists });

  const createMutation = useMutation({
    mutationFn: createWatchlist,
    onSuccess: (watchlist) => {
      queryClient.invalidateQueries({ queryKey: ["watchlists"] });
      setName("");
      navigate(`/watchlists/${watchlist.id}`);
    },
  });

  const deleteMutation = useMutation({
    mutationFn: deleteWatchlist,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["watchlists"] }),
  });

  return (
    <div className="mx-auto flex max-w-xl flex-col gap-4 p-6">
      <h1 className="text-2xl font-semibold">Watchlists</h1>

      <form
        className="flex gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          if (name.trim()) createMutation.mutate(name.trim());
        }}
      >
        <Input placeholder="New watchlist name" value={name} onChange={(e) => setName(e.target.value)} />
        <Button type="submit" disabled={!name.trim() || createMutation.isPending}>
          Create
        </Button>
      </form>

      {watchlistsQuery.isLoading && <p className="text-sm text-neutral-500">Loading…</p>}
      {watchlistsQuery.isError && (
        <p className="text-sm text-red-600">{(watchlistsQuery.error as Error).message}</p>
      )}

      <div className="flex flex-col gap-2">
        {watchlistsQuery.data?.map((watchlist) => (
          <Card key={watchlist.id} className="hover:border-neutral-400">
            <CardContent className="flex items-center justify-between py-3">
              <button
                className="text-left font-medium hover:underline"
                onClick={() => navigate(`/watchlists/${watchlist.id}`)}
              >
                {watchlist.name}
              </button>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  if (confirm(`Delete "${watchlist.name}"?`)) deleteMutation.mutate(watchlist.id);
                }}
              >
                Delete
              </Button>
            </CardContent>
          </Card>
        ))}
        {watchlistsQuery.data?.length === 0 && (
          <p className="text-sm text-neutral-500">No watchlists yet — create one above.</p>
        )}
      </div>
    </div>
  );
}
