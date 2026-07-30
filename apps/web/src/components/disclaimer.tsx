import { DISCLAIMER_TEXT } from "@trader/shared";

export function Disclaimer() {
  return (
    <p className="rounded-md bg-amber-50 px-3 py-2 text-xs text-amber-900 dark:bg-amber-950 dark:text-amber-200">
      {DISCLAIMER_TEXT}
    </p>
  );
}
