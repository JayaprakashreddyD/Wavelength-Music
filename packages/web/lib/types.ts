export interface User {
  id: string;
  username: string;
  email: string;
  profileImage: string | null;
  isAdmin: boolean;
  createdAt: string;
}

export interface Song {
  id: string;
  title: string;
  artistName: string;
  albumName: string | null;
  artworkUrl: string | null;
  audioUrl: string;
  duration: number;
  genre: string | null;
  uploadedById: string;
  playCount: number;
  downloadCount: number;
  isDownloadable: boolean;
  createdAt: string;
}

export interface Playlist {
  id: string;
  name: string;
  description: string | null;
  artworkUrl: string | null;
  ownerId: string;
  createdAt: string;
  updatedAt: string;
  songs?: { songId: string }[];
}

export interface PlaylistDetail extends Playlist {
  songs: { id: string; songId: string; position: number; song: Song }[];
}

export type RoomVisibility = "PUBLIC" | "PRIVATE";
export type RoomRole = "HOST" | "ELDER" | "MEMBER";
export type PlaybackStateValue = "PLAYING" | "PAUSED" | "STOPPED";

export interface RoomSummary {
  id: string;
  name: string;
  description: string | null;
  artworkUrl: string | null;
  host: { id: string; username: string; profileImage: string | null };
  memberCount: number;
  currentSong: { id: string; title: string; artist: string; artworkUrl: string | null } | null;
  playbackState: PlaybackStateValue;
  visibility?: RoomVisibility; code?: string;
}

export interface RoomMemberView {
  userId: string;
  username: string;
  profileImage: string | null;
  role: RoomRole;
  isConnected: boolean;
}

export interface RoomStatePayload {
  playback: PlaybackSnapshot;
  serverNow: number;
  room: {
    id: string;
    name: string;
    visibility: RoomVisibility;
    hostId: string;
    members: RoomMemberView[];
  };
}

export interface PlaybackSnapshot {
  roomId: string;
  currentSongId: string | null;
  state: PlaybackStateValue;
  position: number;
  serverTimestamp: number;
  queueVersion: number;
}

export interface QueueEntry {
  id: string;
  roomId: string;
  songId: string;
  position: number;
  addedById: string | null;
  addedAt: string;
  song: Song;
}
