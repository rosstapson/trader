import { NavLink } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { listAlerts } from "@/lib/api";
import { cn } from "@/lib/utils";

const linkClass = ({ isActive }: { isActive: boolean }) =>
  cn(
    "rounded-md px-3 py-1.5 text-sm font-medium transition-colors",
    isActive
      ? "bg-neutral-900 text-white dark:bg-neutral-100 dark:text-neutral-900"
      : "text-neutral-600 hover:bg-neutral-100 dark:text-neutral-400 dark:hover:bg-neutral-800",
  );

export function Nav() {
  const alertsQuery = useQuery({
    queryKey: ["alerts"],
    queryFn: listAlerts,
    refetchInterval: 60_000,
  });
  const triggeredCount = alertsQuery.data?.filter((a) => a.status === "triggered").length ?? 0;

  return (
    <nav className="mx-auto flex max-w-2xl items-center gap-2 border-b border-neutral-200 px-6 py-3 dark:border-neutral-800">
      <NavLink to="/" end className={linkClass}>
        Research
      </NavLink>
      <NavLink to="/watchlists" className={linkClass}>
        Watchlists
      </NavLink>
      <NavLink to="/alerts" className={linkClass}>
        Alerts
        {triggeredCount > 0 && (
          <span className="ml-1.5 inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-red-600 px-1 text-xs font-semibold text-white">
            {triggeredCount}
          </span>
        )}
      </NavLink>
    </nav>
  );
}
