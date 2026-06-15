import { BoardTile, type BoardPlayerData, type BoardPropertyData, type BoardTileData } from "./BoardTile";

type GameBoardProps = {
  tiles: BoardTileData[];
  players: BoardPlayerData[];
  properties: BoardPropertyData[];
  currentTurnPlayerId: string | null;
  pendingTileId: string | null;
  animatedPlayerPositions?: Record<string, number>;
  activePathTileIndex?: number | null;
  showStartBonus?: boolean;
};

const PLAYER_COLORS = ["bg-[#ff9aa2]", "bg-[#7fc8ff]", "bg-[#8fe388]", "bg-[#ffd166]"];

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

function MapDecorations() {
  return (
    <div aria-hidden="true" className="pointer-events-none absolute inset-0 overflow-hidden">
      <div className="absolute left-[9%] top-[12%] h-4 w-10 bg-[#7a4f2a] shadow-[0_4px_0_#5c351d,12px_0_0_#7a4f2a,12px_4px_0_#5c351d]" />
      <div className="absolute right-[10%] top-[15%] h-3 w-8 bg-[#7a4f2a] shadow-[0_4px_0_#5c351d,-12px_0_0_#7a4f2a,-12px_4px_0_#5c351d]" />
      <div className="absolute bottom-[11%] left-[18%] h-3 w-8 bg-[#7a4f2a] shadow-[0_4px_0_#5c351d,12px_0_0_#7a4f2a,12px_4px_0_#5c351d]" />
      <div className="absolute bottom-[13%] right-[16%] h-10 w-16 rounded-none bg-[#79c7d9] shadow-[4px_4px_0_#2b1f3a]" />
      <div className="absolute bottom-[17%] right-[20%] h-2 w-2 bg-[#fff7df] shadow-[10px_4px_0_#fff7df,20px_0_0_#fff7df]" />
      <div className="absolute left-[38%] top-[8%] h-3 w-3 bg-[#ff9aa2] shadow-[18px_8px_0_#ffd166,34px_0_0_#cdb4db,52px_8px_0_#ff9aa2]" />
      <div className="absolute bottom-[9%] left-[42%] h-3 w-3 bg-[#ffd166] shadow-[18px_0_0_#ff9aa2,36px_6px_0_#b8f2d0,58px_0_0_#cdb4db]" />
    </div>
  );
}

function VillageScene() {
  return (
    <div className="relative mt-4 h-32 w-full max-w-lg overflow-hidden border-4 border-[#2b1f3a] bg-[#9bdc7d] shadow-[6px_6px_0_#2b1f3a]">
      <div className="absolute inset-0 bg-[radial-gradient(#7fcf68_1px,transparent_1px)] bg-[length:10px_10px]" />
      <div className="absolute bottom-0 left-0 right-0 h-9 bg-[#d9a45f] bg-[linear-gradient(90deg,rgba(92,53,29,0.24)_1px,transparent_1px)] bg-[length:12px_12px]" />
      <div className="absolute bottom-9 left-[8%] h-8 w-12 bg-[#fff2cc] shadow-[0_-8px_0_#cf5f45,4px_4px_0_#2b1f3a]" />
      <div className="absolute bottom-9 left-[40%] h-12 w-16 bg-[#f8d98b] shadow-[0_-10px_0_#7a4f2a,5px_5px_0_#2b1f3a]" />
      <div className="absolute bottom-9 right-[10%] h-9 w-14 bg-[#ffe4a3] shadow-[0_-8px_0_#3f8f78,4px_4px_0_#2b1f3a]" />
      <div className="absolute bottom-12 left-[22%] h-3 w-3 bg-[#ff9aa2] shadow-[16px_4px_0_#ffd166,34px_-2px_0_#cdb4db,250px_0_0_#ff9aa2]" />
      <div className="absolute bottom-5 left-1/2 h-8 w-8 -translate-x-1/2 bg-[#b9824b] shadow-[0_8px_0_#7a4f2a,8px_0_0_#b9824b,-8px_0_0_#b9824b]" />
    </div>
  );
}

