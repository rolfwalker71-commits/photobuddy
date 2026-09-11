import { createHash } from "node:crypto";

const PREFIX_BYTES = 64 * 1024;

/** SHA-256 of the first 64 KB plus dimensions and byte length. */
export function mediaContentHash(
  data: Buffer,
  width: number | null,
  height: number | null,
) {
  const hash = createHash("sha256");
  hash.update(data.subarray(0, Math.min(data.length, PREFIX_BYTES)));
  hash.update(`:${width ?? 0}x${height ?? 0}:${data.length}`);
  return hash.digest("hex");
}
