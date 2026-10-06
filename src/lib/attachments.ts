/**
 * Dosya ekleri (makbuz, belge, logo) IndexedDB'de tutulur; kayıtlarda yalnızca
 * `AttachmentRef` saklanır. localStorage'ın ~5 MB sınırına takılmamak için.
 */
import type { AttachmentRef } from "@/lib/erp-types";

const DB_NAME = "lex-attachments";
const STORE = "files";
export const MAX_ATTACHMENT_BYTES = 15 * 1024 * 1024;

let dbPromise: Promise<IDBDatabase> | null = null;

function openDb(): Promise<IDBDatabase> {
  if (dbPromise) return dbPromise;
  dbPromise = new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, 1);
    req.onupgradeneeded = () => req.result.createObjectStore(STORE);
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => {
      dbPromise = null;
      reject(req.error);
    };
  });
  return dbPromise;
}

function tx<T>(mode: IDBTransactionMode, run: (store: IDBObjectStore) => IDBRequest<T>) {
  return openDb().then(
    (db) =>
      new Promise<T>((resolve, reject) => {
        const req = run(db.transaction(STORE, mode).objectStore(STORE));
        req.onsuccess = () => resolve(req.result);
        req.onerror = () => reject(req.error);
      }),
  );
}

function newId() {
  return `att-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

export async function saveAttachment(file: Blob & { name?: string }): Promise<AttachmentRef> {
  if (file.size > MAX_ATTACHMENT_BYTES) {
    throw new Error("Dosya 15 MB'tan büyük olamaz");
  }
  const ref: AttachmentRef = {
    id: newId(),
    name: file.name ?? "dosya",
    mime: file.type || "application/octet-stream",
    size: file.size,
  };
  await tx("readwrite", (s) => s.put(file, ref.id));
  return ref;
}

export async function putAttachmentBlob(id: string, blob: Blob) {
  await tx("readwrite", (s) => s.put(blob, id));
}

export function getAttachment(id: string): Promise<Blob | undefined> {
  return tx("readonly", (s) => s.get(id) as IDBRequest<Blob | undefined>);
}

export async function deleteAttachment(id: string) {
  await tx("readwrite", (s) => s.delete(id));
}

export async function listAttachmentIds(): Promise<string[]> {
  const keys = await tx("readonly", (s) => s.getAllKeys());
  return keys.map(String);
}

export async function openAttachment(ref: AttachmentRef) {
  const blob = await getAttachment(ref.id);
  if (!blob) throw new Error("Dosya bu cihazda bulunamadı");
  const url = URL.createObjectURL(blob);
  window.open(url, "_blank", "noopener");
  setTimeout(() => URL.revokeObjectURL(url), 60_000);
}

export async function downloadAttachment(ref: AttachmentRef) {
  const blob = await getAttachment(ref.id);
  if (!blob) throw new Error("Dosya bu cihazda bulunamadı");
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = ref.name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 10_000);
}
