import { createServer } from "node:http";
import type { AddressInfo } from "node:net";

export type TgCall = { method: string; body: Record<string, unknown> };

/** Fake Bot API on localhost. Points TG_API_BASE at itself. */
export async function startTgStub() {
  const calls: TgCall[] = [];
  let failures = 0;
  let messageId = 100;

  const server = createServer(async (req, res) => {
    let raw = "";
    for await (const chunk of req) raw += chunk;
    const method = (req.url ?? "").split("/").pop() ?? "";
    const body = raw ? (JSON.parse(raw) as Record<string, unknown>) : {};
    calls.push({ method, body });
    res.setHeader("content-type", "application/json");
    if (failures > 0) {
      failures--;
      res.statusCode = 502;
      res.end(JSON.stringify({ ok: false, description: "Bad Gateway (stub)" }));
      return;
    }
    const result = method === "sendMessage" ? { message_id: ++messageId, chat: { id: Number(body.chat_id) } } : true;
    res.end(JSON.stringify({ ok: true, result }));
  });

  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  const { port } = server.address() as AddressInfo;
  process.env.TG_API_BASE = `http://127.0.0.1:${port}`;

  return {
    calls,
    failNext(n = 1) {
      failures = n;
    },
    reset() {
      calls.length = 0;
      failures = 0;
    },
    close: () => new Promise<void>((resolve) => server.close(() => resolve())),
  };
}
