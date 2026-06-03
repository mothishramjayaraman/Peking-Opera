/**
 * 🎙️ Simple WAV Encoder for raw PCM data
 * Converts Float32Array audio samples into a 16-bit PCM .wav Blob
 */
export function encodeWAV(samples, sampleRate = 44100) {
  // Normalize so quiet mics still analyze correctly
  const normalized = normalizeAudio(samples);

  const buffer = new ArrayBuffer(44 + normalized.length * 2);
  const view = new DataView(buffer);

  /* RIFF identifier */
  writeString(view, 0, "RIFF");
  /* file length */
  view.setUint32(4, 36 + normalized.length * 2, true);
  /* RIFF type */
  writeString(view, 8, "WAVE");
  /* format chunk identifier */
  writeString(view, 12, "fmt ");
  /* format chunk length */
  view.setUint32(16, 16, true);
  /* sample format (raw) */
  view.setUint16(20, 1, true);
  /* channel count */
  view.setUint16(22, 1, true);
  /* sample rate */
  view.setUint32(24, sampleRate, true);
  /* byte rate (sample rate * block align) */
  view.setUint32(28, sampleRate * 2, true);
  /* block align (channel count * bytes per sample) */
  view.setUint16(32, 2, true);
  /* bits per sample */
  view.setUint16(34, 16, true);
  /* data chunk identifier */
  writeString(view, 36, "data");
  /* data chunk length */
  view.setUint32(40, normalized.length * 2, true);

  floatTo16BitPCM(view, 44, normalized);

  return new Blob([view], { type: "audio/wav" });
}

function writeString(view, offset, string) {
  for (let i = 0; i < string.length; i++) {
    view.setUint8(offset + i, string.charCodeAt(i));
  }
}

function floatTo16BitPCM(output, offset, input) {
  for (let i = 0; i < input.length; i++, offset += 2) {
    const s = Math.max(-1, Math.min(1, input[i]));
    output.setInt16(offset, s < 0 ? s * 0x8000 : s * 0x7fff, true);
  }
}

/**
 * Normalize audio to prevent clipping and ensure consistent amplitude
 * Uses peak normalization with headroom for safety
 */
function normalizeAudio(samples) {
  if (samples.length === 0) return samples;

  let peak = 0;
  for (let i = 0; i < samples.length; i++) {
    peak = Math.max(peak, Math.abs(samples[i])); // Find loudest point
  }

  if (peak === 0) return samples; // Silent

  const targetLevel = 0.95; // Leave headroom
  const scale = targetLevel / peak;

  const normalized = new Float32Array(samples.length);
  for (let i = 0; i < samples.length; i++) {
    normalized[i] = samples[i] * scale; // Scale all samples
  }

  return normalized;
}
