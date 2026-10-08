export type DateRangePreset =
  | "last7Days"
  | "last30Days"
  | "thisMonth"
  | "lastMonth"
  | "thisYear"
  | "custom";

export interface DateRangeFilterBinding {
  getFilters: () => { startDate?: string; endDate?: string };
  updateFilters: (next: { startDate?: string; endDate?: string }) => void;
}

export interface DateRangeFilterViewModel {
  startDateLabel: string;
  endDateLabel: string;
  startDateValue?: string;
  endDateValue?: string;
  startDateDisplay?: string;
  endDateDisplay?: string;
  endDateMin?: string;
  error?: string;
  deemphasizedFutureDates: {
    startDate: boolean;
    endDate: boolean;
  };
}

const PRESET_LABELS: Record<DateRangePreset, string> = {
  last7Days: "Last 7 days",
  last30Days: "Last 30 days",
  thisMonth: "This month",
  lastMonth: "Last month",
  thisYear: "This year",
  custom: "Custom",
};

function formatDateInput(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function parseDateInput(value: string | undefined): Date | undefined {
  if (!value) return undefined;
  const [year, month, day] = value.split("-").map((segment) => Number(segment));
  if (!year || !month || !day) return undefined;

  const date = new Date(year, month - 1, day);
  if (
    date.getFullYear() !== year ||
    date.getMonth() !== month - 1 ||
    date.getDate() !== day
  ) {
    return undefined;
  }

  return date;
}

function startOfDay(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

function addDays(date: Date, amount: number): Date {
  const copy = new Date(date);
  copy.setDate(copy.getDate() + amount);
  return copy;
}

function getPresetRange(preset: DateRangePreset, now: Date): { startDate: string; endDate: string } | undefined {
  const today = startOfDay(now);

  switch (preset) {
    case "last7Days":
      return { startDate: formatDateInput(addDays(today, -6)), endDate: formatDateInput(today) };
    case "last30Days":
      return { startDate: formatDateInput(addDays(today, -29)), endDate: formatDateInput(today) };
    case "thisMonth":
      return {
        startDate: formatDateInput(new Date(today.getFullYear(), today.getMonth(), 1)),
        endDate: formatDateInput(today),
      };
    case "lastMonth": {
      const firstDayThisMonth = new Date(today.getFullYear(), today.getMonth(), 1);
      const lastDayLastMonth = addDays(firstDayThisMonth, -1);
      const firstDayLastMonth = new Date(
        lastDayLastMonth.getFullYear(),
        lastDayLastMonth.getMonth(),
        1,
      );
      return {
        startDate: formatDateInput(firstDayLastMonth),
        endDate: formatDateInput(lastDayLastMonth),
      };
    }
    case "thisYear":
      return {
        startDate: formatDateInput(new Date(today.getFullYear(), 0, 1)),
        endDate: formatDateInput(today),
      };
    case "custom":
      return undefined;
  }
}

function formatForLocale(value: string | undefined, locale: string): string | undefined {
  const parsed = parseDateInput(value);
  if (!parsed) return undefined;
  return new Intl.DateTimeFormat(locale).format(parsed);
}

function isFutureDate(value: string | undefined, now: Date): boolean {
  const parsed = parseDateInput(value);
  if (!parsed) return false;
  return parsed > startOfDay(now);
}

export function createDateRangeFilter(binding: DateRangeFilterBinding) {
  return {
    selectPreset(preset: DateRangePreset, now: Date = new Date()): void {
      const range = getPresetRange(preset, now);
      if (!range) return;
      binding.updateFilters(range);
    },

    setCustomRange(startDate?: string, endDate?: string): void {
      binding.updateFilters({ startDate, endDate });
    },

    clear(): void {
      binding.updateFilters({ startDate: undefined, endDate: undefined });
    },

    getViewModel(options?: { locale?: string; now?: Date }): DateRangeFilterViewModel {
      const locale = options?.locale ?? "en-US";
      const now = options?.now ?? new Date();
      const { startDate, endDate } = binding.getFilters();
      const error = startDate && endDate && startDate > endDate
        ? "End date must be on or after start date."
        : undefined;

      return {
        startDateLabel: "Start date",
        endDateLabel: "End date",
        startDateValue: startDate,
        endDateValue: endDate,
        startDateDisplay: formatForLocale(startDate, locale),
        endDateDisplay: formatForLocale(endDate, locale),
        endDateMin: startDate,
        error,
        deemphasizedFutureDates: {
          startDate: isFutureDate(startDate, now),
          endDate: isFutureDate(endDate, now),
        },
      };
    },

    renderHtml(options?: { locale?: string; now?: Date }): string {
      const view = this.getViewModel(options);
      const presetButtons = (Object.keys(PRESET_LABELS) as DateRangePreset[])
        .map((preset) => `<button type=\"button\" data-preset=\"${preset}\">${PRESET_LABELS[preset]}</button>`)
        .join("");

      const errorHtml = view.error ? `<p role=\"alert\">${view.error}</p>` : "";

      return [
        '<section aria-label="Date range filter">',
        `<label for=\"start-date\">${view.startDateLabel}</label>`,
        `<input id=\"start-date\" name=\"startDate\" type=\"date\" value=\"${view.startDateValue ?? ""}\" />`,
        `<label for=\"end-date\">${view.endDateLabel}</label>`,
        `<input id=\"end-date\" name=\"endDate\" type=\"date\" min=\"${view.endDateMin ?? ""}\" value=\"${view.endDateValue ?? ""}\" />`,
        presetButtons,
        '<button type="button" data-action="clear">Clear</button>',
        errorHtml,
        "</section>",
      ].join("");
    },
  };
}

export function checkDateRangeFilterAccessibility(html: string): string[] {
  const violations: string[] = [];
  const inputIds = [...html.matchAll(/<input[^>]*id=\"([^\"]+)\"[^>]*>/g)].map((match) => match[1]);

  for (const id of inputIds) {
    const labelRe = new RegExp(`<label[^>]*for=\\"${id}\\"[^>]*>[^<]+<\\/label>`);
    if (!labelRe.test(html)) {
      violations.push(`Missing label for input id \"${id}\"`);
    }
  }

  if (!/type=\"date\"/.test(html)) {
    violations.push("Date inputs are required");
  }

  if (!/type=\"button\"/.test(html)) {
    violations.push("Keyboard-accessible buttons are required");
  }

  return violations;
}
