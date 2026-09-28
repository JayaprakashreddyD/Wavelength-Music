"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { Play, Pause, SkipForward, LogOut, Plus, ListPlus, Lock, Globe, AudioLines } from "lucide-react";
import { useRoomSync } from "@/lib/roomSync";
import { api } from "@/lib/api";
import { Playlist, RoomVisibility } from "@/lib/types";
import { Button } from "@/components/ui/Button";
import { ParticipantsPanel } from "@/components/rooms/ParticipantsPanel";
import { RoomQueue } from "@/components/rooms/RoomQueue";
import { Modal } from "@/components/ui/Modal";
import { useToast } from "@/components/ui/Toast";
import { Artwork } from "@/components/music/Artwork";

function formatTime(seconds: number) {
  if (!Number.isFinite(seconds)) return "0:00";
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${s.toString().padStart(2, "0")}`;
}

export default function RoomPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const { show } = useToast();
  const { connected, members, playback, queue, currentSong, error, controls, canControl, isHost } =
    useRoomSync(id);

  const [roomMeta, setRoomMeta] = useState<{ name: string; visibility: RoomVisibility; code?: string } | null>(null);
  const [addSongsOpen, setAddSongsOpen] = useState(false);
  const [tab, setTab] = useState<"queue" | "people">("queue");

  useEffect(() => {
    api.get<{ room: any }>(`/rooms/${id}`).then((res) =>
      setRoomMeta({ name: res.room.name, visibility: res.room.visibility, code: res.room.code })
    );
    // Ensure server-side membership exists before the socket tries to join
    // (public rooms: idempotent join; private rooms are joined via code
    // beforehand, so this simply confirms membership).
    api.post(`/rooms/${id}/join`).catch(() => {});
  }, [id]);

  useEffect(() => {
    if (error) show(error, "error");
  }, [error, show]);

  async function handleLeave() {
    await api.post(`/rooms/${id}/leave`);
    router.push("/rooms");
  }

  async function handleEnd() {
    if (!confirm("End this room for everyone?")) return;
    await api.post(`/rooms/${id}/end`);
    router.push("/rooms");
  }

  const isPlaying = playback?.state === "PLAYING";
  const position = playback ? Math.max(0, playback.position + (isPlaying ? (Date.now() - playback.serverTimestamp) / 1000 : 0)) : 0;

  return (
    <div className="flex min-h-full flex-col">
      <header className="flex flex-wrap items-center gap-3 border-b border-white/[0.08] px-4 py-4 sm:gap-4 sm:p-6 bg-[#080d16]/80 backdrop-blur-xl">
        <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl border border-room/40 bg-room/20 shadow-[0_0_20px_rgba(168,85,247,0.35)] sm:h-14 sm:w-14">
          <AudioLines size={23} className="text-room-bright drop-shadow-[0_0_6px_rgba(168,85,247,0.6)]" />
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <h1 className="truncate text-xl font-bold tracking-tight text-white">{roomMeta?.name ?? "Room"}</h1>
            {roomMeta?.visibility === "PRIVATE" ? (
              <Lock size={14} className="text-base-400" />
            ) : (
              <Globe size={14} className="text-base-400" />
            )}
          </div>
          <p className="mt-1 flex items-center gap-2 text-xs text-base-300">
            <span className={`h-2 w-2 rounded-full ${connected ? "bg-room-bright shadow-[0_0_8px_#c084fc] animate-pulseDot" : "bg-base-600"}`} />
            <span className={connected ? "text-room-bright font-semibold tracking-wider" : "text-base-400"}>{connected ? "LISTENING LIVE" : "CONNECTING"}</span>
            <span className="text-base-600">·</span>
            {members.length} listening {roomMeta?.code && isHost && <span className="ml-2 font-mono font-semibold text-accent-bright bg-accent/10 px-2.5 py-0.5 rounded-lg border border-accent/25 shadow-[0_0_10px_rgba(0,245,155,0.2)]">Code: {roomMeta.code}</span>}
          </p>
        </div>
        {isHost ? (
          <Button variant="danger" size="sm" onClick={handleEnd}>
            End room
          </Button>
        ) : (
          <Button variant="secondary" size="sm" onClick={handleLeave}>
            <LogOut size={14} /> Leave
          </Button>
        )}
      </header>

      <div className="flex min-h-0 flex-1 flex-col overflow-y-auto md:flex-row md:overflow-hidden">
        <div className="relative isolate flex min-h-[460px] flex-none flex-col items-center justify-center gap-5 overflow-hidden px-5 py-8 sm:gap-6 sm:p-8 md:min-h-0 md:flex-1">
          <div className="pointer-events-none absolute inset-0 -z-10 bg-[radial-gradient(ellipse_at_50%_35%,rgba(168,85,247,.16),rgba(56,189,248,.1)_35%,transparent_60%)]" />
          <div className="mb-1 flex items-center gap-2 text-[9px] font-bold uppercase tracking-[.22em] text-room-bright drop-shadow-[0_0_6px_rgba(168,85,247,0.5)]"><AudioLines size={13} /> Shared frequency</div>
          <div className="room-artwork-wrap">
            <Artwork key={currentSong?.id ?? "no-song"} src={currentSong?.artworkUrl} alt={currentSong ? `${currentSong.title} artwork` : "Wavelength room artwork"} loading="eager" className={`room-artwork artwork-crossfade h-[min(56vw,18rem)] w-[min(56vw,18rem)] rounded-2xl object-cover shadow-[0_20px_50px_rgba(0,0,0,0.5)] sm:h-64 sm:w-64 ${isPlaying ? "room-artwork-playing ring-2 ring-room/40 shadow-[0_0_30px_rgba(168,85,247,0.3)]" : ""}`} />
          </div>
          <div className="max-w-full text-center">
            <p className="max-w-[min(80vw,28rem)] truncate text-xl font-bold tracking-tight text-white sm:text-2xl">{currentSong?.title ?? "The room is ready"}</p>
            <p className="mt-1 text-sm text-base-300">{currentSong?.artistName ?? "Add a song to start listening together"}</p>
          </div>

          <div className={`room-wave mt-[-.5rem] flex h-5 items-center gap-[3px] ${isPlaying ? "room-wave-active" : ""}`} aria-hidden="true">{[7,12,17,10,15,19,9,13,18,8,14,11,17,7,12,16,9,14,19,10,15,8,13,17,9,12].map((height, index) => <span key={index} style={{ height, "--room-delay": `${index * -55}ms` } as React.CSSProperties} />)}</div>

          <div className="w-full max-w-md">
            <div className="mb-1.5 h-2 w-full overflow-hidden rounded-full bg-base-800">
              <div
                className="h-full bg-gradient-to-r from-room to-room-bright shadow-[0_0_12px_rgba(168,85,247,0.6)] transition-all"
                style={{ width: currentSong ? `${Math.min(100, (position / currentSong.duration) * 100)}%` : "0%" }}
              />
            </div>
            <div className="flex justify-between text-xs text-base-300 font-mono">
              <span>{formatTime(position)}</span>
              <span>{currentSong ? formatTime(currentSong.duration) : "0:00"}</span>
            </div>
          </div>

          <div className="flex items-center gap-6">
            <button
              onClick={() => (isPlaying ? controls.pause() : controls.play())}
              disabled={!canControl}
              aria-label={isPlaying ? "Pause room playback" : "Play room playback"}
              className="flex h-14 w-14 items-center justify-center rounded-full bg-room text-white font-bold shadow-[0_0_25px_rgba(168,85,247,0.5),0_4px_12px_rgba(168,85,247,0.3)] transition hover:scale-105 hover:bg-room-bright hover:shadow-[0_0_35px_rgba(168,85,247,0.7)] active:scale-95 disabled:opacity-40"
            >
              {isPlaying ? <Pause size={22} /> : <Play size={22} className="ml-0.5" />}
            </button>
            <button
              onClick={() => queue[0] && controls.changeSong(queue[0].songId)}
              disabled={!canControl || queue.length === 0}
              aria-label="Play next queued song"
              className="flex h-11 w-11 items-center justify-center rounded-full text-base-200 hover:bg-white/[0.08] hover:text-white disabled:opacity-30 transition-colors"
            >
              <SkipForward size={22} />
            </button>
          </div>

          {!canControl && (
            <p className="text-xs text-base-500">Only the host and elders can control playback in this room.</p>
          )}
          {!connected && <p className="text-xs text-base-500">Connecting…</p>}
        </div>

        <aside className="max-h-[45vh] w-full shrink-0 overflow-y-auto border-t border-white/[0.07] bg-black/[0.08] p-4 sm:p-5 md:max-h-none md:w-[21rem] md:border-l md:border-t-0">
          <div role="tablist" aria-label="Room activity" className="mb-4 flex rounded-xl border border-white/[0.05] bg-black/20 p-1 text-sm">
            <button
              onClick={() => setTab("queue")}
              role="tab"
              aria-selected={tab === "queue"}
              className={"min-h-10 flex-1 rounded-lg py-1.5 transition-colors " + (tab === "queue" ? "bg-white/[0.07] text-base-100" : "text-base-400 hover:text-base-200")}
            >
              Up next
            </button>
            <button
              onClick={() => setTab("people")}
              role="tab"
              aria-selected={tab === "people"}
              className={"min-h-10 flex-1 rounded-lg py-1.5 transition-colors " + (tab === "people" ? "bg-white/[0.07] text-base-100" : "text-base-400 hover:text-base-200")}
            >
              People ({members.length})
            </button>
          </div>

          {tab === "queue" ? (
            <>
              {canControl && (
                <Button size="sm" variant="secondary" className="mb-3 w-full" onClick={() => setAddSongsOpen(true)}>
                  <Plus size={14} /> Add songs or a playlist
                </Button>
              )}
              <RoomQueue
                queue={queue}
                canControl={canControl}
                onRemove={controls.removeFromQueue}
                onPlayNow={(songId) => controls.changeSong(songId)}
              />
            </>
          ) : (
            <ParticipantsPanel
              members={members}
              isHost={isHost}
              onPromote={controls.promote}
              onDemote={controls.demote}
              onRemove={controls.removeMember}
            />
          )}
        </aside>
      </div>

      <AddToQueueModal roomId={id} open={addSongsOpen} onClose={() => setAddSongsOpen(false)} onAddSongs={controls.addSongs} onAddPlaylist={controls.addPlaylist} />
    </div>
  );
}

function AddToQueueModal({
  roomId,
  open,
  onClose,
  onAddSongs,
  onAddPlaylist,
}: {
  roomId: string;
  open: boolean;
  onClose: () => void;
  onAddSongs: (songIds: string[]) => void;
  onAddPlaylist: (playlistId: string) => void;
}) {
  const [mode, setMode] = useState<"songs" | "playlists">("songs");
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<{ id: string; title: string; artistName: string }[]>([]);
  const [playlists, setPlaylists] = useState<Playlist[]>([]);

  useEffect(() => {
    if (open && mode === "playlists") {
      api.get<{ items: Playlist[] }>("/playlists").then((res) => setPlaylists(res.items));
    }
  }, [open, mode]);

  useEffect(() => {
    if (mode !== "songs" || !query.trim()) {
      setResults([]);
      return;
    }
    const t = setTimeout(() => {
      api.get<{ items: any[] }>(`/songs?q=${encodeURIComponent(query)}`).then((res) => setResults(res.items));
    }, 300);
    return () => clearTimeout(t);
  }, [query, mode]);

  return (
    <Modal open={open} onClose={onClose} title="Add to room queue">
      <div className="mb-4 flex rounded-lg bg-base-850 p-1 text-sm">
        <button onClick={() => setMode("songs")} className={"flex-1 rounded-md py-1.5 " + (mode === "songs" ? "bg-base-700 text-base-200" : "text-base-400")}>
          Songs
        </button>
        <button
          onClick={() => setMode("playlists")}
          className={"flex-1 rounded-md py-1.5 " + (mode === "playlists" ? "bg-base-700 text-base-200" : "text-base-400")}
        >
          Playlists
        </button>
      </div>

      {mode === "songs" ? (
        <div className="space-y-3">
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search songs to add…"
            className="w-full rounded-lg border border-base-700 bg-base-850 px-3 py-2 text-sm text-base-200 outline-none"
          />
          <div className="max-h-64 space-y-1 overflow-y-auto">
            {results.map((s) => (
              <button
                key={s.id}
                onClick={() => onAddSongs([s.id])}
                className="block w-full rounded-lg px-3 py-2 text-left text-sm text-base-200 hover:bg-base-800"
              >
                {s.title} <span className="text-base-400">— {s.artistName}</span>
              </button>
            ))}
          </div>
        </div>
      ) : (
        <div className="max-h-72 space-y-1 overflow-y-auto">
          {playlists.map((p) => (
            <button
              key={p.id}
              onClick={() => onAddPlaylist(p.id)}
              className="flex w-full items-center justify-between rounded-lg px-3 py-2 text-left text-sm text-base-200 hover:bg-base-800"
            >
              <span>{p.name}</span>
              <span className="flex items-center gap-1 text-xs text-base-400">
                <ListPlus size={14} /> {p.songs?.length ?? 0}
              </span>
            </button>
          ))}
        </div>
      )}
    </Modal>
  );
}
