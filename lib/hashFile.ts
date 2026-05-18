import { createSHA256 } from 'hash-wasm';

// Streaming SHA-256 over a File. We deliberately avoid crypto.subtle.digest
// because its one-shot API would force us to buffer the entire file in
// memory, fatal for the multi-GB LAS uploads this is built for. hash-wasm
// initialises a WASM hasher we can feed chunks into incrementally.
const HASH_CHUNK = 8 * 1024 * 1024; // 8 MB, large enough to keep the WASM busy, small enough to stay friendly on phones.

export async function sha256OfFile(
  file: File,
  onProgress?: (fractionDone: number) => void,
): Promise<string> {
  const hasher = await createSHA256();
  hasher.init();

  let offset = 0;
  const total = file.size;
  while (offset < total) {
    const end = Math.min(offset + HASH_CHUNK, total);
    const slice = file.slice(offset, end);
    // arrayBuffer() reads only this slice into memory, not the whole file.
    const buf = await slice.arrayBuffer();
    hasher.update(new Uint8Array(buf));
    offset = end;
    onProgress?.(total === 0 ? 1 : offset / total);
  }

  return hasher.digest('hex');
}
