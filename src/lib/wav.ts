// 16 kHz mono 16-bit WAV: every speech AI accepts it (browser WebM/Opus isn't
// officially supported by Gemini), and 75 s fit in one Vercel request.
export const WAV_RATE = 16000;

// Averages each block of input samples into one output sample.
export function downsample(input: Float32Array, fromRate: number, toRate = WAV_RATE): Float32Array {
  if (fromRate === toRate) return input.slice();
  const ratio = fromRate / toRate;
  const out = new Float32Array(Math.floor(input.length / ratio));
  for (let i = 0; i < out.length; i++) {
    const start = Math.floor(i * ratio), end = Math.min(input.length, Math.floor((i + 1) * ratio));
    let sum = 0;
    for (let j = start; j < end; j++) sum += input[j];
    out[i] = sum / Math.max(1, end - start);
  }
  return out;
}

export function encodeWav(chunks: Float32Array[], rate = WAV_RATE): Uint8Array {
  const n = chunks.reduce((a, c) => a + c.length, 0);
  const buf = new DataView(new ArrayBuffer(44 + n * 2));
  const str = (o: number, s: string) => { for (let i = 0; i < s.length; i++) buf.setUint8(o + i, s.charCodeAt(i)); };
  str(0, 'RIFF'); buf.setUint32(4, 36 + n * 2, true); str(8, 'WAVE');
  str(12, 'fmt '); buf.setUint32(16, 16, true); buf.setUint16(20, 1, true); buf.setUint16(22, 1, true);
  buf.setUint32(24, rate, true); buf.setUint32(28, rate * 2, true); buf.setUint16(32, 2, true); buf.setUint16(34, 16, true);
  str(36, 'data'); buf.setUint32(40, n * 2, true);
  let o = 44;
  for (const c of chunks) for (let i = 0; i < c.length; i++, o += 2) {
    const v = Math.max(-1, Math.min(1, c[i]));
    buf.setInt16(o, v < 0 ? v * 0x8000 : v * 0x7fff, true);
  }
  return new Uint8Array(buf.buffer);
}

// Joins several WAV pieces (same format) into one file: the backup download.
export function joinWavs(parts: Uint8Array[], rate = WAV_RATE): Uint8Array {
  const size = parts.reduce((a, p) => a + p.length - 44, 0);
  const out = new Uint8Array(44 + size);
  out.set(encodeWav([], rate));
  const v = new DataView(out.buffer);
  v.setUint32(4, 36 + size, true);
  v.setUint32(40, size, true);
  let o = 44;
  for (const p of parts) { out.set(p.subarray(44), o); o += p.length - 44; }
  return out;
}
