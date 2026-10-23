import { useCallback, useRef, useState } from "react";
import { z } from "zod";

export type FormDraftStorage = Pick<Storage, "getItem" | "setItem" | "removeItem">;
export type FormDraftSnapshot<T> = { id: string; values: T };
export type FormDraftSnapshotValidator<T> = (snapshot: FormDraftSnapshot<T>) => boolean;

export type FormDraftRead<T> =
  | {
      status: "ready";
      id: string;
      values: T;
      stored: boolean;
      sourceRaw: string | null;
      sourceKey: string | null;
    }
  | { status: "invalid"; raw: string; sourceKey: string }
  | { status: "unavailable" };

type FormDraftState<T> =
  | {
      status: "ready";
      id: string;
      initialValues: T;
      stored: boolean;
      writeFailed: boolean;
      sourceRaw: string | null;
      sourceKey: string | null;
    }
  | { status: "invalid"; raw: string; sourceKey: string; discardFailed: boolean }
  | { status: "unavailable" };

export type ReadyFormDraft<T> = Extract<FormDraftState<T>, { status: "ready" }> & {
  save: (values: T) => boolean;
  startNew: (values?: T) => FormDraftSnapshot<T> & { stored: boolean };
  retryRead: () => void;
  discardInvalid: () => void;
};

export type RecoverableFormDraft<T> = Extract<
  FormDraftState<T>,
  { status: "invalid" | "unavailable" }
> & {
  save: (values: T) => boolean;
  startNew: (values?: T) => FormDraftSnapshot<T> & { stored: boolean };
  retryRead: () => void;
  discardInvalid: () => void;
};

const storedDraftEnvelope = z.strictObject({ id: z.uuid(), values: z.unknown() });

/** Read and validate persisted data before any form consumer receives its values. */
export function readFormDraft<T>(
  storage: FormDraftStorage | null,
  storageKey: string,
  valuesSchema: z.ZodType<T>,
  emptyValues: () => T,
  fallbackStorageKey?: string,
  validateSnapshot?: FormDraftSnapshotValidator<T>,
): FormDraftRead<T> {
  if (!storage) return { status: "unavailable" };

  let raw: string | null;
  let sourceKey: string | null = storageKey;
  try {
    raw = storage.getItem(storageKey);
    if (raw === null && fallbackStorageKey) {
      raw = storage.getItem(fallbackStorageKey);
      if (raw !== null) sourceKey = fallbackStorageKey;
    }
  } catch {
    return { status: "unavailable" };
  }

  if (raw === null) {
    return {
      status: "ready",
      id: crypto.randomUUID(),
      values: valuesSchema.parse(emptyValues()),
      stored: false,
      sourceRaw: null,
      sourceKey: null,
    };
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return { status: "invalid", raw, sourceKey };
  }

  const envelope = storedDraftEnvelope.safeParse(parsed);
  if (!envelope.success) return { status: "invalid", raw, sourceKey };
  const values = valuesSchema.safeParse(envelope.data.values);
  if (!values.success) return { status: "invalid", raw, sourceKey };
  const snapshot = { id: envelope.data.id, values: values.data };
  if (validateSnapshot && !validateSnapshot(snapshot)) return { status: "invalid", raw, sourceKey };
  return {
    status: "ready",
    id: snapshot.id,
    values: snapshot.values,
    stored: true,
    sourceRaw: raw,
    sourceKey,
  };
}

/** Keep failures visible to the caller; never make a failed write look durable. */
export function persistFormDraft<T>(
  storage: FormDraftStorage | null,
  storageKey: string,
  draft: FormDraftSnapshot<T>,
): boolean {
  if (!storage) return false;
  try {
    storage.setItem(storageKey, JSON.stringify(draft));
    return true;
  } catch {
    return false;
  }
}

/** Removal is explicit and its failure must leave the old raw draft available for recovery. */
export function removeStoredFormDraft(
  storage: FormDraftStorage | null,
  storageKey: string,
): boolean {
  if (!storage) return false;
  try {
    storage.removeItem(storageKey);
    return true;
  } catch {
    return false;
  }
}

function sessionStorageOrNull(): FormDraftStorage | null {
  try {
    return globalThis.sessionStorage;
  } catch {
    return null;
  }
}

function stateFromRead<T>(result: FormDraftRead<T>): FormDraftState<T> {
  if (result.status === "ready") {
    return {
      status: "ready",
      id: result.id,
      initialValues: result.values,
      stored: result.stored,
      writeFailed: false,
      sourceRaw: result.sourceRaw,
      sourceKey: result.sourceKey,
    };
  }
  if (result.status === "invalid") return { ...result, discardFailed: false };
  return result;
}

