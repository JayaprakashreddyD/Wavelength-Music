"use client";

import { useEffect, useState } from "react";
import { Plus, KeyRound } from "lucide-react";
import { api } from "@/lib/api";
import { RoomSummary } from "@/lib/types";
import { RoomCard } from "@/components/rooms/RoomCard";
import { Button } from "@/components/ui/Button";
import { CreateRoomModal } from "@/components/rooms/CreateRoomModal";
import { JoinPrivateRoomModal } from "@/components/rooms/JoinPrivateRoomModal";
import { Skeleton } from "@/components/ui/Skeleton";

export default function RoomsPage() { const [rooms, setRooms] = useState<RoomSummary[]>([]); const [myRooms, setMyRooms] = useState<RoomSummary[]>([]); const [loading, setLoading] = useState(true); const [createOpen, setCreateOpen] = useState(false); const [joinOpen, setJoinOpen] = useState(false); useEffect(() => { Promise.allSettled([ api.get<{ items: RoomSummary[] }>("/rooms"), api.get<{ items: RoomSummary[] }>("/rooms/mine"), ]).then(([pub, mine]) => { if (pub.status === "fulfilled") setRooms(pub.value.items); if (mine.status === "fulfilled") setMyRooms(mine.value.items); setLoading(false); }); }, []);

  return (
    <div className="px-5 py-7 md:px-9 md:py-9">
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <div><p className="mb-2 text-[10px] font-bold uppercase tracking-[.2em] text-room-bright drop-shadow-[0_0_6px_rgba(168,85,247,0.5)]">Listen in sync</p><h1 className="text-3xl font-extrabold tracking-tight text-white">Listening rooms</h1><p className="mt-2 text-sm text-base-300">Join a live room or invite friends into a new one.</p></div>
        <div className="flex gap-2">
          <Button variant="secondary" size="sm" onClick={() => setJoinOpen(true)}>
            <KeyRound size={16} /> Join with code
          </Button>
          <Button size="sm" onClick={() => setCreateOpen(true)} className="bg-room text-white font-semibold shadow-[0_0_18px_rgba(168,85,247,0.35)] hover:bg-room-bright hover:shadow-[0_0_25px_rgba(168,85,247,0.55)]">
            <Plus size={16} /> Create room
          </Button>
        </div>
      </div>

      {loading ? (
        <div className="space-y-3">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-24 w-full" />
          ))}
        </div>
      ) : ( <> {myRooms.length > 0 && ( <div className="mb-8"> <h2 className="mb-3 text-lg font-bold text-white">Your rooms</h2> <div className="grid gap-3 md:grid-cols-2"> {myRooms.map((room) => ( <RoomCard key={room.id} room={room} /> ))} </div> </div> )} <h2 className="mb-3 text-lg font-bold text-white">Public rooms</h2> {rooms.length === 0 ? ( <p className="text-base-300">No public rooms are live right now — start one.</p> ) : ( <div className="grid gap-3 md:grid-cols-2"> {rooms.map((room) => ( <RoomCard key={room.id} room={room} /> ))} </div> )} </> )}

      <CreateRoomModal open={createOpen} onClose={() => setCreateOpen(false)} />
      <JoinPrivateRoomModal open={joinOpen} onClose={() => setJoinOpen(false)} />
    </div>
  );
}
