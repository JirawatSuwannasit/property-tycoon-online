import { HomeRoomForms } from "@/components/Home/HomeRoomForms";
import { PixelCard, PixelPanel } from "@/components/ui";

const previewTiles = [
  "bg-[#ffd166]",
  "bg-[#b8f2d0]",
  "bg-[#a0d8ff]",
  "bg-[#ff9aa2]",
  "bg-[#cdb4db]",
  "bg-[#fff2cc]",
  "bg-[#7bd88f]",
  "bg-[#ffd166]",
];

function PixelBoardPreview() {
  return (
    <div className="pixel-border-lg pixel-grid-bg relative mx-auto aspect-square w-full max-w-md bg-[#fff2cc] p-4">
      <div className="grid h-full grid-cols-6 grid-rows-6 gap-2">
        {Array.from({ length: 36 }, (_, index) => {
          const row = Math.floor(index / 6);
          const column = index % 6;
          const isEdge = row === 0 || row === 5 || column === 0 || column === 5;

          if (!isEdge) {
            return <div key={index} className="bg-[#fff7df]/70" />;
          }

          return (
            <div
              key={index}
              className={`border-2 border-[#2b1f3a] ${previewTiles[index % previewTiles.length]}`}
            />
          );
        })}
      </div>
      <div className="absolute inset-1/2 flex h-24 w-24 -translate-x-1/2 -translate-y-1/2 items-center justify-center border-[3px] border-[#2b1f3a] bg-[#fff7df] text-center text-xs font-black uppercase leading-tight shadow-[4px_4px_0_#2b1f3a]">
        24 Tile MVP
      </div>
      <span className="absolute left-5 top-5 h-5 w-5 border-2 border-[#2b1f3a] bg-[#ff9aa2] shadow-[20px_10px_0_#a0d8ff,40px_0_0_#b8f2d0]" />
    </div>
  );
}

export default function Home() {
  return (
    <main className="min-h-screen px-5 py-8 sm:px-8 lg:px-12">
      <section className="mx-auto grid max-w-7xl gap-8 lg:grid-cols-[1.05fr_0.95fr] lg:items-center">
        <div className="space-y-6">
          <p className="pixel-border inline-block bg-[#b8f2d0] px-4 py-2 text-xs font-black uppercase tracking-[0.22em]">
            Original Pixel Board Game
          </p>
          <div className="space-y-4">
            <h1 className="max-w-4xl text-5xl font-black leading-none tracking-[-0.06em] text-[#2b1f3a] sm:text-7xl lg:text-8xl">
              Property Tycoon Online
            </h1>
            <p className="max-w-2xl text-lg font-semibold leading-8 text-[#4d3b61]">
              Build a cozy little property empire with friends in a bright, CSS-first pixel-art board game. Create a room, invite 2-4 players, and get ready for the 24-tile MVP board.
            </p>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <PixelCard label="MVP Focus">
              <h2 className="mb-2 text-xl font-black">Server-authoritative play</h2>
              <p className="text-sm font-semibold text-[#4d3b61]">
                Future game actions will go through API routes so dice rolls, money, and ownership are never decided by the browser.
              </p>
            </PixelCard>
            <PixelCard label="Visual Direction" className="bg-[#b8f2d0]">
              <h2 className="mb-2 text-xl font-black">Cute pixel style</h2>
              <p className="text-sm font-semibold text-[#4d3b61]">
                The interface uses playful CSS blocks, chunky shadows, and original visual elements instead of external artwork.
              </p>
            </PixelCard>
          </div>
        </div>

        <PixelPanel className="p-5 sm:p-7" tone="paper">
          <PixelBoardPreview />
        </PixelPanel>
      </section>

      <HomeRoomForms />
    </main>
  );
}
