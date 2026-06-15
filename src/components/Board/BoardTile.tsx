import { PlayerToken } from "./PlayerToken";

export type BoardTileData = {
  id: string;
  tile_index: number;
  type: string;
  name: string;
  description: string | null;
  price: number | null;
  rent: number | null;
  amount: number | null;
  color_group: string | null;
};

export type BoardPlayerData = {
  id: string;
  display_name: string;
  avatar_key: string;
  position: number;
  is_host: boolean;
  play_order: number | null;
  is_current_turn: boolean;
  is_you: boolean;
  status: string;
};

export type BoardPropertyData = {
  id: string;
  tile_id: string;
  owner_player_id: string;
  upgrade_level: number;
};

type BoardTileProps = {
  tile: BoardTileData;
  players: BoardPlayerData[];
  property: BoardPropertyData | null;
  owner: BoardPlayerData | null;
  isCurrentTile: boolean;
  isPendingTile: boolean;
  isPathTile: boolean;
  showStartBonus: boolean;
  playerColorClass: (player: BoardPlayerData) => string;
};

const TILE_TONES: Record<string, string> = {
  start: "from-[#b8f2d0] to-[#79d78f]",
  property: "from-[#f9d27a] to-[#d99b4d]",
  tax: "from-[#ff9aa2] to-[#d95d6a]",
  chance: "from-[#cdb4db] to-[#9e7bc4]",
  jail: "from-[#a0d8ff] to-[#5ca6d8]",
  go_to_jail: "from-[#ffd166] to-[#f09a3e]",
  bonus: "from-[#b8f2d0] to-[#6fcf97]",
};

const GROUP_TONES: Record<string, string> = {
  mint: "bg-[#54d1a6]",
  sky: "bg-[#55b8ff]",
  coral: "bg-[#ff6f7d]",
  lavender: "bg-[#a77bd8]",
  leaf: "bg-[#63c66d]",
  gold: "bg-[#f0b429]",
};

function LandmarkMiniScene({ tile }: { tile: BoardTileData }) {
  const groupColor = tile.color_group ? GROUP_TONES[tile.color_group] ?? "bg-[#f0b429]" : "bg-[#f0b429]";

  if (tile.type === "start") {
    return (
      <div className="relative h-12 bg-[#8fd879]">
        <div className="absolute bottom-0 left-0 right-0 h-4 bg-[#d9a45f]" />
        <div className="absolute left-3 top-2 h-5 w-5 bg-[#ffd166] shadow-[0_0_0_3px_#f08f3e]" />
        <div className="absolute bottom-4 right-3 h-4 w-10 bg-[#fff7df] shadow-[0_4px_0_#7a4f2a]" />
      </div>
    );
  }

  if (tile.type === "tax") {
    return (
      <div className="relative h-12 bg-[#e8b45f]">
        <div className="absolute bottom-0 left-0 right-0 h-4 bg-[#8a5a35]" />
        <div className="absolute bottom-4 left-4 h-6 w-8 bg-[#fff7df] shadow-[4px_4px_0_#2b1f3a]" />
        <div className="absolute bottom-5 left-7 text-lg font-black text-[#2b1f3a]">฿</div>
      </div>
    );
  }

  if (tile.type === "chance") {
    return (
      <div className="relative h-12 bg-[#b991d1]">
        <div className="absolute bottom-0 left-0 right-0 h-3 bg-[#6c557d]" />
        <div className="absolute bottom-3 left-5 h-7 w-7 rotate-3 bg-[#fff7df] shadow-[4px_4px_0_#2b1f3a]" />
        <div className="absolute bottom-4 left-8 text-lg font-black text-[#2b1f3a]">?</div>
      </div>
    );
  }

  if (tile.type === "jail") {
    return (
      <div className="relative h-12 bg-[#9fd2ec]">
        <div className="absolute bottom-0 left-0 right-0 h-3 bg-[#79c7d9]" />
        <div className="absolute bottom-3 left-4 h-7 w-10 bg-[#fff2cc] shadow-[4px_4px_0_#2b1f3a]" />
        <div className="absolute bottom-6 left-6 h-1 w-6 bg-[#7a4f2a] shadow-[0_5px_0_#7a4f2a]" />
      </div>
    );
  }

  if (tile.type === "go_to_jail") {
    return (
      <div className="relative h-12 bg-[#6aa8c8]">
        <div className="absolute bottom-0 left-0 right-0 h-4 bg-[#5d7280]" />
        <div className="absolute left-4 top-1 h-6 w-10 bg-[#4d3b61] shadow-[0_6px_0_#2b1f3a]" />
        <div className="absolute left-7 top-0 h-3 w-2 bg-[#ffd166]" />
      </div>
    );
  }

  if (tile.type === "bonus") {
    return (
      <div className="relative h-12 bg-[#85d678]">
        <div className="absolute bottom-0 left-0 right-0 h-3 bg-[#d9a45f]" />
        <div className="absolute bottom-3 left-5 h-6 w-8 bg-[#ffd166] shadow-[4px_4px_0_#2b1f3a]" />
        <div className="absolute bottom-5 left-8 h-2 w-2 bg-white shadow-[8px_0_0_white,-8px_0_0_white]" />
      </div>
    );
  }

  return (
    <div className="relative h-12 bg-[#91d27f]">
      <div className="absolute bottom-0 left-0 right-0 h-4 bg-[#d9a45f] bg-[linear-gradient(90deg,rgba(92,53,29,0.22)_1px,transparent_1px)] bg-[length:8px_8px]" />
      <div className={`absolute bottom-4 left-3 h-5 w-10 ${groupColor} shadow-[4px_4px_0_#2b1f3a]`} />
      <div className="absolute bottom-9 left-5 h-3 w-6 bg-[#7a4f2a] shadow-[0_-3px_0_#2b1f3a]" />
      <div className="absolute bottom-4 right-3 h-3 w-3 bg-[#ff9aa2] shadow-[8px_2px_0_#ffd166]" />
    </div>
  );
}

