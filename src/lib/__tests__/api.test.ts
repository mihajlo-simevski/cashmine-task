import { z } from "zod";

import { api, ApiError } from "@/lib/api";
import { mockFetch } from "@/test/mock-fetch";

const UserSchema = z.object({ id: z.string() });

describe("api", () => {
  it("calls the proxy route and returns validated data", async () => {
    const fetchMock = mockFetch(200, { id: "u1" });

    await expect(api(UserSchema, "/users/me")).resolves.toEqual({ id: "u1" });
    expect(fetchMock).toHaveBeenCalledWith("/api/proxy/users/me", expect.anything());
  });

  it("sends a JSON body", async () => {
    const fetchMock = mockFetch(201, { id: "u2" });

    await api(UserSchema, "users", { method: "POST", body: { name: "Ana" } });

    const [, init] = fetchMock.mock.calls[0];
    expect(init.body).toBe('{"name":"Ana"}');
    expect(init.headers["Content-Type"]).toBe("application/json");
  });

  it("throws ApiError with the status and body on failure", async () => {
    mockFetch(422, { message: "Invalid" });

    const error = await api(UserSchema, "users").catch((e: unknown) => e);
    expect(error).toBeInstanceOf(ApiError);
    expect(error).toMatchObject({ status: 422, body: { message: "Invalid" } });
  });

  it("rejects responses that don't match the schema", async () => {
    mockFetch(200, { id: 42 });

    await expect(api(UserSchema, "users/me")).rejects.toBeInstanceOf(z.ZodError);
  });
});