export function getPlayerColorClass(player: BoardPlayerData) {
  const colorIndex = Math.max(0, (player.play_order ?? 1) - 1) % PLAYER_COLORS.length;
  return PLAYER_COLORS[colorIndex] ?? PLAYER_COLORS[0];
}

export function GameBoard({
  tiles,
  players,
  properties,
  currentTurnPlayerId,
  pendingTileId,
  animatedPlayerPositions = {},
  activePathTileIndex = null,
  showStartBonus = false,
}: GameBoardProps) {
  const sortedTiles = [...tiles].sort((a, b) => a.tile_index - b.tile_index);

  return (
    <div className="pixel-border relative bg-[#6b3f24] p-4 shadow-[10px_10px_0_#2b1f3a]">
      <div className="absolute inset-1 border-4 border-[#a66a3d]" aria-hidden="true" />
      <div className="relative grid min-w-[860px] grid-cols-7 grid-rows-7 gap-2 overflow-hidden rounded-none border-4 border-[#2b1f3a] bg-[#71b85f] bg-[radial-gradient(#8fd879_1px,transparent_1px),linear-gradient(45deg,rgba(255,255,255,0.12)_25%,transparent_25%_50%,rgba(255,255,255,0.12)_50%_75%,transparent_75%)] bg-[length:11px_11px,34px_34px] p-4">
        <MapDecorations />
        <div className="pixel-border relative z-10 col-start-2 col-end-7 row-start-2 row-end-7 flex flex-col items-center justify-center overflow-hidden bg-[#f4d58d] bg-[linear-gradient(90deg,rgba(122,79,42,0.2)_1px,transparent_1px),linear-gradient(rgba(122,79,42,0.15)_1px,transparent_1px)] bg-[length:18px_18px] p-6 text-center shadow-[inset_0_0_0_8px_#dfaa62]">
          <div aria-hidden="true" className="absolute left-0 right-0 top-0 h-5 bg-[#7a4f2a] shadow-[0_5px_0_#5c351d]" />
          <p className="mt-4 text-xs font-black uppercase tracking-[0.32em] text-[#6c557d]">Property Tycoon Online</p>
          <h2 className="mt-2 text-4xl font-black tracking-[-0.06em] text-[#2b1f3a]">Thailand Landmark Trail</h2>
          <p className="mt-3 max-w-md text-sm font-bold text-[#4d3b61]">
            Follow the dirt road through a tiny Thai travel village. Dice, money, ownership, and movement still come from the server.
          </p>
          <VillageScene />
          <div className="mt-4 flex flex-wrap justify-center gap-2 text-xs font-black uppercase text-[#2b1f3a]">
            <span className="pixel-border bg-[#b8f2d0] px-3 py-2">Current token glows</span>
            <span className="pixel-border bg-[#ffd166] px-3 py-2">Path lights up</span>
            <span className="pixel-border bg-[#ff9aa2] px-3 py-2">Owned stops marked</span>
          </div>
        </div>

        {sortedTiles.map((tile) => {
          const property = properties.find((candidate) => candidate.tile_id === tile.id) ?? null;
          const owner = property ? players.find((player) => player.id === property.owner_player_id) ?? null : null;
          const tilePlayers = players.filter((player) => (animatedPlayerPositions[player.id] ?? player.position) === tile.tile_index && player.status !== "left");
          const isCurrentTile = tilePlayers.some((player) => player.id === currentTurnPlayerId);
          const isPendingTile = pendingTileId === tile.id;
          const isPathTile = activePathTileIndex === tile.tile_index;
          const tileShowsStartBonus = showStartBonus && tile.tile_index === 0;

          return (
            <div key={tile.id} className="relative z-10" style={getTileGridPosition(tile.tile_index)}>
              <BoardTile
                tile={tile}
                players={tilePlayers}
                property={property}
                owner={owner}
                isCurrentTile={isCurrentTile}
                isPendingTile={isPendingTile}
                isPathTile={isPathTile}
                showStartBonus={tileShowsStartBonus}
                playerColorClass={getPlayerColorClass}
              />
            </div>
          );
        })}
      </div>
    </div>
  );
}
