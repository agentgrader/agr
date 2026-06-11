import type { AggregateResult } from "./aggregate";

interface Objective {
  get: (a: AggregateResult) => number;
  maximize: boolean;
}

/**
 * Filters `aggregates` down to the Pareto-optimal set across:
 *  - `solveRate` (maximize)
 *  - `avgCostUsd` (minimize)
 *  - `avgQuality.linterViolations` (minimize) - only included as an
 *    objective if every aggregate has it set, since `avgQuality` is itself
 *    optional (only populated when a static-quality scorer ran for all runs
 *    of a config).
 *
 * An aggregate is dropped if another aggregate is at least as good on every
 * objective and strictly better on at least one (i.e. it is dominated).
 */
export function paretoFront(aggregates: AggregateResult[]): AggregateResult[] {
  if (aggregates.length === 0) return [];

  const objectives: Objective[] = [
    { get: (a) => a.solveRate, maximize: true },
    { get: (a) => a.avgCostUsd, maximize: false },
  ];

  if (aggregates.every((a) => typeof a.avgQuality?.linterViolations === "number")) {
    objectives.push({ get: (a) => a.avgQuality!.linterViolations!, maximize: false });
  }

  const dominates = (a: AggregateResult, b: AggregateResult): boolean => {
    let strictlyBetter = false;
    for (const { get, maximize } of objectives) {
      const av = get(a);
      const bv = get(b);
      if (maximize ? av < bv : av > bv) return false;
      if (av !== bv) strictlyBetter = true;
    }
    return strictlyBetter;
  };

  return aggregates.filter(
    (candidate) => !aggregates.some((other) => other !== candidate && dominates(other, candidate)),
  );
}