function typeLabel(type: string) {
  return type.replaceAll("_", " ");
}

export function BoardTile({
  tile,
  players,
  property,
  owner,
  isCurrentTile,
  isPendingTile,
  isPathTile,
  showStartBonus,
  playerColorClass,
}: BoardTileProps) {
  const tone = TILE_TONES[tile.type] ?? TILE_TONES.property;
  const groupDot = tile.color_group ? GROUP_TONES[tile.color_group] ?? "bg-[#2b1f3a]" : "bg-[#2b1f3a]";

  return (
    <div
      className={`relative flex h-full min-h-32 flex-col overflow-hidden border-4 border-[#2b1f3a] bg-gradient-to-b ${tone} text-[#2b1f3a] shadow-[4px_4px_0_#2b1f3a] transition-transform ${
        isCurrentTile ? "-translate-y-1 ring-4 ring-[#ff9aa2]" : ""
      } ${isPendingTile ? "outline outline-4 outline-[#ffd166]" : ""} ${isPathTile ? "animate-pulse ring-4 ring-[#fff7df]" : ""}`}
    >
      <LandmarkMiniScene tile={tile} />
      {showStartBonus ? (
        <span className="absolute right-1 top-10 z-20 animate-bounce border-4 border-[#2b1f3a] bg-[#b8f2d0] px-2 py-1 text-[10px] font-black text-[#2b1f3a] shadow-[3px_3px_0_#2b1f3a]">
          +200
        </span>
      ) : null}

      <div className="relative flex flex-1 flex-col justify-between bg-[#fff7df]/90 p-2 shadow-[inset_0_4px_0_rgba(122,79,42,0.22)]">
        <div>
          <div className="flex items-center justify-between gap-1">
            <span className="bg-[#2b1f3a] px-1.5 py-0.5 font-mono text-[10px] font-black text-[#fff7df]">#{tile.tile_index}</span>
            <span className={`h-3 w-3 border-2 border-[#2b1f3a] ${groupDot}`} aria-label={tile.color_group ?? "special tile"} />
          </div>
          <p className="mt-1 text-[11px] font-black leading-tight sm:text-xs">{tile.name}</p>
          <p className="mt-0.5 text-[8px] font-black uppercase tracking-wide text-[#6c557d]">{typeLabel(tile.type)}</p>
          {tile.type === "property" ? (
            <p className="mt-1 inline-block bg-[#f4d58d] px-1 py-0.5 text-[10px] font-black text-[#4d3b61]">
              ฿{tile.price ?? "—"} · Rent {tile.rent ?? "—"}
            </p>
          ) : null}
        </div>

        <div className="mt-1 flex flex-wrap items-center gap-1">
          {owner ? (
            <span className={`border-2 border-[#2b1f3a] px-1 py-0.5 text-[9px] font-black uppercase shadow-[2px_2px_0_#2b1f3a] ${playerColorClass(owner)}`}>
              Owned #{owner.play_order ?? "?"}
            </span>
          ) : null}
          {property && property.upgrade_level > 0 ? (
            <span className="border-2 border-[#2b1f3a] bg-[#ffd166] px-1 py-0.5 text-[9px] font-black uppercase shadow-[2px_2px_0_#2b1f3a]">
              Facilities Lv {property.upgrade_level}
            </span>
          ) : null}
        </div>

        {players.length ? (
          <div className="mt-2 flex flex-wrap gap-1">
            {players.map((player) => (
              <PlayerToken
                key={player.id}
                avatarKey={player.avatar_key}
                colorClass={playerColorClass(player)}
                isCurrentTurn={player.is_current_turn}
                isYou={player.is_you}
                name={player.display_name}
              />
            ))}
          </div>
        ) : null}
      </div>
    </div>
  );
}
