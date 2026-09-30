import { useCallback, useState } from "react";

/**
 * Form resilience (FR-038, FR-042): the values survive failed saves, an expired session, and a
 * lost connection (kept in this tab's session storage), and the record's identifier is
 * generated once per draft and reused on every retry, so a repeated save never duplicates.
 */
export function useFormDraft<T>(key: string, emptyValues: () => T) {
  const storageKey = `domy:draft:${key}`;
  const [draft, setDraft] = useState<{ id: string; values: T }>(() => {
    try {
      const stored = sessionStorage.getItem(storageKey);
      if (stored) return JSON.parse(stored) as { id: string; values: T };
    } catch {
      // Storage unavailable: start a new draft.
    }
    return { id: crypto.randomUUID(), values: emptyValues() };
  });

  const save = useCallback(
    (values: T) => {
      try {
        sessionStorage.setItem(storageKey, JSON.stringify({ id: draft.id, values }));
      } catch {
        // Storage full or unavailable: the form still keeps its values in memory.
      }
    },
    [storageKey, draft.id],
  );

  /** Discards the draft after a confirmed save and starts a new one. */
  const startNew = useCallback(() => {
    const next = { id: crypto.randomUUID(), values: emptyValues() };
    try {
      sessionStorage.removeItem(storageKey);
    } catch {
      // Nothing to clear.
    }
    setDraft(next);
    return next;
  }, [storageKey, emptyValues]);

  return { id: draft.id, initialValues: draft.values, save, startNew };
}
