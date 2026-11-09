import SearchIcon from "@material-symbols/svg-400/rounded/search.svg?react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import { Icon } from "@/components/icon";
import { ShipmentStatusMark } from "@/components/shipment-status-mark";
import { TrackingNumber } from "@/components/tracking-number";
import { boardQueryOptions } from "./board-query";
import { searchBoard } from "./board-search";

/**
 * Search by tracking number, merchant, recipient, or phone from any page (design-system.md §7),
 * as approved with the board (feature 006, T019): from two characters, the day's matching
 * shipments open below the field, each a link to its detail; Enter takes the search to
 * «Historial», which also finds phones and references.
 */
export function GlobalSearch() {
  const navigate = useNavigate();
  const [term, setTerm] = useState("");
  const [open, setOpen] = useState(false);
  const input = useRef<HTMLInputElement>(null);
  const box = useRef<HTMLElement>(null);
  const typed = term.trim().length >= 2;
  const board = useQuery({ ...boardQueryOptions(), enabled: typed, staleTime: 20_000 });
  const results = typed && board.data ? searchBoard(board.data, term) : [];
  const showing = open && typed && board.data !== undefined;

  // "/" jumps to the search from anywhere, unless the person is already typing.
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement;
      if (event.key !== "/" || event.metaKey || event.ctrlKey || event.altKey) return;
      if (target.closest("input, textarea, select, [contenteditable=true]")) return;
      event.preventDefault();
      input.current?.focus();
    };
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("keydown", onKey);
    };
  }, []);

  // A press outside closes the results; focus moving into them keeps them open.
  useEffect(() => {
    if (!showing) return;
    const onDown = (event: PointerEvent) => {
      if (event.target instanceof Node && !box.current?.contains(event.target)) setOpen(false);
    };
    document.addEventListener("pointerdown", onDown);
    return () => {
      document.removeEventListener("pointerdown", onDown);
    };
  }, [showing]);

  const done = () => {
    setTerm("");
    setOpen(false);
  };

  return (
    <search
      ref={box}
      className="relative block w-full max-w-xl min-w-0"
      onKeyDown={(event) => {
        if (event.key === "Escape" && open) {
          setOpen(false);
          input.current?.focus();
        }
      }}
    >
      <form
        className="flex h-12 items-center gap-3 rounded-sm border border-outline bg-sheet px-4 text-on-surface-variant transition-[border-color,box-shadow] hover:border-on-surface focus-within:border-accent-strong focus-within:shadow-[inset_0_0_0_1px_var(--color-accent-strong)]"
        onSubmit={(event) => {
          event.preventDefault();
          const q = term.trim();
          if (!q) return;
          done();
          void navigate({ to: "/historial", search: { q } });
        }}
      >
        <Icon symbol={SearchIcon} />
        <input
          ref={input}
          type="search"
          value={term}
          onChange={(event) => {
            setTerm(event.target.value);
            setOpen(true);
          }}
          onFocus={() => {
            setOpen(true);
          }}
          aria-label="Buscar envíos"
          aria-keyshortcuts="/"
          placeholder="Buscar guía, cliente, destinatario o teléfono"
          className="h-full min-h-12 min-w-0 flex-1 bg-transparent text-body-l text-on-surface outline-none placeholder:text-on-surface-variant"
        />
        <kbd
          aria-hidden="true"
          className="hidden h-6 min-w-6 items-center justify-center rounded-xs border border-outline-variant px-1.5 text-label-m text-on-surface-variant md:flex"
        >
          /
        </kbd>
      </form>
      {/* Mounted while the person is in the search, so its count is announced as they type,
          without leaving an empty status region on every page. */}
      {open && (
        <p role="status" className="sr-only">
          {showing
            ? results.length === 0
              ? "No hay envíos de hoy con esa búsqueda."
              : `${String(results.length)} ${results.length === 1 ? "envío" : "envíos"} de hoy`
            : ""}
        </p>
      )}
      {showing && (
        <div className="absolute inset-x-0 top-[calc(100%+6px)] z-30 rounded-lg border border-outline-variant bg-sheet p-1.5 shadow-lg">
          {results.length > 0 ? (
            <ul aria-label="Envíos de hoy">
              {results.map((shipment) => (
                <li key={shipment.id}>
                  <Link
                    to="/envios/$trackingNumber"
                    params={{ trackingNumber: shipment.trackingNumber }}
                    onClick={done}
                    className="grid min-h-12 grid-cols-[6.5rem_minmax(0,1fr)_auto] items-center gap-2.5 rounded-sm px-2.5 py-1.5 text-on-surface outline-none hover:bg-on-surface/8 focus-visible:outline-2 focus-visible:outline-solid focus-visible:-outline-offset-2 focus-visible:outline-accent-strong"
                  >
                    <TrackingNumber value={shipment.trackingNumber} />
                    <span className="min-w-0">
                      <span className="block truncate font-semibold">
                        {shipment.recipientName ?? shipment.merchant.name}
                      </span>
                      <span className="block truncate text-body-m text-on-surface-variant">
                        {[shipment.merchant.name, shipment.recipientNeighborhood?.name]
                          .filter(Boolean)
                          .join(" · ")}
                      </span>
                    </span>
                    <ShipmentStatusMark status={shipment.status} />
                  </Link>
                </li>
              ))}
            </ul>
          ) : (
            <p className="p-3 text-body-m text-on-surface-variant">
              No hay envíos de hoy con esa búsqueda. Pulsa Enter para buscarla en «Historial».
            </p>
          )}
        </div>
      )}
    </search>
  );
}

/** "Actualizado hace 4 s" while the board refreshes itself (approved with the board, FR-023). */
export function LastUpdate() {
  const queryClient = useQueryClient();
  const updatedAt = useSyncExternalStore(
    (onChange) => queryClient.getQueryCache().subscribe(onChange),
    () =>
      Math.max(
        0,
        ...queryClient
          .getQueryCache()
          .findAll({ queryKey: ["board"] })
          .map((query) => query.state.dataUpdatedAt),
      ),
  );
  const [nowMs, setNowMs] = useState(() => Date.now());
  useEffect(() => {
    const id = setInterval(() => {
      setNowMs(Date.now());
    }, 1000);
    return () => {
      clearInterval(id);
    };
  }, []);
  if (!updatedAt) return null;
  const seconds = Math.max(0, Math.round((nowMs - updatedAt) / 1000));
  return (
    <span className="inline-flex items-center gap-2 px-1.5 text-body-m whitespace-nowrap text-on-surface-variant max-md:hidden">
      <span
        aria-hidden="true"
        className="size-2 rounded-full bg-accent-strong motion-safe:animate-[next-stop_2.2s_ease-out_infinite]"
      />
      Actualizado hace{" "}
      {seconds < 60 ? `${String(seconds)} s` : `${String(Math.floor(seconds / 60))} min`}
    </span>
  );
}
