import { createClient, type SupabaseClient } from "@supabase/supabase-js";

let client: SupabaseClient | null = null;

// PvP画面を開くまで生成しない。他モード（対AI戦・CvC等）は環境変数未設定でも動作させたいため、
// モジュール読み込み時ではなく実際にSupabaseへアクセスするタイミングで初めて検証する。
export function getSupabase(): SupabaseClient {
  if (client) return client;
  const url = import.meta.env.VITE_SUPABASE_URL;
  const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;
  if (!url || !anonKey) {
    throw new Error(
      "VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY が設定されていません。.env.local を確認してください。"
    );
  }
  client = createClient(url, anonKey, { auth: { persistSession: false } });
  return client;
}
