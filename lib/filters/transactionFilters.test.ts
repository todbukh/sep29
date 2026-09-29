import { describe, expect, it } from "vitest";
import {
  parseTransactionFilters,
  serializeTransactionFilters,
  type TransactionFilters,
} from "./transactionFilters.js";

describe("parseTransactionFilters", () => {
  it("parses a fully populated set of filters", () => {
    const result = parseTransactionFilters({
      startDate: "2024-01-01",
      endDate: "2024-01-31",
      categoryIds: "1,2,3",
      includeUncategorized: "true",
      q: "groceries",
    });

    expect(result).toEqual({
      ok: true,
      filters: {
        startDate: "2024-01-01",
        endDate: "2024-01-31",
        categoryIds: ["1", "2", "3"],
        includeUncategorized: true,
        q: "groceries",
      },
    });
  });

  it("returns an empty filters object for no params", () => {
    const result = parseTransactionFilters({});
    expect(result).toEqual({ ok: true, filters: {} });
  });

  it("accepts only a start date (open-ended range)", () => {
    const result = parseTransactionFilters({ startDate: "2024-01-01" });
    expect(result).toEqual({ ok: true, filters: { startDate: "2024-01-01" } });
  });

  it("accepts only an end date (open-ended range)", () => {
    const result = parseTransactionFilters({ endDate: "2024-01-31" });
    expect(result).toEqual({ ok: true, filters: { endDate: "2024-01-31" } });
  });

  it("rejects startDate after endDate", () => {
    const result = parseTransactionFilters({
      startDate: "2024-02-01",
      endDate: "2024-01-01",
    });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.errors).toEqual([
        {
          field: "startDate",
          message: 'startDate ("2024-02-01") must not be after endDate ("2024-01-01")',
        },
      ]);
    }
  });

  it("accepts startDate equal to endDate", () => {
    const result = parseTransactionFilters({
      startDate: "2024-01-01",
      endDate: "2024-01-01",
    });
    expect(result).toEqual({
      ok: true,
      filters: { startDate: "2024-01-01", endDate: "2024-01-01" },
    });
  });

  it.each([
    ["2024-02-30", "startDate"],
    ["abc", "startDate"],
    ["2024/01/01", "startDate"],
    ["2024-13-01", "startDate"],
  ])("rejects invalid date %s", (value, field) => {
    const result = parseTransactionFilters({ [field]: value });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.errors).toEqual([
        { field, message: `Invalid date: "${value}"` },
      ]);
    }
  });

  it("rejects an invalid endDate", () => {
    const result = parseTransactionFilters({ endDate: "2024-02-30" });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.errors).toEqual([
        { field: "endDate", message: 'Invalid date: "2024-02-30"' },
      ]);
    }
  });

  it("accumulates multiple validation errors", () => {
    const result = parseTransactionFilters({
      startDate: "abc",
      endDate: "def",
      includeUncategorized: "maybe",
    });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.errors).toHaveLength(3);
    }
  });

  it("dedupes duplicate category IDs from a comma-separated list", () => {
    const result = parseTransactionFilters({ categoryIds: "1,2,1,3,2" });
    expect(result).toEqual({ ok: true, filters: { categoryIds: ["1", "2", "3"] } });
  });

  it("dedupes duplicate category IDs from repeated params", () => {
    const result = parseTransactionFilters({ categoryIds: ["1", "2", "1"] });
    expect(result).toEqual({ ok: true, filters: { categoryIds: ["1", "2"] } });
  });

  it("dedupes category IDs mixing repeated params and comma-separated values", () => {
    const result = parseTransactionFilters({ categoryIds: ["1,2", "2,3"] });
    expect(result).toEqual({ ok: true, filters: { categoryIds: ["1", "2", "3"] } });
  });

  it("trims whitespace around category IDs and drops empty entries", () => {
    const result = parseTransactionFilters({ categoryIds: " 1 , , 2 ," });
    expect(result).toEqual({ ok: true, filters: { categoryIds: ["1", "2"] } });
  });

  it("omits categoryIds entirely when none are present", () => {
    const result = parseTransactionFilters({ categoryIds: "" });
    expect(result).toEqual({ ok: true, filters: {} });
  });

  it("treats empty q as absent", () => {
    const result = parseTransactionFilters({ q: "" });
    expect(result).toEqual({ ok: true, filters: {} });
  });

  it("treats whitespace-only q as absent", () => {
    const result = parseTransactionFilters({ q: "   " });
    expect(result).toEqual({ ok: true, filters: {} });
  });

  it("trims q", () => {
    const result = parseTransactionFilters({ q: "  coffee  " });
    expect(result).toEqual({ ok: true, filters: { q: "coffee" } });
  });

  it("caps q at 100 characters", () => {
    const longQuery = "a".repeat(150);
    const result = parseTransactionFilters({ q: longQuery });
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.filters.q).toHaveLength(100);
      expect(result.filters.q).toBe("a".repeat(100));
    }
  });

  it("parses includeUncategorized=false", () => {
    const result = parseTransactionFilters({ includeUncategorized: "false" });
    expect(result).toEqual({ ok: true, filters: { includeUncategorized: false } });
  });

  it("rejects an invalid includeUncategorized value", () => {
    const result = parseTransactionFilters({ includeUncategorized: "yes" });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.errors).toEqual([
        { field: "includeUncategorized", message: 'Invalid boolean: "yes"' },
      ]);
    }
  });

  it("ignores unknown params instead of rejecting them", () => {
    const result = parseTransactionFilters({
      q: "coffee",
      sortBy: "amount",
      page: "2",
    } as Record<string, string>);
    expect(result).toEqual({ ok: true, filters: { q: "coffee" } });
  });

  it("skips explicit undefined values in a plain object input", () => {
    const result = parseTransactionFilters({ q: undefined, startDate: "2024-01-01" });
    expect(result).toEqual({ ok: true, filters: { startDate: "2024-01-01" } });
  });

  it("accepts a URLSearchParams instance with repeated categoryIds", () => {
    const params = new URLSearchParams();
    params.append("categoryIds", "1");
    params.append("categoryIds", "2");
    params.set("q", "rent");

    const result = parseTransactionFilters(params);
    expect(result).toEqual({
      ok: true,
      filters: { categoryIds: ["1", "2"], q: "rent" },
    });
  });
});

