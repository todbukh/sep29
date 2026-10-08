// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, renderHook, waitFor } from "@testing-library/react";
import { useTransactionFilters } from "./useTransactionFilters.js";
import type { TransactionFilters } from "../lib/filters/transactionFilters.js";

/**
 * This suite is written against design decisions made alongside issue #4
 * (no router/query library exists yet in this repo, so these had to be
 * chosen rather than inferred from code):
 *
 * - URL sync uses the raw History API (pushState/replaceState) plus a
 *   `popstate` listener for back/forward - no router dependency.
 * - The hook owns data-fetching: callers pass a `fetchTransactions(filters,
 *   page, signal)` callback, and the hook tracks `page`/`data`/`isLoading`,
 *   resetting `page` to 1 and discarding stale in-flight responses itself.
 *   This is required by the hook, since nothing else could own the
 *   pagination-reset/stale-response behavior the issue asks for.
 * - `activeFilterCount` counts defined top-level keys on `filters` (e.g.
 *   startDate+endDate = 2; a non-empty categoryIds array = 1).
 * - `parseTransactionFilters` is all-or-nothing: a URL with ANY invalid
 *   param yields `{ ok: false }`. On init, the hook falls back to `{}`
 *   filters in that case rather than attempting a partial recovery.
 */

type Page = { items: string[] };

type Fetcher = (
  filters: TransactionFilters,
  page: number,
  signal: AbortSignal,
) => Promise<Page>;

function setUrl(pathAndQuery: string) {
  window.history.pushState({}, "", pathAndQuery);
}

function makeFetcher() {
  return vi.fn<Fetcher>().mockResolvedValue({ items: [] });
}

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((res) => {
    resolve = res;
  });
  return { promise, resolve };
}

beforeEach(() => {
  setUrl("/transactions");
});

afterEach(() => {
  vi.restoreAllMocks();
  setUrl("/transactions");
});

describe("useTransactionFilters: initialization from URL", () => {
  it("initializes filters from the current URL on mount", () => {
    setUrl("/transactions?startDate=2024-01-01&q=coffee");
    const { result } = renderHook(() =>
      useTransactionFilters({ fetchTransactions: makeFetcher() }),
    );

    expect(result.current.filters).toEqual({ startDate: "2024-01-01", q: "coffee" });
  });

  it("initializes with an empty filters object when the URL has no params", () => {
    const { result } = renderHook(() =>
      useTransactionFilters({ fetchTransactions: makeFetcher() }),
    );

    expect(result.current.filters).toEqual({});
  });

  it("ignores unknown URL params on init", () => {
    setUrl("/transactions?q=coffee&sortBy=amount");
    const { result } = renderHook(() =>
      useTransactionFilters({ fetchTransactions: makeFetcher() }),
    );

    expect(result.current.filters).toEqual({ q: "coffee" });
  });

  it("drops filters silently and still renders when the URL has an invalid hand-edited param", () => {
    setUrl("/transactions?startDate=not-a-date&q=coffee");

    expect(() =>
      renderHook(() => useTransactionFilters({ fetchTransactions: makeFetcher() })),
    ).not.toThrow();

    const { result } = renderHook(() =>
      useTransactionFilters({ fetchTransactions: makeFetcher() }),
    );
    expect(result.current.filters).toEqual({});
  });

  it("fetches page 1 with the initial filters on mount", async () => {
    setUrl("/transactions?q=coffee");
    const fetchTransactions = makeFetcher();
    renderHook(() => useTransactionFilters({ fetchTransactions }));

    await waitFor(() => expect(fetchTransactions).toHaveBeenCalledTimes(1));
    expect(fetchTransactions).toHaveBeenCalledWith({ q: "coffee" }, 1, expect.any(AbortSignal));
  });
});

