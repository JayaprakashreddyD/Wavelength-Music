import { RoomRole } from "@prisma/client";

export interface SocketData {
  userId: string;
  username: string;
}

// Client -> Server events
export interface ClientToServerEvents {
  "room:join": (payload: { roomId: string }, ack: (res: AckResponse) => void) => void;
  "room:leave": (payload: { roomId: string }) => void;
  "room:play": (payload: { roomId: string }) => void;
  "room:pause": (payload: { roomId: string }) => void;
  "room:seek": (payload: { roomId: string; position: number }) => void;
  "room:song-change": (payload: { roomId: string; songId: string; autoplay?: boolean }) => void;
  "room:queue-add-songs": (payload: { roomId: string; songIds: string[] }) => void;
  "room:queue-add-playlist": (payload: { roomId: string; playlistId: string }) => void;
  "room:queue-remove": (payload: { roomId: string; songId: string }) => void;
  "room:queue-reorder": (payload: { roomId: string; orderedSongIds: string[] }) => void;
  "room:role-change": (payload: { roomId: string; targetUserId: string; action: "promote" | "demote" | "remove" }) => void;
  "room:sync-request": (payload: { roomId: string }) => void;
}

// Server -> Client events
export interface ServerToClientEvents {
  "room:state": (payload: unknown) => void;
  "room:queue-update": (payload: unknown) => void;
  "room:member-join": (payload: unknown) => void;
  "room:member-leave": (payload: unknown) => void;
  "room:role-change": (payload: unknown) => void;
  "room:host-migrated": (payload: unknown) => void;
  "room:sync": (payload: unknown) => void;
  "room:closed": (payload: { roomId: string }) => void;
  "error": (payload: { code: string; message: string }) => void;
}

export interface AckResponse {
  ok: boolean;
  error?: string;
  role?: RoomRole;
}
