import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type ChangeEvent,
  type KeyboardEvent,
} from "react";

/**
 * Must match `Q_MAX_LENGTH` in `lib/filters/transactionFilters.ts`. The
 * shared validator truncates `q` to this length; enforcing it here keeps the
 * input from showing text that would never be searched for.
 */
export const SEARCH_MAX_LENGTH = 100;

export const SEARCH_DEBOUNCE_MS = 300;

export interface TransactionSearchProps {
  /** Current committed `q` filter value (e.g. `filters.q`). */
  value?: string;
  /**
   * Called with the trimmed query after the debounce settles, or `undefined`
   * when the query is cleared. Not called for whitespace-only input or when
   * the trimmed query is unchanged.
   */
  onChange: (q: string | undefined) => void;
  debounceMs?: number;
  placeholder?: string;
  label?: string;
}

function normalizeQuery(text: string): string | undefined {
  const trimmed = text.trim();
  return trimmed.length > 0 ? trimmed : undefined;
}

export function TransactionSearch({
  value,
  onChange,
  debounceMs = SEARCH_DEBOUNCE_MS,
  placeholder = "Search transactions",
  label = "Search transactions",
}: TransactionSearchProps) {
  const [text, setText] = useState(() => (value ?? "").slice(0, SEARCH_MAX_LENGTH));
  const inputRef = useRef<HTMLInputElement>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const committedRef = useRef<string | undefined>(normalizeQuery(value ?? ""));
  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;

  const cancelPending = useCallback(() => {
    if (timerRef.current !== undefined) {
      clearTimeout(timerRef.current);
      timerRef.current = undefined;
    }
  }, []);

  const commit = useCallback((q: string | undefined) => {
    if (q === committedRef.current) return;
    committedRef.current = q;
    onChangeRef.current(q);
  }, []);

  // Sync when `q` changes from outside (clear all, back/forward navigation).
  useEffect(() => {
    const external = normalizeQuery(value ?? "");
    if (external === committedRef.current) return;
    cancelPending();
    committedRef.current = external;
    setText((value ?? "").slice(0, SEARCH_MAX_LENGTH));
  }, [value, cancelPending]);

  useEffect(() => cancelPending, [cancelPending]);

  const handleChange = (event: ChangeEvent<HTMLInputElement>) => {
    const next = event.target.value.slice(0, SEARCH_MAX_LENGTH);
    setText(next);
    cancelPending();
    timerRef.current = setTimeout(() => {
      timerRef.current = undefined;
      commit(normalizeQuery(next));
    }, debounceMs);
  };

  const clear = () => {
    cancelPending();
    setText("");
    commit(undefined);
    inputRef.current?.focus();
  };

  const handleKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === "Escape" && text.length > 0) {
      event.preventDefault();
      clear();
    }
  };

  return (
    <div role="search" className="transaction-search">
      <input
        ref={inputRef}
        type="text"
        aria-label={label}
        placeholder={placeholder}
        value={text}
        maxLength={SEARCH_MAX_LENGTH}
        onChange={handleChange}
        onKeyDown={handleKeyDown}
        autoComplete="off"
        spellCheck={false}
      />
      {text.length > 0 && (
        <button type="button" aria-label="Clear search" onClick={clear}>
          ×
        </button>
      )}
    </div>
  );
}
