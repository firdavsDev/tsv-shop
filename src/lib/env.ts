import "server-only";

function required(name: string): string {
  const v = process.env[name];
  if (!v) throw new Error(`Missing environment variable ${name}`);
  return v;
}

/** Server-side configuration. Getters read process.env on every call (tests change env between files). */
export const serverEnv = {
  get supabaseUrl() {
    return required("NEXT_PUBLIC_SUPABASE_URL");
  },
  get supabaseAnonKey() {
    return required("NEXT_PUBLIC_SUPABASE_ANON_KEY");
  },
  get serviceRoleKey() {
    return required("SUPABASE_SERVICE_ROLE_KEY");
  },
  get tgToken() {
    return process.env.TG_BOT_TOKEN ?? "";
  },
  get tgAdminChatId() {
    return process.env.TG_ADMIN_CHAT_ID ?? "";
  },
  get tgWebhookSecret() {
    return process.env.TG_WEBHOOK_SECRET ?? "";
  },
  get tgApiBase() {
    return process.env.TG_API_BASE ?? "https://api.telegram.org";
  },
  get revalidateSecret() {
    return process.env.REVALIDATE_SECRET ?? "";
  },
  get cronSecret() {
    return process.env.CRON_SECRET ?? "";
  },
  get ipHashSalt() {
    return process.env.IP_HASH_SALT ?? "";
  },
};
