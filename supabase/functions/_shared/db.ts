import { createClient, type SupabaseClient } from "npm:@supabase/supabase-js@2";

// service-roleクライアント。RLSをバイパスするため、Edge Functions内でのみ使用し
// クライアントへ直接返却・転送してはならない。
export function adminClient(): SupabaseClient {
  const url = Deno.env.get("SUPABASE_URL");
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!url || !serviceRoleKey) {
    throw new Error("SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY が設定されていません");
  }
  return createClient(url, serviceRoleKey, {
    auth: { persistSession: false },
  });
}
