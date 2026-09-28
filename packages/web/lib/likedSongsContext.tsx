"use client";

import { createContext, useContext, useEffect, useState, useCallback } from "react";
import { api } from "@/lib/api";
import { useAuth } from "@/lib/authContext";
import { useToast } from "@/components/ui/Toast";

interface LikedSongsContextValue {
  likedIds: Set<string>;
  isLiked: (songId: string) => boolean;
  toggleLike: (songId: string, songTitle?: string) => Promise<boolean>;
  refreshLiked: () => Promise<void>;
}

const LikedSongsContext = createContext<LikedSongsContextValue | null>(null);

export function LikedSongsProvider({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  const { show } = useToast();
  const [likedIds, setLikedIds] = useState<Set<string>>(new Set());

  const refreshLiked = useCallback(async () => {
    if (!user) {
      setLikedIds(new Set());
      return;
    }
    try {
      const res = await api.get<{ ids: string[] }>("/users/me/liked-song-ids");
      setLikedIds(new Set(res.ids));
    } catch {
      // Ignore if unauthenticated or error
    }
  }, [user]);

  useEffect(() => {
    refreshLiked();
  }, [refreshLiked]);

  const isLiked = useCallback(
    (songId: string) => likedIds.has(songId),
    [likedIds]
  );

  const toggleLike = useCallback(
    async (songId: string, songTitle?: string) => {
      const currentlyLiked = likedIds.has(songId);
      const nextLiked = !currentlyLiked;

      // Optimistic update
      setLikedIds((prev) => {
        const next = new Set(prev);
        if (nextLiked) next.add(songId);
        else next.delete(songId);
        return next;
      });

      try {
        if (currentlyLiked) {
          await api.delete(`/songs/${songId}/like`);
          show(
            songTitle
              ? `Removed "${songTitle}" from Liked Songs`
              : "Removed from Liked Songs",
            "info"
          );
        } else {
          await api.post(`/songs/${songId}/like`);
          show(
            songTitle
              ? `Added "${songTitle}" to Liked Songs`
              : "Added to Liked Songs",
            "success"
          );
        }
        return nextLiked;
      } catch {
        // Rollback
        setLikedIds((prev) => {
          const rollback = new Set(prev);
          if (currentlyLiked) rollback.add(songId);
          else rollback.delete(songId);
          return rollback;
        });
        show("Failed to update liked songs", "error");
        return currentlyLiked;
      }
    },
    [likedIds, show]
  );

  return (
    <LikedSongsContext.Provider
      value={{
        likedIds,
        isLiked,
        toggleLike,
        refreshLiked,
      }}
    >
      {children}
    </LikedSongsContext.Provider>
  );
}

export function useLikedSongs() {
  const ctx = useContext(LikedSongsContext);
  if (!ctx) {
    throw new Error("useLikedSongs must be used within a LikedSongsProvider");
  }
  return ctx;
}
