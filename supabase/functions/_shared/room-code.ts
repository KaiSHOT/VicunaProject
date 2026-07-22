// 曖昧な文字（0/O, 1/I/L等）を除いた6桁のルームコードを生成する。
const ALPHABET = "23456789ABCDEFGHJKMNPQRSTUVWXYZ";

export function generateRoomCode(): string {
  const buf = new Uint32Array(6);
  crypto.getRandomValues(buf);
  let code = "";
  for (let i = 0; i < 6; i++) {
    code += ALPHABET[buf[i] % ALPHABET.length];
  }
  return code;
}
