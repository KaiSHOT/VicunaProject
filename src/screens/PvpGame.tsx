import { useEffect, useRef, useState } from "react";
import type { CardT, Decision, Player } from "../engine/types";
import { cardValue } from "../engine/deck";
import { chipScore } from "../engine/rules";
import Card from "../components/Card";
import PlayerBadge from "../components/PlayerBadge";
import RulesModal from "../components/RulesModal";
import { getSupabase } from "../lib/supabaseClient";
import {
  PvpApiError,
  addCpuPlayer,
  applyAction,
  createRoom,
  getMyView,
  joinRoom,
  startRound,
} from "../lib/pvpApi";
import { clearSession, loadSession, saveSession, type PvpSession } from "../lib/pvpSession";
import type { PrivateSeatView, PublicPlayerView, PublicRoomView } from "../lib/pvpTypes";

const PENALTY = 5;
const DISPLAY_STEP_MS = 410;

interface PvpGameProps {
  onExit: () => void;
}

// PlayerBadgeはrevealHand=falseの場合hand.lengthしか参照しないため、件数だけ合わせたダミー配列を渡す
function toDisplayPlayer(pv: PublicPlayerView): Player {
  return {
    id: pv.seatIdx,
    name: pv.nickname,
    isAi: pv.isAi,
    hand: Array.from({ length: pv.handCount }) as unknown as CardT[],
    chips: pv.chips,
    folded: pv.folded,
    hasGoneOut: pv.hasGoneOut,
  };
}

