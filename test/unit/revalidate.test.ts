import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("next/cache", () => ({ revalidateTag: vi.fn() }));

const { revalidateTag } = await import("next/cache");
const { POST } = await import("@/app/api/revalidate/route");

const call = (secret?: string) =>
  POST(new Request("http://localhost/api/revalidate", { method: "POST", headers: secret ? { "x-revalidate-secret": secret } : {} }));

describe("POST /api/revalidate", () => {
  beforeEach(() => {
    vi.mocked(revalidateTag).mockClear();
    process.env.REVALIDATE_SECRET = "s3cret";
  });

  it("expires the catalog tag immediately with the right secret", async () => {
    const res = await call("s3cret");
    expect(res.status).toBe(200);
    expect(revalidateTag).toHaveBeenCalledWith("catalog", { expire: 0 });
  });

  it("refuses a wrong or missing secret, and an unset secret never matches", async () => {
    expect((await call("nope")).status).toBe(403);
    expect((await call()).status).toBe(403);
    process.env.REVALIDATE_SECRET = "";
    expect((await call("")).status).toBe(403);
    expect(revalidateTag).not.toHaveBeenCalled();
  });
});
