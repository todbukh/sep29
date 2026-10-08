import { afterEach, describe, expect, it, vi } from "vitest";
import {
  checkDateRangeFilterAccessibility,
  createDateRangeFilter,
  type DateRangeFilterBinding,
} from "./DateRangeFilter.js";

function createBinding(initial: { startDate?: string; endDate?: string } = {}): {
  binding: DateRangeFilterBinding;
  read: () => { startDate?: string; endDate?: string };
} {
  let filters = { ...initial };

  return {
    binding: {
      getFilters: () => filters,
      updateFilters: (next) => {
        filters = { ...filters, ...next };
      },
    },
    read: () => filters,
  };
}

describe("DateRangeFilter", () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it("applies Last 7 days and Last 30 days presets using the mocked clock", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-03-14T08:30:00.000Z"));
    const state = createBinding();
    const filter = createDateRangeFilter(state.binding);

    filter.selectPreset("last7Days");
    expect(state.read()).toEqual({
      startDate: "2026-03-08",
      endDate: "2026-03-14",
    });

    filter.selectPreset("last30Days");
    expect(state.read()).toEqual({
      startDate: "2026-02-13",
      endDate: "2026-03-14",
    });
  });

  it("computes Last month correctly across a year boundary", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-01-05T12:00:00.000Z"));
    const state = createBinding();
    const filter = createDateRangeFilter(state.binding);

    filter.selectPreset("lastMonth");

    expect(state.read()).toEqual({
      startDate: "2025-12-01",
      endDate: "2025-12-31",
    });
  });

  it("applies This month and This year presets and keeps Custom as manual mode", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-03-14T08:30:00.000Z"));
    const state = createBinding();
    const filter = createDateRangeFilter(state.binding);

    filter.selectPreset("thisMonth");
    expect(state.read()).toEqual({
      startDate: "2026-03-01",
      endDate: "2026-03-14",
    });

    filter.selectPreset("thisYear");
    expect(state.read()).toEqual({
      startDate: "2026-01-01",
      endDate: "2026-03-14",
    });

    filter.selectPreset("custom");
    expect(state.read()).toEqual({
      startDate: "2026-01-01",
      endDate: "2026-03-14",
    });
  });

  it("supports custom range, locale display, and invalid range state", () => {
    const state = createBinding();
    const filter = createDateRangeFilter(state.binding);

    filter.setCustomRange("2026-10-10", "2026-10-02");

    expect(state.read()).toEqual({
      startDate: "2026-10-10",
      endDate: "2026-10-02",
    });

    const view = filter.getViewModel({ locale: "en-GB", now: new Date("2026-10-08T09:00:00.000Z") });

    expect(view.error).toBe("End date must be on or after start date.");
    expect(view.endDateMin).toBe("2026-10-10");
    expect(view.startDateDisplay).toBe("10/10/2026");
    expect(view.endDateDisplay).toBe("02/10/2026");
    expect(view.deemphasizedFutureDates).toEqual({ startDate: true, endDate: false });
  });

  it("clears the date range", () => {
    const state = createBinding({ startDate: "2026-10-01", endDate: "2026-10-08" });
    const filter = createDateRangeFilter(state.binding);

    filter.clear();

    expect(state.read()).toEqual({ startDate: undefined, endDate: undefined });
  });

  it("passes accessibility checks for labeled keyboard-accessible controls", () => {
    const state = createBinding({ startDate: "2026-10-01", endDate: "2026-10-08" });
    const filter = createDateRangeFilter(state.binding);

    const html = filter.renderHtml();
    expect(html).toContain("Last 7 days");
    expect(html).toContain("Last 30 days");
    expect(html).toContain("This month");
    expect(html).toContain("Last month");
    expect(html).toContain("This year");
    expect(html).toContain("Custom");
    expect(checkDateRangeFilterAccessibility(html)).toEqual([]);
  });
});
