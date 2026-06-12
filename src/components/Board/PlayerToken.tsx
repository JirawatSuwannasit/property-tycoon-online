type PlayerTokenProps = {
  name: string;
  avatarKey: string;
  colorClass: string;
  isCurrentTurn: boolean;
  isYou: boolean;
};

function TokenIcon({ avatarKey }: { avatarKey: string }) {
  if (avatarKey === "berry_blob") {
    return (
      <span className="relative block h-4 w-5">
        <span className="absolute bottom-0 left-0 h-2 w-5 bg-[#2b1f3a]" />
        <span className="absolute bottom-2 left-1 h-2 w-3 bg-current" />
        <span className="absolute bottom-0 left-0 h-1 w-1 bg-white" />
        <span className="absolute bottom-0 right-0 h-1 w-1 bg-white" />
      </span>
    );
  }

  if (avatarKey === "cloud_cat") {
    return (
      <span className="relative block h-4 w-5">
        <span className="absolute bottom-0 left-2 h-4 w-1 bg-[#2b1f3a]" />
        <span className="absolute bottom-0 left-0 h-2 w-5 bg-current" />
        <span className="absolute bottom-2 left-1 h-2 w-1 bg-current" />
        <span className="absolute bottom-2 right-1 h-2 w-1 bg-current" />
      </span>
    );
  }

  if (avatarKey === "star_sprout") {
    return (
      <span className="relative block h-4 w-5">
        <span className="absolute left-2 top-0 h-4 w-1 bg-current" />
        <span className="absolute left-0 top-2 h-1 w-5 bg-current" />
        <span className="absolute left-1 top-1 h-2 w-3 bg-[#2b1f3a]" />
      </span>
    );
  }

  return (
    <span className="relative block h-4 w-5">
      <span className="absolute left-0 top-2 h-2 w-5 bg-[#2b1f3a]" />
      <span className="absolute left-1 top-1 h-2 w-3 bg-current" />
      <span className="absolute left-2 top-0 h-1 w-1 bg-current" />
    </span>
  );
}

export function PlayerToken({ name, avatarKey, colorClass, isCurrentTurn, isYou }: PlayerTokenProps) {
  return (
    <span
      className={`pixel-border inline-flex h-7 min-w-8 items-center justify-center px-1 text-[#2b1f3a] ${colorClass} ${
        isCurrentTurn ? "scale-110 animate-bounce ring-2 ring-[#ff9aa2]" : ""
      } ${isYou ? "shadow-[0_0_0_3px_#ffffff_inset]" : ""}`}
      title={`${name}${isYou ? " (you)" : ""}${isCurrentTurn ? " — current turn" : ""}`}
      aria-label={`${name} token`}
    >
      <TokenIcon avatarKey={avatarKey} />
    </span>
  );
}
