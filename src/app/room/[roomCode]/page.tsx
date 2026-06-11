import Link from "next/link";
import { PixelButton, PixelPanel } from "@/components/ui";

type RoomPageProps = {
  params: Promise<{
    roomCode: string;
  }>;
};

export default async function RoomPage({ params }: RoomPageProps) {
  const { roomCode } = await params;
  const normalizedRoomCode = roomCode.toUpperCase();

  return (
    <main className="flex min-h-screen items-center justify-center px-5 py-10">
      <PixelPanel className="max-w-2xl p-8 text-center" tone="lavender">
        <p className="mb-3 text-xs font-black uppercase tracking-[0.22em] text-[#5a4770]">
          Room Placeholder
        </p>
        <h1 className="mb-4 text-4xl font-black tracking-[-0.04em] sm:text-6xl">
          Room {normalizedRoomCode}
        </h1>
        <p className="mx-auto mb-8 max-w-xl text-base font-semibold leading-7 text-[#4d3b61]">
          This route is ready for the lobby and realtime game experience. Room loading, player lists, and game actions will be implemented after the Phase 1 scaffold.
        </p>
        <Link href="/">
          <PixelButton>Back to Home</PixelButton>
        </Link>
      </PixelPanel>
    </main>
  );
}
