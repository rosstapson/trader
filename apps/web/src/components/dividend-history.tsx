import type { DividendEvent } from "@trader/shared";

export function DividendHistory({ dividends }: { dividends: DividendEvent[] }) {
  if (dividends.length === 0) {
    return <p className="text-sm text-neutral-500">No dividend history — this company doesn't appear to pay a dividend.</p>;
  }

  return (
    <div className="max-h-64 overflow-y-auto text-sm">
      <table className="w-full">
        <thead>
          <tr className="text-left text-neutral-500">
            <th className="py-1 font-medium">Ex-dividend date</th>
            <th className="py-1 font-medium">Payment date</th>
            <th className="py-1 font-medium">Amount</th>
          </tr>
        </thead>
        <tbody className="[font-variant-numeric:tabular-nums]">
          {dividends.map((d) => (
            <tr key={d.exDividendDate} className="border-t border-neutral-100 dark:border-neutral-800">
              <td className="py-1">{d.exDividendDate}</td>
              <td className="py-1">{d.paymentDate ?? "—"}</td>
              <td className="py-1">{d.amount}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
