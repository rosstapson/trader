import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { searchCompanies } from "@/lib/api";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";

export function SearchView({ onSelect }: { onSelect: (symbol: string) => void }) {
  const [query, setQuery] = useState("");
  const [submitted, setSubmitted] = useState("");

  const { data, isFetching, isError, error } = useQuery({
    queryKey: ["search", submitted],
    queryFn: () => searchCompanies(submitted),
    enabled: submitted.length > 0,
  });

  return (
    <div className="mx-auto flex max-w-xl flex-col gap-4 p-6">
      <h1 className="text-2xl font-semibold">Investment Research Assistant</h1>
      <form
        className="flex gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          setSubmitted(query.trim());
        }}
      >
        <Input
          placeholder="Search a company, e.g. AAPL or Apple"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
        <Button type="submit">Search</Button>
      </form>

      {isFetching && <p className="text-sm text-neutral-500">Searching…</p>}
      {isError && <p className="text-sm text-red-600">{(error as Error).message}</p>}

      <div className="flex flex-col gap-2">
        {data?.map((result) => (
          <Card
            key={result.symbol}
            className="cursor-pointer hover:border-neutral-400"
            onClick={() => onSelect(result.symbol)}
          >
            <CardContent className="flex items-center justify-between py-3">
              <div>
                <p className="font-medium">{result.symbol}</p>
                <p className="text-sm text-neutral-500">{result.name}</p>
              </div>
              {result.exchange && <span className="text-xs text-neutral-400">{result.exchange}</span>}
            </CardContent>
          </Card>
        ))}
        {data?.length === 0 && <p className="text-sm text-neutral-500">No results.</p>}
      </div>
    </div>
  );
}