export default function PvpGame({ onExit }: PvpGameProps) {
  const [phase, setPhase] = useState<"home" | "inRoom">("home");
  const [session, setSession] = useState<PvpSession | null>(null);
  const [homeTab, setHomeTab] = useState<"create" | "join">("create");
  const [nickname, setNickname] = useState("");
  const [maxPlayers, setMaxPlayers] = useState(6);
  const [roomCodeInput, setRoomCodeInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showRules, setShowRules] = useState(false);

  // latestPublic: プロトコル用の最新の真実（expectedTurnVersion等はここから取る、遅延なし）
  const [latestPublic, setLatestPublic] = useState<PublicRoomView | null>(null);
  // displayPublic: 画面描画用。CPU連鎖の逐次表示のためキュー経由でしか更新しない
  const [displayPublic, setDisplayPublic] = useState<PublicRoomView | null>(null);
  const [privateView, setPrivateView] = useState<PrivateSeatView | null>(null);
  const [privateViewTurnVersion, setPrivateViewTurnVersion] = useState<number | null>(null);

  const displayPublicRef = useRef<PublicRoomView | null>(null);
  const queueRef = useRef<PublicRoomView[]>([]);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const sessionRef = useRef<PvpSession | null>(null);

  useEffect(() => {
    displayPublicRef.current = displayPublic;
  }, [displayPublic]);

  useEffect(() => {
    sessionRef.current = session;
  }, [session]);

  useEffect(() => {
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, []);

  function scheduleDrain(immediate: boolean) {
    if (timerRef.current) return;
    timerRef.current = setTimeout(
      () => {
        timerRef.current = null;
        const next = queueRef.current.shift();
        if (next) setDisplayPublic(next);
        if (queueRef.current.length > 0) scheduleDrain(false);
      },
      immediate ? 0 : DISPLAY_STEP_MS
    );
  }

  function receivePublicView(view: PublicRoomView) {
    // turnVersionはロビー中の入退室/CPU追加ではインクリメントされないため、
    // ここは「巻き戻っていなければ」を条件にする（同値の再送・ロビー更新も反映する）
    setLatestPublic((prev) => (!prev || view.turnVersion >= prev.turnVersion ? view : prev));
    const lastQueued = queueRef.current[queueRef.current.length - 1];
    const baseline = lastQueued ?? displayPublicRef.current;
    if (!baseline || view.turnVersion >= baseline.turnVersion) {
      const wasEmpty = queueRef.current.length === 0 && displayPublicRef.current === null;
      queueRef.current.push(view);
      scheduleDrain(!wasEmpty ? false : true);
    }
  }

  async function resync(s: PvpSession) {
    const res = await getMyView({
      roomCode: s.roomCode,
      seatIdx: s.seatIdx,
      clientSecret: s.clientSecret,
    });
    receivePublicView(res.public);
    setPrivateView(res.private);
    setPrivateViewTurnVersion(res.public.turnVersion);
  }

  function handleApiError(e: unknown) {
    if (e instanceof PvpApiError) {
      if (e.code === "turn_version_conflict") {
        setError("状態が更新されていたため最新の状態に同期しました");
        if (sessionRef.current) void resync(sessionRef.current).catch(() => {});
        return;
      }
      if (e.code === "room_not_found" || e.code === "forbidden") {
        clearSession();
        setSession(null);
        setPhase("home");
        setError("部屋が見つからないため退出しました");
        return;
      }
      setError(e.message);
      return;
    }
    if (e instanceof Error && e.message.includes("VITE_SUPABASE")) {
      setError(e.message);
      return;
    }
    setError("通信エラーが発生しました");
  }

  // 起動時にセッションが残っていれば復帰を試みる
  useEffect(() => {
    const s = loadSession();
    if (!s) return;
    setSession(s);
    setPhase("inRoom");
    resync(s).catch(handleApiError);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Realtime購読
  useEffect(() => {
    if (!session) return;
    let supabase;
    try {
      supabase = getSupabase();
    } catch (e) {
      handleApiError(e);
      return;
    }
    const channel = supabase.channel(`room:${session.roomCode}`);
    channel
      .on("broadcast", { event: "state_changed" }, ({ payload }) => {
        receivePublicView(payload as PublicRoomView);
      })
      .subscribe((status) => {
        if (status === "SUBSCRIBED") {
          resync(session).catch(() => {});
        }
      });
    return () => {
      void supabase.removeChannel(channel);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session?.roomCode]);

  // 自分の手番になったら手札・合法手を取得する
  useEffect(() => {
    if (!session || !latestPublic) return;
    if (latestPublic.roundOver) return;
    if (latestPublic.currentPlayerIdx !== session.seatIdx) return;
    if (privateViewTurnVersion === latestPublic.turnVersion) return;
    resync(session).catch(handleApiError);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [latestPublic, session, privateViewTurnVersion]);

  function handleExit() {
    clearSession();
    setSession(null);
    setPhase("home");
    setLatestPublic(null);
    setDisplayPublic(null);
    setPrivateView(null);
    setPrivateViewTurnVersion(null);
    queueRef.current = [];
    onExit();
  }

  async function handleCreateRoom() {
    if (!nickname.trim()) return;
    setBusy(true);
    setError(null);
    try {
      const res = await createRoom({ nickname: nickname.trim(), maxPlayers, penalty: PENALTY });
      const s: PvpSession = {
        roomCode: res.roomCode,
        seatIdx: res.seatIdx,
        clientSecret: res.clientSecret,
        nickname: nickname.trim(),
      };
      saveSession(s);
      setSession(s);
      receivePublicView(res.public);
      setPhase("inRoom");
    } catch (e) {
      handleApiError(e);
    } finally {
      setBusy(false);
    }
  }

  async function handleJoinRoom() {
    if (!nickname.trim() || !roomCodeInput.trim()) return;
    setBusy(true);
    setError(null);
    try {
      const res = await joinRoom({ roomCode: roomCodeInput.trim(), nickname: nickname.trim() });
      const s: PvpSession = {
        roomCode: res.roomCode,
        seatIdx: res.seatIdx,
        clientSecret: res.clientSecret,
        nickname: nickname.trim(),
      };
      saveSession(s);
      setSession(s);
      receivePublicView(res.public);
      setPhase("inRoom");
    } catch (e) {
      handleApiError(e);
    } finally {
      setBusy(false);
    }
  }

  async function handleAddCpu() {
    if (!session) return;
    setBusy(true);
    setError(null);
    try {
      const res = await addCpuPlayer({ roomCode: session.roomCode });
      receivePublicView(res.public);
    } catch (e) {
      handleApiError(e);
    } finally {
      setBusy(false);
    }
  }

  async function handleStartRound() {
    if (!session || !latestPublic) return;
    setBusy(true);
    setError(null);
    try {
      const res = await startRound({
        roomCode: session.roomCode,
        seatIdx: session.seatIdx,
        clientSecret: session.clientSecret,
        expectedTurnVersion: latestPublic.turnVersion,
      });
      receivePublicView(res.public);
      setPrivateView(res.private);
      setPrivateViewTurnVersion(res.public.turnVersion);
    } catch (e) {
      handleApiError(e);
    } finally {
      setBusy(false);
    }
  }

  async function handleDecision(decision: Decision) {
    if (!session || !latestPublic) return;
    setBusy(true);
    setError(null);
    try {
      const res = await applyAction({
        roomCode: session.roomCode,
        seatIdx: session.seatIdx,
        clientSecret: session.clientSecret,
        expectedTurnVersion: latestPublic.turnVersion,
        decision,
      });
      receivePublicView(res.public);
      setPrivateView(res.private);
      setPrivateViewTurnVersion(res.public.turnVersion);
    } catch (e) {
      handleApiError(e);
    } finally {
      setBusy(false);
    }
  }

  const rulesModal = <RulesModal open={showRules} onClose={() => setShowRules(false)} />;

  const topBar = (
    <div className="flex justify-between items-center">
      <button onClick={handleExit} className="text-vicuna-text-secondary text-sm">
        ← メニューに戻る
      </button>
      <button
        onClick={() => setShowRules(true)}
        className="w-7 h-7 rounded-full border border-vicuna-text-secondary text-vicuna-text-secondary text-sm font-bold hover:bg-vicuna-panel/60"
      >
        ？
      </button>
    </div>
  );

  const errorBanner = error && (
    <div className="text-xs bg-vicuna-risk/20 border border-vicuna-risk text-vicuna-risk-ink rounded px-3 py-2 flex justify-between items-center">
      <span>{error}</span>
      <button onClick={() => setError(null)} className="font-bold ml-2">
        ×
      </button>
    </div>
  );

  if (phase === "home") {
    return (
      <div className="min-h-[600px] text-vicuna-text-primary flex flex-col items-center justify-center gap-6">
        <div className="w-full flex justify-between items-center">
          <button onClick={onExit} className="text-vicuna-text-secondary text-sm">
            ← メニューに戻る
          </button>
          <button
            onClick={() => setShowRules(true)}
            className="w-7 h-7 rounded-full border border-vicuna-text-secondary text-vicuna-text-secondary text-sm font-bold hover:bg-vicuna-panel/60"
          >
            ？
          </button>
        </div>
        <h2 className="text-2xl font-bold">友達と対戦（PvP）</h2>
        {errorBanner}
        <div className="bg-vicuna-panel/60 rounded-lg p-5 w-80 flex flex-col gap-4">
          <div className="flex gap-2">
            <button
              onClick={() => setHomeTab("create")}
              className={[
                "flex-1 py-2 rounded font-bold text-sm",
                homeTab === "create"
                  ? "bg-vicuna-accent text-vicuna-accent-ink"
                  : "bg-transparent border border-vicuna-panel-border text-vicuna-text-secondary",
              ].join(" ")}
            >
              部屋を作る
            </button>
            <button
              onClick={() => setHomeTab("join")}
              className={[
                "flex-1 py-2 rounded font-bold text-sm",
                homeTab === "join"
                  ? "bg-vicuna-accent text-vicuna-accent-ink"
                  : "bg-transparent border border-vicuna-panel-border text-vicuna-text-secondary",
              ].join(" ")}
            >
              部屋に入る
            </button>
          </div>
          <div>
            <div className="text-sm mb-1">ニックネーム</div>
            <input
              value={nickname}
              onChange={(e) => setNickname(e.target.value)}
              maxLength={20}
              placeholder="あなたの名前"
              className="w-full px-3 py-2 rounded bg-vicuna-board border border-vicuna-panel-border text-sm"
            />
          </div>
          {homeTab === "create" ? (
            <div>
              <div className="text-sm mb-2">最大人数（2〜6人）</div>
              <div className="flex gap-2">
                {[2, 3, 4, 5, 6].map((n) => (
                  <button
                    key={n}
                    onClick={() => setMaxPlayers(n)}
                    className={[
                      "w-9 h-9 rounded-full border-2 font-bold text-sm",
                      maxPlayers === n
                        ? "bg-vicuna-accent border-vicuna-accent-light text-vicuna-accent-ink"
                        : "border-vicuna-panel-border text-vicuna-text-secondary",
                    ].join(" ")}
                  >
                    {n}
                  </button>
                ))}
              </div>
            </div>
          ) : (
            <div>
              <div className="text-sm mb-1">部屋コード</div>
              <input
                value={roomCodeInput}
                onChange={(e) => setRoomCodeInput(e.target.value.toUpperCase())}
                placeholder="例: ABCD"
                className="w-full px-3 py-2 rounded bg-vicuna-board border border-vicuna-panel-border text-sm tracking-widest"
              />
            </div>
          )}
        </div>
        <button
          onClick={homeTab === "create" ? handleCreateRoom : handleJoinRoom}
          disabled={busy || !nickname.trim() || (homeTab === "join" && !roomCodeInput.trim())}
          className="px-6 py-3 bg-vicuna-accent text-vicuna-accent-ink font-bold rounded-lg hover:bg-vicuna-accent-light disabled:opacity-50"
        >
          {homeTab === "create" ? "部屋を作る" : "参加する"}
        </button>
        {rulesModal}
      </div>
    );
  }

  if (!session || !displayPublic) {
    return (
      <div className="min-h-[600px] text-vicuna-text-primary flex flex-col items-center justify-center gap-4">
        <div className="text-sm text-vicuna-text-secondary">接続中…</div>
        {errorBanner}
      </div>
    );
  }

  const isHost = session.seatIdx === 0;
  const view = displayPublic;

  if (view.status === "lobby") {
    return (
      <div className="min-h-[600px] text-vicuna-text-primary flex flex-col gap-4">
        {topBar}
        {errorBanner}
        <div className="flex items-center justify-between bg-vicuna-panel/60 rounded-lg p-4">
          <div>
            <div className="text-xs text-vicuna-text-secondary">部屋コード</div>
            <div className="text-2xl font-bold tracking-widest">{view.roomCode}</div>
          </div>
          <button
            onClick={() => navigator.clipboard?.writeText(view.roomCode)}
            className="px-3 py-2 text-sm rounded bg-vicuna-info text-white font-bold"
          >
            コピー
          </button>
        </div>
        <div className="flex flex-col gap-2">
          {view.players.map((p) => (
            <div
              key={p.seatIdx}
              className="flex items-center justify-between bg-vicuna-panel/40 rounded px-3 py-2 text-sm"
            >
              <span>
                {p.nickname}
                {p.seatIdx === 0 && (
                  <span className="ml-1 text-[10px] bg-vicuna-accent text-vicuna-accent-ink rounded px-1">
                    作成者
                  </span>
                )}
                {p.isAi && <span className="ml-1 text-[10px] bg-vicuna-info-dark rounded px-1">CPU</span>}
              </span>
              {p.seatIdx === session.seatIdx && (
                <span className="text-[10px] text-vicuna-text-secondary">あなた</span>
              )}
            </div>
          ))}
        </div>
        <div className="text-xs text-vicuna-text-secondary">
          {view.players.length} / {view.maxPlayers} 人
        </div>
        {isHost ? (
          <div className="flex gap-3 flex-wrap">
            <button
              onClick={handleAddCpu}
              disabled={busy || view.players.length >= view.maxPlayers}
              className="px-4 py-2 rounded bg-vicuna-info text-white font-bold disabled:bg-neutral-600 disabled:text-neutral-400"
            >
              CPUを追加
            </button>
            <button
              onClick={handleStartRound}
              disabled={busy || view.players.length < 2}
              className="px-4 py-2 rounded bg-vicuna-accent text-vicuna-accent-ink font-bold disabled:bg-neutral-600 disabled:text-neutral-400"
            >
              ゲーム開始
            </button>
          </div>
        ) : (
          <div className="text-sm text-vicuna-text-secondary">作成者の開始を待っています…</div>
        )}
        {rulesModal}
      </div>
    );
  }

  if (view.status === "playing" && !view.roundOver) {
    const isMyTurn = view.currentPlayerIdx === session.seatIdx;
    const currentPlayer = view.players.find((p) => p.seatIdx === view.currentPlayerIdx);
    const legal = isMyTurn ? privateView?.legalActions ?? null : null;

    return (
      <div className="min-h-[600px] text-vicuna-text-primary flex flex-col gap-4">
        {topBar}
        {errorBanner}
        <div className="text-sm text-vicuna-text-secondary text-center">ラウンド {view.roundNo}</div>

        <div className="flex gap-2 overflow-x-auto pb-2">
          {view.players.map((p) => (
            <PlayerBadge
              key={p.seatIdx}
              pp={toDisplayPlayer(p)}
              isCurrent={p.seatIdx === view.currentPlayerIdx}
              reservedPlayerId={view.reservedPlayerId}
              revealHand={false}
            />
          ))}
        </div>

        <div className="bg-vicuna-board rounded-xl p-4 flex flex-col gap-4">
          <div className="flex items-center justify-center gap-6">
            <div className="flex flex-col items-center gap-1">
              <div className="text-xs text-vicuna-text-secondary">山札</div>
              <div className="w-16 h-24 rounded-lg bg-vicuna-panel border-2 border-vicuna-panel-border flex items-center justify-center text-sm font-bold">
                {view.deckCount}
              </div>
            </div>
            {view.discardTop !== null && (
              <div className="flex flex-col items-center gap-1">
                <div className="text-xs text-vicuna-text-secondary">場札</div>
                <Card token={view.discardTop} disabled />
              </div>
            )}
          </div>

          {!isMyTurn && (
            <div className="text-sm text-center text-vicuna-text-secondary">
              {currentPlayer?.nickname ?? "?"}
              {currentPlayer?.isAi ? "（CPU）" : ""} の番です…
            </div>
          )}

          {isMyTurn && privateView && legal && (
            <div>
              <div className="text-sm mb-2 flex items-center gap-2">
                あなたの手札
                {legal.isReserved && (
                  <span className="text-[10px] bg-vicuna-risk text-white rounded px-1">
                    予約中（降りられません）
                  </span>
                )}
                {legal.solo && (
                  <span className="text-[10px] bg-vicuna-accent text-vicuna-accent-ink rounded px-1">
                    最後の1人（引けません）
                  </span>
                )}
              </div>
              <div className="flex flex-wrap gap-2 mb-4">
                {privateView.hand
                  .slice()
                  .sort((a, b) => cardValue(a.token) - cardValue(b.token))
                  .map((c) => (
                    <Card
                      key={c.id}
                      token={c.token}
                      disabled={!legal.canPlay.some((pc) => pc.id === c.id)}
                      onClick={() => handleDecision({ type: "play", cardId: c.id })}
                    />
                  ))}
              </div>
              <div className="flex gap-3 flex-wrap">
                <button
                  onClick={() => handleDecision({ type: "draw" })}
                  disabled={!legal.canDraw || busy}
                  className="px-4 py-2 rounded bg-vicuna-info disabled:bg-neutral-600 disabled:text-neutral-400 text-white font-bold"
                >
                  山札から引く
                </button>
                <button
                  onClick={() => handleDecision({ type: "fold" })}
                  disabled={!legal.canFold || busy}
                  className="px-4 py-2 rounded bg-neutral-700 disabled:bg-neutral-600 disabled:text-neutral-400 text-white font-bold"
                >
                  降りる
                </button>
                {legal.canReserve && (
                  <button
                    onClick={() => handleDecision({ type: "reserve" })}
                    disabled={busy}
                    className="px-4 py-2 rounded bg-vicuna-risk text-white font-bold"
                  >
                    予約する（一発逆転）
                  </button>
                )}
                {legal.canPass && (
                  <button
                    onClick={() => handleDecision({ type: "pass" })}
                    disabled={busy}
                    className="px-4 py-2 rounded bg-neutral-500 text-white font-bold"
                  >
                    投了（他に選択肢なし）
                  </button>
                )}
              </div>
            </div>
          )}
        </div>
        {rulesModal}
      </div>
    );
  }

  if (view.status === "playing" && view.roundOver && view.roundResult) {
    const result = view.roundResult;
    return (
      <div className="min-h-[600px] text-vicuna-text-primary flex flex-col gap-4">
        {topBar}
        {errorBanner}
        <h2 className="text-2xl font-bold">ラウンド {view.roundNo} 終了</h2>
        <table className="w-full text-sm">
          <thead>
            <tr className="text-vicuna-text-secondary text-left">
              <th className="py-1">プレイヤー</th>
              <th>手札失点</th>
              <th>予約</th>
              <th>合計</th>
            </tr>
          </thead>
          <tbody>
            {view.players.map((p) => {
              const handLoss = result.handLossMap[p.seatIdx] ?? 0;
              const wentOut = p.seatIdx === result.outPlayerId;
              const wasReserved = result.reservedPlayerId === p.seatIdx;
              return (
                <tr key={p.seatIdx} className="border-t border-vicuna-panel-border">
                  <td className="py-2">
                    {p.nickname}
                    {wentOut && (
                      <span className="ml-1 text-[10px] bg-vicuna-accent text-vicuna-accent-ink rounded px-1">
                        出し切り
                      </span>
                    )}
                  </td>
                  <td>{handLoss === 0 ? "-" : `-${handLoss}`}</td>
                  <td>{wasReserved ? (wentOut ? "成功（2枚返却）" : `失敗（+${PENALTY}）`) : "-"}</td>
                  <td className="font-bold text-vicuna-accent-light">-{chipScore(p.chips)}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
        {isHost ? (
          <button
            onClick={handleStartRound}
            disabled={busy}
            className="mt-4 px-6 py-3 bg-vicuna-accent text-vicuna-accent-ink font-bold rounded-lg hover:bg-vicuna-accent-light self-start disabled:opacity-50"
          >
            次のラウンドへ
          </button>
        ) : (
          <div className="text-sm text-vicuna-text-secondary">作成者が次のラウンドを開始するのを待っています…</div>
        )}
        {rulesModal}
      </div>
    );
  }

  if (view.status === "finished") {
    const sorted = [...view.players].sort((a, b) => chipScore(a.chips) - chipScore(b.chips));
    const winner = sorted[0];
    return (
      <div className="min-h-[600px] text-vicuna-text-primary flex flex-col items-center justify-center gap-4">
        <div className="text-vicuna-accent text-sm">ゲーム終了</div>
        <div className="text-3xl font-bold">
          {winner.seatIdx === session.seatIdx ? "あなたの勝利！" : `${winner.nickname} の勝利！`}
        </div>
        <table className="mt-4 text-sm">
          <tbody>
            {sorted.map((p) => (
              <tr key={p.seatIdx}>
                <td className="pr-4 py-1">{p.nickname}</td>
                <td className="text-vicuna-accent-light">-{chipScore(p.chips)}点</td>
              </tr>
            ))}
          </tbody>
        </table>
        <button
          onClick={handleExit}
          className="mt-4 px-6 py-3 bg-vicuna-accent text-vicuna-accent-ink font-bold rounded-lg"
        >
          メニューに戻る
        </button>
        {rulesModal}
      </div>
    );
  }

  return null;
}
