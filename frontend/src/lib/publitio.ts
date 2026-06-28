import { createHash } from "crypto";
import type { PublitioFile } from "./types";

const PUBLITIO_KEY = process.env.PUBLITIO_API_KEY ?? "";
const PUBLITIO_SECRET = process.env.PUBLITIO_API_SECRET ?? "";
const PUBLITIO_FOLDER_ID = process.env.PUBLITIO_FOLDER_ID ?? "";

const API_BASE = "https://api.publit.io/v1";
const CDN_BASE = "https://media.publit.io/file";

function getAuthParams(): Record<string, string> {
  const timestamp = Math.floor(Date.now() / 1000).toString();
  const nonce = Math.random().toString(36).substring(2, 10);
  const signature = createHash("sha1")
    .update(timestamp + nonce + PUBLITIO_SECRET)
    .digest("hex");
  return {
    api_key: PUBLITIO_KEY,
    api_timestamp: timestamp,
    api_nonce: nonce,
    api_signature: signature,
  };
}

function authQuery(): string {
  return new URLSearchParams(getAuthParams()).toString();
}

export async function uploadFile(
  file: Uint8Array,
  filename: string,
  mimeType = "application/octet-stream"
): Promise<PublitioFile> {
  const form = new FormData();
  form.append("file", new Blob([file as BlobPart], { type: mimeType }), filename);
  if (PUBLITIO_FOLDER_ID) form.append("folder", PUBLITIO_FOLDER_ID);
  form.append("privacy", "1"); // public

  const res = await fetch(`${API_BASE}/files/create?${authQuery()}`, {
    method: "POST",
    body: form,
    signal: AbortSignal.timeout(30000),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Publit.io upload failed (${res.status}): ${text}`);
  }
  return res.json() as Promise<PublitioFile>;
}

export async function deleteFile(fileId: string): Promise<void> {
  const res = await fetch(
    `${API_BASE}/files/delete/${fileId}?${authQuery()}`,
    { method: "DELETE" }
  );
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Publit.io delete failed (${res.status}): ${text}`);
  }
}

export async function showFile(fileId: string): Promise<PublitioFile> {
  const res = await fetch(
    `${API_BASE}/files/show/${fileId}?${authQuery()}`
  );
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Publit.io show failed (${res.status}): ${text}`);
  }
  return res.json() as Promise<PublitioFile>;
}

export function cdnUrl(fileId: string, ext: string): string {
  return `${CDN_BASE}/${fileId}.${ext}`;
}

export function cdnUrlTransformed(
  fileId: string,
  ext: string,
  options: string
): string {
  return `${CDN_BASE}/${options}/${fileId}.${ext}`;
}
