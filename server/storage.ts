// Simple file-system storage for free deployment
// Files are stored in memory/temp directory for stateless deployment

import { randomUUID } from "crypto";
import path from "path";
import fs from "fs";

// In-memory storage for stateless deployment
const memoryStorage = new Map<string, { data: Buffer; contentType: string }>();

function normalizeKey(relKey: string): string {
  return relKey.replace(/^\/+/, "");
}

function appendHashSuffix(relKey: string): string {
  const hash = randomUUID().replace(/-/g, "").slice(0, 8);
  const lastDot = relKey.lastIndexOf(".");
  if (lastDot === -1) return `${relKey}_${hash}`;
  return `${relKey.slice(0, lastDot)}_${hash}${relKey.slice(lastDot)}`;
}

export async function storagePut(
  relKey: string,
  data: Buffer | Uint8Array | string,
  contentType = "application/octet-stream",
): Promise<{ key: string; url: string }> {
  const key = appendHashSuffix(normalizeKey(relKey));
  const buffer = typeof data === "string" ? Buffer.from(data) : Buffer.from(data);
  
  // Store in memory
  memoryStorage.set(key, { data: buffer, contentType });
  
  return { key, url: `/api/storage/${key}` };
}

export async function storageGet(relKey: string): Promise<{ key: string; url: string }> {
  const key = normalizeKey(relKey);
  return { key, url: `/api/storage/${key}` };
}

export async function storageGetSignedUrl(relKey: string): Promise<string> {
  const key = normalizeKey(relKey);
  return `/api/storage/${key}`;
}

// Helper to retrieve stored file
export function getStoredFile(key: string): { data: Buffer; contentType: string } | null {
  return memoryStorage.get(key) || null;
}

// Helper to list all stored files
export function listStoredFiles(): string[] {
  return Array.from(memoryStorage.keys());
}

// Helper to clear storage
export function clearStorage(): void {
  memoryStorage.clear();
}
