"use client";

import { publicConfig } from "@/lib/publicConfig";

const API_URL = publicConfig.apiUrl;

let accessToken: string | null = null;

export function setAccessToken(token: string | null) {
  accessToken = token;
}

export function getAccessToken() {
  // Keep short-lived bearer tokens in memory only. The HttpOnly refresh cookie
  // restores a session after reload without leaving access tokens in storage.
  return accessToken;
}

export class ApiError extends Error {
  status: number;
  code?: string;
  constructor(message: string, status: number, code?: string) {
    super(message);
    this.status = status;
    this.code = code;
  }
}

interface RequestOpts extends RequestInit {
  skipRefreshRetry?: boolean;
}

async function request<T>(path: string, opts: RequestOpts = {}): Promise<T> {
  const token = getAccessToken();
  const headers = new Headers(opts.headers);
  if (token) headers.set("Authorization", `Bearer ${token}`);
  if (!(opts.body instanceof FormData) && opts.body) {
    headers.set("Content-Type", "application/json");
  }

  const res = await fetch(`${API_URL}${path}`, {
    ...opts,
    headers,
    credentials: "include",
  });

  if (res.status === 401 && !opts.skipRefreshRetry) {
    const refreshed = await tryRefresh();
    if (refreshed) return request<T>(path, { ...opts, skipRefreshRetry: true });
  }

  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new ApiError(body?.error?.message ?? res.statusText, res.status, body?.error?.code);
  }

  if (res.status === 204) return undefined as T;
  return res.json();
}

async function tryRefresh(): Promise<boolean> {
  try {
    const res = await fetch(`${API_URL}/auth/refresh`, { method: "POST", credentials: "include" });
    if (!res.ok) return false;
    const data = await res.json();
    setAccessToken(data.accessToken);
    return true;
  } catch {
    return false;
  }
}

export const api = {
  get: <T,>(path: string) => request<T>(path),
  post: <T,>(path: string, body?: unknown) =>
    request<T>(path, { method: "POST", body: body instanceof FormData ? body : body !== undefined ? JSON.stringify(body) : undefined }),
  patch: <T,>(path: string, body?: unknown) =>
    request<T>(path, { method: "PATCH", body: JSON.stringify(body) }),
  put: <T,>(path: string, body?: unknown) => request<T>(path, { method: "PUT", body: JSON.stringify(body) }),
  delete: <T,>(path: string) => request<T>(path, { method: "DELETE" }),
};

export { API_URL };
