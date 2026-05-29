/**
 * Bun-specific augmentations for Web-standard types.
 *
 * Bun extends ReadableStream with convenience consumers that are not part of
 * the WHATWG Streams spec and therefore not typed in lib.dom.d.ts or bun-types.
 * Ref: https://bun.sh/docs/api/streams (Bun extension, non-standard).
 */

interface ReadableStream<R = unknown> {
  /** Bun extension: collect the entire stream into a Uint8Array. */
  bytes(): Promise<Uint8Array<ArrayBuffer>>;
  /** Bun extension: collect the entire stream as a UTF-8 string. */
  text(): Promise<string>;
  /** Bun extension: collect the entire stream, then parse as JSON. */
  json<T = unknown>(): Promise<T>;
}
