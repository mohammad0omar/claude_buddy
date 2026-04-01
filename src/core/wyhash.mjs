/**
 * Pure JavaScript wyhash implementation (BigInt-based).
 * Produces bit-exact identical output to Bun.hash().
 *
 * Faithfully implements Zig's std.hash.Wyhash (Zig 0.13.x) as found in:
 * https://github.com/ziglang/zig/blob/0.13.0/lib/std/hash/wyhash.zig
 *
 * Key implementation detail: Zig's mum(a,b) REPLACES a with lo64(a*b)
 * and b with hi64(a*b). It does NOT XOR with originals.
 */

const M = 0xFFFFFFFFFFFFFFFFn;

const S0 = 0xa0761d6478bd642fn;
const S1 = 0xe7037ed1a0b428dbn;
const S2 = 0x8ebc6af09c88c6e3n;
const S3 = 0x589965cc75374cc3n;

/**
 * mum: 128-bit multiply, return [lo64, hi64].
 * Matches Zig's mum which REPLACES a,b (not XOR).
 */
function mum(a, b) {
  const full = (a & M) * (b & M);
  return [full & M, (full >> 64n) & M];
}

/**
 * mix: lo64(a*b) XOR hi64(a*b).
 */
function mix(a, b) {
  const [lo, hi] = mum(a, b);
  return (lo ^ hi) & M;
}

/** Read little-endian u32 from buffer at offset. */
function r32(buf, off) {
  return BigInt(buf[off]) |
    (BigInt(buf[off + 1]) << 8n) |
    (BigInt(buf[off + 2]) << 16n) |
    (BigInt(buf[off + 3]) << 24n);
}

/** Read little-endian u64 from buffer at offset. */
function r64(buf, off) {
  return (r32(buf, off) | (r32(buf, off + 4) << 32n)) & M;
}

/**
 * Hash a Uint8Array using wyhash (Zig std lib variant, matches Bun.hash).
 * Implements Wyhash.hash() — the standalone function.
 *
 * @param {Uint8Array} buf - bytes to hash
 * @param {bigint} [seed=0n] - seed value
 * @returns {bigint} - 64-bit unsigned hash
 */
function wyhashBytes(buf, seed = 0n) {
  const len = buf.length;

  // init(seed): state[0] = state[1] = state[2] = seed ^ mix(seed ^ S0, S1)
  const s0init = (seed ^ mix((seed ^ S0) & M, S1)) & M;
  let state0 = s0init;
  let state1 = s0init;
  let state2 = s0init;

  let a, b;

  if (len <= 16) {
    // smallKey path
    if (len >= 4) {
      const quarter = (len >>> 3) << 2;
      const end = len - 4;
      a = ((r32(buf, 0) << 32n) | r32(buf, quarter)) & M;
      b = ((r32(buf, end) << 32n) | r32(buf, end - quarter)) & M;
    } else if (len > 0) {
      a = (BigInt(buf[0]) << 16n) | (BigInt(buf[len >> 1]) << 8n) | BigInt(buf[len - 1]);
      b = 0n;
    } else {
      a = 0n;
      b = 0n;
    }
  } else {
    // > 16 bytes
    let i = 0;

    if (len >= 48) {
      // Process 48-byte rounds while i + 48 < len
      while (i + 48 < len) {
        // round: 3 lanes, each processes 16 bytes
        const a0 = r64(buf, i);
        const b0 = r64(buf, i + 8);
        state0 = mix((a0 ^ S1) & M, (b0 ^ state0) & M);

        const a1 = r64(buf, i + 16);
        const b1 = r64(buf, i + 24);
        state1 = mix((a1 ^ S2) & M, (b1 ^ state1) & M);

        const a2 = r64(buf, i + 32);
        const b2 = r64(buf, i + 40);
        state2 = mix((a2 ^ S3) & M, (b2 ^ state2) & M);

        i += 48;
      }
      // final0: combine lanes
      state0 = (state0 ^ state1 ^ state2) & M;
    }

    // final1: process remaining in 16-byte chunks, then read last 16 bytes
    // input_lb = buf (full input), start_pos = i
    // "input" inside final1 = buf[i..]
    const remaining = len - i;
    let j = 0;
    while (j + 16 < remaining) {
      state0 = mix((r64(buf, i + j) ^ S1) & M, (r64(buf, i + j + 8) ^ state0) & M);
      j += 16;
    }

    // Read last 16 bytes of the full input (input_lb)
    a = r64(buf, len - 16);
    b = r64(buf, len - 8);
  }

  // final2:
  // a ^= S1; b ^= state[0]; mum(&a, &b);
  // return mix(a ^ S0 ^ total_len, b ^ S1)
  a = (a ^ S1) & M;
  b = (b ^ state0) & M;
  const [lo, hi] = mum(a, b);
  a = lo;
  b = hi;

  return mix((a ^ S0 ^ BigInt(len)) & M, (b ^ S1) & M);
}

/**
 * Hash a string using wyhash (Bun-compatible).
 * String is UTF-8 encoded before hashing.
 * @param {string} str - string to hash
 * @param {bigint|number} [seed=0n] - seed value
 * @returns {bigint} - 64-bit hash as unsigned BigInt
 */
export function wyhash(str, seed = 0n) {
  if (typeof seed === 'number') seed = BigInt(seed);
  const buf = new TextEncoder().encode(str);
  return wyhashBytes(buf, seed);
}

export default wyhash;
