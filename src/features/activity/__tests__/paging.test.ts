import { nextActivityCursor } from "@/features/activity/paging";
import { ActivityPageSchema } from "@/features/api/schemas";

const item = {
  id: "act_1",
  type: "accrual",
  asset: "USDT",
  amount: "9.81",
  status: "confirmed",
  exchange: "Binance",
  createdAt: "2026-10-20T19:00:00.000Z",
  relatedId: null,
};

describe("nextActivityCursor", () => {
  it("follows the server's cursor", () => {
    expect(nextActivityCursor({ items: [item], nextCursor: "c2" }, null)).toBe("c2");
  });

  it("stops on the last page, an empty page, an empty or repeated cursor", () => {
    expect(nextActivityCursor({ items: [item], nextCursor: null }, "c1")).toBeUndefined();
    expect(nextActivityCursor({ items: [], nextCursor: "c2" }, "c1")).toBeUndefined();
    expect(nextActivityCursor({ items: [item], nextCursor: "" }, "c1")).toBeUndefined();
    expect(nextActivityCursor({ items: [item], nextCursor: "c1" }, "c1")).toBeUndefined();
  });
});

describe("ActivityPageSchema", () => {
  it("accepts the documented last page and signed amounts", () => {
    const page = {
      items: [{ ...item, type: "claim", amount: "-0.5", relatedId: "clm_1" }],
      nextCursor: null,
    };
    expect(ActivityPageSchema.parse(page)).toEqual(page);
  });

  it("keeps unknown types and statuses as text but rejects bad amounts", () => {
    expect(
      ActivityPageSchema.safeParse({
        items: [{ ...item, type: "bonus", status: "new" }],
        nextCursor: null,
      }).success,
    ).toBe(true);
    expect(
      ActivityPageSchema.safeParse({ items: [{ ...item, amount: "1e3" }], nextCursor: null })
        .success,
    ).toBe(false);
    expect(
      ActivityPageSchema.safeParse({ items: [{ ...item, amount: 9.81 }], nextCursor: null })
        .success,
    ).toBe(false);
  });
});
