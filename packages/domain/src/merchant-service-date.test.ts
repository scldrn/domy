import { describe, expect, it } from "vitest";
import { z } from "zod";
import * as domain from "./index.ts";

const serviceDateWindow = z.function({
  input: [z.date()],
  output: z.strictObject({ firstDate: z.iso.date(), lastDate: z.iso.date() }),
});

function merchantServiceDateWindow(now: Date): { firstDate: string; lastDate: string } {
  const candidate: unknown = Reflect.get(domain, "merchantServiceDateWindow");
  expect(typeof candidate).toBe("function");
  return serviceDateWindow.parse(candidate)(now);
}

describe("merchantServiceDateWindow (004/T027, FR-019)", () => {
  it("returns the inclusive 30 Bogotá service dates across a UTC month boundary", () => {
    expect(merchantServiceDateWindow(new Date("2026-10-01T04:30:00.000Z"))).toEqual({
      firstDate: "2026-09-01",
      lastDate: "2026-09-30",
    });
    expect(merchantServiceDateWindow(new Date("2026-10-01T05:00:00.000Z"))).toEqual({
      firstDate: "2026-09-02",
      lastDate: "2026-10-01",
    });
  });

  it("uses Bogotá's calendar day across the year boundary", () => {
    expect(merchantServiceDateWindow(new Date("2026-01-01T04:59:59.999Z"))).toEqual({
      firstDate: "2025-12-02",
      lastDate: "2025-12-31",
    });
    expect(merchantServiceDateWindow(new Date("2026-01-01T05:00:00.000Z"))).toEqual({
      firstDate: "2025-12-03",
      lastDate: "2026-01-01",
    });
  });
});
