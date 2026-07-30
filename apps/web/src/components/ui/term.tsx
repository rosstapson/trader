import type { ReactNode } from "react";
import { GLOSSARY, type GlossaryTerm } from "@trader/shared";

/** Wraps a fundamentals label with a plain-English definition, shown as a native hover tooltip. */
export function Term({ term, children }: { term: GlossaryTerm; children: ReactNode }) {
  return (
    <span title={GLOSSARY[term]} className="cursor-help underline decoration-dotted decoration-neutral-400 underline-offset-2">
      {children}
    </span>
  );
}
