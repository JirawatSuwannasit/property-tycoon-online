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
  playerColorClass: (player: BoardPlayerData) => string;
};

const TILE_ICONS: Record<string, string> = {
  start: "☀",
  property: "◆",
  tax: "฿",
  chance: "?",
  jail: "☕",
  go_to_jail: "☂",
  bonus: "✦",
};

const TILE_TONES: Record<string, string> = {
  start: "bg-[#b8f2d0]",
  property: "bg-[#fff7df]",
  tax: "bg-[#ff9aa2]",
  chance: "bg-[#cdb4db]",
  jail: "bg-[#a0d8ff]",
  go_to_jail: "bg-[#ffd166]",
  bonus: "bg-[#b8f2d0]",
};

const GROUP_TONES: Record<string, string> = {
  mint: "border-t-[#54d1a6]",
  sky: "border-t-[#55b8ff]",
  coral: "border-t-[#ff6f7d]",
  lavender: "border-t-[#a77bd8]",
  leaf: "border-t-[#63c66d]",
  gold: "border-t-[#f0b429]",
};

export function BoardTile({ tile, players, property, owner, isCurrentTile, isPendingTile, playerColorClass }: BoardTileProps) {
  const tone = TILE_TONES[tile.type] ?? "bg-[#fff7df]";
  const groupTone = tile.color_group ? GROUP_TONES[tile.color_group] ?? "border-t-[#2b1f3a]" : "border-t-[#2b1f3a]";

  return (
    <div
      className={`pixel-border relative flex min-h-28 flex-col justify-between overflow-hidden border-t-8 p-2 text-[#2b1f3a] ${tone} ${groupTone} ${
        isCurrentTile ? "ring-4 ring-[#ff9aa2]" : ""
      } ${isPendingTile ? "outline outline-4 outline-[#ffd166]" : ""}`}
    >
      <div className="flex items-start justify-between gap-1">
        <span className="font-mono text-[10px] font-black">#{tile.tile_index}</span>
        <span className="pixel-border bg-white px-1 text-[10px] font-black uppercase">{TILE_ICONS[tile.type] ?? "·"}</span>
      </div>

      <div>
        <p className="text-[11px] font-black leading-tight sm:text-xs">{tile.name}</p>
        <p className="mt-1 text-[9px] font-black uppercase tracking-wide text-[#6c557d]">{tile.type.replaceAll("_", " ")}</p>
        {tile.type === "property" ? (
          <p className="mt-1 text-[10px] font-bold text-[#4d3b61]">
            ฿{tile.price ?? "—"} · Rent {tile.rent ?? "—"}
          </p>
        ) : null}
      </div>

      <div className="mt-1 flex flex-wrap items-center gap-1">
        {owner ? (
          <span className={`pixel-border px-1 py-0.5 text-[9px] font-black uppercase ${playerColorClass(owner)}`}>
            Owner {owner.play_order ? `#${owner.play_order}` : owner.is_host ? "Host" : "Player"}
          </span>
        ) : null}
        {property && property.upgrade_level > 0 ? (
          <span className="pixel-border bg-[#ffd166] px-1 py-0.5 text-[9px] font-black uppercase">Lv {property.upgrade_level}</span>
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
  );
}
