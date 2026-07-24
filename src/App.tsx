import { useState } from "react";
import MenuScreen, { type AppMode } from "./screens/MenuScreen";
import PvcGame from "./screens/PvcGame";
import PvpGame from "./screens/PvpGame";
import CvcWatch from "./screens/CvcWatch";
import CvcStats from "./screens/CvcStats";
import RulesScreen from "./screens/RulesScreen";

export default function App() {
  const [mode, setMode] = useState<AppMode>("menu");
  return (
    <div className="min-h-[640px] bg-vicuna-bg rounded-xl p-4">
      {mode === "menu" && <MenuScreen onSelect={setMode} />}
      {mode === "pvc" && <PvcGame onExit={() => setMode("menu")} />}
      {mode === "pvp" && <PvpGame onExit={() => setMode("menu")} />}
      {import.meta.env.DEV && mode === "cvcWatch" && <CvcWatch onExit={() => setMode("menu")} />}
      {import.meta.env.DEV && mode === "cvcStats" && <CvcStats onExit={() => setMode("menu")} />}
      {mode === "rules" && <RulesScreen onExit={() => setMode("menu")} />}
    </div>
  );
}