describe("useTransactionFilters: setFilter", () => {
  it("updates a single filter value", () => {
    const { result } = renderHook(() =>
      useTransactionFilters({ fetchTransactions: makeFetcher() }),
    );

    act(() => {
      result.current.setFilter("q", "groceries");
    });

    expect(result.current.filters).toEqual({ q: "groceries" });
  });

  it("removes a key when set to undefined", () => {
    setUrl("/transactions?q=coffee&startDate=2024-01-01");
    const { result } = renderHook(() =>
      useTransactionFilters({ fetchTransactions: makeFetcher() }),
    );

    act(() => {
      result.current.setFilter("q", undefined);
    });

    expect(result.current.filters).toEqual({ startDate: "2024-01-01" });
  });

  it("writes the change to the URL with replaceState, not pushState", () => {
    const replaceSpy = vi.spyOn(window.history, "replaceState");
    const pushSpy = vi.spyOn(window.history, "pushState");
    const { result } = renderHook(() =>
      useTransactionFilters({ fetchTransactions: makeFetcher() }),
    );

    act(() => {
      result.current.setFilter("q", "groceries");
    });

    expect(replaceSpy).toHaveBeenCalled();
    expect(pushSpy).not.toHaveBeenCalled();
    expect(new URLSearchParams(window.location.search).get("q")).toBe("groceries");
  });

  it("resets the page to 1 and triggers a new fetch", async () => {
    const fetchTransactions = makeFetcher();
    const { result } = renderHook(() => useTransactionFilters({ fetchTransactions }));
    await waitFor(() => expect(fetchTransactions).toHaveBeenCalledTimes(1));

    act(() => {
      result.current.setPage(3);
    });
    expect(result.current.page).toBe(3);
    await waitFor(() => expect(fetchTransactions).toHaveBeenCalledTimes(2));

    act(() => {
      result.current.setFilter("q", "groceries");
    });

    expect(result.current.page).toBe(1);
    await waitFor(() => expect(fetchTransactions).toHaveBeenCalledTimes(3));
    expect(fetchTransactions).toHaveBeenLastCalledWith(
      { q: "groceries" },
      1,
      expect.any(AbortSignal),
    );
  });
});

describe("useTransactionFilters: clearFilters", () => {
  it("resets filters to an empty object", () => {
    setUrl("/transactions?q=coffee&startDate=2024-01-01");
    const { result } = renderHook(() =>
      useTransactionFilters({ fetchTransactions: makeFetcher() }),
    );

    act(() => {
      result.current.clearFilters();
    });

    expect(result.current.filters).toEqual({});
  });

  it("writes an empty query string to the URL via replaceState", () => {
    setUrl("/transactions?q=coffee");
    const replaceSpy = vi.spyOn(window.history, "replaceState");
    const pushSpy = vi.spyOn(window.history, "pushState");
    const { result } = renderHook(() =>
      useTransactionFilters({ fetchTransactions: makeFetcher() }),
    );

    act(() => {
      result.current.clearFilters();
    });

    expect(replaceSpy).toHaveBeenCalled();
    expect(pushSpy).not.toHaveBeenCalled();
    expect(window.location.search).toBe("");
  });

  it("resets activeFilterCount and page, and re-fetches page 1 with empty filters", async () => {
    setUrl("/transactions?q=coffee&startDate=2024-01-01");
    const fetchTransactions = makeFetcher();
    const { result } = renderHook(() => useTransactionFilters({ fetchTransactions }));
    await waitFor(() => expect(fetchTransactions).toHaveBeenCalledTimes(1));

    act(() => {
      result.current.setPage(2);
    });
    await waitFor(() => expect(fetchTransactions).toHaveBeenCalledTimes(2));

    act(() => {
      result.current.clearFilters();
    });

    expect(result.current.activeFilterCount).toBe(0);
    expect(result.current.page).toBe(1);
    await waitFor(() =>
      expect(fetchTransactions).toHaveBeenLastCalledWith({}, 1, expect.any(AbortSignal)),
    );
  });
});

describe("useTransactionFilters: activeFilterCount", () => {
  it("is 0 when no filters are active", () => {
    const { result } = renderHook(() =>
      useTransactionFilters({ fetchTransactions: makeFetcher() }),
    );

    expect(result.current.activeFilterCount).toBe(0);
  });

  it("counts each active top-level filter key once, regardless of value size", () => {
    setUrl(
      "/transactions?startDate=2024-01-01&endDate=2024-01-31&categoryIds=1,2,3&includeUncategorized=true&q=coffee",
    );
    const { result } = renderHook(() =>
      useTransactionFilters({ fetchTransactions: makeFetcher() }),
    );

    expect(result.current.activeFilterCount).toBe(5);
  });

  it("updates as filters are set and cleared", () => {
    const { result } = renderHook(() =>
      useTransactionFilters({ fetchTransactions: makeFetcher() }),
    );

    act(() => {
      result.current.setFilter("q", "coffee");
    });
    expect(result.current.activeFilterCount).toBe(1);

    act(() => {
      result.current.setFilter("categoryIds", ["1", "2"]);
    });
    expect(result.current.activeFilterCount).toBe(2);

    act(() => {
      result.current.setFilter("q", undefined);
    });
    expect(result.current.activeFilterCount).toBe(1);
  });
});

