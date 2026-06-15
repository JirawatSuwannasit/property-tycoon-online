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
      <span className="relative block h-6 w-7">
        <span className="absolute bottom-1 left-0 h-3 w-7 bg-[#2b1f3a]" />
        <span className="absolute bottom-4 left-1 h-2 w-5 bg-current" />
        <span className="absolute bottom-0 left-1 h-2 w-2 bg-[#fff7df]" />
        <span className="absolute bottom-0 right-1 h-2 w-2 bg-[#fff7df]" />
        <span className="absolute bottom-3 right-0 h-1 w-1 bg-[#ffd166]" />
      </span>
    );
  }

  if (avatarKey === "cloud_cat") {
    return (
      <span className="relative block h-6 w-7">
        <span className="absolute bottom-1 left-3 h-5 w-1 bg-[#2b1f3a]" />
        <span className="absolute bottom-1 left-0 h-3 w-7 bg-current" />
        <span className="absolute bottom-4 left-1 h-2 w-2 bg-current" />
        <span className="absolute bottom-4 right-1 h-2 w-2 bg-current" />
        <span className="absolute bottom-2 left-3 h-1 w-1 bg-[#fff7df]" />
      </span>
    );
  }

  if (avatarKey === "star_sprout") {
    return (
      <span className="relative block h-6 w-7">
        <span className="absolute left-3 top-0 h-6 w-1 bg-current" />
        <span className="absolute left-0 top-3 h-1 w-7 bg-current" />
        <span className="absolute left-1 top-2 h-3 w-5 bg-[#2b1f3a]" />
        <span className="absolute left-3 top-3 h-1 w-1 bg-[#ffd166]" />
      </span>
    );
  }

  return (
    <span className="relative block h-6 w-7">
      <span className="absolute left-0 top-3 h-3 w-7 bg-[#2b1f3a]" />
      <span className="absolute left-1 top-2 h-3 w-5 bg-current" />
      <span className="absolute left-3 top-0 h-2 w-1 bg-current" />
      <span className="absolute left-2 top-4 h-1 w-3 bg-[#fff7df]" />
    </span>
  );
}

export function PlayerToken({ name, avatarKey, colorClass, isCurrentTurn, isYou }: PlayerTokenProps) {
  return (
    <span
      className={`relative inline-flex h-9 min-w-10 items-center justify-center border-4 border-[#2b1f3a] px-1 text-[#2b1f3a] shadow-[3px_3px_0_#2b1f3a] ${colorClass} ${
        isCurrentTurn ? "-translate-y-1 animate-bounce ring-4 ring-[#fff7df]" : ""
      } ${isYou ? "after:absolute after:inset-1 after:border-2 after:border-white" : ""}`}
      title={`${name}${isYou ? " (you)" : ""}${isCurrentTurn ? " — current turn" : ""}`}
      aria-label={`${name} token`}
    >
      <TokenIcon avatarKey={avatarKey} />
    </span>
  );
}
