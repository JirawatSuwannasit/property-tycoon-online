type PlayerTokenProps = {
  name: string;
  avatarKey: string;
  colorClass: string;
  isCurrentTurn: boolean;
  isYou: boolean;
};

const TOKEN_SYMBOLS: Record<string, string> = {
  berry_blob: "★",
  cloud_cat: "◆",
  star_sprout: "✦",
  mint_robot: "●",
};

export function PlayerToken({ name, avatarKey, colorClass, isCurrentTurn, isYou }: PlayerTokenProps) {
  const label = TOKEN_SYMBOLS[avatarKey] ?? "●";

  return (
    <span
      className={`pixel-border inline-flex h-6 min-w-6 items-center justify-center px-1 text-[10px] font-black leading-none text-[#2b1f3a] ${colorClass} ${
        isCurrentTurn ? "scale-110 ring-2 ring-[#ff9aa2]" : ""
      }`}
      title={`${name}${isYou ? " (you)" : ""}${isCurrentTurn ? " — current turn" : ""}`}
      aria-label={`${name} token`}
    >
      {label}
    </span>
  );
}
