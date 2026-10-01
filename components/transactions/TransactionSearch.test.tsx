// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { serializeTransactionFilters } from "../../lib/filters/transactionFilters.js";
import {
  SEARCH_DEBOUNCE_MS,
  SEARCH_MAX_LENGTH,
  TransactionSearch,
} from "./TransactionSearch.js";

function setup(props: { value?: string; debounceMs?: number } = {}) {
  const onChange = vi.fn<(q: string | undefined) => void>();
  // `delay: null` stops user-event awaiting a (faked) setTimeout between
  // actions, which would otherwise hang under vi.useFakeTimers().
  const user = userEvent.setup({ delay: null });
  const utils = render(<TransactionSearch onChange={onChange} {...props} />);
  const input = screen.getByRole<HTMLInputElement>("textbox", {
    name: "Search transactions",
  });
  return { ...utils, onChange, user, input };
}

function advance(ms: number) {
  act(() => {
    vi.advanceTimersByTime(ms);
  });
}

beforeEach(() => {
  vi.useFakeTimers();
  // Testing Library's asyncWrapper ends every `await user.*` call with a
  // `setTimeout(0)` that it only flushes when it detects Jest fake timers
  // (`typeof jest !== "undefined"`). Under Vitest that timer is faked and
  // never fires, hanging every interaction. Exposing a `jest` shim backed by
  // Vitest's clock lets it flush the timer.
  vi.stubGlobal("jest", {
    advanceTimersByTime: (ms: number) => vi.advanceTimersByTime(ms),
  });
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  vi.useRealTimers();
});

