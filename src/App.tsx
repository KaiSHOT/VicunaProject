import { useState } from "react";
import MenuScreen, { type AppMode } from "./screens/MenuScreen";
import HotseatGame from "./screens/HotseatGame";
import CvcWatch from "./screens/CvcWatch";
import CvcStats from "./screens/CvcStats";

export default function App() {
  const [mode, setMode] = useState<AppMode>("menu");
  return (
    <div className="min-h-[640px] bg-vicuna-bg rounded-xl p-4">
      {mode === "menu" && <MenuScreen onSelect={setMode} />}
      {mode === "hotseat" && <HotseatGame onExit={() => setMode("menu")} />}
      {mode === "cvcWatch" && <CvcWatch onExit={() => setMode("menu")} />}
      {mode === "cvcStats" && <CvcStats onExit={() => setMode("menu")} />}
    </div>
  );
}
