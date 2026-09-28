"use client";

import { GripVertical, X } from "lucide-react";
import { QueueEntry } from "@/lib/types";
import { Artwork } from "@/components/music/Artwork";

export function RoomQueue({
  queue,
  canControl,
  onRemove,
  onPlayNow,
}: {
  queue: QueueEntry[];
  canControl: boolean;
  onRemove: (songId: string) => void;
  onPlayNow: (songId: string) => void;
}) {
  if (queue.length === 0) {
    return <div className="rounded-xl border border-dashed border-white/[0.08] px-3 py-7 text-center"><p className="text-sm font-medium text-base-300">Nothing queued yet</p><p className="mt-1 text-xs text-base-400">Add a song and shape the room?s next moment.</p></div>;
  }

  return (
    <div className="space-y-1">
      {queue.map((entry) => (
        <div key={entry.id} className="group flex min-h-14 items-center gap-3 rounded-xl border border-transparent px-2 py-2 transition-colors hover:border-accent/[0.1] hover:bg-accent/[0.03]">
          {canControl && <GripVertical size={14} className="shrink-0 cursor-grab text-base-500" />}
          <button onClick={() => canControl && onPlayNow(entry.songId)} className="flex min-w-0 flex-1 items-center gap-3 text-left">
            <Artwork src={entry.song.artworkUrl} alt="" className="h-10 w-10 rounded-lg object-cover" />
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold text-white">{entry.song.title}</p>
              <p className="truncate text-xs text-base-300">{entry.song.artistName}</p>
            </div>
          </button>
          {canControl && (
            <button onClick={() => onRemove(entry.songId)} className="opacity-0 text-base-500 transition-colors hover:text-rose-400 group-hover:opacity-100">
              <X size={16} />
            </button>
          )}
        </div>
      ))}
    </div>
  );
}
