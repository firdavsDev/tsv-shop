import { execSync } from "node:child_process";

/** Read the local Supabase keys so the tests never depend on .env.local. */
function supabaseStatus(): Record<string, string> {
  const out = execSync("npx supabase status -o env", { encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] });
  const env: Record<string, string> = {};
  for (const line of out.split("\n")) {
    const m = /^([A-Z_]+)="?(.*?)"?$/.exec(line.trim());
    if (m) env[m[1]] = m[2];
  }
  return env;
}

const s = supabaseStatus();
process.env.NEXT_PUBLIC_SUPABASE_URL = s.API_URL;
process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = s.ANON_KEY ?? s.PUBLISHABLE_KEY;
process.env.SUPABASE_SERVICE_ROLE_KEY = s.SERVICE_ROLE_KEY ?? s.SECRET_KEY;
process.env.NEXT_PUBLIC_SITE_URL = "http://localhost:3000";
process.env.TG_BOT_TOKEN = "123456:TEST-TOKEN";
process.env.TG_ADMIN_CHAT_ID = "-1001";
process.env.TG_WEBHOOK_SECRET = "webhook-secret";
process.env.REVALIDATE_SECRET = "revalidate-secret";
process.env.CRON_SECRET = "cron-secret";
process.env.IP_HASH_SALT = "test-salt";