describe("TransactionSearch", () => {
  describe("debounce", () => {
    it("calls onChange once with the final value after 300ms of inactivity", async () => {
      const { user, input, onChange } = setup();

      await user.type(input, "coffee");
      expect(onChange).not.toHaveBeenCalled();

      advance(SEARCH_DEBOUNCE_MS - 1);
      expect(onChange).not.toHaveBeenCalled();

      advance(1);
      expect(onChange).toHaveBeenCalledTimes(1);
      expect(onChange).toHaveBeenCalledWith("coffee");
    });

    it("restarts the timer on each keystroke", async () => {
      const { user, input, onChange } = setup();

      await user.type(input, "cof");
      advance(200);
      await user.type(input, "fee");
      advance(200);
      expect(onChange).not.toHaveBeenCalled();

      advance(100);
      expect(onChange).toHaveBeenCalledTimes(1);
      expect(onChange).toHaveBeenCalledWith("coffee");
    });

    it("respects a custom debounceMs", async () => {
      const { user, input, onChange } = setup({ debounceMs: 500 });

      await user.type(input, "rent");
      advance(499);
      expect(onChange).not.toHaveBeenCalled();
      advance(1);
      expect(onChange).toHaveBeenCalledWith("rent");
    });

    it("triggers a search when text is pasted", async () => {
      const { user, input, onChange } = setup();

      await user.click(input);
      await user.paste("groceries");
      expect(input.value).toBe("groceries");

      advance(SEARCH_DEBOUNCE_MS);
      expect(onChange).toHaveBeenCalledTimes(1);
      expect(onChange).toHaveBeenCalledWith("groceries");
    });

    it("trims surrounding whitespace before submitting", async () => {
      const { user, input, onChange } = setup();

      await user.type(input, "  rent  ");
      advance(SEARCH_DEBOUNCE_MS);
      expect(input.value).toBe("  rent  ");
      expect(onChange).toHaveBeenCalledWith("rent");
    });

    it("does not trigger a request for whitespace-only input", async () => {
      const { user, input, onChange } = setup();

      await user.type(input, "   ");
      advance(SEARCH_DEBOUNCE_MS);
      expect(onChange).not.toHaveBeenCalled();
    });

    it("does not re-submit when only trailing whitespace changes", async () => {
      const { user, input, onChange } = setup();

      await user.type(input, "rent");
      advance(SEARCH_DEBOUNCE_MS);
      await user.type(input, "   ");
      advance(SEARCH_DEBOUNCE_MS);
      expect(onChange).toHaveBeenCalledTimes(1);
    });

    it("submits undefined when the user deletes all text", async () => {
      const { user, input, onChange } = setup({ value: "rent" });

      await user.clear(input);
      advance(SEARCH_DEBOUNCE_MS);
      expect(onChange).toHaveBeenCalledTimes(1);
      expect(onChange).toHaveBeenCalledWith(undefined);
    });

    it("does not fire a pending search after unmount", async () => {
      const { user, input, onChange, unmount } = setup();

      await user.type(input, "rent");
      unmount();
      advance(SEARCH_DEBOUNCE_MS);
      expect(onChange).not.toHaveBeenCalled();
    });
  });

  describe("clear button", () => {
    it("is hidden when the input is empty", () => {
      setup();
      expect(screen.queryByRole("button", { name: "Clear search" })).toBeNull();
    });

    it("clears the input immediately, submits undefined, and refocuses", async () => {
      const { user, input, onChange } = setup({ value: "rent" });

      await user.click(screen.getByRole("button", { name: "Clear search" }));

      expect(input.value).toBe("");
      expect(onChange).toHaveBeenCalledTimes(1);
      expect(onChange).toHaveBeenCalledWith(undefined);
      expect(document.activeElement).toBe(input);
      expect(screen.queryByRole("button", { name: "Clear search" })).toBeNull();
    });

    it("cancels a pending debounced search", async () => {
      const { user, input, onChange } = setup();

      await user.type(input, "rent");
      await user.click(screen.getByRole("button", { name: "Clear search" }));
      advance(SEARCH_DEBOUNCE_MS);

      // Nothing was committed yet, so clearing back to empty is a no-op.
      expect(onChange).not.toHaveBeenCalled();
      expect(input.value).toBe("");
    });
  });

  describe("Escape key", () => {
    it("clears the input and submits undefined", async () => {
      const { user, input, onChange } = setup({ value: "rent" });

      await user.click(input);
      await user.keyboard("{Escape}");

      expect(input.value).toBe("");
      expect(onChange).toHaveBeenCalledTimes(1);
      expect(onChange).toHaveBeenCalledWith(undefined);
    });

    it("cancels a pending debounced search", async () => {
      const { user, input, onChange } = setup({ value: "rent" });

      await user.type(input, "al");
      await user.keyboard("{Escape}");
      advance(SEARCH_DEBOUNCE_MS);

      expect(onChange).toHaveBeenCalledTimes(1);
      expect(onChange).toHaveBeenCalledWith(undefined);
    });

    it("lets Escape propagate when the input is already empty", () => {
      const { input, onChange } = setup();

      const notPrevented = fireEvent.keyDown(input, { key: "Escape" });
      expect(notPrevented).toBe(true);
      expect(onChange).not.toHaveBeenCalled();
    });

    it("ignores other keys", async () => {
      const { user, input, onChange } = setup({ value: "rent" });

      await user.click(input);
      await user.keyboard("{Enter}");
      advance(SEARCH_DEBOUNCE_MS);
      expect(input.value).toBe("rent");
      expect(onChange).not.toHaveBeenCalled();
    });
  });

  describe("max length", () => {
    it("matches the shared validator's limit", () => {
      const long = "a".repeat(SEARCH_MAX_LENGTH + 50);
      const serialized = serializeTransactionFilters({ q: long }).get("q");
      expect(serialized).toHaveLength(SEARCH_MAX_LENGTH);
      expect(SEARCH_MAX_LENGTH).toBe(100);
    });

    it("sets the maxLength attribute", () => {
      const { input } = setup();
      expect(input.maxLength).toBe(SEARCH_MAX_LENGTH);
    });

    it("stops accepting typed characters at the limit", async () => {
      const { user, input, onChange } = setup();

      await user.type(input, "b".repeat(SEARCH_MAX_LENGTH + 5));
      expect(input.value).toHaveLength(SEARCH_MAX_LENGTH);

      advance(SEARCH_DEBOUNCE_MS);
      expect(onChange).toHaveBeenCalledWith("b".repeat(SEARCH_MAX_LENGTH));
    });

    it("truncates pasted text to the limit", async () => {
      const { user, input, onChange } = setup();

      await user.click(input);
      await user.paste("c".repeat(SEARCH_MAX_LENGTH + 50));
      expect(input.value).toHaveLength(SEARCH_MAX_LENGTH);

      advance(SEARCH_DEBOUNCE_MS);
      expect(onChange).toHaveBeenCalledWith("c".repeat(SEARCH_MAX_LENGTH));
    });

    it("truncates values set programmatically past the limit", () => {
      const { input, onChange } = setup();

      fireEvent.change(input, { target: { value: "d".repeat(SEARCH_MAX_LENGTH + 1) } });
      expect(input.value).toHaveLength(SEARCH_MAX_LENGTH);

      advance(SEARCH_DEBOUNCE_MS);
      expect(onChange).toHaveBeenCalledWith("d".repeat(SEARCH_MAX_LENGTH));
    });

    it("truncates an over-long initial value", () => {
      const { input } = setup({ value: "e".repeat(SEARCH_MAX_LENGTH + 10) });
      expect(input.value).toHaveLength(SEARCH_MAX_LENGTH);
    });
  });

  describe("special characters", () => {
    const special = `50% off & <b>"café"</b> #1 ?q=a+b 😀`;

    it("displays and submits them unchanged", async () => {
      const { user, input, onChange, container } = setup();

      await user.click(input);
      await user.paste(special);
      expect(input.value).toBe(special);
      expect(container.querySelector("b")).toBeNull();

      advance(SEARCH_DEBOUNCE_MS);
      expect(onChange).toHaveBeenCalledWith(special);
    });

    it("round-trips through URL serialization", () => {
      const params = serializeTransactionFilters({ q: special });
      expect(new URLSearchParams(params.toString()).get("q")).toBe(special);
    });
  });

  describe("external value", () => {
    it("renders the initial value", () => {
      const { input } = setup({ value: "rent" });
      expect(input.value).toBe("rent");
    });

    it("syncs when the value prop changes externally", async () => {
      const { user, input, onChange, rerender } = setup({ value: "rent" });

      await user.type(input, "al");
      rerender(<TransactionSearch onChange={onChange} value="groceries" />);
      expect(input.value).toBe("groceries");

      // The pending "rental" search is discarded in favour of the new value.
      advance(SEARCH_DEBOUNCE_MS);
      expect(onChange).not.toHaveBeenCalled();
    });

    it("clears when the value prop is cleared externally", () => {
      const { input, onChange, rerender } = setup({ value: "rent" });

      rerender(<TransactionSearch onChange={onChange} />);
      expect(input.value).toBe("");
      expect(onChange).not.toHaveBeenCalled();
    });

    it("keeps the user's text when the parent echoes back the committed value", async () => {
      const { user, input, onChange, rerender } = setup();

      await user.type(input, "rent ");
      advance(SEARCH_DEBOUNCE_MS);
      rerender(<TransactionSearch onChange={onChange} value="rent" />);

      expect(input.value).toBe("rent ");
      expect(onChange).toHaveBeenCalledTimes(1);
    });

    it("calls the latest onChange prop", async () => {
      const { user, input, onChange, rerender } = setup();
      const nextOnChange = vi.fn();

      await user.type(input, "rent");
      rerender(<TransactionSearch onChange={nextOnChange} />);
      advance(SEARCH_DEBOUNCE_MS);

      expect(onChange).not.toHaveBeenCalled();
      expect(nextOnChange).toHaveBeenCalledWith("rent");
    });
  });
});