describe("serializeTransactionFilters", () => {
  it("omits empty/undefined values", () => {
    const params = serializeTransactionFilters({});
    expect(params.toString()).toBe("");
  });

  it("serializes a fully populated filter set", () => {
    const params = serializeTransactionFilters({
      startDate: "2024-01-01",
      endDate: "2024-01-31",
      categoryIds: ["1", "2"],
      includeUncategorized: true,
      q: "groceries",
    });

    expect(params.get("startDate")).toBe("2024-01-01");
    expect(params.get("endDate")).toBe("2024-01-31");
    expect(params.get("categoryIds")).toBe("1,2");
    expect(params.get("includeUncategorized")).toBe("true");
    expect(params.get("q")).toBe("groceries");
  });

  it("serializes includeUncategorized=false explicitly", () => {
    const params = serializeTransactionFilters({ includeUncategorized: false });
    expect(params.get("includeUncategorized")).toBe("false");
  });

  it("omits an empty categoryIds array", () => {
    const params = serializeTransactionFilters({ categoryIds: [] });
    expect(params.has("categoryIds")).toBe(false);
  });

  it("omits a blank q", () => {
    const params = serializeTransactionFilters({ q: "   " });
    expect(params.has("q")).toBe(false);
  });
});

describe("round-trip: parse(serialize(filters))", () => {
  const cases: TransactionFilters[] = [
    {},
    { startDate: "2024-01-01" },
    { endDate: "2024-01-31" },
    { startDate: "2024-01-01", endDate: "2024-01-31" },
    { categoryIds: ["1", "2", "3"] },
    { includeUncategorized: true },
    { includeUncategorized: false },
    { q: "coffee" },
    {
      startDate: "2024-01-01",
      endDate: "2024-12-31",
      categoryIds: ["9", "4", "2"],
      includeUncategorized: false,
      q: "a".repeat(100),
    },
  ];

  it.each(cases)("round-trips %j", (filters) => {
    const serialized = serializeTransactionFilters(filters);
    const result = parseTransactionFilters(serialized);
    expect(result).toEqual({ ok: true, filters });
  });
});