describe("useTransactionFilters: browser back/forward", () => {
  it("resyncs filters when a popstate event fires, without rewriting the URL itself", () => {
    setUrl("/transactions?q=coffee");
    const { result } = renderHook(() =>
      useTransactionFilters({ fetchTransactions: makeFetcher() }),
    );
    expect(result.current.filters).toEqual({ q: "coffee" });

    const replaceSpy = vi.spyOn(window.history, "replaceState");

    act(() => {
      window.history.pushState({}, "", "/transactions?startDate=2024-01-01");
      window.dispatchEvent(new PopStateEvent("popstate"));
    });

    expect(result.current.filters).toEqual({ startDate: "2024-01-01" });
    expect(replaceSpy).not.toHaveBeenCalled();
  });

  it("triggers a refetch with page reset when filters change via popstate", async () => {
    setUrl("/transactions?q=coffee");
    const fetchTransactions = makeFetcher();
    const { result } = renderHook(() => useTransactionFilters({ fetchTransactions }));
    await waitFor(() => expect(fetchTransactions).toHaveBeenCalledTimes(1));

    act(() => {
      result.current.setPage(2);
    });
    await waitFor(() => expect(fetchTransactions).toHaveBeenCalledTimes(2));

    act(() => {
      window.history.pushState({}, "", "/transactions?startDate=2024-01-01");
      window.dispatchEvent(new PopStateEvent("popstate"));
    });

    expect(result.current.page).toBe(1);
    await waitFor(() =>
      expect(fetchTransactions).toHaveBeenLastCalledWith(
        { startDate: "2024-01-01" },
        1,
        expect.any(AbortSignal),
      ),
    );
  });
});

describe("useTransactionFilters: stale-response race", () => {
  it("does not let a stale response overwrite a newer one", async () => {
    const first = deferred<Page>();
    const second = deferred<Page>();
    const fetchTransactions = vi
      .fn<Fetcher>()
      .mockReturnValueOnce(first.promise)
      .mockReturnValueOnce(second.promise);

    const { result } = renderHook(() => useTransactionFilters({ fetchTransactions }));
    await waitFor(() => expect(fetchTransactions).toHaveBeenCalledTimes(1));

    act(() => {
      result.current.setFilter("q", "groceries");
    });
    await waitFor(() => expect(fetchTransactions).toHaveBeenCalledTimes(2));

    // Newer request resolves first.
    await act(async () => {
      second.resolve({ items: ["new"] });
    });
    await waitFor(() => expect(result.current.data).toEqual({ items: ["new"] }));

    // Older, stale request resolves after - must be discarded, not applied.
    await act(async () => {
      first.resolve({ items: ["stale"] });
    });

    expect(result.current.data).toEqual({ items: ["new"] });
  });

  it("aborts the previous in-flight request's signal when a newer one starts", async () => {
    const first = deferred<Page>();
    let firstSignal: AbortSignal | undefined;
    const fetchTransactions = vi.fn<Fetcher>().mockImplementationOnce((_f, _p, signal) => {
      firstSignal = signal;
      return first.promise;
    });
    fetchTransactions.mockResolvedValue({ items: [] });

    const { result } = renderHook(() => useTransactionFilters({ fetchTransactions }));
    await waitFor(() => expect(fetchTransactions).toHaveBeenCalledTimes(1));
    expect(firstSignal?.aborted).toBe(false);

    act(() => {
      result.current.setFilter("q", "groceries");
    });

    await waitFor(() => expect(firstSignal?.aborted).toBe(true));
  });

  it("exposes isLoading while a request is in flight and clears it once resolved", async () => {
    const first = deferred<Page>();
    const fetchTransactions = vi.fn<Fetcher>().mockReturnValueOnce(first.promise);

    const { result } = renderHook(() => useTransactionFilters({ fetchTransactions }));
    expect(result.current.isLoading).toBe(true);

    await act(async () => {
      first.resolve({ items: ["a"] });
    });

    expect(result.current.isLoading).toBe(false);
    expect(result.current.data).toEqual({ items: ["a"] });
  });
});
