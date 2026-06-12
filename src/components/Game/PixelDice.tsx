type PixelDiceProps = {
  die1: number | null;
  die2: number | null;
  total: number | null;
  playerName: string | null;
  rolling: boolean;
};

function DieFace({ value, rolling }: { value: number | null; rolling: boolean }) {
  return (
    <span className={`pixel-border inline-flex h-14 w-14 items-center justify-center bg-white text-3xl font-black text-[#2b1f3a] ${rolling ? "animate-bounce" : ""}`}>
      {rolling ? "?" : value ?? "—"}
    </span>
  );
}

export function PixelDice({ die1, die2, total, playerName, rolling }: PixelDiceProps) {
  return (
    <div className="pixel-border bg-[#ffd166] p-4 text-[#2b1f3a]">
      <p className="text-xs font-black uppercase tracking-[0.2em] text-[#6c557d]">Dice Roll</p>
      <div className="mt-3 flex flex-wrap items-center gap-3">
        <DieFace rolling={rolling} value={die1} />
        <span className="text-2xl font-black">+</span>
        <DieFace rolling={rolling} value={die2} />
        <span className="text-2xl font-black">=</span>
        <span className="pixel-border bg-[#fff7df] px-4 py-3 text-2xl font-black">{rolling ? "..." : total ?? "—"}</span>
      </div>
      <p className="mt-3 text-sm font-black">
        {rolling ? "Rolling the pixel dice..." : total != null ? `${playerName ?? "Player"} rolled ${total}` : "Roll dice to start movement."}
      </p>
    </div>
  );
}
