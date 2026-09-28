"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Modal } from "@/components/ui/Modal";
import { Input } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";
import { api, ApiError } from "@/lib/api";

export function JoinPrivateRoomModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [code, setCode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  async function handleJoin(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const { membership } = await api.post<{ membership: { roomId: string } }>("/rooms/join", {
        code: code.toUpperCase(),
      });
      onClose();
      router.push(`/rooms/${membership.roomId}`);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Couldn't join room");
    } finally {
      setLoading(false);
    }
  }

  return (
    <Modal open={open} onClose={onClose} title="Join a private room">
      <form onSubmit={handleJoin} className="space-y-4">
        {error && <p className="rounded-xl border border-rose-500/30 bg-rose-500/[0.1] px-3 py-2.5 text-sm text-rose-300">{error}</p>}
        <div>
          <label className="mb-1 block text-xs font-medium text-base-300">6-character room code</label>
          <Input
            value={code}
            onChange={(e) => setCode(e.target.value.toUpperCase())}
            maxLength={6}
            required
            className="tracking-[0.3em] text-center font-mono uppercase"
            placeholder="AB7K9X"
          />
        </div>
        <Button type="submit" disabled={loading} className="w-full">
          {loading ? "Joining…" : "Join room"}
        </Button>
      </form>
    </Modal>
  );
}
