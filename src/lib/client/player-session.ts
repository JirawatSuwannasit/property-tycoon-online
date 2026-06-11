export type StoredPlayerSession = {
  roomCode: string;
  playerId: string;
  sessionToken: string;
};

function getSessionKey(roomCode: string) {
  return `property-tycoon-session:${roomCode.toUpperCase()}`;
}

export function savePlayerSession(session: StoredPlayerSession) {
  if (typeof window === "undefined") {
    return;
  }

  const normalizedSession = {
    ...session,
    roomCode: session.roomCode.toUpperCase(),
  };

  window.localStorage.setItem(getSessionKey(normalizedSession.roomCode), JSON.stringify(normalizedSession));
  window.localStorage.setItem("property-tycoon-last-room", normalizedSession.roomCode);
}

export function loadPlayerSession(roomCode: string): StoredPlayerSession | null {
  if (typeof window === "undefined") {
    return null;
  }

  const rawSession = window.localStorage.getItem(getSessionKey(roomCode));

  if (!rawSession) {
    return null;
  }

  try {
    const parsedSession = JSON.parse(rawSession) as StoredPlayerSession;

    if (!parsedSession.playerId || !parsedSession.sessionToken) {
      return null;
    }

    return {
      ...parsedSession,
      roomCode: parsedSession.roomCode.toUpperCase(),
    };
  } catch {
    return null;
  }
}
