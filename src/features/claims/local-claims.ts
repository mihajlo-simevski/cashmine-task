import { useSyncExternalStore } from "react";

import type { ClaimStatus } from "@/features/api/schemas";
import { tokenKey } from "@/features/token/token-store";
import { storage } from "@/lib/storage";

// Claims this browser created, kept until a balance snapshot includes them. Stored per
// token so switching tokens never mixes accounts.

export type LocalClaim = {
  id: string;
  asset: string;
  amount: string;
  createdAt: string;
  status: ClaimStatus;
};

const keyFor = (token: string) => `cashmine.claims.${tokenKey(token)}`;
const listeners = new Set<() => void>();
const cache = new Map<string, { raw: string | null; claims: LocalClaim[] }>();

function read(token: string): LocalClaim[] {
  const key = keyFor(token);
  const raw = storage.get(key);
  const cached = cache.get(key);
  if (cached && cached.raw === raw) return cached.claims;
  let claims: LocalClaim[] = [];
  try {
    const parsed: unknown = raw ? JSON.parse(raw) : [];
    if (Array.isArray(parsed)) claims = parsed as LocalClaim[];
  } catch {
    claims = [];
  }
  cache.set(key, { raw, claims });
  return claims;
}

function write(token: string, claims: LocalClaim[]): void {
  storage.set(keyFor(token), JSON.stringify(claims));
  listeners.forEach((listener) => listener());
}

export function getLocalClaims(token: string): LocalClaim[] {
  return read(token);
}

/** Adds or updates a claim. A replayed claim keeps the createdAt the server first gave it. */
export function upsertLocalClaim(token: string, claim: LocalClaim): void {
  const claims = read(token);
  const existing = claims.find((c) => c.id === claim.id);
  if (existing && existing.status === claim.status) return;
  const next = existing
    ? claims.map((c) => (c.id === claim.id ? { ...c, status: claim.status } : c))
    : [...claims, claim];
  write(token, next);
}

/** Drops claims that a snapshot taken at `asOf` already includes. */
export function pruneLocalClaims(token: string, asOf: string): void {
  const asOfMs = Date.parse(asOf);
  const claims = read(token);
  const next = claims.filter((c) => Date.parse(c.createdAt) > asOfMs);
  if (next.length !== claims.length) write(token, next);
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

const EMPTY: LocalClaim[] = [];

export function useLocalClaims(token: string): LocalClaim[] {
  return useSyncExternalStore(
    subscribe,
    () => read(token),
    () => EMPTY,
  );
}
