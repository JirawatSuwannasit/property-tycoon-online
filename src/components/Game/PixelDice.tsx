type PixelDiceProps = {
  die1: number | null;
  die2: number | null;
  total: number | null;
  playerName: string | null;
  rolling: boolean;
};

function PipPattern({ value }: { value: number | null }) {
  if (!value) {
    return <span className="text-2xl font-black">?</span>;
  }

  const pipMap: Record<number, number[]> = {
    1: [4],
    2: [0, 8],
    3: [0, 4, 8],
    4: [0, 2, 6, 8],
    5: [0, 2, 4, 6, 8],
    6: [0, 2, 3, 5, 6, 8],
  };

  return (
    <span className="grid h-9 w-9 grid-cols-3 grid-rows-3 gap-1">
      {Array.from({ length: 9 }, (_, index) => (
        <span key={index} className={pipMap[value]?.includes(index) ? "bg-[#2b1f3a]" : "bg-transparent"} />
      ))}
    </span>
  );
}

function DieFace({ value, rolling }: { value: number | null; rolling: boolean }) {
  return (
    <span
      className={`inline-flex h-16 w-16 items-center justify-center border-4 border-[#2b1f3a] bg-[#fff7df] text-[#2b1f3a] shadow-[4px_4px_0_#2b1f3a] ${
        rolling ? "animate-bounce" : ""
      }`}
    >
      <PipPattern value={rolling ? null : value} />
    </span>
  );
}

export function PixelDice({ die1, die2, total, playerName, rolling }: PixelDiceProps) {
  return (
    <div className="relative overflow-hidden border-4 border-[#2b1f3a] bg-[#7a4f2a] p-3 text-[#2b1f3a] shadow-[6px_6px_0_#2b1f3a]">
      <div className="absolute inset-x-0 top-0 h-4 bg-[#a66a3d]" aria-hidden="true" />
      <div className="relative bg-[#f4d58d] bg-[linear-gradient(90deg,rgba(122,79,42,0.16)_1px,transparent_1px)] bg-[length:12px_12px] p-4 shadow-[inset_0_0_0_4px_#dfaa62]">
        <p className="text-xs font-black uppercase tracking-[0.22em] text-[#6c557d]">Travel Dice</p>
        <div className="mt-3 flex flex-wrap items-center gap-3">
          <DieFace rolling={rolling} value={die1} />
          <span className="text-2xl font-black">+</span>
          <DieFace rolling={rolling} value={die2} />
          <span className="text-2xl font-black">=</span>
          <span className="border-4 border-[#2b1f3a] bg-[#fff7df] px-4 py-3 text-2xl font-black shadow-[4px_4px_0_#2b1f3a]">
            {rolling ? "..." : total ?? "—"}
          </span>
        </div>
        <p className="mt-3 text-sm font-black">
          {rolling ? "Shaking the carved pixel dice..." : total != null ? `${playerName ?? "Player"} rolled ${total}` : "Roll to travel the landmark path."}
        </p>
      </div>
    </div>
  );
}
