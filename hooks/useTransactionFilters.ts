import { useCallback, useEffect, useRef, useState } from "react";
import {
  parseTransactionFilters,
  serializeTransactionFilters,
  type TransactionFilters,
} from "../lib/filters/transactionFilters.js";

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

function readFiltersFromLocation(): TransactionFilters {
  const result = parseTransactionFilters(new URLSearchParams(window.location.search));
  return result.ok ? result.filters : {};
}

function writeFiltersToLocation(filters: TransactionFilters): void {
  const query = serializeTransactionFilters(filters).toString();
  const url = `${window.location.pathname}${query ? `?${query}` : ""}${window.location.hash}`;
  window.history.replaceState(null, "", url);
}

export function useTransactionFilters<TPage>({
  fetchTransactions,
}: UseTransactionFiltersOptions<TPage>): UseTransactionFiltersResult<TPage> {
  const [filters, setFilters] = useState<TransactionFilters>(readFiltersFromLocation);
  const [page, setPage] = useState(1);
  const [data, setData] = useState<TPage | undefined>(undefined);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<unknown>(undefined);

  const latestRequestIdRef = useRef(0);
  const abortControllerRef = useRef<AbortController | null>(null);

  useEffect(() => {
    function onPopState() {
      setFilters(readFiltersFromLocation());
      setPage(1);
    }
    window.addEventListener("popstate", onPopState);
    return () => window.removeEventListener("popstate", onPopState);
  }, []);

  useEffect(() => {
    abortControllerRef.current?.abort();
    const controller = new AbortController();
    abortControllerRef.current = controller;
    const requestId = ++latestRequestIdRef.current;

    setIsLoading(true);
    setError(undefined);

    fetchTransactions(filters, page, controller.signal).then(
      (result) => {
        if (latestRequestIdRef.current !== requestId) return;
        setData(result);
        setIsLoading(false);
      },
      (err: unknown) => {
        if (latestRequestIdRef.current !== requestId) return;
        setError(err);
        setIsLoading(false);
      },
    );
    // fetchTransactions is intentionally not a dependency: callers are
    // expected to pass a stable reference, and this effect already keys
    // refetching off the state that actually changes (filters, page).
  }, [filters, page]);

  const setFilter = useCallback(
    <K extends keyof TransactionFilters>(key: K, value: TransactionFilters[K] | undefined) => {
      const next = { ...filters };
      if (value === undefined) {
        delete next[key];
      } else {
        next[key] = value;
      }
      writeFiltersToLocation(next);
      setFilters(next);
      setPage(1);
    },
    [filters],
  );

  const clearFilters = useCallback(() => {
    writeFiltersToLocation({});
    setFilters({});
    setPage(1);
  }, []);

  const activeFilterCount = Object.keys(filters).length;

  return {
    filters,
    setFilter,
    clearFilters,
    activeFilterCount,
    page,
    setPage,
    data,
    isLoading,
    error,
  };
}
