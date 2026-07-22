// =====================================================
// 乱数生成（暗号学的に安全な乱数。ブラウザ・Deno双方でWeb標準API）
// =====================================================

// サーバー権威実行時にクライアントがシャッフル結果等を予測・改ざんできないよう、
// Math.random()ではなくcrypto.getRandomValues()ベースの乱数を全体で使用する。
export function randomFloat(): number {
  const buf = new Uint32Array(1);
  crypto.getRandomValues(buf);
  return buf[0] / (0xffffffff + 1);
}
