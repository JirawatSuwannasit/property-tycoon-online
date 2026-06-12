import { BoardTile, type BoardPlayerData, type BoardPropertyData, type BoardTileData } from "./BoardTile";

type GameBoardProps = {
  tiles: BoardTileData[];
  players: BoardPlayerData[];
  properties: BoardPropertyData[];
  currentTurnPlayerId: string | null;
  pendingTileId: string | null;
};

const PLAYER_COLORS = ["bg-[#ff9aa2]", "bg-[#a0d8ff]", "bg-[#b8f2d0]", "bg-[#ffd166]"];

function getTileGridPosition(tileIndex: number) {
  if (tileIndex >= 0 && tileIndex <= 6) {
    return { gridColumn: `${tileIndex + 1}`, gridRow: "7" };
  }

  if (tileIndex >= 7 && tileIndex <= 12) {
    return { gridColumn: "7", gridRow: `${13 - tileIndex}` };
  }

  if (tileIndex >= 13 && tileIndex <= 18) {
    return { gridColumn: `${19 - tileIndex}`, gridRow: "1" };
  }

  return { gridColumn: "1", gridRow: `${tileIndex - 17}` };
}

export function getPlayerColorClass(player: BoardPlayerData) {
  const colorIndex = Math.max(0, (player.play_order ?? 1) - 1) % PLAYER_COLORS.length;
  return PLAYER_COLORS[colorIndex] ?? PLAYER_COLORS[0];
}

export function GameBoard({ tiles, players, properties, currentTurnPlayerId, pendingTileId }: GameBoardProps) {
  const sortedTiles = [...tiles].sort((a, b) => a.tile_index - b.tile_index);

  return (
    <div className="pixel-border bg-[#2b1f3a] p-3">
      <div className="grid min-w-[760px] grid-cols-7 grid-rows-7 gap-2 rounded-none bg-[#6c557d] p-2">
        <div className="pixel-border col-start-2 col-end-7 row-start-2 row-end-7 flex flex-col items-center justify-center bg-[#fff2cc] p-6 text-center">
          <p className="text-xs font-black uppercase tracking-[0.28em] text-[#6c557d]">Property Tycoon Online</p>
          <h2 className="mt-2 text-4xl font-black tracking-[-0.06em] text-[#2b1f3a]">Thailand Landmark Trail</h2>
          <p className="mt-3 max-w-md text-sm font-bold text-[#4d3b61]">
            Server-authoritative board state. The client only displays tiles, tokens, owners, and upgrade levels.
          </p>
          <div className="mt-4 flex flex-wrap justify-center gap-2 text-xs font-black uppercase text-[#2b1f3a]">
            <span className="pixel-border bg-[#b8f2d0] px-3 py-2">Current turn highlighted</span>
            <span className="pixel-border bg-[#ffd166] px-3 py-2">Pending tile outlined</span>
            <span className="pixel-border bg-[#ff9aa2] px-3 py-2">Owner badges</span>
          </div>
        </div>

        {sortedTiles.map((tile) => {
          const property = properties.find((candidate) => candidate.tile_id === tile.id) ?? null;
          const owner = property ? players.find((player) => player.id === property.owner_player_id) ?? null : null;
          const tilePlayers = players.filter((player) => player.position === tile.tile_index && player.status !== "left");
          const isCurrentTile = tilePlayers.some((player) => player.id === currentTurnPlayerId);
          const isPendingTile = pendingTileId === tile.id;

          return (
            <div key={tile.id} style={getTileGridPosition(tile.tile_index)}>
              <BoardTile
                tile={tile}
                players={tilePlayers}
                property={property}
                owner={owner}
                isCurrentTile={isCurrentTile}
                isPendingTile={isPendingTile}
                playerColorClass={getPlayerColorClass}
              />
            </div>
          );
        })}
      </div>
    </div>
  );
}
