"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Modal } from "@/components/ui/Modal";
import { Input } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";
import { api, ApiError } from "@/lib/api";
import { RoomVisibility } from "@/lib/types";
import { useToast } from "@/components/ui/Toast";

export function CreateRoomModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [visibility, setVisibility] = useState<RoomVisibility>("PUBLIC");
  const [loading, setLoading] = useState(false);
  const router = useRouter();
  const { show } = useToast();

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    try {
      const { room } = await api.post<{ room: { id: string; code: string | null } }>("/rooms", {
        name,
        description: description || undefined,
        visibility,
      });
      if (room.code) show(`Room created — share code ${room.code}`, "success");
      onClose();
      router.push(`/rooms/${room.id}`);
    } catch (err) { show(err instanceof ApiError ? err.message : "Couldn't create room", "error"); } finally {
      setLoading(false);
    }
  }

  return (
    <Modal open={open} onClose={onClose} title="Create a room">
      <form onSubmit={handleCreate} className="space-y-4">
        <div>
          <label className="mb-1 block text-xs font-medium text-base-300">Room name</label>
          <Input value={name} onChange={(e) => setName(e.target.value)} required autoFocus />
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium text-base-300">Description (optional)</label>
          <Input value={description} onChange={(e) => setDescription(e.target.value)} />
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium text-base-300">Visibility</label>
          <div className="flex gap-2">
            {(["PUBLIC", "PRIVATE"] as const).map((v) => (
              <button
                type="button"
                key={v}
                onClick={() => setVisibility(v)}
                className={
                  "flex-1 rounded-lg border px-3 py-2 text-sm " +
                  (visibility === v ? "border-room/50 bg-room/10 text-room-bright shadow-[0_0_12px_rgba(168,85,247,0.2)]" : "border-white/[0.1] text-base-300 transition-colors hover:border-white/20 hover:text-base-200")
                }
              >
                {v === "PUBLIC" ? "Public — discoverable" : "Private — code only"}
              </button>
            ))}
          </div>
        </div>
        <Button type="submit" disabled={loading} className="w-full">
          {loading ? "Creating…" : "Create room"}
        </Button>
      </form>
    </Modal>
  );
}
