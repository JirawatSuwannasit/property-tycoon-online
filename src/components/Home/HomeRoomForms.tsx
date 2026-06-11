"use client";

import { useRouter } from "next/navigation";
import { type FormEvent, useState } from "react";
import { PixelButton, PixelInput, PixelPanel } from "@/components/ui";
import { savePlayerSession } from "@/lib/client/player-session";

type RoomSessionResponse = {
  roomCode: string;
  playerId: string;
  sessionToken: string;
  error?: string;
};

function PixelDice() {
  return (
    <div className="pixel-border grid h-20 w-20 grid-cols-3 grid-rows-3 gap-1 bg-white p-3 pixelated" aria-hidden="true">
      <span className="col-start-1 row-start-1 bg-[#2b1f3a]" />
      <span className="col-start-3 row-start-1 bg-[#2b1f3a]" />
      <span className="col-start-2 row-start-2 bg-[#2b1f3a]" />
      <span className="col-start-1 row-start-3 bg-[#2b1f3a]" />
      <span className="col-start-3 row-start-3 bg-[#2b1f3a]" />
    </div>
  );
}

async function submitRoomAction(path: string, payload: Record<string, string>) {
  const response = await fetch(path, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  const data = (await response.json()) as RoomSessionResponse;

  if (!response.ok) {
    throw new Error(data.error ?? "Something went wrong. Please try again.");
  }

  return data;
}

export function HomeRoomForms() {
  const router = useRouter();
  const [createName, setCreateName] = useState("");
  const [joinName, setJoinName] = useState("");
  const [joinRoomCode, setJoinRoomCode] = useState("");
  const [createError, setCreateError] = useState<string | null>(null);
  const [joinError, setJoinError] = useState<string | null>(null);
  const [isCreating, setIsCreating] = useState(false);
  const [isJoining, setIsJoining] = useState(false);

  async function handleCreateRoom(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setCreateError(null);
    setIsCreating(true);

    try {
      const data = await submitRoomAction("/api/rooms/create", { displayName: createName });
      savePlayerSession(data);
      router.push(`/room/${data.roomCode}`);
    } catch (error) {
      setCreateError(error instanceof Error ? error.message : "Unable to create room.");
    } finally {
      setIsCreating(false);
    }
  }

  async function handleJoinRoom(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setJoinError(null);
    setIsJoining(true);

    try {
      const data = await submitRoomAction("/api/rooms/join", {
        displayName: joinName,
        roomCode: joinRoomCode.toUpperCase(),
      });
      savePlayerSession(data);
      router.push(`/room/${data.roomCode}`);
    } catch (error) {
      setJoinError(error instanceof Error ? error.message : "Unable to join room.");
    } finally {
      setIsJoining(false);
    }
  }

  return (
    <section className="mx-auto mt-10 grid max-w-7xl gap-6 lg:grid-cols-2">
      <PixelPanel className="p-6" tone="mint">
        <div className="mb-5 flex items-center justify-between gap-4">
          <div>
            <p className="text-xs font-black uppercase tracking-[0.2em] text-[#5a4770]">Host a table</p>
            <h2 className="text-3xl font-black">Create Room</h2>
          </div>
          <PixelDice />
        </div>
        <form className="space-y-5" aria-label="Create room form" onSubmit={handleCreateRoom}>
          <PixelInput
            label="Display name"
            name="createDisplayName"
            onChange={(event) => setCreateName(event.target.value)}
            placeholder="Pixel Pal"
            required
            value={createName}
          />
          {createError ? <p className="pixel-border bg-[#ff9aa2] p-3 text-sm font-bold">{createError}</p> : null}
          <PixelButton className="w-full" disabled={isCreating} type="submit">
            {isCreating ? "Creating..." : "Create Room"}
          </PixelButton>
        </form>
        <p className="mt-4 text-sm font-semibold text-[#4d3b61]">
          Hosts get a private player session token in this browser and can invite friends with a 6-character room code.
        </p>
      </PixelPanel>

      <PixelPanel className="p-6" tone="sky">
        <div className="mb-5">
          <p className="text-xs font-black uppercase tracking-[0.2em] text-[#5a4770]">Join friends</p>
          <h2 className="text-3xl font-black">Join Room</h2>
        </div>
        <form className="space-y-5" aria-label="Join room form" onSubmit={handleJoinRoom}>
          <PixelInput
            label="Display name"
            name="joinDisplayName"
            onChange={(event) => setJoinName(event.target.value)}
            placeholder="Cloud Cat"
            required
            value={joinName}
          />
          <PixelInput
            label="Room code"
            maxLength={6}
            name="roomCode"
            onChange={(event) => setJoinRoomCode(event.target.value.toUpperCase())}
            placeholder="ABC123"
            required
            value={joinRoomCode}
            className="uppercase tracking-[0.3em]"
          />
          {joinError ? <p className="pixel-border bg-[#ff9aa2] p-3 text-sm font-bold">{joinError}</p> : null}
          <PixelButton disabled={isJoining} className="w-full" type="submit" variant="secondary">
            {isJoining ? "Joining..." : "Join Room"}
          </PixelButton>
        </form>
        <p className="mt-4 text-sm font-semibold text-[#4d3b61]">
          Room codes use 6 uppercase letters or numbers. Joining is available only while the room is waiting.
        </p>
      </PixelPanel>
    </section>
  );
}
