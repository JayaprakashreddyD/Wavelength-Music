import { RoomRole } from "@prisma/client";

// Central permission table for every privileged room action. Both the
// socket layer and (for completeness) any REST equivalents consult this
// so permission logic lives in exactly one place — the frontend's view of
// a user's role is never trusted, only used to decide what UI to show.
export type RoomAction =
  | "PLAY_PAUSE"
  | "SEEK"
  | "CHANGE_SONG"
  | "SKIP"
  | "ADD_SONGS"
  | "ADD_PLAYLIST"
  | "REMOVE_SONG"
  | "REORDER_QUEUE"
  | "PROMOTE_MEMBER"
  | "DEMOTE_ELDER"
  | "REMOVE_MEMBER"
  | "END_ROOM"
  | "CHANGE_ROOM_SETTINGS";

const HOST_ONLY: RoomAction[] = [
  "PROMOTE_MEMBER",
  "DEMOTE_ELDER",
  "REMOVE_MEMBER",
  "END_ROOM",
  "CHANGE_ROOM_SETTINGS",
];

const HOST_AND_ELDER: RoomAction[] = [
  "PLAY_PAUSE",
  "SEEK",
  "CHANGE_SONG",
  "SKIP",
  "ADD_SONGS",
  "ADD_PLAYLIST",
  "REMOVE_SONG",
  "REORDER_QUEUE",
];

export function can(role: RoomRole | null, action: RoomAction): boolean {
  if (!role) return false;
  if (role === RoomRole.HOST) return true; // host can do everything
  if (role === RoomRole.ELDER) return HOST_AND_ELDER.includes(action);
  return false; // MEMBER: view-only, no privileged actions
}

export function assertHostOnlyActionIsHostOnly(action: RoomAction) {
  return HOST_ONLY.includes(action);
}
