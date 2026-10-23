import { noticeText, noticeTypes } from "@domy/domain";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { NoticeList } from "./notice-list";

vi.mock("./courier-store", async () => {
  const { noticeTypes: fixtureNoticeTypes } = await import("@domy/domain");
  return {
    acknowledgeCourierNotices: vi.fn(),
    useCourierState: () => ({
      userId: "00000000-0000-4000-8000-000000000001",
      view: {
        notices: fixtureNoticeTypes.map((type, index) => ({
          id: `00000000-0000-4000-8000-${String(index + 1).padStart(12, "0")}`,
          type,
          routeNumber: 17,
          trackingNumber: "7SMQ5M5T",
          createdAt: "2026-10-21T15:00:00.000Z",
        })),
      },
    }),
  };
});

const text = (html: string) =>
  html
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim();

describe("NoticeList (FR-027)", () => {
  it("renders the shared Spanish notice text for every notice type", () => {
    const html = renderToStaticMarkup(<NoticeList />);
    const renderedItems = [...html.matchAll(/<li(?:\s[^>]*)?>(.*?)<\/li>/gs)].map((match) =>
      text(match[1] ?? ""),
    );
    const expectedItems = noticeTypes.map((type) =>
      noticeText(type, { routeNumber: 17, trackingNumber: "7SMQ5M5T" }),
    );

    expect(renderedItems).toEqual(expectedItems);
    expect(text(html)).toContain("Entendido");
  });
});
