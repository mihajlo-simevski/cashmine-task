/**
 * @jest-environment node
 */
// Node has the browser's AbortController/DOMException behaviour; the React Native test
// environment doesn't, so the abort paths are tested here.
import { z } from "zod";

import { api } from "@/lib/api";

const UserSchema = z.object({ id: z.string() });

describe("api aborts", () => {
  it("turns our timeout into TIMEOUT and a caller cancel into ABORTED", async () => {
    // fetch that only settles when its signal aborts, like a hung request
    globalThis.fetch = jest.fn(
      (_url: string, init: { signal: AbortSignal }) =>
        new Promise((_resolve, reject) => {
          // Like real fetch: an already-aborted signal rejects at once.
          if (init.signal.aborted) reject(init.signal.reason);
          init.signal.addEventListener("abort", () => reject(init.signal.reason));
        }),
    ) as unknown as typeof fetch;

    const timeout = await api(UserSchema, "balances", { token: "t", timeoutMs: 5 }).catch(
      (e: unknown) => e,
    );
    expect(timeout).toMatchObject({ status: 0, code: "TIMEOUT" });

    const caller = new AbortController();
    const pending = api(UserSchema, "balances", { token: "t", signal: caller.signal }).catch(
      (e: unknown) => e,
    );
    caller.abort();
    expect(await pending).toMatchObject({ status: 0, code: "ABORTED" });

    const already = new AbortController();
    already.abort();
    const early = await api(UserSchema, "balances", { token: "t", signal: already.signal }).catch(
      (e: unknown) => e,
    );
    expect(early).toMatchObject({ code: "ABORTED" });
  });
});
