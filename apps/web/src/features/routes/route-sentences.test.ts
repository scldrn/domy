import type { RouteDetail, RouteSummary, RouteTask, UnassignedShipment } from "@domy/domain";
import { describe, expect, it } from "vitest";
import type { SentencePart } from "@/components/summary-sentence";
import { routeMarks, routeSentence, routesDaySentence, stopStates } from "./route-sentences";

const read = (parts: SentencePart[]) => parts.map((part) => part.text).join("");
const camilo = { id: "c1", name: "Camilo Restrepo" };

const summary = (status: RouteSummary["status"]): RouteSummary =>
  ({ id: crypto.randomUUID(), number: 1, status }) as RouteSummary;

const waiting = (windowEnd: string | null): UnassignedShipment =>
  ({ id: crypto.randomUUID(), status: "registered", windowEnd }) as UnassignedShipment;

const task = (status: RouteTask["status"], kind: RouteTask["kind"] = "delivery"): RouteTask =>
  ({
    id: crypto.randomUUID(),
    kind,
    status,
    completedAt: status === "pending" ? null : "2026-11-03T17:00:00.000Z",
  }) as RouteTask;

const route = (status: RouteDetail["status"], tasks: RouteTask["status"][]): RouteDetail =>
  ({
    status,
    serviceDate: "2026-11-03",
    courier: camilo,
    finishedAt: "2026-11-03T23:40:00.000Z",
    progress: { completed: tasks.filter((t) => t !== "pending").length, total: tasks.length },
    stops: tasks.map((t, i) => ({
      id: `s${String(i)}`,
      position: i + 1,
      kind: "delivery",
      address: `Calle ${String(i)}`,
      neighborhood: { id: "n", name: i === 2 ? "Laureles" : "Belén" },
      tasks: [task(t)],
    })),
  }) as RouteDetail;

describe("routesDaySentence (approved «Rutas»)", () => {
  const now = new Date("2026-11-03T20:00:00.000Z");

  it("counts the day's routes by state and the shipments without a route that are late", () => {
    const parts = routesDaySentence({
      date: "2026-11-03",
      today: "2026-11-03",
      routes: [
        summary("in_progress"),
        summary("in_progress"),
        summary("draft"),
        summary("cancelled"),
      ],
      unassigned: [
        waiting("2026-11-03T19:00:00.000Z"),
        waiting(null),
        waiting("2026-11-03T20:30:00.000Z"),
      ],
      now,
    });
    expect(read(parts)).toBe(
      "Martes 3 de noviembre: 3 rutas, 2 en curso y 1 en preparación. 3 envíos siguen sin ruta; 1 atrasado y 1 en riesgo.",
    );
    expect(parts.find((part) => part.text === "1 atrasado")?.tone).toBe("error");
  });

  it("says when there are no routes and every shipment has one", () => {
    expect(
      read(
        routesDaySentence({
          date: "2026-11-03",
          today: "2026-11-03",
          routes: [],
          unassigned: [],
          now,
        }),
      ),
    ).toBe("Martes 3 de noviembre: todavía no hay rutas. Todos los envíos tienen ruta.");
  });
});

describe("stopStates and routeMarks", () => {
  it("marks the first pending stop of a route on the street as the next one", () => {
    const onStreet = route("in_progress", ["completed", "failed", "pending", "pending"]);
    expect(stopStates(onStreet)).toEqual(["done", "exception", "next", "pending"]);
    expect(stopStates({ ...onStreet, status: "draft" })).toEqual([
      "done",
      "exception",
      "pending",
      "pending",
    ]);
    expect(routeMarks(onStreet).map((mark) => mark.state)).toEqual([
      "done",
      "exception",
      "pending",
      "pending",
    ]);
  });
});

describe("routeSentence (approved «Detalle de ruta»)", () => {
  it("asks to review and dispatch a route in preparation", () => {
    expect(read(routeSentence(route("draft", ["pending", "pending"]), "2026-11-03"))).toBe(
      "En preparación para el martes 3 de noviembre: 2 paradas de Camilo Restrepo. Revisa el orden y despáchala cuando salga.",
    );
  });

  it("tells the progress and the next stop of a route on the street", () => {
    expect(
      read(
        routeSentence(route("in_progress", ["completed", "completed", "pending"]), "2026-11-03"),
      ),
    ).toBe("Camilo Restrepo lleva 2 de 3 paradas. La próxima es la 3, en Laureles.");
  });

  it("sums up a finished route", () => {
    expect(
      read(routeSentence(route("finished", ["completed", "completed", "failed"]), "2026-11-03")),
    ).toBe("Finalizó a las 6:40 p. m.: 2 entregas y 1 novedad.");
  });
});
