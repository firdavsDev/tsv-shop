import "server-only";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { CATALOG_TAG } from "@/lib/cache-tags";
import { serverEnv } from "@/lib/env";

const noSession = { persistSession: false, autoRefreshToken: false } as const;

/** Catalog reads go through Next's data cache, tagged so a database webhook can expire them. */
const taggedFetch: typeof fetch = (input, init) =>
  fetch(input, { ...init, next: { tags: [CATALOG_TAG], revalidate: 3600 } });

const freshFetch: typeof fetch = (input, init) => fetch(input, { ...init, cache: "no-store" });

let catalog: SupabaseClient | undefined;
let service: SupabaseClient | undefined;

/** Anon key + RLS: can only read published catalog rows. Cached. */
export function catalogClient(): SupabaseClient {
  catalog ??= createClient(serverEnv.supabaseUrl, serverEnv.supabaseAnonKey, {
    auth: noSession,
    global: { fetch: taggedFetch },
  });
  return catalog;
}

/** Service role: bypasses RLS. Server only — orders, webhook, cron. Never cached. */
export function serviceClient(): SupabaseClient {
  service ??= createClient(serverEnv.supabaseUrl, serverEnv.serviceRoleKey, {
    auth: noSession,
    global: { fetch: freshFetch },
  });
  return service;
}
