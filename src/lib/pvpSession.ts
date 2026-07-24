const STORAGE_KEY = "vicuna_pvp_session_v1";

export interface PvpSession {
  roomCode: string;
  seatIdx: number;
  clientSecret: string;
  nickname: string;
}

export function loadSession(): PvpSession | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (
      typeof parsed !== "object" ||
      parsed === null ||
      typeof parsed.roomCode !== "string" ||
      typeof parsed.seatIdx !== "number" ||
      typeof parsed.clientSecret !== "string" ||
      typeof parsed.nickname !== "string"
    ) {
      return null;
    }
    return parsed as PvpSession;
  } catch {
    return null;
  }
}

export function saveSession(session: PvpSession) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(session));
  } catch {
    // 保存に失敗しても致命的ではないため無視
  }
}

export function clearSession() {
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch {
    // 保存領域にアクセスできなくても致命的ではないため無視
  }
}
