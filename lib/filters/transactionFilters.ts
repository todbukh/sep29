/**
 * Canonical shared filter contract for transaction history filtering.
 *
 * This module is the single source of truth for parsing, validating, and
 * serializing transaction filters. The API uses it for request validation;
 * the frontend uses its types and serialization for URL state.
 *
 * Ownership: changes to `TransactionFilters` after merge require review
 * from the owners of the API filter route and the `useTransactionFilters`
 * hook.
 */

export interface TransactionFilters {
  startDate?: string;
  endDate?: string;
  categoryIds?: string[];
  includeUncategorized?: boolean;
  q?: string;
}

export interface FilterValidationError {
  field: string;
  message: string;
}

export type ParseFiltersResult =
  | { ok: true; filters: TransactionFilters }
  | { ok: false; errors: FilterValidationError[] };

export type QueryParamsInput =
  | URLSearchParams
  | Record<string, string | string[] | undefined>;

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const Q_MAX_LENGTH = 100;

function isValidDateString(value: string): boolean {
  if (!DATE_RE.test(value)) return false;
  const [yearStr, monthStr, dayStr] = value.split("-");
  const year = Number(yearStr!);
  const month = Number(monthStr!);
  const day = Number(dayStr!);
  const date = new Date(Date.UTC(year, month - 1, day));
  return (
    date.getUTCFullYear() === year &&
    date.getUTCMonth() === month - 1 &&
    date.getUTCDate() === day
  );
}

function normalizeInput(input: QueryParamsInput): Map<string, string[]> {
  const map = new Map<string, string[]>();

  if (input instanceof URLSearchParams) {
    for (const key of input.keys()) {
      if (!map.has(key)) {
        map.set(key, input.getAll(key));
      }
    }
    return map;
  }

  for (const [key, value] of Object.entries(input)) {
    if (value === undefined) continue;
    map.set(key, Array.isArray(value) ? value : [value]);
  }
  return map;
}

function firstValue(map: Map<string, string[]>, key: string): string | undefined {
  return map.get(key)?.[0];
}

function dedupe(values: string[]): string[] {
  const seen = new Set<string>();
  const result: string[] = [];
  for (const value of values) {
    if (!seen.has(value)) {
      seen.add(value);
      result.push(value);
    }
  }
  return result;
}

export function parseTransactionFilters(
  queryParams: QueryParamsInput,
): ParseFiltersResult {
  const map = normalizeInput(queryParams);
  const errors: FilterValidationError[] = [];
  const filters: TransactionFilters = {};

  const rawStartDate = firstValue(map, "startDate");
  if (rawStartDate !== undefined) {
    if (isValidDateString(rawStartDate)) {
      filters.startDate = rawStartDate;
    } else {
      errors.push({ field: "startDate", message: `Invalid date: "${rawStartDate}"` });
    }
  }

  const rawEndDate = firstValue(map, "endDate");
  if (rawEndDate !== undefined) {
    if (isValidDateString(rawEndDate)) {
      filters.endDate = rawEndDate;
    } else {
      errors.push({ field: "endDate", message: `Invalid date: "${rawEndDate}"` });
    }
  }

  if (
    filters.startDate !== undefined &&
    filters.endDate !== undefined &&
    filters.startDate > filters.endDate
  ) {
    errors.push({
      field: "startDate",
      message: `startDate ("${filters.startDate}") must not be after endDate ("${filters.endDate}")`,
    });
  }

  const rawCategoryIds = map.get("categoryIds") ?? [];
  const categoryIds = dedupe(
    rawCategoryIds
      .flatMap((value) => value.split(","))
      .map((value) => value.trim())
      .filter((value) => value.length > 0),
  );
  if (categoryIds.length > 0) {
    filters.categoryIds = categoryIds;
  }

  const rawIncludeUncategorized = firstValue(map, "includeUncategorized");
  if (rawIncludeUncategorized !== undefined) {
    if (rawIncludeUncategorized === "true") {
      filters.includeUncategorized = true;
    } else if (rawIncludeUncategorized === "false") {
      filters.includeUncategorized = false;
    } else {
      errors.push({
        field: "includeUncategorized",
        message: `Invalid boolean: "${rawIncludeUncategorized}"`,
      });
    }
  }

  const rawQ = firstValue(map, "q");
  if (rawQ !== undefined) {
    const trimmed = rawQ.trim();
    if (trimmed.length > 0) {
      filters.q = trimmed.slice(0, Q_MAX_LENGTH);
    }
  }

  if (errors.length > 0) {
    return { ok: false, errors };
  }
  return { ok: true, filters };
}

export function serializeTransactionFilters(
  filters: TransactionFilters,
): URLSearchParams {
  const params = new URLSearchParams();

  if (filters.startDate) {
    params.set("startDate", filters.startDate);
  }
  if (filters.endDate) {
    params.set("endDate", filters.endDate);
  }
  if (filters.categoryIds && filters.categoryIds.length > 0) {
    params.set("categoryIds", dedupe(filters.categoryIds).join(","));
  }
  if (filters.includeUncategorized !== undefined) {
    params.set("includeUncategorized", String(filters.includeUncategorized));
  }
  if (filters.q && filters.q.trim().length > 0) {
    params.set("q", filters.q.trim().slice(0, Q_MAX_LENGTH));
  }

  return params;
}
