import { webcrypto } from "node:crypto";

if (typeof globalThis.crypto === "undefined") {
  // Node 18 has webcrypto, but may not expose it as globalThis.crypto in Jest jsdom env
  (globalThis as unknown as { crypto: Crypto }).crypto = webcrypto as unknown as Crypto;
}
