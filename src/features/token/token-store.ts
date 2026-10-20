import { useSyncExternalStore } from "react";

import { storage } from "@/lib/storage";

const TOKEN_KEY = "cashmine.token";

// In-memory copy so the token keeps working for this visit even if storage is blocked.
let current: string | null | undefined;
const listeners = new Set<() => void>();

export function getToken(): string | null {
  if (current === undefined) current = storage.get(TOKEN_KEY);
  return current;
}

export function setToken(token: string): void {
  current = token;
  storage.set(TOKEN_KEY, token);
  listeners.forEach((listener) => listener());
}

export function clearToken(): void {
  current = null;
  storage.remove(TOKEN_KEY);
  listeners.forEach((listener) => listener());
}

export function subscribeToken(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

/**
 * The saved token: a string, null when there is none, or undefined while rendering on
 * the server (the browser storage isn't known yet).
 */
export function useToken(): string | null | undefined {
  return useSyncExternalStore(subscribeToken, getToken, () => undefined);
}

/**
 * Short FNV-1a fingerprint of a token, used only to namespace storage keys and query keys
 * per token. Not a security measure: the token itself sits in the same browser storage.
 */
export function tokenKey(token: string): string {
  let hash = 0x811c9dc5;
  for (let i = 0; i < token.length; i++) {
    hash ^= token.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193) >>> 0;
  }
  return hash.toString(16).padStart(8, "0");
}

/** "ct1.…abcd": enough to recognise a token without showing it. */
export function maskToken(token: string): string {
  return token.length <= 8 ? "••••" : `${token.slice(0, 4)}…${token.slice(-4)}`;
}