/**
 * Form resilience (FR-038, FR-042): restore only a validated form shape and keep the mutation
 * UUID until a confirmed ACK. A storage failure remains explicit and blocks the next request.
 */
export function useFormDraft<T>(
  key: string,
  emptyValues: () => T,
  valuesSchema: z.ZodType<T>,
  fallbackKey?: string,
  validateSnapshot?: FormDraftSnapshotValidator<T>,
): ReadyFormDraft<T> | RecoverableFormDraft<T> {
  const storageKey = `domy:draft:${key}`;
  const fallbackStorageKey = fallbackKey ? `domy:draft:${fallbackKey}` : undefined;
  const [state, setState] = useState<FormDraftState<T>>(() =>
    stateFromRead(
      readFormDraft(
        sessionStorageOrNull(),
        storageKey,
        valuesSchema,
        emptyValues,
        fallbackStorageKey,
        validateSnapshot,
      ),
    ),
  );
  const stateRef = useRef(state);

  const updateState = useCallback((next: FormDraftState<T>) => {
    stateRef.current = next;
    setState(next);
  }, []);

  const retryRead = useCallback(() => {
    updateState(
      stateFromRead(
        readFormDraft(
          sessionStorageOrNull(),
          storageKey,
          valuesSchema,
          emptyValues,
          fallbackStorageKey,
          validateSnapshot,
        ),
      ),
    );
  }, [emptyValues, fallbackStorageKey, storageKey, updateState, validateSnapshot, valuesSchema]);

  const discardInvalid = useCallback(() => {
    const current = stateRef.current;
    if (current.status !== "invalid") return;

    if (!removeStoredFormDraft(sessionStorageOrNull(), current.sourceKey)) {
      updateState({ ...current, discardFailed: true });
      return;
    }

    const values = valuesSchema.parse(emptyValues());
    const draft = { id: crypto.randomUUID(), values };
    const stored = persistFormDraft(sessionStorageOrNull(), storageKey, draft);
    updateState({
      status: "ready",
      id: draft.id,
      initialValues: values,
      stored,
      writeFailed: !stored,
      sourceRaw: stored ? JSON.stringify(draft) : null,
      sourceKey: stored ? storageKey : null,
    });
  }, [emptyValues, storageKey, updateState, valuesSchema]);

  const save = useCallback(
    (values: T): boolean => {
      const current = stateRef.current;
      if (current.status !== "ready") return false;

      const parsed = valuesSchema.safeParse(values);
      if (!parsed.success) {
        if (!current.writeFailed) updateState({ ...current, writeFailed: true });
        return false;
      }
      const snapshot = { id: current.id, values: parsed.data };
      if (
        (validateSnapshot && !validateSnapshot(snapshot)) ||
        !persistFormDraft(sessionStorageOrNull(), storageKey, snapshot)
      ) {
        if (!current.writeFailed) updateState({ ...current, writeFailed: true });
        return false;
      }
      const sourceRaw = JSON.stringify(snapshot);
      if (
        !current.stored ||
        current.writeFailed ||
        current.sourceRaw !== sourceRaw ||
        current.sourceKey !== storageKey
      ) {
        updateState({
          ...current,
          initialValues: parsed.data,
          stored: true,
          writeFailed: false,
          sourceRaw,
          sourceKey: storageKey,
        });
      }
      return true;
    },
    [storageKey, updateState, validateSnapshot, valuesSchema],
  );

  const startNew = useCallback(
    (nextValues: T = emptyValues()): FormDraftSnapshot<T> & { stored: boolean } => {
      if (stateRef.current.status !== "ready") {
        throw new Error(
          "No se puede iniciar otro borrador mientras el actual requiere recuperación.",
        );
      }
      const values = valuesSchema.parse(nextValues);
      const draft = { id: crypto.randomUUID(), values };
      const stored = persistFormDraft(sessionStorageOrNull(), storageKey, draft);
      const current = stateRef.current;
      updateState({
        status: "ready",
        id: draft.id,
        initialValues: values,
        stored,
        writeFailed: !stored,
        sourceRaw: stored ? JSON.stringify(draft) : current.sourceRaw,
        sourceKey: stored ? storageKey : current.sourceKey,
      });
      return { ...draft, stored };
    },
    [emptyValues, storageKey, updateState, valuesSchema],
  );

  const actions = { save, startNew, retryRead, discardInvalid };
  if (state.status === "ready") return { ...state, ...actions };
  return { ...state, ...actions };
}
