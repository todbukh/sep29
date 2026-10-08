/**
 * TDD placeholder for issue #4 ("Create useTransactionFilters hook with URL sync").
 *
 * This stub exists only so `useTransactionFilters.test.ts` compiles and fails
 * loudly (not with a module-resolution error). Replace the body with a real
 * implementation; do not change the exported shape without updating the
 * owners listed in the issue's ownership notes.
 */

import type { TransactionFilters } from "../lib/filters/transactionFilters.js";

export interface UseTransactionFiltersOptions<TPage> {
  fetchTransactions: (
    filters: TransactionFilters,
    page: number,
    signal: AbortSignal,
  ) => Promise<TPage>;
}

export interface UseTransactionFiltersResult<TPage> {
  filters: TransactionFilters;
  setFilter: <K extends keyof TransactionFilters>(
    key: K,
    value: TransactionFilters[K] | undefined,
  ) => void;
  clearFilters: () => void;
  activeFilterCount: number;
  page: number;
  setPage: (page: number) => void;
  data: TPage | undefined;
  isLoading: boolean;
  error: unknown;
}

export function useTransactionFilters<TPage>(
  _options: UseTransactionFiltersOptions<TPage>,
): UseTransactionFiltersResult<TPage> {
  throw new Error("useTransactionFilters is not implemented yet");
}
