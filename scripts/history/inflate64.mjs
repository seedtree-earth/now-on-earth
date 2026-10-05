// A small inflater for Deflate64 ("enhanced deflate", zip method 9), which
// Node's zlib cannot read. Deflate64 is deflate with three changes: a 64 KB
// window, length code 285 taking 16 extra bits (base 3), and distance codes
// 30 and 31 (bases 32769 and 49153, 14 extra bits). It also reads plain
// deflate (method 8) when `deflate64` is false.

const LEN_BASE = [3, 4, 5, 6, 7, 8, 9, 10, 11, 13, 15, 17, 19, 23, 27, 31, 35, 43, 51, 59, 67, 83, 99, 115, 131, 163, 195, 227, 258];
const LEN_EXTRA = [0, 0, 0, 0, 0, 0, 0, 0, 1, 1, 1, 1, 2, 2, 2, 2, 3, 3, 3, 3, 4, 4, 4, 4, 5, 5, 5, 5, 0];
const DIST_BASE = [1, 2, 3, 4, 5, 7, 9, 13, 17, 25, 33, 49, 65, 97, 129, 193, 257, 385, 513, 769, 1025, 1537, 2049, 3073, 4097, 6145, 8193, 12289, 16385, 24577, 32769, 49153];
const DIST_EXTRA = [0, 0, 0, 0, 1, 1, 2, 2, 3, 3, 4, 4, 5, 5, 6, 6, 7, 7, 8, 8, 9, 9, 10, 10, 11, 11, 12, 12, 13, 13, 14, 14];
const ORDER = [16, 17, 18, 0, 8, 7, 9, 6, 10, 5, 11, 4, 12, 3, 13, 2, 14, 1, 15];

/** A canonical Huffman table: counts per length and symbols in code order. */
function table(lengths) {
  const counts = new Uint16Array(16);
  for (const l of lengths) counts[l]++;
  counts[0] = 0;
  const offs = new Uint16Array(16);
  for (let i = 1; i < 16; i++) offs[i] = offs[i - 1] + counts[i - 1];
  const symbols = new Uint16Array(lengths.length);
  lengths.forEach((l, s) => {
    if (l) symbols[offs[l]++] = s;
  });
  return { counts, symbols };
}

/** Inflate a raw deflate (or Deflate64) stream into `size` bytes. */
export function inflate(input, size, deflate64 = true) {
  const out = Buffer.alloc(size);
  let o = 0;
  let pos = 0;
  let bit = 0;
  const bits = (n) => {
    let v = 0;
    for (let i = 0; i < n; i++) {
      v |= ((input[pos] >> bit) & 1) << i;
      if (++bit === 8) {
        bit = 0;
        pos++;
      }
    }
    return v >>> 0;
  };
  const decode = ({ counts, symbols }) => {
    let code = 0;
    let first = 0;
    let index = 0;
    for (let len = 1; len < 16; len++) {
      code |= bits(1);
      const count = counts[len];
      if (code - first < count) return symbols[index + code - first];
      index += count;
      first = (first + count) << 1;
      code <<= 1;
    }
    throw new Error("bad Huffman code");
  };
  const fixedLit = table([...Array(144).fill(8), ...Array(112).fill(9), ...Array(24).fill(7), ...Array(8).fill(8)]);
  const fixedDist = table(Array(32).fill(5));

  let final = 0;
  while (!final) {
    final = bits(1);
    const type = bits(2);
    if (type === 0) {
      if (bit) {
        bit = 0;
        pos++;
      }
      const len = input.readUInt16LE(pos);
      pos += 4;
      input.copy(out, o, pos, pos + len);
      pos += len;
      o += len;
      continue;
    }
    let lit = fixedLit;
    let dist = fixedDist;
    if (type === 2) {
      const hlit = bits(5) + 257;
      const hdist = bits(5) + 1;
      const hclen = bits(4) + 4;
      const cl = new Array(19).fill(0);
      for (let i = 0; i < hclen; i++) cl[ORDER[i]] = bits(3);
      const clt = table(cl);
      const lens = [];
      while (lens.length < hlit + hdist) {
        const s = decode(clt);
        if (s < 16) lens.push(s);
        else if (s === 16) {
          const prev = lens[lens.length - 1];
          for (let r = 3 + bits(2); r > 0; r--) lens.push(prev);
        } else if (s === 17) for (let r = 3 + bits(3); r > 0; r--) lens.push(0);
        else for (let r = 11 + bits(7); r > 0; r--) lens.push(0);
      }
      lit = table(lens.slice(0, hlit));
      dist = table(lens.slice(hlit));
    } else if (type === 3) throw new Error("bad block type");
    for (;;) {
      const s = decode(lit);
      if (s < 256) out[o++] = s;
      else if (s === 256) break;
      else {
        const i = s - 257;
        const len = i === 28 && deflate64 ? 3 + bits(16) : LEN_BASE[i] + bits(LEN_EXTRA[i]);
        const d = decode(dist);
        const back = DIST_BASE[d] + bits(DIST_EXTRA[d]);
        for (let k = 0; k < len; k++, o++) out[o] = out[o - back];
      }
    }
  }
  return out.subarray(0, o);
}
