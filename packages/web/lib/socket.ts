"use client";

import { io, Socket } from "socket.io-client";
import { getAccessToken } from "@/lib/api";
import { publicConfig } from "@/lib/publicConfig";

const SOCKET_URL = publicConfig.socketUrl;

let socket: Socket | null = null;

// A single shared socket connection for the whole app (not per-room), so
// switching rooms doesn't pay a new handshake, and so global notifications
// could later ride the same connection.
export function getSocket(): Socket {
  if (socket) return socket;
  socket = io(SOCKET_URL, {
    autoConnect: false,
    withCredentials: true,
    auth: (cb) => cb({ token: getAccessToken() }),
  });
  return socket;
}

export function connectSocket() {
  const s = getSocket();
  if (!s.connected) s.connect();
  return s;
}

export function disconnectSocket() {
  socket?.disconnect();
}
