"use client";

import { useRouter } from "next/navigation";
import { Users, Radio } from "lucide-react";
import { RoomSummary } from "@/lib/types";
import { api } from "@/lib/api";
import { Button } from "@/components/ui/Button";
import { useToast } from "@/components/ui/Toast";
import { Artwork } from "@/components/music/Artwork";

export function RoomCard({ room }: { room: RoomSummary }) {
  const router = useRouter();
  const { show } = useToast();

  async function handleJoin() {
    try {
      await api.post(`/rooms/${room.id}/join`);
      router.push(`/rooms/${room.id}`);
    } catch {
      show("Couldn't join room", "error");
    }
  }

  return (
    <div className="group flex min-w-0 items-center gap-3 rounded-2xl border border-white/[0.08] bg-white/[0.025] p-3 transition-all duration-200 hover:-translate-y-1 hover:border-room/40 hover:bg-white/[0.05] hover:shadow-[0_16px_40px_rgba(0,0,0,0.35),0_0_30px_rgba(168,85,247,0.18)] sm:gap-4 sm:p-4">
      <div className="artwork-frame relative h-[4.25rem] w-[4.25rem] shrink-0 rounded-xl sm:h-[4.5rem] sm:w-[4.5rem]">
        <Artwork src={room.artworkUrl ?? room.currentSong?.artworkUrl} alt="" className="h-full w-full rounded-xl object-cover transition-transform duration-300 group-hover:scale-[1.03]" />
        {room.playbackState === "PLAYING" && (
          <span className="absolute bottom-1.5 left-1.5 z-10 flex items-center gap-1.5 rounded-full border border-room/50 bg-[#090b14]/95 px-2 py-0.5 text-[8px] font-bold tracking-wider text-room-bright shadow-[0_0_12px_rgba(168,85,247,0.45)]">
            <span className="h-1.5 w-1.5 rounded-full bg-room-bright animate-pulseDot shadow-[0_0_6px_#c084fc]" /> LIVE
          </span>
        )}
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex min-w-0 items-center gap-2"><p className="truncate text-sm font-semibold text-white group-hover:text-room-bright transition-colors">{room.name}</p>{room.visibility === "PRIVATE" && <span className="shrink-0 rounded-full border border-white/15 bg-white/[0.05] px-2 py-0.5 text-[9px] font-semibold text-base-300">Private{room.code ? ` · ${room.code}` : ""}</span>}</div>
        <p className="mt-1 truncate text-xs text-base-400">Hosted by <span className="text-base-200">{room.host.username}</span></p>
        <p className="mt-1 truncate text-xs text-base-300">{room.currentSong ? <><span className="text-room">Listening</span> ? {room.currentSong.title} ? {room.currentSong.artist}</> : <><span className="text-room">Room open</span> ? Tune in with the group</>}</p>
        <p className="mt-2 flex items-center gap-1.5 text-[11px] text-base-400"><Users size={12} /> {room.memberCount} listening</p>
      </div>
      <Button size="sm" onClick={handleJoin} className="min-h-10 shrink-0 px-3 sm:px-4 bg-room text-white font-semibold shadow-[0_0_18px_rgba(168,85,247,0.35)] hover:bg-room-bright hover:shadow-[0_0_24px_rgba(168,85,247,0.55)]"><Radio size={14} /> Join</Button>
    </div>
  );
}
