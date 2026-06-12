import { GameDebugPanel } from "@/components/Game/GameDebugPanel";
import { LobbyClient } from "@/components/Lobby/LobbyClient";

type RoomPageProps = {
  params: Promise<{
    roomCode: string;
  }>;
};

export default async function RoomPage({ params }: RoomPageProps) {
  const { roomCode } = await params;

  return (
    <>
      <LobbyClient roomCode={roomCode} />
      <GameDebugPanel roomCode={roomCode} />
    </>
  );
}
