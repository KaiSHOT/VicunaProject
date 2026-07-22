// Vercel Edge Middleware: サイト全体への簡易ベーシック認証。
// 目的: 1) 友人限定という当初方針の実効性確保 2) ブログ経由等の想定外アクセスによる
// Supabase/Vercel無料枠の消費を、JS/CSSバンドル配信・Supabase初期化より前の
// Edgeの時点で遮断して予防する。
//
// パスワードはVercelの環境変数 SITE_ACCESS_PASSWORD に設定する（ダッシュボード側の作業）。

export const config = {
  matcher: "/(.*)",
};

export default function middleware(request: Request): Response | undefined {
  const password = process.env.SITE_ACCESS_PASSWORD;
  if (!password) {
    // 未設定のまま誤って公開しないよう、安全側に倒して常に遮断する。
    return new Response("Site access is not configured.", { status: 500 });
  }

  const expected = "Basic " + btoa(`friend:${password}`);
  const auth = request.headers.get("authorization");
  if (auth === expected) {
    return undefined;
  }

  return new Response("Authentication required.", {
    status: 401,
    headers: { "WWW-Authenticate": 'Basic realm="Vicuna Reserve"' },
  });
}
